@echo off
title Glyph Studio - Expo Go
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-expo.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    pause
)
