const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const captureState = document.getElementById("captureState");
const frontInput = document.getElementById("regCccdFront");
const backInput = document.getElementById("regCccdBack");
const frontState = document.getElementById("frontState");
const backState = document.getElementById("backState");
const btnRegister = document.getElementById("btnRegister");
const cardPickFront = document.getElementById("cardPickFront");
const cardPickBack = document.getElementById("cardPickBack");
const frontCccdNumber = document.getElementById("frontCccdNumber");
const frontBirthDate = document.getElementById("frontBirthDate");
const backIssuedDate = document.getElementById("backIssuedDate");
const regFullName = document.getElementById("regFullName");

let latestImage = "";
let frontPreviewValid = false;
let backPreviewValid = false;

const FRONT_REQUIRED_FIELDS = ["cccd_number", "birth_date"];
const BACK_REQUIRED_FIELDS = ["issued_date"];

const FRONT_FIELD_ELEMENTS = {
  cccd_number: frontCccdNumber,
  birth_date: frontBirthDate,
};

const BACK_FIELD_ELEMENTS = {
  issued_date: backIssuedDate,
};

const ALLOWED_CCCD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function requestOcrSide(imageBase64, side) {
  try {
    const data = await apiRequest("/ocr-cccd", "POST", {
      image_base64: imageBase64,
      side,
    });
    return {
      ocr_available: Boolean(data?.ocr_available),
      fields: data?.fields || {},
      raw_text: String(data?.raw_text || ""),
      fallback_reason: "",
    };
  } catch (error) {
    return {
      ocr_available: false,
      fields: {},
      raw_text: "",
      fallback_reason: String(error?.message || "Unknown OCR error"),
    };
  }
}

function updateRegisterButtonState() {
  const hasFrontFile = Boolean(frontInput.files?.[0]);
  const hasBackFile = Boolean(backInput.files?.[0]);
  const ready =
    hasFrontFile &&
    hasBackFile &&
    frontPreviewValid &&
    backPreviewValid &&
    Boolean(latestImage);
  btnRegister.disabled = !ready;
}

function findMissingFields(fields, required) {
  return required.filter((key) => !String(fields?.[key] || "").trim());
}

function isValidDateDDMMYYYY(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return false;
  }
  const [dd, mm, yyyy] = value.split("/").map((x) => Number(x));
  const d = new Date(yyyy, mm - 1, dd);
  return (
    d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd
  );
}

function validateStrictCccdFields(frontFields, backFields) {
  const errors = [];
  const cccdNumber = String(frontFields?.cccd_number || "").trim();
  const birthDate = String(frontFields?.birth_date || "").trim();
  const issuedDate = String(backFields?.issued_date || "").trim();

  if (!/^\d{12}$/.test(cccdNumber)) {
    errors.push("cccd_number phải gồm đúng 12 chữ số");
  }
  if (!isValidDateDDMMYYYY(birthDate)) {
    errors.push("birth_date không đúng định dạng dd/mm/yyyy hợp lệ");
  }
  if (!isValidDateDDMMYYYY(issuedDate)) {
    errors.push("issued_date không đúng định dạng dd/mm/yyyy hợp lệ");
  }

  if (errors.length > 0) {
    throw new Error(`CCCD không đúng định dạng chuẩn. ${errors.join("; ")}`);
  }
}

async function validateCccdFormat(frontBase64, backBase64) {
  const front = await requestOcrSide(frontBase64, "front");
  const back = await requestOcrSide(backBase64, "back");

  const ocrUnavailable = !front.ocr_available || !back.ocr_available;

  if (ocrUnavailable) {
    throw new Error(
      "OCR CCCD chưa sẵn sàng. Hệ thống chỉ cho đăng ký khi đọc được Số CCCD, Ngày sinh và Ngày cấp từ ảnh.",
    );
  }

  const missingFront = findMissingFields(front.fields, FRONT_REQUIRED_FIELDS);
  const missingBack = findMissingFields(back.fields, BACK_REQUIRED_FIELDS);
  const missing = [...missingFront, ...missingBack];

  const strictErrors = [];
  if (missing.length > 0) {
    strictErrors.push(`Thiếu dữ liệu: ${missing.join(", ")}`);
  }

  try {
    validateStrictCccdFields(front.fields, back.fields);
  } catch (error) {
    strictErrors.push(error.message);
  }

  if (strictErrors.length > 0) {
    throw new Error(
      `CCCD chưa đọc chuẩn từ OCR (${strictErrors.join("; ")}). Vui lòng chọn ảnh rõ hơn hoặc chụp lại CCCD.`,
    );
  }

  return {
    mode: "ocr",
    cccd_number: String(front.fields?.cccd_number || "").trim(),
    message: "CCCD hợp lệ.",
  };
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Không đọc được file ảnh"));
    reader.readAsDataURL(file);
  });
}

function setReadonlyField(inputEl, value) {
  inputEl.value = String(value || "").trim();
}

function markMissingFields(fieldElements, missingFields) {
  Object.entries(fieldElements).forEach(([key, el]) => {
    if (!el) return;
    if (missingFields.includes(key)) {
      el.classList.add("ocr-missing");
    } else {
      el.classList.remove("ocr-missing");
    }
  });
}

function clearFrontPreview() {
  setReadonlyField(frontCccdNumber, "");
  setReadonlyField(frontBirthDate, "");
  if (regFullName) regFullName.value = "";
  frontPreviewValid = false;
  markMissingFields(FRONT_FIELD_ELEMENTS, FRONT_REQUIRED_FIELDS);
  updateRegisterButtonState();
}

function clearBackPreview() {
  setReadonlyField(backIssuedDate, "");
  backPreviewValid = false;
  markMissingFields(BACK_FIELD_ELEMENTS, BACK_REQUIRED_FIELDS);
  updateRegisterButtonState();
}

async function previewFrontOcr(file) {
  const imageBase64 = await fileToBase64(file);
  const data = await requestOcrSide(imageBase64, "front");
  const fields = data.fields || {};
  setReadonlyField(frontCccdNumber, fields.cccd_number);
  setReadonlyField(frontBirthDate, fields.birth_date);
  // Auto-fill full name if OCR read it; keep field editable so user can correct
  if (fields.full_name && regFullName) {
    regFullName.value = fields.full_name;
  }
  const missingFront = findMissingFields(fields, FRONT_REQUIRED_FIELDS);
  frontPreviewValid = missingFront.length === 0;
  markMissingFields(FRONT_FIELD_ELEMENTS, missingFront);
  updateRegisterButtonState();
  return data;
}

function openInputFilePicker(inputEl) {
  if (!inputEl) return;
  // Always reset first so selecting the same file still triggers `change`.
  inputEl.value = "";

  // Edge/Chromium can be stricter with programmatic file pickers.
  if (typeof inputEl.showPicker === "function") {
    try {
      inputEl.showPicker();
      return;
    } catch {
      // Fall through to click() fallback.
    }
  }

  try {
    inputEl.click();
    return;
  } catch {
    // Final fallback: temporarily ensure the element is focusable/interactive.
    const originalStyle = inputEl.getAttribute("style") || "";
    inputEl.style.position = "fixed";
    inputEl.style.left = "0";
    inputEl.style.top = "0";
    inputEl.style.width = "1px";
    inputEl.style.height = "1px";
    inputEl.style.opacity = "0";
    inputEl.style.pointerEvents = "none";
    try {
      inputEl.click();
    } finally {
      inputEl.setAttribute("style", originalStyle);
    }
  }
}

function bindNativeFileTrigger(triggerEl, inputEl) {
  if (!triggerEl || !inputEl) return;
  triggerEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openInputFilePicker(inputEl);
  });
}

function isSupportedCccdImage(file) {
  if (!file) return false;
  if (ALLOWED_CCCD_MIME_TYPES.has(String(file.type || "").toLowerCase())) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(String(file.name || ""));
}

bindNativeFileTrigger(cardPickFront, frontInput);
bindNativeFileTrigger(cardPickBack, backInput);

async function previewBackOcr(file) {
  const imageBase64 = await fileToBase64(file);
  const data = await requestOcrSide(imageBase64, "back");
  const fields = data.fields || {};
  setReadonlyField(backIssuedDate, fields.issued_date);
  const missingBack = findMissingFields(fields, BACK_REQUIRED_FIELDS);
  backPreviewValid = missingBack.length === 0;
  markMissingFields(BACK_FIELD_ELEMENTS, missingBack);
  updateRegisterButtonState();
  return data;
}

frontInput.addEventListener("change", async () => {
  const file = frontInput.files?.[0];
  frontState.textContent = file
    ? `Đã chọn: ${file.name}`
    : "Chưa chọn ảnh CCCD mặt trước.";

  if (!file) {
    clearFrontPreview();
    return;
  }

  if (!isSupportedCccdImage(file)) {
    frontInput.value = "";
    clearFrontPreview();
    frontState.textContent =
      "Định dạng ảnh không hỗ trợ. Vui lòng chọn JPG, PNG hoặc WEBP.";
    return;
  }

  try {
    frontState.textContent = `Đã chọn: ${file.name}. Đang đọc OCR...`;
    const frontOcr = await previewFrontOcr(file);
    if (!frontOcr.ocr_available) {
      clearFrontPreview();
      frontState.textContent =
        "Đã chọn ảnh mặt trước nhưng OCR chưa sẵn sàng. Hệ thống chưa thể tự đọc Số CCCD và Ngày sinh.";
      return;
    }
    frontState.textContent = frontPreviewValid
      ? `Đã chọn: ${file.name}. Dữ liệu hợp lệ.`
      : `Đã chọn: ${file.name}. Thiếu dữ liệu bắt buộc (Số CCCD/Ngày sinh).`;
  } catch (error) {
    clearFrontPreview();
    frontState.textContent = `Đã chọn: ${file.name}. OCR thất bại: ${error.message}`;
  }
});

backInput.addEventListener("change", async () => {
  const file = backInput.files?.[0];
  backState.textContent = file
    ? `Đã chọn: ${file.name}`
    : "Chưa chọn ảnh CCCD mặt sau.";

  if (!file) {
    clearBackPreview();
    return;
  }

  if (!isSupportedCccdImage(file)) {
    backInput.value = "";
    clearBackPreview();
    backState.textContent =
      "Định dạng ảnh không hỗ trợ. Vui lòng chọn JPG, PNG hoặc WEBP.";
    return;
  }

  try {
    backState.textContent = `Đã chọn: ${file.name}. Đang đọc OCR...`;
    const backOcr = await previewBackOcr(file);
    if (!backOcr.ocr_available) {
      clearBackPreview();
      backState.textContent =
        "Đã chọn ảnh mặt sau nhưng OCR chưa sẵn sàng. Hệ thống chưa thể tự đọc Ngày cấp.";
      return;
    }
    backState.textContent = backPreviewValid
      ? `Đã chọn: ${file.name}. Dữ liệu hợp lệ.`
      : `Đã chọn: ${file.name}. Thiếu dữ liệu bắt buộc (Ngày cấp).`;
  } catch (error) {
    clearBackPreview();
    backState.textContent = `Đã chọn: ${file.name}. OCR thất bại: ${error.message}`;
  }
});

document.getElementById("btnStartCam").addEventListener("click", async () => {
  try {
    await startWebcam(video);
    setStatus(statusEl, "Webcam đã sẵn sàng.");
  } catch (error) {
    setStatus(statusEl, `Không mở được webcam: ${error.message}`, true);
  }
});

document.getElementById("btnCapture").addEventListener("click", () => {
  try {
    latestImage = captureBase64(video, canvas);
    captureState.textContent = "Đã chụp ảnh ✓";
    setStatus(statusEl, "Ảnh đã được chụp.");
    updateRegisterButtonState();
  } catch (error) {
    setStatus(statusEl, `Lỗi chụp ảnh: ${error.message}`, true);
  }
});

btnRegister.addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const full_name = document.getElementById("regFullName").value.trim();
  const gender = document.getElementById("regGender").value || "Nam";
  const phone = document.getElementById("regPhone").value.trim();
  const email = document.getElementById("regEmail").value.trim() || username;
  const password = document.getElementById("regPassword").value;
  const cccdFrontFile = frontInput.files?.[0];
  const cccdBackFile = backInput.files?.[0];

  if (!username || !full_name || !password) {
    return setStatus(
      statusEl,
      "Vui lòng điền đủ tên đăng nhập, họ tên và mật khẩu.",
      true,
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
    return setStatus(statusEl, "Tên đăng nhập phải là email hợp lệ.", true);
  }
  if (!/^\d{9,11}$/.test(phone)) {
    return setStatus(statusEl, "Số điện thoại phải gồm 9-11 chữ số.", true);
  }
  if (password.length < 6) {
    return setStatus(statusEl, "Mật khẩu phải có ít nhất 6 ký tự.", true);
  }
  if (!cccdFrontFile || !cccdBackFile) {
    return setStatus(
      statusEl,
      "Vui lòng chọn đủ ảnh CCCD mặt trước và mặt sau.",
      true,
    );
  }
  if (!latestImage) {
    return setStatus(
      statusEl,
      "Hãy chụp ảnh khuôn mặt trước khi đăng ký.",
      true,
    );
  }

  try {
    btnRegister.disabled = true;
    setStatus(statusEl, "Đang xử lý ảnh CCCD và đăng ký...");
    const cccd_front_image = await fileToBase64(cccdFrontFile);
    const cccd_back_image = await fileToBase64(cccdBackFile);

    setStatus(statusEl, "Đang kiểm tra định dạng CCCD...");
    const cccdValidation = await validateCccdFormat(
      cccd_front_image,
      cccd_back_image,
    );

    const data = await apiRequest("/register.php", "POST", {
      username,
      full_name,
      gender,
      phone,
      email,
      password,
      image_base64: latestImage,
      cccd_front_image,
      cccd_back_image,
      cccd_number: cccdValidation.cccd_number,
      birth_date: String(frontBirthDate?.value || "").trim(),
      issued_date: String(backIssuedDate?.value || "").trim(),
    });
    const accountNumber = String(data.account_number || "").trim();
    const successMessage =
      data.message || "Đăng ký thành công. Vui lòng chờ admin duyệt.";
    setStatus(
      statusEl,
      accountNumber
        ? `${successMessage} Số tài khoản của bạn: ${accountNumber}.`
        : successMessage,
    );
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1800);
  } catch (error) {
    setStatus(statusEl, error.message, true);
  } finally {
    updateRegisterButtonState();
  }
});

clearFrontPreview();
clearBackPreview();
