const API = window.APP_CONFIG.PHP_API_BASE;

async function apiRequest(path, method = "GET", body = null) {
  const options = {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API}${path}`, options);
  let data;
  try {
    data = await response.json();
  } catch {
    const text = await response.text().catch(() => "");
    const preview = String(text || "")
      .trim()
      .slice(0, 180);
    const detail = preview
      ? `Non-JSON response: ${preview}`
      : "Non-JSON response";
    data = {
      ok: false,
      message: `${detail} (HTTP ${response.status})`,
    };
  }
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

function setStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.className = isError ? "status error" : "status success";
}

async function startWebcam(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

function captureBase64(videoEl, canvasEl) {
  const width = videoEl.videoWidth || 640;
  const height = videoEl.videoHeight || 480;
  canvasEl.width = width;
  canvasEl.height = height;
  const ctx = canvasEl.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, width, height);
  return canvasEl.toDataURL("image/jpeg", 0.92);
}

/**
 * Kiểm tra phiên đăng nhập. Nếu chưa đăng nhập → về trang login.
 * Nếu requiredRole được truyền vào mà role không khớp → về trang phù hợp.
 * Trả về object user nếu hợp lệ, null nếu đã redirect.
 */
async function requireAuth(requiredRole = null) {
  try {
    const data = await apiRequest("/user/profile.php");
    const user = data.user;
    if (requiredRole && user.role !== requiredRole) {
      window.location.replace(
        user.role === "admin" ? "./admin.html" : "./dashboard.html",
      );
      return null;
    }
    return user;
  } catch (e) {
    window.location.replace("./index.html");
    return null;
  }
}
