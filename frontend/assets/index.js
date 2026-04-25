const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const captureState = document.getElementById("captureState");

let latestImage = "";

// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((t) => (t.style.display = "none"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).style.display = "block";
  });
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
  } catch (error) {
    setStatus(statusEl, `Lỗi chụp ảnh: ${error.message}`, true);
  }
});

document.getElementById("btnFaceLogin").addEventListener("click", async () => {
  const username = document.getElementById("faceUsername").value.trim();

  if (!username) return setStatus(statusEl, "Nhập tên đăng nhập.", true);
  if (!latestImage) {
    return setStatus(
      statusEl,
      "Hãy chụp ảnh trước khi đăng nhập khuôn mặt.",
      true,
    );
  }

  try {
    const data = await apiRequest("/login-face.php", "POST", {
      username,
      image_base64: latestImage,
    });
    setStatus(statusEl, data.message || "Đăng nhập thành công.");
    const role = data.user?.role;
    window.location.href =
      role === "admin" ? "./admin.html" : "./dashboard.html";
  } catch (error) {
    setStatus(statusEl, error.message, true);
  }
});

document
  .getElementById("btnPasswordLogin")
  .addEventListener("click", async () => {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
      return setStatus(
        statusEl,
        "Nhập đầy đủ tên đăng nhập và mật khẩu.",
        true,
      );
    }

    try {
      const data = await apiRequest("/login-password.php", "POST", {
        username,
        password,
      });
      setStatus(statusEl, data.message || "Đăng nhập thành công.");
      const role = data.user?.role;
      window.location.href =
        role === "admin" ? "./admin.html" : "./dashboard.html";
    } catch (error) {
      setStatus(statusEl, error.message, true);
    }
  });
