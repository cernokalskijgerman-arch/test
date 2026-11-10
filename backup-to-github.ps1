# Nothing Glyph Studio - Automated GitHub Backup
$env:Path = "$env:LOCALAPPDATA\Programs\Git\cmd;" + $env:Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         NOTHING GLYPH STUDIO - GITHUB BACKUP           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ОШИБКА] Git не найден." -ForegroundColor Red
    pause
    exit 1
}

if (-not (Test-Path ".git")) {
    Write-Host "[1/4] Инициализация Git репозитория..." -ForegroundColor Yellow
    git init -b main
    git config user.name "Nothing Creator"
    git config user.email "creator@glyphstudio.local"
}

$origin = git remote get-url origin 2>$null
if (-not $origin) {
    Write-Host "[!] Репозиторий GitHub еще не привязан." -ForegroundColor Yellow
    Write-Host "1. Создайте репозиторий на https://github.com/new"
    $repoUrl = Read-Host "Вставьте ссылку на ваш GitHub репозиторий"
    if ([string]::IsNullOrWhiteSpace($repoUrl)) {
        Write-Host "[ОШИБКА] Ссылка не введена." -ForegroundColor Red
        pause
        exit 1
    }
    git remote add origin $repoUrl
    Write-Host "[+] Репозиторий привязан: $repoUrl" -ForegroundColor Green
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "[2/4] Подготовка файлов и коммит..." -ForegroundColor Yellow
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "Automated Backup: $timestamp"
} else {
    Write-Host "[ИНФО] Нет новых изменений для коммита." -ForegroundColor Gray
}

Write-Host "[3/4] Выкатка бэкапа на GitHub..." -ForegroundColor Yellow
git branch -M main
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "[УСПЕХ] Бэкап успешно выкачен на GitHub!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ВНИМАНИЕ] Проверьте доступ к репозиторию." -ForegroundColor Red
}

Write-Host ""
pause
