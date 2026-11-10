@echo off
setlocal enabledelayedexpansion

title Glyph Studio - Expo Go Launcher

echo ========================================================
echo       NOTHING GLYPH STUDIO - EXPO GO LAUNCHER
echo ========================================================
echo.

cd /d "%~dp0expo-glyph-studio"
if not exist "package.json" (
    echo [ERROR] Could not find expo-glyph-studio folder!
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo [1/3] Checking port 8081...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8081" ^| findstr "LISTENING"') do (
    echo Freeing occupied port 8081 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] Checking local dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo [3/3] Starting Metro Bundler for Expo Go...
echo.
echo --------------------------------------------------------
echo Scan the QR code below with the Expo Go app on your phone!
echo Press 'r' to reload, 'c' to show QR code again.
echo --------------------------------------------------------
echo.

if exist "node_modules\.bin\expo.cmd" (
    call "node_modules\.bin\expo.cmd" start -c
) else (
    call npx expo start -c
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Expo server exited with error code: %ERRORLEVEL%
)

echo.
echo Press any key to close this window...
pause >nul
