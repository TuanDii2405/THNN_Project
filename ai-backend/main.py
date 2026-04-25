from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request as UrlRequest
from urllib.request import urlopen

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

try:
    import face_recognition
except Exception:
    face_recognition = None

try:
    from google.cloud import vision  # type: ignore
except Exception:
    vision = None

try:
    import easyocr as _easyocr_mod  # type: ignore
    _ocr_reader: Any = None

    def _get_ocr_reader() -> Any:
        global _ocr_reader
        if _ocr_reader is None:
            _ocr_reader = _easyocr_mod.Reader(["vi", "en"], gpu=False, verbose=False)
        return _ocr_reader

    EASYOCR_AVAILABLE = True
except Exception:
    EASYOCR_AVAILABLE = False

    def _get_ocr_reader() -> Any:  # type: ignore[misc]
        return None


BASE_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = BASE_DIR / "frontend"
DB_FILE = BASE_DIR / "app.sqlite3"
UPLOADS_DIR = BASE_DIR / "uploads"
SESSION_SECRET = os.getenv("APP_SESSION_SECRET", "face-auth-dev-secret")
GOOGLE_APPS_SCRIPT_URL = os.getenv("GOOGLE_APPS_SCRIPT_URL", "").strip()
GOOGLE_APPS_SCRIPT_TIMEOUT = float(os.getenv("GOOGLE_APPS_SCRIPT_TIMEOUT", "12"))
INITIAL_ACCOUNT_BALANCE = 500_000
CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"

app = FastAPI(title="Face Auth Unified Server", version="2.0.0")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")


class ImagePayload(BaseModel):
    image_base64: str = Field(..., min_length=16)


class VerifyPayload(BaseModel):
    image_base64: str = Field(..., min_length=16)
    stored_encoding: List[float]
    threshold: float = 0.45


class LivenessPayload(BaseModel):
    image_base64: str = Field(..., min_length=16)
    require_smile: bool = True


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


# StaticFiles checks directory existence at mount time (module import),
# so ensure upload folders exist before app.mount(...).
ensure_dir(UPLOADS_DIR)
ensure_dir(UPLOADS_DIR / "registrations")


def infer_image_extension(image_base64: str) -> str:
    m = re.match(r"^data:image/([a-zA-Z0-9.+-]+);base64,", image_base64)
    if not m:
        return "jpg"
    subtype = m.group(1).lower()
    if subtype in {"jpeg", "jpg"}:
        return "jpg"
    if subtype == "png":
        return "png"
    if subtype == "webp":
        return "webp"
    return "jpg"


def save_base64_image(image_base64: str, sub_dir: str, prefix: str) -> str:
    ensure_dir(UPLOADS_DIR / sub_dir)
    ext = infer_image_extension(image_base64)
    filename = f"{prefix}_{uuid.uuid4().hex}.{ext}"
    path = UPLOADS_DIR / sub_dir / filename

    raw = image_base64.split(",", 1)[-1]
    data = base64.b64decode(raw)
    path.write_bytes(data)
    return f"/uploads/{sub_dir}/{filename}".replace("\\", "/")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000)
    return f"120000${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        iterations_text, salt, digest_hex = stored_hash.split("$", 2)
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations_text),
        )
        return hmac.compare_digest(candidate.hex(), digest_hex)
    except (TypeError, ValueError):
        return False


def generate_unique_account_number(conn: sqlite3.Connection) -> str:
    # Generate a 12-digit domestic account number and ensure uniqueness.
    while True:
        candidate = f"97{secrets.randbelow(10**10):010d}"
        exists = conn.execute(
            "SELECT id FROM users WHERE account_number = ? LIMIT 1",
            (candidate,),
        ).fetchone()
        if not exists:
            return candidate


def init_database() -> None:
    with get_db() as conn:
        ensure_dir(UPLOADS_DIR)
        ensure_dir(UPLOADS_DIR / "registrations")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                approval_status TEXT NOT NULL DEFAULT 'approved',
                account_number TEXT UNIQUE,
                balance INTEGER NOT NULL DEFAULT 500000,
                full_name TEXT,
                face_encoding TEXT,
                is_locked INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS deleted_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_user_id INTEGER,
                username TEXT,
                deleted_by INTEGER,
                deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                profile_json TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bank_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_user_id INTEGER NOT NULL,
                receiver_user_id INTEGER NOT NULL,
                sender_account_number TEXT NOT NULL,
                receiver_account_number TEXT NOT NULL,
                amount INTEGER NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Always upsert admin account with the canonical password
        conn.execute(
            """
            INSERT INTO users (username, password_hash, role, full_name, is_locked)
            VALUES (?, ?, 'admin', 'System Admin', 0)
            ON CONFLICT(username) DO UPDATE SET
                password_hash = excluded.password_hash,
                role = 'admin'
            WHERE username = 'admin'
            """,
            ("admin", hash_password("Abc@123")),
        )

        # Add KYC columns if they don't exist yet (SQLite doesn't support IF NOT EXISTS)
        kyc_columns = [
            ("email", "TEXT"),
            ("phone", "TEXT"),
            ("birth_date", "TEXT"),
            ("cccd_number", "TEXT"),
            ("gender", "TEXT"),
            ("hometown", "TEXT"),
            ("residence", "TEXT"),
            ("nationality", "TEXT"),
            ("valid_until", "TEXT"),
            ("issued_date", "TEXT"),
            ("issued_place", "TEXT"),
            ("face_image_path", "TEXT"),
            ("cccd_front_image_path", "TEXT"),
            ("cccd_back_image_path", "TEXT"),
        ]
        for col, dtype in kyc_columns:
            try:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {dtype}")
            except Exception:
                pass  # column already exists

        existing_cols = {
            str(row[1])
            for row in conn.execute("PRAGMA table_info(users)").fetchall()
        }
        had_balance_column = "balance" in existing_cols
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN balance INTEGER NOT NULL DEFAULT {INITIAL_ACCOUNT_BALANCE}")
        except Exception:
            pass  # column already exists

        try:
            conn.execute("ALTER TABLE users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'")
        except Exception:
            pass  # column already exists

        try:
            conn.execute("ALTER TABLE users ADD COLUMN account_number TEXT")
        except Exception:
            pass  # column already exists

        # Ensure admin account is always approved.
        conn.execute(
            "UPDATE users SET approval_status = 'approved' WHERE username = 'admin'"
        )
        conn.execute(
            "UPDATE users SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = ''"
        )

        rows_without_account = conn.execute(
            "SELECT id FROM users WHERE account_number IS NULL OR TRIM(account_number) = ''"
        ).fetchall()
        for row in rows_without_account:
            new_account = generate_unique_account_number(conn)
            conn.execute(
                "UPDATE users SET account_number = ? WHERE id = ?",
                (new_account, int(row["id"])),
            )

        if not had_balance_column:
            # One-time migration for all legacy accounts created before this fix.
            conn.execute(
                "UPDATE users SET balance = ?",
                (INITIAL_ACCOUNT_BALANCE,),
            )
        else:
            conn.execute(
                "UPDATE users SET balance = ? WHERE balance IS NULL",
                (INITIAL_ACCOUNT_BALANCE,),
            )

        try:
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cccd_number_unique ON users(cccd_number)")
        except Exception:
            pass
        try:
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_number_unique ON users(account_number)")
        except Exception:
            pass


def parse_json_body(raw_body: bytes) -> dict[str, Any]:
    if not raw_body:
        return {}
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="JSON body must be an object")
    return payload


async def json_body(request: Request) -> dict[str, Any]:
    return parse_json_body(await request.body())


def _validate_apps_script_url(url_text: str) -> str:
    if not url_text:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_APPS_SCRIPT_URL is not configured",
        )

    parsed = urlsplit(url_text)
    host = (parsed.netloc or "").lower()
    if parsed.scheme not in {"https"}:
        raise HTTPException(status_code=500, detail="GOOGLE_APPS_SCRIPT_URL must use https")
    if host not in {"script.google.com", "script.googleusercontent.com"}:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_APPS_SCRIPT_URL must point to a Google Apps Script host",
        )
    return url_text


def _build_apps_script_url(base_url: str, query_params: dict[str, Any]) -> str:
    parsed = urlsplit(base_url)
    merged = dict(parse_qsl(parsed.query, keep_blank_values=True))
    for key, value in query_params.items():
        merged[str(key)] = str(value)
    new_query = urlencode(merged)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, new_query, parsed.fragment))


def _decode_upstream_body(raw: bytes) -> tuple[Any, str]:
    text = raw.decode("utf-8", errors="replace")
    try:
        return json.loads(text), "json"
    except Exception:
        return text, "text"


def _call_apps_script(url: str, method: str, payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    body_bytes: Optional[bytes] = None
    headers: dict[str, str] = {}
    if method == "POST":
        body_bytes = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"

    req = UrlRequest(url=url, data=body_bytes, headers=headers, method=method)
    try:
        with urlopen(req, timeout=GOOGLE_APPS_SCRIPT_TIMEOUT) as resp:
            raw = resp.read()
            decoded, response_type = _decode_upstream_body(raw)
            return {
                "ok": True,
                "upstream_status": int(resp.getcode() or 200),
                "upstream_content_type": resp.headers.get("Content-Type", ""),
                "response_type": response_type,
                "data": decoded,
            }
    except HTTPError as exc:
        error_raw = exc.read() if hasattr(exc, "read") else b""
        decoded, response_type = _decode_upstream_body(error_raw)
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Apps Script upstream returned an error",
                "upstream_status": int(exc.code),
                "response_type": response_type,
                "data": decoded,
            },
        )
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"Apps Script connection failed: {exc.reason}")


def sanitize_user(row: sqlite3.Row) -> dict[str, Any]:
    keys = row.keys()
    return {
        "id": row["id"],
        "username": row["username"],
        "role": row["role"],
        "approval_status": row["approval_status"] if "approval_status" in keys else "approved",
        "account_number": row["account_number"] if "account_number" in keys else "",
        "balance": int(row["balance"]) if "balance" in keys and row["balance"] is not None else INITIAL_ACCOUNT_BALANCE,
        "full_name": row["full_name"] or "",
        "email": row["email"] if "email" in keys else "",
        "has_face_data": bool(row["face_encoding"]),
        "is_locked": int(row["is_locked"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        # KYC fields (present only when columns exist)
        "phone": row["phone"] if "phone" in keys else "",
        "birth_date": row["birth_date"] if "birth_date" in keys else "",
        "cccd_number": row["cccd_number"] if "cccd_number" in keys else "",
        "gender": row["gender"] if "gender" in keys else "",
        "hometown": row["hometown"] if "hometown" in keys else "",
        "residence": row["residence"] if "residence" in keys else "",
        "nationality": row["nationality"] if "nationality" in keys else "",
        "valid_until": row["valid_until"] if "valid_until" in keys else "",
        "issued_date": row["issued_date"] if "issued_date" in keys else "",
        "issued_place": row["issued_place"] if "issued_place" in keys else "",
        "face_image_path": row["face_image_path"] if "face_image_path" in keys else "",
        "cccd_front_image_path": row["cccd_front_image_path"] if "cccd_front_image_path" in keys else "",
        "cccd_back_image_path": row["cccd_back_image_path"] if "cccd_back_image_path" in keys else "",
    }


def ensure_user_account_number(user_id: int) -> None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT account_number FROM users WHERE id = ? LIMIT 1",
            (user_id,),
        ).fetchone()
        if not row:
            return
        current = str(row["account_number"] or "").strip()
        if current:
            return
        generated = generate_unique_account_number(conn)
        conn.execute(
            "UPDATE users SET account_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (generated, user_id),
        )


def load_user_by_id(user_id: int) -> Optional[sqlite3.Row]:
    ensure_user_account_number(user_id)
    with get_db() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ? LIMIT 1", (user_id,)).fetchone()


# ── OCR helpers ──────────────────────────────────────────────────────────────

def _ocr_via_google_vision(image_base64: str) -> list[str]:
    """Return list of text lines using Google Cloud Vision."""
    if vision is None or not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return []
    try:
        raw = image_base64.split(",", 1)[-1]
        image_bytes = base64.b64decode(raw)
        client = vision.ImageAnnotatorClient()
        img = vision.Image(content=image_bytes)
        response = client.text_detection(image=img)
        if response.error.message:
            return []
        texts = response.text_annotations
        if not texts:
            return []
        return [line.strip() for line in texts[0].description.split("\n") if line.strip()]
    except Exception:
        return []


def _ocr_via_easyocr(image_base64: str) -> list[str]:
    """Return list of text lines using EasyOCR."""
    if not EASYOCR_AVAILABLE:
        return []
    try:
        raw = image_base64.split(",", 1)[-1]
        image_bytes = base64.b64decode(raw)
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return []
        reader = _get_ocr_reader()
        if reader is None:
            return []
        results = reader.readtext(img_bgr, detail=0, paragraph=False)
        return [str(r).strip() for r in results if str(r).strip()]
    except Exception:
        return []


def extract_text_lines(image_base64: str) -> list[str]:
    lines = _ocr_via_google_vision(image_base64)
    if lines:
        return lines
    lines = _ocr_via_easyocr(image_base64)
    return lines


def _find_after_keyword(lines: list[str], *keywords: str) -> str:
    """Return the first non-empty line that appears after a line containing any keyword."""
    for i, line in enumerate(lines):
        ll = line.lower()
        if any(kw.lower() in ll for kw in keywords):
            # Check if value is on the same line after the colon
            if ":" in line:
                val = line.split(":", 1)[1].strip()
                if val:
                    return val
            for j in range(i + 1, min(i + 5, len(lines))):
                if lines[j].strip():
                    return lines[j].strip()
    return ""


def _extract_first_date(value: str) -> str:
    m = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", value)
    return m.group(1) if m else ""


def _is_valid_date_ddmmyyyy(value: str) -> bool:
    if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", value):
        return False
    try:
        datetime.strptime(value, "%d/%m/%Y")
        return True
    except ValueError:
        return False


def validate_cccd_inferred_fields(inferred: dict[str, str]) -> list[str]:
    errors: list[str] = []
    cccd_number = str(inferred.get("cccd_number", "")).strip()
    birth_date = str(inferred.get("birth_date", "")).strip()
    issued_date = str(inferred.get("issued_date", "")).strip()

    if not re.fullmatch(r"\d{12}", cccd_number):
        errors.append("cccd_number phải gồm đúng 12 chữ số")

    if not _is_valid_date_ddmmyyyy(birth_date):
        errors.append("birth_date không đúng định dạng dd/mm/yyyy hợp lệ")
    if not _is_valid_date_ddmmyyyy(issued_date):
        errors.append("issued_date không đúng định dạng dd/mm/yyyy hợp lệ")

    return errors


def _extract_cccd_face_encoding(cccd_front_base64: str) -> np.ndarray:
    """Try extracting the portrait face from CCCD front image using full-frame then ROI fallback."""
    image_rgb = decode_image(cccd_front_base64)
    h, w = image_rgb.shape[:2]

    # Common CCCD front layout places portrait on the left block.
    roi = image_rgb[0:max(1, int(h * 0.88)), 0:max(1, int(w * 0.52))]
    candidates = [image_rgb, roi]

    for img in candidates:
        try:
            return extract_single_face_encoding(img)
        except HTTPException as exc:
            if exc.status_code == 422:
                continue
            raise

    raise HTTPException(
        status_code=422,
        detail="Không phát hiện được khuôn mặt trên ảnh CCCD mặt trước. Vui lòng tải ảnh rõ hơn.",
    )


def verify_face_against_cccd(cccd_front_base64: str, live_face_base64: str) -> dict[str, Any]:
    cccd_encoding = _extract_cccd_face_encoding(cccd_front_base64)
    live_rgb = decode_image(live_face_base64)
    live_encoding = extract_single_face_encoding(live_rgb)

    if face_recognition is None:
        distance = float(np.linalg.norm(cccd_encoding - live_encoding))
        threshold = float(os.getenv("CCCD_FACE_MATCH_THRESHOLD_FALLBACK", "0.95"))
    else:
        distance = float(face_recognition.face_distance([cccd_encoding], live_encoding)[0])
        # More tolerant than login verification because age and appearance can change over years.
        threshold = float(os.getenv("CCCD_FACE_MATCH_THRESHOLD", "0.68"))

    return {
        "matched": distance <= threshold,
        "distance": distance,
        "threshold": threshold,
    }


def parse_cccd_front(text: str, lines: list[str]) -> dict[str, str]:
    result: dict[str, str] = {
        "cccd_number": "",
        "full_name": "",
        "birth_date": "",
        "gender": "",
        "hometown": "",
        "residence": "",
        "nationality": "",
        "valid_until": "",
    }
    # 12-digit ID number
    m = re.search(r"\b(\d{12})\b", text)
    if m:
        result["cccd_number"] = m.group(1)
    # Full name – line after "Họ và tên" / "Full name"
    raw_name = _find_after_keyword(lines, "Họ và tên", "Ho va ten", "Full name")
    if raw_name:
        # Strip any trailing bilingual labels that OCR may append
        raw_name = re.split(r"(?i)(?:ng[àa]y\s*sinh|date\s*of\s*birth|gi[oó]i\s*t[íi]nh|sex)", raw_name)[0]
        result["full_name"] = raw_name.strip()
    # Dates DD/MM/YYYY
    dates = re.findall(r"\b(\d{2}/\d{2}/\d{4})\b", text)
    birth_line = _find_after_keyword(lines, "Ngày sinh", "Ngay sinh", "Date of birth")
    if birth_line:
        result["birth_date"] = _extract_first_date(birth_line)
    if not result["birth_date"] and dates:
        result["birth_date"] = dates[0]

    valid_line = _find_after_keyword(lines, "Có giá trị đến", "Co gia tri den", "Date of expiry")
    if valid_line:
        result["valid_until"] = _extract_first_date(valid_line)
    if not result["valid_until"] and len(dates) >= 2:
        result["valid_until"] = dates[-1]
    # Gender
    gm = re.search(r"\b(Nam|Nữ|Nu|FEMALE|MALE)\b", text, re.IGNORECASE)
    if gm:
        g = gm.group(1)
        result["gender"] = "Nam" if g.upper() in {"NAM", "MALE"} else "Nữ"
    result["hometown"] = _find_after_keyword(lines, "Quê quán", "Que quan", "Place of origin")
    result["residence"] = _find_after_keyword(lines, "thường trú", "thuong tru", "Place of residence")
    result["nationality"] = _find_after_keyword(lines, "Quốc tịch", "Quoc tich", "Nationality")
    return result


def parse_cccd_back(text: str, lines: list[str]) -> dict[str, str]:
    result: dict[str, str] = {"issued_date": "", "issued_place": ""}
    dates = re.findall(r"\b(\d{2}/\d{2}/\d{4})\b", text)
    if dates:
        result["issued_date"] = dates[0]
    issued = _find_after_keyword(lines, "Nơi cấp", "Noi cap", "Issuing authority")
    if not issued:
        for line in lines:
            if re.search(r"C[ụu]c|CSQLHC|BCA|Bộ Công An|Bo Cong An", line, re.IGNORECASE):
                issued = line.strip()
                break
    result["issued_place"] = issued
    return result


def require_login(request: Request) -> sqlite3.Row:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = load_user_by_id(int(user_id))
    if not user:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Session expired")

    if int(user["is_locked"]) == 1:
        request.session.clear()
        raise HTTPException(status_code=403, detail="Account is locked")

    if user["role"] != "admin" and str(user["approval_status"] or "pending") != "approved":
        request.session.clear()
        raise HTTPException(status_code=403, detail="Account is pending admin approval")

    return user


def require_admin(request: Request) -> sqlite3.Row:
    user = require_login(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: admin only")
    return user


def store_session(request: Request, user: sqlite3.Row) -> None:
    request.session["user_id"] = int(user["id"])


def decode_image(image_base64: str) -> np.ndarray:
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_base64)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}")

    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image_bgr = cv2.imdecode(array, cv2.IMREAD_COLOR)

    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Unable to decode image")

    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)


def detect_single_face_crop_rgb(image_rgb: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    classifier = cv2.CascadeClassifier(CASCADE_PATH)
    faces = classifier.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))

    if len(faces) == 0:
        raise HTTPException(status_code=422, detail="No face detected")
    if len(faces) > 1:
        raise HTTPException(status_code=422, detail="Multiple faces detected")

    x, y, w, h = faces[0]
    pad_w = int(w * 0.12)
    pad_h = int(h * 0.12)

    x0 = max(0, x - pad_w)
    y0 = max(0, y - pad_h)
    x1 = min(image_rgb.shape[1], x + w + pad_w)
    y1 = min(image_rgb.shape[0], y + h + pad_h)

    crop = image_rgb[y0:y1, x0:x1]
    if crop.size == 0:
        raise HTTPException(status_code=422, detail="Unable to crop detected face")
    return crop


def fallback_face_encoding(image_rgb: np.ndarray) -> np.ndarray:
    crop = detect_single_face_crop_rgb(image_rgb)
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    # 16x8 gives 128 values, matching the API contract expected by current code.
    small = cv2.resize(gray, (16, 8), interpolation=cv2.INTER_AREA)
    vec = small.astype(np.float64).flatten()
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec


def extract_single_face_encoding(image_rgb: np.ndarray) -> np.ndarray:
    if face_recognition is None:
        return fallback_face_encoding(image_rgb)

    face_locations = face_recognition.face_locations(image_rgb, model="hog")
    if len(face_locations) == 0:
        raise HTTPException(status_code=422, detail="No face detected")
    if len(face_locations) > 1:
        raise HTTPException(status_code=422, detail="Multiple faces detected")

    encodings = face_recognition.face_encodings(image_rgb, known_face_locations=face_locations)
    if not encodings:
        raise HTTPException(status_code=422, detail="Unable to extract face encoding")

    return encodings[0]


def liveness_with_google_vision(image_base64: str, require_smile: bool) -> Optional[dict[str, Any]]:
    if vision is None or not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return None

    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        image_bytes = base64.b64decode(image_base64)

        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.face_detection(image=image)

        if response.error.message:
            raise RuntimeError(response.error.message)

        if not response.face_annotations:
            return {
                "is_live": False,
                "source": "google_vision",
                "message": "No face detected",
            }

        face = response.face_annotations[0]
        is_smiling = str(face.joy_likelihood) in {"LIKELY", "VERY_LIKELY"}
        is_eye_visible = (
            str(face.left_eye_open_likelihood) in {"POSSIBLE", "LIKELY", "VERY_LIKELY"}
            and str(face.right_eye_open_likelihood) in {"POSSIBLE", "LIKELY", "VERY_LIKELY"}
        )

        live = is_eye_visible and (is_smiling if require_smile else True)
        return {
            "is_live": bool(live),
            "source": "google_vision",
            "smiling": is_smiling,
            "eyes_open": is_eye_visible,
        }
    except Exception as exc:
        return {
            "is_live": False,
            "source": "google_vision",
            "message": f"Vision error: {exc}",
        }


def run_liveness_check(image_base64: str, require_smile: bool = True) -> dict[str, Any]:
    vision_result = liveness_with_google_vision(image_base64, require_smile)
    if vision_result is not None:
        return vision_result

    image_rgb = decode_image(image_base64)
    _ = extract_single_face_encoding(image_rgb)
    return {
        "is_live": True,
        "source": "fallback_single_face",
        "message": "Google Vision is not configured; fallback liveness is weak",
    }


def extract_encoding_from_image(image_base64: str) -> list[float]:
    image_rgb = decode_image(image_base64)
    encoding = extract_single_face_encoding(image_rgb)
    return encoding.tolist()


def verify_face_encoding(image_base64: str, stored_encoding: List[float], threshold: float = 0.45) -> dict[str, Any]:
    image_rgb = decode_image(image_base64)
    new_encoding = extract_single_face_encoding(image_rgb)
    stored = np.array(stored_encoding, dtype=np.float64)
    if stored.shape[0] != 128:
        raise HTTPException(status_code=422, detail="stored_encoding must have 128 values")

    if face_recognition is None:
        distance = float(np.linalg.norm(stored - new_encoding))
    else:
        distance = float(face_recognition.face_distance([stored], new_encoding)[0])
    return {
        "matched": distance <= threshold,
        "distance": distance,
        "threshold": threshold,
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "message": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"ok": False, "message": f"Internal server error: {exc}"},
    )


@app.on_event("startup")
def startup() -> None:
    init_database()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "mode": "unified"}


@app.post("/extract-encoding")
def extract_encoding(payload: ImagePayload) -> dict[str, Any]:
    return {"ok": True, "face_encoding": extract_encoding_from_image(payload.image_base64)}


@app.post("/verify-face")
def verify_face(payload: VerifyPayload) -> dict[str, Any]:
    return {"ok": True, **verify_face_encoding(payload.image_base64, payload.stored_encoding, payload.threshold)}


@app.post("/liveness-check")
def liveness_check(payload: LivenessPayload) -> dict[str, Any]:
    return {"ok": True, **run_liveness_check(payload.image_base64, payload.require_smile)}


@app.post("/api/register.php")
async def register(request: Request) -> dict[str, Any]:
    payload = await json_body(request)
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    full_name = str(payload.get("full_name", "")).strip()
    gender = str(payload.get("gender", "")).strip()
    phone = str(payload.get("phone", "")).strip()
    email = str(payload.get("email", "")).strip()
    image_base64 = str(payload.get("image_base64", ""))
    cccd_front_image = str(payload.get("cccd_front_image", ""))
    cccd_back_image = str(payload.get("cccd_back_image", ""))
    manual_cccd_number = str(payload.get("cccd_number", "")).strip()
    manual_birth_date = str(payload.get("birth_date", "")).strip()
    manual_issued_date = str(payload.get("issued_date", "")).strip()

    if not username or not password or not full_name or not gender or not phone or not email:
        raise HTTPException(status_code=400, detail="Thiếu thông tin bắt buộc: họ tên, giới tính, số điện thoại, email")
    if not image_base64 or not cccd_front_image or not cccd_back_image:
        raise HTTPException(status_code=400, detail="Cần ảnh khuôn mặt, CCCD mặt trước và CCCD mặt sau")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise HTTPException(status_code=400, detail="Email không hợp lệ")

    ocr_available = bool((vision is not None and os.getenv("GOOGLE_APPLICATION_CREDENTIALS")) or EASYOCR_AVAILABLE)

    front_lines = extract_text_lines(cccd_front_image)
    back_lines = extract_text_lines(cccd_back_image)
    front_fields = parse_cccd_front("\n".join(front_lines), front_lines)
    back_fields = parse_cccd_back("\n".join(back_lines), back_lines)

    inferred = {
        "cccd_number": front_fields.get("cccd_number", "").strip(),
        "birth_date": front_fields.get("birth_date", "").strip(),
        "hometown": front_fields.get("hometown", "").strip(),
        "residence": front_fields.get("residence", "").strip(),
        "nationality": front_fields.get("nationality", "").strip(),
        "valid_until": front_fields.get("valid_until", "").strip(),
        "issued_date": back_fields.get("issued_date", "").strip(),
        "issued_place": back_fields.get("issued_place", "").strip(),
    }

    missing_required = [
        key for key in ("cccd_number", "birth_date", "issued_date") if not inferred[key]
    ]
    format_errors = validate_cccd_inferred_fields(inferred) if not missing_required else []

    needs_manual_fallback = (not ocr_available) or bool(missing_required) or bool(format_errors)
    if needs_manual_fallback:
        if not re.fullmatch(r"\d{12}", manual_cccd_number):
            reason = "OCR chưa sẵn sàng" if not ocr_available else "OCR chưa đọc đủ dữ liệu CCCD"
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{reason}. Vui lòng nhập số CCCD gồm đúng 12 chữ số để tiếp tục đăng ký."
                ),
            )

        inferred["cccd_number"] = manual_cccd_number

        if manual_birth_date:
            if not _is_valid_date_ddmmyyyy(manual_birth_date):
                raise HTTPException(status_code=422, detail="birth_date không đúng định dạng dd/mm/yyyy hợp lệ")
            inferred["birth_date"] = manual_birth_date

        if manual_issued_date:
            if not _is_valid_date_ddmmyyyy(manual_issued_date):
                raise HTTPException(status_code=422, detail="issued_date không đúng định dạng dd/mm/yyyy hợp lệ")
            inferred["issued_date"] = manual_issued_date

    cccd_face_verification = verify_face_against_cccd(cccd_front_image, image_base64)
    if not cccd_face_verification["matched"]:
        raise HTTPException(
            status_code=422,
            detail=(
                "Khuôn mặt chụp không khớp ảnh CCCD trong mức sai số cho phép. "
                f"distance={cccd_face_verification['distance']:.4f}, "
                f"threshold={cccd_face_verification['threshold']:.4f}"
            ),
        )

    with get_db() as conn:
        exists = conn.execute("SELECT id FROM users WHERE username = ? LIMIT 1", (username,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="Username already exists")

        cccd_exists = conn.execute(
            "SELECT id FROM users WHERE cccd_number = ? LIMIT 1",
            (inferred["cccd_number"],),
        ).fetchone()
        if cccd_exists:
            raise HTTPException(
                status_code=409,
                detail="Số CCCD đã được đăng ký bởi tài khoản khác. Vui lòng nhập thông tin CCCD khác.",
            )

        face_encoding = json.dumps(extract_encoding_from_image(image_base64))
        safe_username = re.sub(r"[^a-zA-Z0-9._-]", "_", username)[:64] or "user"
        reg_subdir = f"registrations/{safe_username}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        face_image_path = save_base64_image(image_base64, reg_subdir, "face_live")
        cccd_front_image_path = save_base64_image(cccd_front_image, reg_subdir, "cccd_front")
        cccd_back_image_path = save_base64_image(cccd_back_image, reg_subdir, "cccd_back")
        generated_account_number = generate_unique_account_number(conn)

        cursor = conn.execute(
            """
            INSERT INTO users (
                username, password_hash, role, approval_status, full_name, email, face_encoding,
                account_number,
                gender, phone, cccd_number, birth_date, hometown, residence, nationality,
                valid_until, issued_date, issued_place,
                face_image_path, cccd_front_image_path, cccd_back_image_path
            )
            VALUES (?, ?, 'user', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? , ?)
            """,
            (
                username,
                hash_password(password),
                full_name,
                email,
                face_encoding,
                generated_account_number,
                gender or front_fields.get("gender", ""),
                phone,
                inferred["cccd_number"],
                inferred["birth_date"],
                inferred["hometown"],
                inferred["residence"],
                inferred["nationality"],
                inferred["valid_until"],
                inferred["issued_date"],
                inferred["issued_place"],
                face_image_path,
                cccd_front_image_path,
                cccd_back_image_path,
            ),
        )

    return {
        "ok": True,
        "message": "Đăng ký thành công. Tài khoản đang chờ admin duyệt.",
        "approval_status": "pending",
        "account_number": generated_account_number,
        "user_id": cursor.lastrowid,
    }


@app.post("/api/login-password.php")
async def login_password(request: Request) -> dict[str, Any]:
    payload = await json_body(request)
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password are required")

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ? LIMIT 1", (username,)).fetchone()

    if not user or not verify_password(password, str(user["password_hash"])):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if int(user["is_locked"]) == 1:
        raise HTTPException(status_code=403, detail="Account is locked")
    if user["role"] != "admin" and str(user["approval_status"] or "pending") != "approved":
        raise HTTPException(status_code=403, detail="Tài khoản đang chờ admin duyệt")

    fresh_user = load_user_by_id(int(user["id"]))
    if not fresh_user:
        raise HTTPException(status_code=404, detail="User not found")

    store_session(request, fresh_user)
    return {"ok": True, "message": "Login successful", "user": sanitize_user(fresh_user)}


@app.post("/api/login-face.php")
async def login_face(request: Request) -> dict[str, Any]:
    payload = await json_body(request)
    username = str(payload.get("username", "")).strip()
    image_base64 = str(payload.get("image_base64", ""))

    if not username or not image_base64:
        raise HTTPException(status_code=400, detail="username and image_base64 are required")

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ? LIMIT 1", (username,)).fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if int(user["is_locked"]) == 1:
        raise HTTPException(status_code=403, detail="Account is locked")
    if user["role"] != "admin" and str(user["approval_status"] or "pending") != "approved":
        raise HTTPException(status_code=403, detail="Tài khoản đang chờ admin duyệt")
    if not user["face_encoding"]:
        raise HTTPException(status_code=428, detail="Face data not set. Please login by password and enroll face again.")

    liveness = run_liveness_check(image_base64)
    if not liveness["is_live"]:
        raise HTTPException(status_code=401, detail="Liveness check failed")

    stored_encoding = json.loads(str(user["face_encoding"]))
    verification = verify_face_encoding(image_base64, stored_encoding)
    if not verification["matched"]:
        raise HTTPException(status_code=401, detail="Face verification failed")

    fresh_user = load_user_by_id(int(user["id"]))
    if not fresh_user:
        raise HTTPException(status_code=404, detail="User not found")

    store_session(request, fresh_user)
    return {
        "ok": True,
        "message": "Face login successful",
        "distance": verification["distance"],
        "user": sanitize_user(fresh_user),
    }


@app.post("/api/logout.php")
async def logout(request: Request) -> dict[str, Any]:
    request.session.clear()
    return {"ok": True, "message": "Logged out"}


@app.get("/api/user/profile.php")
async def user_profile(request: Request) -> dict[str, Any]:
    user = require_login(request)
    return {"ok": True, "user": sanitize_user(user)}


@app.post("/api/user/update-face.php")
async def update_face(request: Request) -> dict[str, Any]:
    user = require_login(request)
    payload = await json_body(request)
    image_base64 = str(payload.get("image_base64", ""))
    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    face_encoding = json.dumps(extract_encoding_from_image(image_base64))
    safe_username = re.sub(r"[^a-zA-Z0-9._-]", "_", str(user["username"]))[:64] or "user"
    face_image_path = save_base64_image(
        image_base64,
        f"registrations/{safe_username}_updates",
        "face_live",
    )
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET face_encoding = ?, face_image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (face_encoding, face_image_path, user["id"]),
        )

    return {"ok": True, "message": "Face data updated"}


@app.post("/api/user/change-password.php")
async def change_password(request: Request) -> dict[str, Any]:
    user = require_login(request)
    payload = await json_body(request)
    current_password = str(payload.get("current_password", ""))
    new_password = str(payload.get("new_password", ""))

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="current_password and new_password are required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="new_password must be at least 6 characters")
    if not verify_password(current_password, str(user["password_hash"])):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    with get_db() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (hash_password(new_password), user["id"]),
        )

    return {"ok": True, "message": "Password changed successfully"}


@app.api_route("/api/admin/users.php", methods=["GET", "POST", "PUT", "DELETE"])
async def admin_users(request: Request) -> dict[str, Any]:
    admin = require_admin(request)
    if request.method == "GET":
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM users ORDER BY id DESC"
            ).fetchall()
        return {"ok": True, "users": [sanitize_user(row) for row in rows]}

    payload = await json_body(request)
    with get_db() as conn:
        if request.method == "POST":
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))
            role = str(payload.get("role", "user"))
            full_name = str(payload.get("full_name", "")).strip()

            if not username or not password:
                raise HTTPException(status_code=400, detail="username and password are required")
            if role not in {"admin", "user"}:
                raise HTTPException(status_code=400, detail="Invalid role")
            exists = conn.execute("SELECT id FROM users WHERE username = ? LIMIT 1", (username,)).fetchone()
            if exists:
                raise HTTPException(status_code=409, detail="Username already exists")

            cursor = conn.execute(
                """
                INSERT INTO users (username, password_hash, role, approval_status, full_name, account_number)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (username, hash_password(password), role, "approved", full_name, generate_unique_account_number(conn)),
            )
            return {"ok": True, "message": "User created", "id": cursor.lastrowid}

        if request.method == "PUT":
            user_id = int(payload.get("id", 0))
            if user_id <= 0:
                raise HTTPException(status_code=400, detail="id is required")

            fields: list[str] = []
            params: list[Any] = []
            if "full_name" in payload:
                fields.append("full_name = ?")
                params.append(str(payload.get("full_name", "")).strip())
            if "role" in payload:
                role = str(payload.get("role", ""))
                if role not in {"admin", "user"}:
                    raise HTTPException(status_code=400, detail="Invalid role")
                fields.append("role = ?")
                params.append(role)
            if "is_locked" in payload:
                fields.append("is_locked = ?")
                params.append(1 if bool(payload.get("is_locked")) else 0)
            if "approval_status" in payload:
                approval_status = str(payload.get("approval_status", "")).strip().lower()
                if approval_status not in {"pending", "approved", "rejected"}:
                    raise HTTPException(status_code=400, detail="Invalid approval_status")
                fields.append("approval_status = ?")
                params.append(approval_status)

            if not fields:
                raise HTTPException(status_code=400, detail="No update fields provided")
            params.extend([user_id])
            conn.execute(
                f"UPDATE users SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                tuple(params),
            )
            return {"ok": True, "message": "User updated"}

        user_id = int(payload.get("id", 0))
        if user_id <= 0:
            raise HTTPException(status_code=400, detail="id is required")
        if int(admin["id"]) == user_id:
            raise HTTPException(status_code=400, detail="Admin cannot delete the current session account")

        target = conn.execute("SELECT * FROM users WHERE id = ? LIMIT 1", (user_id,)).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        archived_payload = json.dumps(dict(target), ensure_ascii=False)
        conn.execute(
            """
            INSERT INTO deleted_profiles (original_user_id, username, deleted_by, profile_json)
            VALUES (?, ?, ?, ?)
            """,
            (int(target["id"]), str(target["username"]), int(admin["id"]), archived_payload),
        )
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        return {"ok": True, "message": "User deleted"}


@app.get("/api/admin/deleted-users.php")
async def admin_deleted_users(request: Request) -> dict[str, Any]:
    require_admin(request)
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, original_user_id, username, deleted_by, deleted_at, profile_json
            FROM deleted_profiles
            ORDER BY id DESC
            """
        ).fetchall()

    items: list[dict[str, Any]] = []
    for row in rows:
        try:
            profile = json.loads(str(row["profile_json"]))
        except Exception:
            profile = {}
        items.append(
            {
                "id": row["id"],
                "original_user_id": row["original_user_id"],
                "username": row["username"],
                "deleted_by": row["deleted_by"],
                "deleted_at": row["deleted_at"],
                "profile": profile,
            }
        )
    return {"ok": True, "deleted_users": items}


@app.post("/api/admin/reset-face.php")
async def admin_reset_face(request: Request) -> dict[str, Any]:
    require_admin(request)
    payload = await json_body(request)
    user_id = int(payload.get("user_id", 0))
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="user_id is required")

    with get_db() as conn:
        conn.execute(
            "UPDATE users SET face_encoding = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (user_id,),
        )
    return {"ok": True, "message": "Face data reset successfully"}


@app.post("/api/admin/toggle-lock.php")
async def admin_toggle_lock(request: Request) -> dict[str, Any]:
    admin = require_admin(request)
    payload = await json_body(request)
    user_id = int(payload.get("user_id", 0))
    is_locked = bool(payload.get("is_locked", False))
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="user_id is required")
    if int(admin["id"]) == user_id and is_locked:
        raise HTTPException(status_code=400, detail="Admin cannot lock the current session account")

    with get_db() as conn:
        conn.execute(
            "UPDATE users SET is_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (1 if is_locked else 0, user_id),
        )
    return {"ok": True, "message": "User locked" if is_locked else "User unlocked"}



# ── OCR endpoint ──────────────────────────────────────────────────────────────

class OcrPayload(BaseModel):
    image_base64: str = Field(..., min_length=16)
    side: str = "front"  # "front" | "back"


@app.post("/api/ocr-cccd")
async def ocr_cccd(payload: OcrPayload, request: Request) -> dict[str, Any]:
    lines = extract_text_lines(payload.image_base64)
    full_text = "\n".join(lines)
    side = payload.side.lower()
    if side == "back":
        fields = parse_cccd_back(full_text, lines)
    else:
        fields = parse_cccd_front(full_text, lines)
    ocr_available = bool(
        (vision is not None and os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
        or EASYOCR_AVAILABLE
    )
    return {
        "ok": True,
        "ocr_available": ocr_available,
        "raw_text": full_text,
        "fields": fields,
    }


# ── KYC endpoints ─────────────────────────────────────────────────────────────

KYC_FIELDS = ("full_name", "phone", "birth_date", "cccd_number", "gender",
              "email", "hometown", "residence", "nationality", "valid_until", "issued_date", "issued_place")


@app.get("/api/user/kyc.php")
async def get_kyc(request: Request) -> dict[str, Any]:
    user = require_login(request)
    row = load_user_by_id(int(user["id"]))
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    kyc = {f: (row[f] or "") if f in row.keys() else "" for f in KYC_FIELDS}
    return {"ok": True, "kyc": kyc}


@app.post("/api/user/kyc.php")
async def save_kyc(request: Request) -> dict[str, Any]:
    user = require_login(request)
    payload = await json_body(request)
    current = load_user_by_id(int(user["id"]))
    if not current:
        raise HTTPException(status_code=404, detail="User not found")

    immutable_fields = {
        "full_name": "Họ và tên",
        "birth_date": "Ngày sinh",
        "gender": "Giới tính",
        "cccd_number": "Số CCCD",
        "issued_date": "Ngày cấp CCCD",
    }
    for field, label in immutable_fields.items():
        if field not in payload:
            continue
        old_value = str(current[field] or "").strip() if field in current.keys() else ""
        new_value = str(payload.get(field, "") or "").strip()
        if old_value and new_value and old_value != new_value:
            raise HTTPException(
                status_code=409,
                detail=f"{label} đã được xác lập và không thể thay đổi",
            )

    if "cccd_number" in payload:
        cccd_number = str(payload.get("cccd_number", "")).strip()
        if cccd_number:
            with get_db() as conn:
                conflict = conn.execute(
                    "SELECT id FROM users WHERE cccd_number = ? AND id <> ? LIMIT 1",
                    (cccd_number, int(user["id"])),
                ).fetchone()
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail="Số CCCD đã được đăng ký bởi tài khoản khác",
                )

    fields: list[str] = []
    params: list[Any] = []
    for f in KYC_FIELDS:
        if f in payload:
            fields.append(f"{f} = ?")
            params.append(str(payload[f]).strip())
    if not fields:
        raise HTTPException(status_code=400, detail="No KYC fields provided")
    params.append(int(user["id"]))
    with get_db() as conn:
        conn.execute(
            f"UPDATE users SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            tuple(params),
        )
    return {"ok": True, "message": "KYC information saved successfully"}


@app.post("/api/user/transfer.php")
async def user_transfer(request: Request) -> dict[str, Any]:
    user = require_login(request)
    payload = await json_body(request)
    target_account_number = str(payload.get("target_account_number", "")).strip()
    note = str(payload.get("note", "")).strip()
    amount_raw = payload.get("amount", 0)

    try:
        amount = int(amount_raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Số tiền không hợp lệ")

    if not re.fullmatch(r"\d{10,20}", target_account_number):
        raise HTTPException(status_code=400, detail="Số tài khoản nhận không hợp lệ")
    if amount < 1000:
        raise HTTPException(status_code=400, detail="Số tiền chuyển tối thiểu là 1.000 VNĐ")

    with get_db() as conn:
        sender = conn.execute("SELECT * FROM users WHERE id = ? LIMIT 1", (int(user["id"]),)).fetchone()
        if not sender:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản gửi")
        sender_account = str(sender["account_number"] or "")
        if target_account_number == sender_account:
            raise HTTPException(status_code=400, detail="Không thể chuyển khoản cho chính mình")

        receiver = conn.execute(
            "SELECT * FROM users WHERE account_number = ? LIMIT 1",
            (target_account_number,),
        ).fetchone()
        if not receiver:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản nhận")
        if int(receiver["is_locked"] or 0) == 1:
            raise HTTPException(status_code=403, detail="Tài khoản nhận đang bị khóa")

        sender_balance = int(sender["balance"] or 0)
        if sender_balance < amount:
            raise HTTPException(status_code=400, detail="Số dư không đủ để thực hiện giao dịch")

        receiver_balance = int(receiver["balance"] or 0)
        conn.execute(
            "UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (sender_balance - amount, int(sender["id"])),
        )
        conn.execute(
            "UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (receiver_balance + amount, int(receiver["id"])),
        )
        tx = conn.execute(
            """
            INSERT INTO bank_transactions (
                sender_user_id, receiver_user_id, sender_account_number,
                receiver_account_number, amount, note
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                int(sender["id"]),
                int(receiver["id"]),
                sender_account,
                target_account_number,
                amount,
                note,
            ),
        )

    return {
        "ok": True,
        "message": "Chuyển khoản thành công",
        "transaction_id": tx.lastrowid,
        "sender_balance": sender_balance - amount,
        "receiver_account_number": target_account_number,
        "receiver_name": str(receiver["full_name"] or receiver["username"]),
    }


@app.post("/api/user/transfer-recipient.php")
async def transfer_recipient_lookup(request: Request) -> dict[str, Any]:
    user = require_login(request)
    payload = await json_body(request)
    target_account_number = str(payload.get("target_account_number", "")).strip()

    if not re.fullmatch(r"\d{10,20}", target_account_number):
        raise HTTPException(status_code=400, detail="Số tài khoản nhận không hợp lệ")

    with get_db() as conn:
        sender = conn.execute(
            "SELECT account_number FROM users WHERE id = ? LIMIT 1",
            (int(user["id"]),),
        ).fetchone()
        if not sender:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản gửi")

        sender_account = str(sender["account_number"] or "")
        if target_account_number == sender_account:
            raise HTTPException(status_code=400, detail="Không thể chuyển khoản cho chính mình")

        receiver = conn.execute(
            "SELECT full_name, username, is_locked FROM users WHERE account_number = ? LIMIT 1",
            (target_account_number,),
        ).fetchone()
        if not receiver:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản nhận")
        if int(receiver["is_locked"] or 0) == 1:
            raise HTTPException(status_code=403, detail="Tài khoản nhận đang bị khóa")

    return {
        "ok": True,
        "receiver_account_number": target_account_number,
        "receiver_name": str(receiver["full_name"] or receiver["username"]),
    }


@app.get("/api/user/transactions.php")
async def user_transactions(request: Request) -> dict[str, Any]:
    user = require_login(request)
    user_id = int(user["id"])

    limit_raw = request.query_params.get("limit", "120")
    try:
        limit = int(limit_raw)
    except Exception:
        limit = 120
    limit = max(1, min(limit, 300))

    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT
                bt.id,
                bt.sender_user_id,
                bt.receiver_user_id,
                bt.sender_account_number,
                bt.receiver_account_number,
                bt.amount,
                bt.note,
                bt.created_at,
                su.full_name AS sender_full_name,
                su.username AS sender_username,
                ru.full_name AS receiver_full_name,
                ru.username AS receiver_username
            FROM bank_transactions bt
            LEFT JOIN users su ON su.id = bt.sender_user_id
            LEFT JOIN users ru ON ru.id = bt.receiver_user_id
            WHERE bt.sender_user_id = ? OR bt.receiver_user_id = ?
            ORDER BY bt.id DESC
            LIMIT ?
            """,
            (user_id, user_id, limit),
        ).fetchall()

    items: list[dict[str, Any]] = []
    for row in rows:
        is_credit = int(row["receiver_user_id"]) == user_id
        counterparty_account = (
            str(row["sender_account_number"] or "")
            if is_credit
            else str(row["receiver_account_number"] or "")
        )
        counterparty_name = (
            str(row["sender_full_name"] or row["sender_username"] or "")
            if is_credit
            else str(row["receiver_full_name"] or row["receiver_username"] or "")
        )
        items.append(
            {
                "id": int(row["id"]),
                "type": "credit" if is_credit else "debit",
                "amount": int(row["amount"] or 0),
                "counterparty": counterparty_account,
                "counterparty_name": counterparty_name,
                "note": str(row["note"] or ""),
                "created_at": str(row["created_at"] or ""),
            }
        )

    return {
        "ok": True,
        "transactions": items,
        "balance": int(user["balance"] or 0),
    }


# ── Google Apps Script proxy endpoints ───────────────────────────────────────

@app.get("/api/integrations/google-apps-script")
async def gas_proxy_get(request: Request) -> dict[str, Any]:
    require_login(request)
    base_url = _validate_apps_script_url(GOOGLE_APPS_SCRIPT_URL)
    target_url = _build_apps_script_url(base_url, dict(request.query_params))
    return _call_apps_script(target_url, "GET")


@app.post("/api/integrations/google-apps-script")
async def gas_proxy_post(request: Request) -> dict[str, Any]:
    require_login(request)
    base_url = _validate_apps_script_url(GOOGLE_APPS_SCRIPT_URL)
    target_url = _build_apps_script_url(base_url, dict(request.query_params))
    payload = await json_body(request)
    return _call_apps_script(target_url, "POST", payload)


app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR), html=False), name="uploads")
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
