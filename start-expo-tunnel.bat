@echo off
setlocal enabledelayedexpansion

title Glyph Studio - Expo Go (Tunnel Mode)

echo ========================================================
echo   NOTHING GLYPH STUDIO - EXPO GO (TUNNEL MODE)
echo ========================================================
echo.

cd /d "%~dp0expo-glyph-studio"
if not exist "package.json" (
    echo [ERROR] Could not find expo-glyph-studio folder!
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo [1/2] Checking local dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo [2/2] Starting Metro Bundler with Cloudflare Tunnel...
echo.
echo --------------------------------------------------------
echo Tunnel mode works even if your phone is on cellular data!
echo Scan the QR code below with the Expo Go app.
echo --------------------------------------------------------
echo.

if exist "node_modules\.bin\expo.cmd" (
    call "node_modules\.bin\expo.cmd" start --tunnel -c
) else (
    call npx expo start --tunnel -c
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Expo server exited with error code: %ERRORLEVEL%
)

echo.
echo Press any key to close this window...
pause >nul
