# Final_THNN - Tai lieu he thong cap nhat (25/04/2026)

Tai lieu nay mo ta he thong theo van phong tai lieu ky thuat: ro rang, dong nhat thuat ngu, de doc va de doi chieu code. Noi dung ky thuat duoc giu nguyen theo phien ban hien tai.

## 1. Tong quan he thong

Final_THNN la cong mo phong ngan hang noi bo, ket hop:

- Xac thuc bang mat khau va khuon mat.
- OCR CCCD phuc vu dang ky/KYC.
- Quan tri tai khoan nguoi dung.
- Chuyen khoan noi dia va theo doi lich su giao dich.

### 1.1 Luong nghiep vu cho nguoi dung

1. Dang ky tai khoan voi thong tin ca nhan, anh khuon mat, CCCD mat truoc va mat sau.
2. Tai khoan vao trang thai cho duyet.
3. Sau khi duoc duyet, dang nhap bang mat khau hoac khuon mat.
4. Quan ly ho so KYC, doi mat khau, cap nhat du lieu khuon mat.
5. Thuc hien chuyen khoan noi dia va xem thong ke giao dich.

### 1.2 Luong nghiep vu cho quan tri vien

1. Xem danh sach nguoi dung.
2. Duyet hoac tu choi tai khoan dang cho duyet.
3. Khoa/mo khoa tai khoan.
4. Reset du lieu khuon mat.
5. Xoa tai khoan va tra cuu ho so da xoa.

## 2. Kien truc trien khai hien tai

### 2.1 Che do chay chinh (khuyen nghi)

He thong hien tai van hanh theo mo hinh unified backend:

- FastAPI phuc vu frontend static + API ung dung + cac tac vu AI.
- Frontend goi API qua base path /api.
- Uploads duoc mount static de hien thi lai anh da luu.

Ma lien quan:

- [frontend/assets/config.js](frontend/assets/config.js)
- [frontend/assets/common.js](frontend/assets/common.js)
- [ai-backend/main.py](ai-backend/main.py#L880)
- [ai-backend/main.py](ai-backend/main.py)

### 2.2 Vai tro cua thu muc php-backend

Thu muc php-backend van duoc giu lai nhu mot nhanh thay the/legacy (tham khao hoac trien khai theo huong khac). Tuy nhien, voi luong chay RUN_FACE_AUTH.bat, API runtime thuc te dang duoc phuc vu tu ai-backend/main.py.

Ma lien quan:

- [RUN_FACE_AUTH.bat](RUN_FACE_AUTH.bat)
- [php-backend/config.php](php-backend/config.php)
- [php-backend/api/login-password.php](php-backend/api/login-password.php)

## 3. Cau truc thu muc theo chuc nang

### 3.1 Frontend

- [frontend/index.html](frontend/index.html): man hinh dang nhap.
- [frontend/register.html](frontend/register.html): man hinh dang ky.
- [frontend/dashboard.html](frontend/dashboard.html): dashboard nguoi dung.
- [frontend/admin.html](frontend/admin.html): dashboard quan tri.
- [frontend/assets/styles.css](frontend/assets/styles.css): giao dien va style.

### 3.2 Logic frontend

- [frontend/assets/common.js](frontend/assets/common.js): helper API, camera, kiem tra phien dang nhap.
- [frontend/assets/index.js](frontend/assets/index.js): luong dang nhap.
- [frontend/assets/register.js](frontend/assets/register.js): OCR preview, validate dang ky.
- [frontend/assets/dashboard.js](frontend/assets/dashboard.js): KYC, doi mat khau, cap nhat face, chuyen khoan, thong ke.
- [frontend/assets/admin.js](frontend/assets/admin.js): quan tri nguoi dung.

### 3.3 Backend va du lieu

- [ai-backend/main.py](ai-backend/main.py): backend hop nhat.
- [ai-backend/requirements.txt](ai-backend/requirements.txt): dependencies Python.
- [app.sqlite3](app.sqlite3): co so du lieu chinh trong unified mode.
- [uploads](uploads): anh dang ky va anh cap nhat.

### 3.4 Script van hanh

- [SETUP_WINDOWS_ENV.bat](SETUP_WINDOWS_ENV.bat): cai dat moi truong lan dau.
- [RUN_FACE_AUTH.bat](RUN_FACE_AUTH.bat): khoi dong he thong.

## 4. Luong ky thuat frontend -> backend

### 4.1 Goi API va quan ly session

- Frontend su dung /api lam base path.
- Ham apiRequest gui credentials de giu session.
- Backend su dung SessionMiddleware de luu trang thai dang nhap.

Ma lien quan:

- [frontend/assets/common.js](frontend/assets/common.js#L1)
- [ai-backend/main.py](ai-backend/main.py#L67)

### 4.2 Phan quyen truy cap

- require_login: bao ve API nguoi dung.
- require_admin: bao ve API quan tri.

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L723)

## 5. Co so du lieu va model nghiep vu

### 5.1 Cac bang du lieu chinh

- users: thong tin tai khoan, quyen, trang thai duyet, so du, thong tin KYC, du lieu khuon mat.
- deleted_profiles: luu ban sao ho so truoc khi xoa user.
- bank_transactions: luu giao dich chuyen/nhan tien noi dia.

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L157)
- [ai-backend/main.py](ai-backend/main.py#L197)

### 5.2 Thuoc tinh nghiep vu quan trong

- role: admin/user.
- approval_status: pending/approved/rejected.
- account_number: so tai khoan noi dia duoc sinh tu dong.
- balance: so du tai khoan (mac dinh 500000).
- face_encoding: vector dac trung khuon mat.
- cccd_number, birth_date, issued_date: truong dinh danh quan trong.

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L175)
- [ai-backend/main.py](ai-backend/main.py#L1223)

## 6. Danh muc API runtime (unified backend)

### 6.1 Core AI

- GET /health
- POST /extract-encoding
- POST /verify-face
- POST /liveness-check

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L860)

### 6.2 Nhom auth va user

- POST /api/register.php
- POST /api/login-password.php
- POST /api/login-face.php
- POST /api/logout.php
- GET /api/user/profile.php
- POST /api/user/update-face.php
- POST /api/user/change-password.php

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L880)

### 6.3 Nhom OCR va KYC

- POST /api/ocr-cccd
- GET /api/user/kyc.php
- POST /api/user/kyc.php

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L1323)
- [ai-backend/main.py](ai-backend/main.py)

### 6.4 Nhom giao dich noi dia

- POST /api/user/transfer-recipient.php: xac thuc STK nhan truoc khi chuyen.
- POST /api/user/transfer.php: thuc hien chuyen khoan.
- GET /api/user/transactions.php: lay lich su giao dich theo user.

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py)
- [ai-backend/main.py](ai-backend/main.py)
- [ai-backend/main.py](ai-backend/main.py)

### 6.5 Nhom admin

- /api/admin/users.php (GET/POST/PUT/DELETE)
- GET /api/admin/deleted-users.php
- POST /api/admin/reset-face.php
- POST /api/admin/toggle-lock.php

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L1149)
- [ai-backend/main.py](ai-backend/main.py#L1249)

## 7. Luong nghiep vu chi tiet

### 7.1 Dang ky tai khoan

1. Frontend bat buoc cung cap du anh khuon mat + CCCD 2 mat.
2. Frontend thuc hien OCR preview va validate truong bat buoc.
3. Backend OCR lai de parse du lieu va kiem tra dinh dang.
4. Backend kiem tra trung username va trung so CCCD.
5. Backend doi chieu khuon mat chup live voi khuon mat tren CCCD.
6. Tao user voi approval_status = pending.
7. Sinh so tai khoan noi dia va luu anh vao uploads.

Ma lien quan:

- [frontend/assets/register.js](frontend/assets/register.js#L1)
- [ai-backend/main.py](ai-backend/main.py#L880)

### 7.2 Dang nhap

- Dang nhap mat khau: chi cho phep user da duoc duyet.
- Dang nhap khuon mat: co them buoc liveness check truoc khi verify.

Ma lien quan:

- [frontend/assets/index.js](frontend/assets/index.js)
- [ai-backend/main.py](ai-backend/main.py#L1028)
- [ai-backend/main.py](ai-backend/main.py#L1055)

### 7.3 Chuyen khoan noi dia

1. Nguoi dung nhap STK nhan va xac thuc nguoi nhan.
2. Backend kiem tra STK hop le, ton tai, khong trung tai khoan gui, va khong bi khoa.
3. Frontend hien modal xac nhan voi delay 3 giay.
4. Sau xac nhan, backend cap nhat so du 2 ben va ghi bank_transactions.
5. Dashboard dong bo giao dich dinh ky va cap nhat thong ke.

Ma lien quan:

- [frontend/assets/dashboard.js](frontend/assets/dashboard.js#L571)
- [ai-backend/main.py](ai-backend/main.py)

### 7.4 Xoa tai khoan boi admin

1. Ho so user duoc archive vao deleted_profiles.
2. Sau do moi xoa ban ghi trong users.
3. Dashboard admin co the xem lai ho so da xoa.

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L1218)
- [frontend/assets/admin.js](frontend/assets/admin.js#L70)

## 8. Bien moi truong quan trong

- APP_SESSION_SECRET: khoa bao mat session.
- GOOGLE_APPLICATION_CREDENTIALS: thong tin xac thuc Google Vision de OCR (neu can).

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L58)

## 9. Huong dan chay tren Windows

### 9.1 Chay nhanh (khuyen nghi)

1. Chay [RUN_FACE_AUTH.bat](RUN_FACE_AUTH.bat).
2. Script tu tao/cap nhat venv rieng trong LocalAppData.
3. Script khoi dong uvicorn tai cong 8001 va mo trinh duyet.

### 9.2 Setup tay

1. Chay [SETUP_WINDOWS_ENV.bat](SETUP_WINDOWS_ENV.bat).
2. Kich hoat venv.
3. Chay uvicorn.

Vi du:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ai-backend\requirements.txt
python -m uvicorn ai-backend.main:app --host 127.0.0.1 --port 8001 --reload
```

## 10. Tai khoan admin mac dinh

- Khi khoi tao DB unified, backend luon dam bao ton tai tai khoan admin.
- Mat khau mac dinh cua admin trong unified backend la Abc@123.

Ma lien quan:

- [ai-backend/main.py](ai-backend/main.py#L208)

Luu y:

- [php-backend/schema.sql](php-backend/schema.sql) co ghi chu mat khau mac dinh rieng cho mode PHP/MySQL.

## 11. Ghi chu tuong thich giua cac mode

Du an dang trong giai doan chuyen dan ve unified backend, vi vay co the ton tai khac biet giua:

- API trong [ai-backend/main.py](ai-backend/main.py)
- API trong [php-backend/api](php-backend/api)

Khuyen nghi lam viec:

1. Uu tien test/chay theo luong RUN_FACE_AUTH.bat.
2. Coi ai-backend/main.py la nguon su that cho hanh vi API runtime.
3. Dung php-backend lam tai lieu tham chieu hoac mode thay the khi can.

## 12. Checklist xac thuc sau cap nhat

1. Mo app va dang nhap admin.
2. Tao user moi hoac dang ky tu man hinh register.
3. Duyet user dang pending trong man hinh admin.
4. Dang nhap user bang mat khau.
5. Test cap nhat du lieu khuon mat.
6. Test xac thuc nguoi nhan va chuyen khoan.
7. Kiem tra lich su giao dich va thong ke.

## 13. Phan mo rong (tuy chon)

Phan nay chi giu 2 muc mo rong de tranh link ngoai de loi:

### 13.1 Quan ly DB bang DBeaver

Su dung DBeaver de quan sat/chinh sua du lieu trong [app.sqlite3](app.sqlite3) theo giao dien bang.

Goi y nhanh:

1. Mo DBeaver va tao ket noi SQLite.
2. Chon file [app.sqlite3](app.sqlite3).
3. Mo bang users, bank_transactions, deleted_profiles de kiem tra du lieu nghiep vu.

### 13.2 Public local bang localtunnel

Khi can chia se endpoint local tam thoi, chay lenh sau:

```powershell
npx localtunnel --port 8001
```

Lenh nay tao URL public tam thoi tro ve server dang chay tai cong 8001.

# THNN_Project
