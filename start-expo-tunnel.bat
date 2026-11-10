@echo off
title Glyph Studio - Expo Go (Tunnel)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-expo-tunnel.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    pause
)
