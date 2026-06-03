@echo off
title Antigravity POS Web Server
echo =============================================================
echo               ANTIGRAVITY POS WEB SERVER
echo =============================================================
echo.
echo Dang kiem tra moi truong PHP...

set PHP_PATH=php
where php >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo - Da tim thay lenh 'php' trong PATH cua Windows.
    goto start_server
)

:: Check standard XAMPP paths
if exist "C:\xampp\php\php.exe" (
    set PHP_PATH="C:\xampp\php\php.exe"
    echo - Da tim thay PHP tai C:\xampp\php\php.exe (XAMPP)
    goto start_server
)

:: Check Laragon path (finds first php folder under bin\php)
for /d %%i in ("C:\laragon\bin\php\*") do (
    if exist "%%i\php.exe" (
        set PHP_PATH="%%i\php.exe"
        echo - Da tim thay PHP tai %%i\php.exe (Laragon)
        goto start_server
    )
)

:: Check standard C:\Program Files paths
if exist "C:\Program Files\PHP\php.exe" (
    set PHP_PATH="C:\Program Files\PHP\php.exe"
    echo - Da tim thay PHP tai C:\Program Files\PHP\php.exe
    goto start_server
)

echo.
echo [!] LOI: Khong tim thay chuong trinh php.exe.
echo - Hay chac chan rang ban da cai dat XAMPP / Laragon hoac da them PHP vao bien moi truong PATH.
echo - Hoac ban co the mo file 'run.bat' bang Notepad de cau hinh duong dan PHP thu cong.
echo.
pause
exit /b 1

:start_server
echo.
echo - Thiet lap Web Server tai cong 8000...
echo - URL Dang nhap: http://localhost:8000/web/index.html
echo.
echo [INFO] Dang mo trinh duyet va khoi chay server. Nhan Ctrl+C de dung...
echo.

:: Open default browser to login page
start http://localhost:8000/web/index.html

:: Start PHP built-in web server
%PHP_PATH% -S localhost:8000

pause
