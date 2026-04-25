@echo off
setlocal

set "ROOT=%~dp0"
set "AIDIR=%ROOT%ai-backend"
set "VENV_ROOT=%LOCALAPPDATA%\Final_THNN"
set "VENV=%VENV_ROOT%\.venv311"
set "PY_CMD=py -3.11"
set "CMAKE_ARGS=-DDLIB_USE_CUDA=OFF -DCMAKE_DISABLE_FIND_PACKAGE_CUDA=ON"
set "CUDA_PATH="
set "CUDA_HOME="
set "GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbz9cGbcJ1Tbt8fz9Y63YIlD0EekD5kKMUPaq0YaAXKcaHqKDJ5PeJ6WN6WOvJ1Ko0pV/exec"

echo CUDA da duoc tat cho buoc cai dlib.
echo Bat buoc dung Python 3.11 de tranh loi voi Python 3.13+.

%PY_CMD% --version >nul 2>&1
if errorlevel 1 (
    echo Khong tim thay Python 3.11.
    echo Hay cai Python 3.11 hoac mo py launcher va them ban 3.11.
    goto :error
)

if not exist "%VENV_ROOT%" mkdir "%VENV_ROOT%"

if exist "%VENV%\pyvenv.cfg" (
    findstr /b /c:"version = 3.11" "%VENV%\pyvenv.cfg" >nul
    if errorlevel 1 (
        echo Phat hien venv khong phai Python 3.11. Dang tao lai...
        rmdir /s /q "%VENV%"
    )
)

echo [1/4] Kiem tra Python environment...
if not exist "%VENV%\Scripts\python.exe" (
    %PY_CMD% -m venv "%VENV%"
    if errorlevel 1 goto :error

    "%VENV%\Scripts\python.exe" -m pip install --upgrade pip
    if errorlevel 1 goto :error

    echo [2/4] Cai dat dependencies lan dau...
    call :install_deps
    if errorlevel 1 goto :error
) else (
    echo [2/4] Dong bo dependencies...
    call :install_deps
    if errorlevel 1 goto :error
)

echo [3/4] Khoi dong server hop nhat...
echo GAS URL da duoc cau hinh: %GOOGLE_APPS_SCRIPT_URL%
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://127.0.0.1:8001/'"
cd /d "%AIDIR%"

echo [4/4] Mo trinh duyet tai http://127.0.0.1:8001/
"%VENV%\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
exit /b 0

:install_deps
set /a RETRY=0
:install_retry
set /a RETRY+=1
echo Dang cai dependencies (lan %RETRY%/3)...
"%VENV%\Scripts\python.exe" -m pip install --no-cache-dir -r "%AIDIR%\requirements.txt"
if errorlevel 0 exit /b 0

if %RETRY% GEQ 3 (
    echo Cai dependencies that bai sau 3 lan thu.
    exit /b 1
)

echo Gap loi lock file tam thoi, se thu lai sau 4 giay...
timeout /t 4 /nobreak >nul
goto :install_retry

:error
echo.
echo Khoi dong that bai. Kiem tra log ben tren.
pause
exit /b 1
