@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title Glyph Studio - GitHub Backup

set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"

echo ========================================================
echo         NOTHING GLYPH STUDIO - GITHUB BACKUP
echo ========================================================
echo.

cd /d "%~dp0"

where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Git не найден в системе.
    pause
    exit /b 1
)

:: Check if git repository is initialized
if not exist ".git" (
    echo [1/4] Инициализация локального Git репозитория...
    call git init -b main
    call git config user.name "Nothing Creator"
    call git config user.email "creator@glyphstudio.local"
)

:: Check if remote origin exists
git remote get-url origin >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Удалённый репозиторий GitHub еще не привязан.
    echo.
    echo 1. Создайте новый репозиторий на https://github.com/new
    echo 2. Скопируйте ссылку на него (HTTPS)
    echo.
    set /p REPO_URL="Вставьте ссылку на ваш GitHub репозиторий: "
    if "!REPO_URL!"=="" (
        echo [ОШИБКА] Ссылка не введена. Отмена бэкапа.
        pause
        exit /b 1
    )
    call git remote add origin !REPO_URL!
    echo [+] Удалённый репозиторий привязан: !REPO_URL!
    echo.
)

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2% %datetime:~8,2%:%datetime:~10,2%:%datetime:~12,2%"

echo [2/4] Подготовка файлов и сохранение снимка...
call git add .

call git diff --cached --quiet
if %ERRORLEVEL% EQU 0 (
    echo [ИНФО] Новых изменений нет, файлы уже закоммичены.
) else (
    call git commit -m "Automated Backup: %TIMESTAMP%"
)

echo [3/4] Выкатка бэкапа на GitHub...
call git branch -M main
call git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo [УСПЕХ] Бэкап успешно выкачен на GitHub!
    echo Репозиторий обновлён. GitHub Actions автоматически создаст
    echo архив релиза и сохранит резервную копию.
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo [ВНИМАНИЕ] Произошла ошибка при push на GitHub.
    echo Убедитесь, что вы авторизованы в GitHub и имеете права
    echo на запись в указанный репозиторий.
    echo ========================================================
)

echo.
pause
