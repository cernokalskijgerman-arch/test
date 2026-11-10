@echo off
title Glyph Studio - GitHub Backup
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-to-github.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    pause
)
