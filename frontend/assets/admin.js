const usersBody = document.getElementById("usersBody");
const statusEl = document.getElementById("status");
const deletedProfilesEl = document.getElementById("deletedProfiles");

function esc(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function imagePreviewHtml(label, src) {
  if (!src) {
    return `<div class="deleted-image-card"><div class="deleted-image-label">${esc(label)}</div><div class="deleted-image-empty">Không có ảnh</div></div>`;
  }
  return `<div class="deleted-image-card"><div class="deleted-image-label">${esc(label)}</div><img class="deleted-image" src="${esc(src)}" alt="${esc(label)}" loading="lazy" /></div>`;
}

async function loadUsers() {
  try {
    const data = await apiRequest("/admin/users.php");
    usersBody.innerHTML = "";

    data.users.forEach((u) => {
      const approval = u.approval_status || "approved";
      const approvalBadgeClass =
        approval === "approved"
          ? "badge-approval approved"
          : approval === "rejected"
            ? "badge-approval rejected"
            : "badge-approval pending";

      const approvalActions =
        u.role === "user"
          ? `
          <button data-action="approve" data-id="${u.id}" class="secondary">Duyệt</button>
          <button data-action="reject" data-id="${u.id}" class="danger">Từ chối</button>
        `
          : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td><span class="badge">${u.role}</span></td>
        <td><span class="${approvalBadgeClass}">${approval}</span></td>
        <td>${u.has_face_data ? "Yes" : "No"}</td>
        <td>${u.is_locked == 1 ? "Locked" : "Active"}</td>
        <td class="row">
          ${approvalActions}
          <button data-action="reset-face" data-id="${u.id}" class="secondary">Reset Face</button>
          <button data-action="toggle-lock" data-id="${u.id}" data-lock="${u.is_locked == 1 ? 0 : 1}" class="danger">${u.is_locked == 1 ? "Unlock" : "Lock"}</button>
          <button data-action="delete" data-id="${u.id}" class="danger">Delete</button>
        </td>
      `;
      usersBody.appendChild(tr);
    });

    setStatus(statusEl, `Đã tải ${data.users.length} user.`);
  } catch (error) {
    setStatus(statusEl, error.message, true);
  }
}

async function loadDeletedUsers() {
  if (!deletedProfilesEl) return;

  try {
    const data = await apiRequest("/admin/deleted-users.php");
    const items = Array.isArray(data.deleted_users) ? data.deleted_users : [];

    if (items.length === 0) {
      deletedProfilesEl.innerHTML =
        '<div class="hint">Chưa có hồ sơ đã xóa.</div>';
      return;
    }

    deletedProfilesEl.innerHTML = items
      .map((item) => {
        const p = item.profile || {};
        return `
          <article class="deleted-profile-card">
            <div class="deleted-profile-head">
              <strong>${esc(p.full_name || item.username || "(không rõ tên)")}</strong>
              <span class="badge">ID gốc: ${esc(item.original_user_id)}</span>
            </div>
            <div class="deleted-profile-meta">
              <div><b>Username:</b> ${esc(item.username)}</div>
              <div><b>CCCD:</b> ${esc(p.cccd_number || "")}</div>
              <div><b>Email:</b> ${esc(p.email || "")}</div>
              <div><b>Xóa lúc:</b> ${esc(item.deleted_at)}</div>
              <div><b>Xóa bởi admin ID:</b> ${esc(item.deleted_by)}</div>
            </div>
            <div class="deleted-image-grid">
              ${imagePreviewHtml("Ảnh khuôn mặt", p.face_image_path)}
              ${imagePreviewHtml("CCCD mặt trước", p.cccd_front_image_path)}
              ${imagePreviewHtml("CCCD mặt sau", p.cccd_back_image_path)}
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    deletedProfilesEl.innerHTML = `<div class="status error">${esc(error.message)}</div>`;
  }
}

async function loadAllAdminData() {
  await loadUsers();
  await loadDeletedUsers();
}

document.getElementById("btnCreateUser").addEventListener("click", async () => {
  const username = document.getElementById("newUsername").value.trim();
  const full_name = document.getElementById("newFullName").value.trim();
  const password = document.getElementById("newPassword").value;
  const role = document.getElementById("newRole").value;

  try {
    await apiRequest("/admin/users.php", "POST", {
      username,
      full_name,
      password,
      role,
    });
    setStatus(statusEl, "Tạo user thành công.");
    await loadAllAdminData();
  } catch (error) {
    setStatus(statusEl, error.message, true);
  }
});

usersBody.addEventListener("click", async (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const userId = Number(btn.dataset.id);

  try {
    if (action === "reset-face") {
      await apiRequest("/admin/reset-face.php", "POST", { user_id: userId });
      setStatus(statusEl, "Đã reset face data.");
    } else if (action === "approve") {
      await apiRequest("/admin/users.php", "PUT", {
        id: userId,
        approval_status: "approved",
      });
      setStatus(statusEl, "Đã duyệt tài khoản.");
    } else if (action === "reject") {
      await apiRequest("/admin/users.php", "PUT", {
        id: userId,
        approval_status: "rejected",
      });
      setStatus(statusEl, "Đã từ chối tài khoản.");
    } else if (action === "toggle-lock") {
      await apiRequest("/admin/toggle-lock.php", "POST", {
        user_id: userId,
        is_locked: Number(btn.dataset.lock) === 1,
      });
      setStatus(statusEl, "Đã cập nhật trạng thái khóa.");
    } else if (action === "delete") {
      await apiRequest("/admin/users.php", "DELETE", { id: userId });
      setStatus(statusEl, "Đã xóa tài khoản.");
    }

    await loadAllAdminData();
  } catch (error) {
    setStatus(statusEl, error.message, true);
  }
});

document
  .getElementById("btnReload")
  .addEventListener("click", loadAllAdminData);

document.getElementById("btnLogout").addEventListener("click", async () => {
  try {
    await apiRequest("/logout.php", "POST", {});
    window.location.href = "./index.html";
  } catch (error) {
    setStatus(statusEl, error.message, true);
  }
});

async function init() {
  const user = await requireAuth("admin");
  if (!user) return;
  const adminInfo = document.getElementById("adminInfo");
  if (adminInfo)
    adminInfo.textContent = `Đang đăng nhập: ${user.full_name || user.username}`;
  document.getElementById("mainContent").style.display = "";
  await loadAllAdminData();
}

init();
