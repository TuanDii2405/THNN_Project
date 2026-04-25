const statusEl = document.getElementById("status");
const navButtons = Array.from(document.querySelectorAll(".nav-item"));
const sections = Array.from(document.querySelectorAll(".bank-section"));
const welcomeSection = document.getElementById("dashboardWelcome");
const breadcrumbCurrent = document.getElementById("breadcrumbCurrent");

const sectionLabelMap = {
  account: "Quản lý tài khoản",
  transaction: "Giao dịch",
  notifications: "Thông báo hệ thống",
  stats: "Thống kê tiêu dùng",
};

let currentUser = null;
let latestFaceImage = "";
let latestFrontImage = "";
let latestBackImage = "";
let isBalanceVisible = false;
let currentBalance = 0;
let verifiedRecipientAccount = "";
let transferConfirmTimer = null;
let transferConfirmSecondsLeft = 0;
let pendingTransferPayload = null;
let transactionSyncTimer = null;

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "status error" : "status success";
  statusEl.style.display = "";
  clearTimeout(statusEl._timer);
  statusEl._timer = setTimeout(() => (statusEl.style.display = "none"), 4000);
}

function formatMoney(v) {
  return `${Math.max(0, Math.floor(Number(v) || 0)).toLocaleString("vi-VN")} VND`;
}

function localKey(suffix) {
  const userKey = (currentUser?.username || "guest").toLowerCase();
  return `fabank.${userKey}.${suffix}`;
}

function stopWebcamStream(videoEl) {
  const stream = videoEl.srcObject;
  if (stream && typeof stream.getTracks === "function") {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
  videoEl.srcObject = null;
}

function hideWebcam(videoEl) {
  stopWebcamStream(videoEl);
  videoEl.style.display = "none";
}

function hideAllSections() {
  sections.forEach((s) => (s.style.display = "none"));
}

function updateBreadcrumb(sectionName = "") {
  if (!breadcrumbCurrent) return;
  breadcrumbCurrent.textContent = sectionLabelMap[sectionName] || "Tổng quan";
}

function openSection(sectionName) {
  navButtons.forEach((b) =>
    b.classList.toggle("active", b.dataset.section === sectionName),
  );
  hideAllSections();
  const target = document.getElementById(`section-${sectionName}`);
  if (target) target.style.display = "";
  updateBreadcrumb(sectionName);
}

function initNavigation() {
  hideAllSections();
  if (welcomeSection) welcomeSection.style.display = "";
  updateBreadcrumb();
  navButtons.forEach((btn) => {
    btn.classList.remove("active");
    btn.addEventListener("click", () => openSection(btn.dataset.section));
  });
}

function inferInitialBalance() {
  const candidates = [
    currentUser?.balance,
    currentUser?.account_balance,
    currentUser?.wallet_balance,
    currentUser?.remaining_balance,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

function loadBalance() {
  const backendBalance = Number(currentUser?.balance);
  const fromStorage = Number(localStorage.getItem(localKey("balance")));
  currentBalance =
    Number.isFinite(backendBalance) && backendBalance >= 0
      ? Math.floor(backendBalance)
      : Number.isFinite(fromStorage) && fromStorage >= 0
        ? Math.floor(fromStorage)
        : inferInitialBalance();
  localStorage.setItem(localKey("balance"), String(currentBalance));
}

function saveBalance() {
  localStorage.setItem(localKey("balance"), String(currentBalance));
}

function refreshBalanceUI() {
  const balanceEl = document.getElementById("acctBalanceValue");
  const toggleBtn = document.getElementById("btnToggleBalance");
  balanceEl.textContent = isBalanceVisible
    ? formatMoney(currentBalance)
    : "********";
  toggleBtn.textContent = isBalanceVisible ? "Ẩn" : "Hiện";
  document.getElementById("statCurrentBalance").textContent =
    formatMoney(currentBalance);
}

function loadNotifications() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(localKey("notifications")) || "[]",
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotifications(list) {
  localStorage.setItem(localKey("notifications"), JSON.stringify(list));
}

function addNotification(type, title, message, amount = 0) {
  const list = loadNotifications();
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title,
    message,
    amount: Number(amount) || 0,
    created_at: new Date().toISOString(),
  });
  saveNotifications(list.slice(0, 80));
  renderNotifications();
}

function renderNotifications() {
  const list = loadNotifications();
  const ul = document.getElementById("notificationList");
  const empty = document.getElementById("notificationEmpty");
  ul.innerHTML = "";
  if (!list.length) {
    empty.style.display = "";
    return;
  }
  empty.style.display = "none";
  for (const item of list) {
    const li = document.createElement("li");
    li.className = `notification-item ${item.type || "system"}`;
    const time = new Date(item.created_at).toLocaleString("vi-VN");
    const amountType = item.type === "debit" ? "debit" : "credit";
    const amountLine = item.amount
      ? `<div class="notification-amount ${amountType}">${item.type === "debit" ? "-" : "+"}${formatMoney(Math.abs(item.amount))}</div>`
      : "";
    li.innerHTML = `
      <div class="notification-title">${item.title}</div>
      <div class="notification-message">${item.message}</div>
      ${amountLine}
      <div class="notification-time">${time}</div>
    `;
    ul.appendChild(li);
  }
}

function loadTransactions() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(localKey("transactions")) || "[]",
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransactions(list) {
  localStorage.setItem(localKey("transactions"), JSON.stringify(list));
}

function loadSeenServerTransactionIds() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(localKey("seen_server_transaction_ids")) || "[]",
    );
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveSeenServerTransactionIds(idSet) {
  const values = Array.from(idSet).slice(-800);
  localStorage.setItem(
    localKey("seen_server_transaction_ids"),
    JSON.stringify(values),
  );
}

async function syncTransactionsFromServer({ notifyNew = true } = {}) {
  try {
    const data = await apiRequest("/user/transactions.php?limit=120");
    const serverTxns = Array.isArray(data.transactions)
      ? data.transactions
      : [];
    const seenIds = loadSeenServerTransactionIds();
    const localTxns = loadTransactions();
    const localBySource = new Set(
      localTxns
        .map((txn) =>
          txn.source_id !== undefined ? String(txn.source_id) : "",
        )
        .filter(Boolean),
    );

    const ordered = [...serverTxns].reverse();
    for (const st of ordered) {
      const sourceId = String(st.id);
      if (!localBySource.has(sourceId)) {
        localTxns.unshift({
          id: `srv-${sourceId}`,
          source_id: sourceId,
          type: st.type === "credit" ? "credit" : "debit",
          amount: Math.max(0, Math.floor(Number(st.amount) || 0)),
          counterparty: st.counterparty || "—",
          note: st.note || "",
          created_at: st.created_at || new Date().toISOString(),
        });
        localBySource.add(sourceId);
      }

      if (!seenIds.has(sourceId)) {
        if (notifyNew) {
          const amount = Math.max(0, Math.floor(Number(st.amount) || 0));
          if (st.type === "credit") {
            addNotification(
              "credit",
              "Nhận tiền thành công",
              `Bạn vừa nhận ${formatMoney(amount)} từ ${st.counterparty_name || st.counterparty || "tài khoản khác"}.`,
              amount,
            );
          } else {
            addNotification(
              "debit",
              "Giao dịch trừ tiền",
              `Bạn đã chuyển ${formatMoney(amount)} đến ${st.counterparty_name || st.counterparty || "tài khoản khác"}.`,
              amount,
            );
          }
        }
        seenIds.add(sourceId);
      }
    }

    localTxns.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
    saveTransactions(localTxns.slice(0, 120));
    saveSeenServerTransactionIds(seenIds);

    if (Number.isFinite(Number(data.balance))) {
      currentBalance = Math.max(0, Math.floor(Number(data.balance)));
      saveBalance();
      refreshBalanceUI();
    }

    renderTransactions();
    renderStats();
  } catch {
    // Keep the UI usable even if sync temporarily fails.
  }
}

function startTransactionSyncLoop() {
  if (transactionSyncTimer) {
    clearInterval(transactionSyncTimer);
    transactionSyncTimer = null;
  }

  transactionSyncTimer = setInterval(() => {
    syncTransactionsFromServer({ notifyNew: true });
  }, 15000);
}

function renderTransactions() {
  const body = document.getElementById("txnHistoryBody");
  body.innerHTML = "";
  const txns = loadTransactions();
  if (!txns.length) {
    body.innerHTML =
      '<tr><td colspan="5" class="hint">Chưa có giao dịch nào.</td></tr>';
    return;
  }
  for (const txn of txns.slice(0, 25)) {
    const tr = document.createElement("tr");
    const amountType = txn.type === "debit" ? "debit" : "credit";
    tr.innerHTML = `
      <td>${new Date(txn.created_at).toLocaleString("vi-VN")}</td>
      <td>${txn.type === "debit" ? "Chuyển đi" : "Nhận tiền"}</td>
      <td>${txn.counterparty || "—"}</td>
      <td class="txn-amount ${amountType}">${txn.type === "debit" ? "-" : "+"}${formatMoney(txn.amount)}</td>
      <td>${txn.note || "—"}</td>
    `;
    body.appendChild(tr);
  }
}

function toDateInputValue(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear());
  return `${d}/${m}/${y}`;
}

function toDateKeyValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDisplayDateValue(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear());
  return `${d}/${m}/${y}`;
}

function parseDateInputValue(value) {
  const normalized = String(value || "").trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) return null;
  const [d, m, y] = normalized.split("/").map(Number);
  const parsed = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  return parsed;
}

function getDateRange(fromId, toId, label) {
  const fromValue = document.getElementById(fromId).value;
  const toValue = document.getElementById(toId).value;
  const fromDate = parseDateInputValue(fromValue);
  const toDate = parseDateInputValue(toValue);

  if (!fromDate || !toDate) {
    showStatus(`Vui lòng chọn đầy đủ từ ngày/đến ngày cho ${label}.`, true);
    return null;
  }
  if (fromDate > toDate) {
    showStatus(
      `Khoảng ngày của ${label} không hợp lệ (từ ngày > đến ngày).`,
      true,
    );
    return null;
  }

  const diffDays = Math.floor((toDate - fromDate) / 86400000) + 1;
  if (diffDays > 30) {
    showStatus(`Khoảng ngày của ${label} tối đa là 30 ngày.`, true);
    return null;
  }

  const start = new Date(fromDate);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
    startText: toDisplayDateValue(start),
    endText: toDisplayDateValue(end),
    dayCount: diffDays,
  };
}

function filterTransactionsByRange(txns, range) {
  return txns.filter((txn) => {
    const d = new Date(txn.created_at);
    if (Number.isNaN(d.getTime())) return false;
    return d >= range.start && d <= range.end;
  });
}

function renderDailyFlowChart(range, txns) {
  const bars = document.getElementById("statsByDay");
  const dayMap = {};

  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    const key = toDateKeyValue(cursor);
    dayMap[key] = { debit: 0, credit: 0 };
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const txn of txns) {
    const d = new Date(txn.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = toDateKeyValue(d);
    if (!Object.prototype.hasOwnProperty.call(dayMap, key)) continue;
    const amount = Math.max(0, Math.floor(Number(txn.amount) || 0));
    if (txn.type === "debit") dayMap[key].debit += amount;
    else dayMap[key].credit += amount;
  }

  const maxDay = Math.max(
    1,
    ...Object.values(dayMap).map((v) => Math.max(v.debit, v.credit)),
  );

  bars.innerHTML = "";
  for (const [key, item] of Object.entries(dayMap)) {
    const [y, m, d] = key.split("-");
    const debitPercent = Math.round((item.debit / maxDay) * 100);
    const creditPercent = Math.round((item.credit / maxDay) * 100);
    const row = document.createElement("div");
    row.className = "stats-bar-row";
    row.innerHTML = `
      <div class="stats-bar-label">${d}/${m}/${y}</div>
      <div class="stats-bar-track dual">
        <div class="stats-bar-fill credit" style="width:${creditPercent}%"></div>
        <div class="stats-bar-fill debit" style="width:${debitPercent}%"></div>
      </div>
      <div class="stats-bar-value">Thu ${formatMoney(item.credit)} | Chi ${formatMoney(item.debit)}</div>
    `;
    bars.appendChild(row);
  }
}

function renderSpendingStats() {
  const range = getDateRange(
    "spendFromDate",
    "spendToDate",
    "thống kê chi tiêu",
  );
  if (!range) return false;

  const txns = filterTransactionsByRange(loadTransactions(), range);
  const totalSpend = txns
    .filter((t) => t.type === "debit")
    .reduce(
      (sum, t) => sum + Math.max(0, Math.floor(Number(t.amount) || 0)),
      0,
    );
  const totalReceived = txns
    .filter((t) => t.type === "credit")
    .reduce(
      (sum, t) => sum + Math.max(0, Math.floor(Number(t.amount) || 0)),
      0,
    );
  const largestDebit = txns
    .filter((t) => t.type === "debit")
    .reduce(
      (max, t) => Math.max(max, Math.max(0, Math.floor(Number(t.amount) || 0))),
      0,
    );

  document.getElementById("statMonthlySpend").textContent =
    formatMoney(totalSpend);
  document.getElementById("statTotalReceived").textContent =
    formatMoney(totalReceived);
  document.getElementById("statTxnCount").textContent = String(txns.length);
  document.getElementById("statLargestDebit").textContent =
    formatMoney(largestDebit);
  document.getElementById("spendRangeHint").textContent =
    `Khoảng thống kê: ${range.startText} đến ${range.endText} (${range.dayCount} ngày).`;

  renderDailyFlowChart(range, txns);
  return true;
}

function renderAccountStats() {
  const range = getDateRange(
    "accountFromDate",
    "accountToDate",
    "thống kê tài khoản",
  );
  if (!range) return false;

  const txns = filterTransactionsByRange(loadTransactions(), range);
  const totalIncome = txns
    .filter((t) => t.type === "credit")
    .reduce(
      (sum, t) => sum + Math.max(0, Math.floor(Number(t.amount) || 0)),
      0,
    );
  const totalExpense = txns
    .filter((t) => t.type === "debit")
    .reduce(
      (sum, t) => sum + Math.max(0, Math.floor(Number(t.amount) || 0)),
      0,
    );
  const profit = totalIncome - totalExpense;

  document.getElementById("statAccountIncome").textContent =
    formatMoney(totalIncome);
  document.getElementById("statAccountExpense").textContent =
    formatMoney(totalExpense);
  document.getElementById("statAccountProfit").textContent =
    `${profit < 0 ? "-" : ""}${formatMoney(Math.abs(profit))}`;
  document.getElementById("accountRangeHint").textContent =
    `Khoảng thống kê: ${range.startText} đến ${range.endText} (${range.dayCount} ngày).`;
  document.getElementById("statCurrentBalance").textContent =
    formatMoney(currentBalance);

  return true;
}

function initializeStatsDateFilters() {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 6);

  const startValue = toDateInputValue(defaultStart);
  const endValue = toDateInputValue(today);

  document.getElementById("spendFromDate").value = startValue;
  document.getElementById("spendToDate").value = endValue;
  document.getElementById("accountFromDate").value = startValue;
  document.getElementById("accountToDate").value = endValue;
}

function renderStats() {
  const spendOk = renderSpendingStats();
  const accountOk = renderAccountStats();
  return spendOk && accountOk;
}

function resetTransferVerification({ keepAccount = true } = {}) {
  const accountInput = document.getElementById("txnTargetAccount");
  const recipientInput = document.getElementById("txnRecipientName");
  const details = document.getElementById("txnDetailsGroup");
  const amountInput = document.getElementById("txnAmount");
  const noteInput = document.getElementById("txnNote");

  verifiedRecipientAccount = "";
  recipientInput.value = "Chưa xác nhận STK";
  details.classList.remove("visible");
  amountInput.value = "";
  noteInput.value = "";
  if (!keepAccount) {
    accountInput.value = "";
  }
}

async function verifyTransferRecipient() {
  const accountInput = document.getElementById("txnTargetAccount");
  const recipientInput = document.getElementById("txnRecipientName");
  const details = document.getElementById("txnDetailsGroup");
  const account = accountInput.value.trim();

  if (!/^\d{10,20}$/.test(account)) {
    resetTransferVerification({ keepAccount: true });
    showStatus("Số tài khoản nhận phải gồm 10-20 chữ số.", true);
    return;
  }

  try {
    const data = await apiRequest("/user/transfer-recipient.php", "POST", {
      target_account_number: account,
    });
    verifiedRecipientAccount = account;
    recipientInput.value = data.receiver_name || "Không có tên";
    details.classList.add("visible");
    showStatus("Đã xác nhận người nhận. Vui lòng nhập số tiền và nội dung.");
  } catch (error) {
    resetTransferVerification({ keepAccount: true });
    showStatus(error.message, true);
  }
}

function closeTransferConfirmModal() {
  const modal = document.getElementById("transferConfirmModal");
  const confirmBtn = document.getElementById("btnConfirmTransferExec");
  modal.classList.remove("visible");
  modal.setAttribute("aria-hidden", "true");
  if (transferConfirmTimer) {
    clearInterval(transferConfirmTimer);
    transferConfirmTimer = null;
  }
  transferConfirmSecondsLeft = 0;
  pendingTransferPayload = null;
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Xác nhận (3s)";
}

function openTransferConfirmModal(payload) {
  const modal = document.getElementById("transferConfirmModal");
  const confirmBtn = document.getElementById("btnConfirmTransferExec");
  const receiverNameEl = document.getElementById("confirmReceiverName");
  const receiverAccountEl = document.getElementById("confirmReceiverAccount");
  const amountEl = document.getElementById("confirmTransferAmount");
  const noteEl = document.getElementById("confirmTransferNote");

  pendingTransferPayload = payload;
  receiverNameEl.textContent = payload.receiverName || "Không có tên";
  receiverAccountEl.textContent = payload.account;
  amountEl.textContent = formatMoney(payload.amount);
  noteEl.textContent = payload.note || "Không có nội dung";

  modal.classList.add("visible");
  modal.setAttribute("aria-hidden", "false");

  if (transferConfirmTimer) {
    clearInterval(transferConfirmTimer);
    transferConfirmTimer = null;
  }

  transferConfirmSecondsLeft = 3;
  confirmBtn.disabled = true;
  confirmBtn.textContent = `Xác nhận (${transferConfirmSecondsLeft}s)`;

  transferConfirmTimer = setInterval(() => {
    transferConfirmSecondsLeft -= 1;
    if (transferConfirmSecondsLeft <= 0) {
      clearInterval(transferConfirmTimer);
      transferConfirmTimer = null;
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Xác nhận chuyển tiền";
      return;
    }
    confirmBtn.textContent = `Xác nhận (${transferConfirmSecondsLeft}s)`;
  }, 1000);
}

async function executeTransfer(payload) {
  try {
    const data = await apiRequest("/user/transfer.php", "POST", {
      target_account_number: payload.account,
      amount: payload.amount,
      note: payload.note,
    });

    currentBalance = Math.max(0, Math.floor(Number(data.sender_balance) || 0));
    saveBalance();
    refreshBalanceUI();

    const txns = loadTransactions();
    txns.unshift({
      id: data.transaction_id
        ? `srv-${String(data.transaction_id)}`
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      source_id:
        data.transaction_id !== undefined && data.transaction_id !== null
          ? String(data.transaction_id)
          : "",
      type: "debit",
      amount: payload.amount,
      counterparty: data.receiver_account_number || payload.account,
      note: payload.note,
      created_at: new Date().toISOString(),
    });
    saveTransactions(txns.slice(0, 120));

    if (data.transaction_id !== undefined && data.transaction_id !== null) {
      const seenIds = loadSeenServerTransactionIds();
      seenIds.add(String(data.transaction_id));
      saveSeenServerTransactionIds(seenIds);
    }

    addNotification(
      "debit",
      "Giao dịch trừ tiền",
      `Bạn đã chuyển ${formatMoney(payload.amount)} đến tài khoản ${data.receiver_account_number || payload.account}.`,
      payload.amount,
    );

    renderTransactions();
    renderStats();
    showStatus(data.message || "Chuyển tiền nội địa thành công.");

    resetTransferVerification({ keepAccount: false });
    return true;
  } catch (error) {
    showStatus(error.message, true);
    return false;
  }
}

async function loadKyc() {
  try {
    const data = await apiRequest("/user/kyc.php");
    const k = data.kyc || {};
    document.getElementById("kycName").textContent =
      k.full_name || currentUser.full_name || "—";
    document.getElementById("kycCccdDisplay").textContent =
      `CCCD: ${k.cccd_number || "—"}`;
    document.getElementById("kycPhoneDisplay").textContent =
      `SĐT: ${k.phone || "—"}`;

    const filled = [k.full_name, k.phone, k.cccd_number, k.birth_date].filter(
      Boolean,
    ).length;
    const badge = document.getElementById("kycStatusBadge");
    if (filled >= 3) {
      badge.textContent = "Đã xác minh";
      badge.style.background = "#c6f0df";
      badge.style.color = "#0d5c36";
    } else {
      badge.textContent = "Chưa xác minh";
      badge.style.background = "#f8e4d4";
      badge.style.color = "#8a3010";
    }
    return k;
  } catch (e) {
    showStatus(e.message, true);
    return {};
  }
}

document.getElementById("btnEditKyc").addEventListener("click", async () => {
  const k = await loadKyc();
  document.getElementById("kycFullName").value =
    k.full_name || currentUser.full_name || "";
  document.getElementById("kycPhone").value = k.phone || "";
  document.getElementById("kycBirthDate").value = k.birth_date || "";
  document.getElementById("kycGender").value = k.gender || "";
  document.getElementById("kycCccdNumber").value = k.cccd_number || "";
  document.getElementById("kycHometown").value = k.hometown || "";
  document.getElementById("kycResidence").value = k.residence || "";
  document.getElementById("kycValidUntil").value = k.valid_until || "";
  document.getElementById("kycIssuedDate").value = k.issued_date || "";
  document.getElementById("kycIssuedPlace").value = k.issued_place || "";
  document.getElementById("kycForm").style.display = "";
});

document.getElementById("btnCancelKyc").addEventListener("click", () => {
  document.getElementById("kycForm").style.display = "none";
});

document.getElementById("btnSaveKyc").addEventListener("click", async () => {
  const payload = {
    full_name: document.getElementById("kycFullName").value.trim(),
    phone: document.getElementById("kycPhone").value.trim(),
    birth_date: document.getElementById("kycBirthDate").value.trim(),
    gender: document.getElementById("kycGender").value,
    cccd_number: document.getElementById("kycCccdNumber").value.trim(),
    hometown: document.getElementById("kycHometown").value.trim(),
    residence: document.getElementById("kycResidence").value.trim(),
    valid_until: document.getElementById("kycValidUntil").value.trim(),
    issued_date: document.getElementById("kycIssuedDate").value.trim(),
    issued_place: document.getElementById("kycIssuedPlace").value.trim(),
  };
  try {
    const data = await apiRequest("/user/kyc.php", "POST", payload);
    showStatus(data.message || "Đã lưu thông tin.");
    document.getElementById("kycForm").style.display = "none";
    await loadKyc();
    addNotification(
      "system",
      "Cập nhật hồ sơ",
      "Thông tin quản lý tài khoản đã được cập nhật.",
    );
  } catch (e) {
    showStatus(e.message, true);
  }
});

function setupCccdCam(
  btnStartId,
  btnCaptureId,
  videoId,
  canvasId,
  stateId,
  btnOcrId,
  ocrSide,
  fieldMap,
) {
  const video = document.getElementById(videoId);
  const canvas = document.getElementById(canvasId);
  const state = document.getElementById(stateId);

  document.getElementById(btnStartId).addEventListener("click", async () => {
    try {
      hideWebcam(video);
      await startWebcam(video);
      video.style.display = "";
      state.textContent = "Camera đã sẵn sàng.";
    } catch (e) {
      showStatus(`Không mở được camera: ${e.message}`, true);
    }
  });

  document.getElementById(btnCaptureId).addEventListener("click", () => {
    try {
      const img = captureBase64(video, canvas);
      if (ocrSide === "front") latestFrontImage = img;
      else latestBackImage = img;
      hideWebcam(video);
      state.textContent = "Đã chụp ảnh.";
    } catch (e) {
      showStatus(`Lỗi chụp ảnh: ${e.message}`, true);
    }
  });

  document.getElementById(btnOcrId).addEventListener("click", async () => {
    const img = ocrSide === "front" ? latestFrontImage : latestBackImage;
    if (!img) return showStatus("Hãy chụp ảnh CCCD trước.", true);
    try {
      state.textContent = "Đang nhận diện OCR...";
      const data = await apiRequest("/ocr-cccd", "POST", {
        image_base64: img,
        side: ocrSide,
      });
      if (!data.ocr_available) {
        showStatus(
          "OCR chưa được cấu hình. Vui lòng điền thông tin thủ công.",
          true,
        );
        state.textContent = "OCR không khả dụng.";
        return;
      }
      const fields = data.fields || {};
      for (const [fieldId, key] of Object.entries(fieldMap)) {
        if (fields[key]) document.getElementById(fieldId).value = fields[key];
      }
      state.textContent = "Nhận diện thành công.";
      showStatus(
        "OCR thành công, vui lòng kiểm tra lại dữ liệu trước khi lưu.",
      );
    } catch (e) {
      showStatus(e.message, true);
      state.textContent = "Nhận diện thất bại.";
    }
  });
}

setupCccdCam(
  "btnStartCamFront",
  "btnCaptureFront",
  "videoFront",
  "canvasFront",
  "frontCaptureState",
  "btnOcrFront",
  "front",
  {
    kycCccdNumber: "cccd_number",
    kycBirthDate: "birth_date",
    kycGender: "gender",
    kycHometown: "hometown",
    kycResidence: "residence",
    kycValidUntil: "valid_until",
  },
);

setupCccdCam(
  "btnStartCamBack",
  "btnCaptureBack",
  "videoBack",
  "canvasBack",
  "backCaptureState",
  "btnOcrBack",
  "back",
  {
    kycIssuedDate: "issued_date",
    kycIssuedPlace: "issued_place",
  },
);

const videoFace = document.getElementById("videoFace");
const canvasFace = document.getElementById("canvasFace");

document
  .getElementById("btnStartCamFace")
  .addEventListener("click", async () => {
    try {
      hideWebcam(videoFace);
      await startWebcam(videoFace);
      videoFace.style.display = "";
      showStatus("Webcam đã sẵn sàng.");
    } catch (e) {
      showStatus(e.message, true);
    }
  });

document.getElementById("btnCaptureFace").addEventListener("click", () => {
  try {
    latestFaceImage = captureBase64(videoFace, canvasFace);
    hideWebcam(videoFace);
    document.getElementById("faceCaptureState").textContent = "Đã chụp ảnh.";
    showStatus("Ảnh đã được chụp.");
  } catch (e) {
    showStatus(e.message, true);
  }
});

document.getElementById("btnUpdateFace").addEventListener("click", async () => {
  if (!latestFaceImage) return showStatus("Hãy chụp ảnh trước.", true);
  try {
    const data = await apiRequest("/user/update-face.php", "POST", {
      image_base64: latestFaceImage,
    });
    showStatus(data.message || "Đã thay đổi khuôn mặt.");
    document.getElementById("secFace").textContent = "Đã thay đổi khuôn mặt";
    document.getElementById("faceCaptureState").textContent =
      "Đã thay đổi khuôn mặt";
    addNotification(
      "system",
      "Xác thực khuôn mặt",
      "Dữ liệu khuôn mặt đã được cập nhật.",
    );
  } catch (e) {
    showStatus(e.message, true);
  }
});

document
  .getElementById("btnChangePassword")
  .addEventListener("click", async () => {
    const current_password = document.getElementById("currentPassword").value;
    const new_password = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;
    if (!current_password || !new_password)
      return showStatus("Vui lòng điền đầy đủ.", true);
    if (new_password !== confirm)
      return showStatus("Mật khẩu mới không khớp.", true);
    try {
      const data = await apiRequest("/user/change-password.php", "POST", {
        current_password,
        new_password,
      });
      showStatus(data.message || "Đổi mật khẩu thành công.");
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
      addNotification(
        "system",
        "Đổi mật khẩu",
        "Mật khẩu tài khoản đã được thay đổi.",
      );
    } catch (e) {
      showStatus(e.message, true);
    }
  });

document.getElementById("btnTransfer").addEventListener("click", async () => {
  const account = document.getElementById("txnTargetAccount").value.trim();
  const amount = Math.floor(Number(document.getElementById("txnAmount").value));
  const note = document.getElementById("txnNote").value.trim();
  const receiverName = document.getElementById("txnRecipientName").value.trim();

  if (!verifiedRecipientAccount || account !== verifiedRecipientAccount) {
    return showStatus(
      "Vui lòng nhập STK và nhấn OK để xác nhận người nhận trước khi chuyển tiền.",
      true,
    );
  }

  if (!/^\d{10,20}$/.test(account)) {
    return showStatus("Số tài khoản nhận phải gồm 10-20 chữ số.", true);
  }
  if (!Number.isFinite(amount) || amount < 1000) {
    return showStatus("Số tiền tối thiểu là 1.000 VND.", true);
  }

  openTransferConfirmModal({
    account,
    amount,
    note,
    receiverName,
  });
});

document
  .getElementById("btnCancelTransferConfirm")
  .addEventListener("click", closeTransferConfirmModal);

document
  .getElementById("btnConfirmTransferExec")
  .addEventListener("click", async () => {
    if (!pendingTransferPayload) return;
    const confirmBtn = document.getElementById("btnConfirmTransferExec");
    confirmBtn.disabled = true;
    const success = await executeTransfer(pendingTransferPayload);
    if (success) {
      closeTransferConfirmModal();
      return;
    }
    if (!transferConfirmTimer) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Xác nhận chuyển tiền";
    }
  });

document
  .querySelector('[data-close-transfer-modal="true"]')
  .addEventListener("click", closeTransferConfirmModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const modal = document.getElementById("transferConfirmModal");
    if (modal.classList.contains("visible")) {
      closeTransferConfirmModal();
    }
  }
});

document
  .getElementById("btnResolveRecipient")
  .addEventListener("click", verifyTransferRecipient);

document.getElementById("txnTargetAccount").addEventListener("input", () => {
  const account = document.getElementById("txnTargetAccount").value.trim();
  if (account !== verifiedRecipientAccount) {
    resetTransferVerification({ keepAccount: true });
  }
});

document
  .getElementById("txnTargetAccount")
  .addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      verifyTransferRecipient();
    }
  });

document.getElementById("btnToggleBalance").addEventListener("click", () => {
  isBalanceVisible = !isBalanceVisible;
  refreshBalanceUI();
});

document.getElementById("btnApplySpendRange").addEventListener("click", () => {
  renderSpendingStats();
});

document
  .getElementById("btnApplyAccountRange")
  .addEventListener("click", () => {
    renderAccountStats();
  });

document.getElementById("btnLogout").addEventListener("click", async () => {
  try {
    await apiRequest("/logout.php", "POST", {});
    window.location.href = "./index.html";
  } catch (e) {
    showStatus(e.message, true);
  }
});

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  document.getElementById("mainContent").style.display = "";
  document.getElementById("navUsername").textContent =
    currentUser.full_name || currentUser.username;

  document.getElementById("secStatus").textContent = currentUser.is_locked
    ? "Bị khóa"
    : "Đang hoạt động";
  document.getElementById("secFace").textContent = currentUser.has_face_data
    ? "Đã đăng ký"
    : "Chưa đăng ký";
  document.getElementById("secCreated").textContent =
    (currentUser.created_at || "").slice(0, 10) || "—";
  document.getElementById("secUsername").textContent =
    currentUser.username || "—";

  document.getElementById("accountNumberDisplay").textContent =
    `STK: ${currentUser.account_number || "—"}`;
  document.getElementById("txnMyAccountNumber").textContent =
    currentUser.account_number || "—";

  initNavigation();
  loadBalance();
  refreshBalanceUI();
  initializeStatsDateFilters();
  await loadKyc();
  renderTransactions();
  renderNotifications();
  renderStats();
  await syncTransactionsFromServer({ notifyNew: false });
  startTransactionSyncLoop();
  resetTransferVerification({ keepAccount: true });
}

init();
