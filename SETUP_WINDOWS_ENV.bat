@echo off
setlocal

set "ROOT=%~dp0"
set "AIDIR=%ROOT%ai-backend"
set "VENV=%ROOT%.venv"
set "PY_CMD=py -3.11"

echo ===== Final_THNN Windows Setup =====
echo [1/6] Kiem tra Python 3.11...
%PY_CMD% --version >nul 2>&1
if errorlevel 1 (
    echo Khong tim thay Python 3.11 qua py launcher.
    echo Vui long cai Python 3.11 roi chay lai script nay.
    goto :error
)

echo [2/6] Tao virtual environment tai .venv...
if not exist "%VENV%\Scripts\python.exe" (
    %PY_CMD% -m venv "%VENV%"
    if errorlevel 1 goto :error
) else (
    echo .venv da ton tai, bo qua buoc tao moi.
)

echo [3/6] Nang cap pip...
"%VENV%\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto :error

echo [4/6] Cai dat dependencies backend (bao gom EasyOCR cho CCCD)...
"%VENV%\Scripts\python.exe" -m pip install -r "%AIDIR%\requirements.txt"
if errorlevel 1 goto :error

echo [5/6] Cai dat face-recognition stack cho Windows...
"%VENV%\Scripts\python.exe" -m pip install dlib-bin==20.0.1
if errorlevel 1 goto :error
"%VENV%\Scripts\python.exe" -m pip install face-recognition-models Pillow
if errorlevel 1 goto :error
"%VENV%\Scripts\python.exe" -m pip install face-recognition --no-deps
if errorlevel 1 goto :error

echo [6/6] Kiem tra import cv2, face_recognition, easyocr...
"%VENV%\Scripts\python.exe" -c "import cv2, face_recognition, easyocr; print('OK', cv2.__version__)"
if errorlevel 1 goto :error

echo.
echo Setup hoan tat. Cach chay app:
echo - Nhan dup file RUN_FACE_AUTH.bat
echo Hoac:
echo - %VENV%\Scripts\python.exe -m uvicorn ai-backend.main:app --host 127.0.0.1 --port 8001 --reload
echo.
exit /b 0

:error
echo.
echo Setup that bai. Kiem tra log ben tren.
exit /b 1
