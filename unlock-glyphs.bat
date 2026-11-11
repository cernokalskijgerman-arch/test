@echo off
chcp 65001 >nul
title Nothing Glyph Unlocker & Installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0unlock-glyphs.ps1"
pause
