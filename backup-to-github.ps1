# Nothing Glyph Studio - Automated GitHub Backup
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$gitDir = "C:\Users\KAORU\AppData\Local\Programs\Git\cmd"
if (Test-Path $gitDir) {
    $env:Path = "$gitDir;" + $env:Path
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         NOTHING GLYPH STUDIO - GITHUB BACKUP           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ОШИБКА] Git не найден в системе." -ForegroundColor Red
    Write-Host "Нажмите любую клавишу для выхода..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 1. Initialize Git if needed
if (-not (Test-Path ".git")) {
    Write-Host "[1/3] Инициализация репозитория Git..." -ForegroundColor Yellow
    git init -b main | Out-Null
    git config user.name "Nothing Creator"
    git config user.email "creator@glyphstudio.local"
    git config credential.helper manager
}

# 2. Check Remote URL
$origin = git remote get-url origin 2>$null
if ($origin) {
    Write-Host "[+] Привязан репозиторий: " -NoNewline -ForegroundColor Green
    Write-Host $origin -ForegroundColor White
    Write-Host "Хотите изменить ссылку на репозиторий? (y/N): " -NoNewline -ForegroundColor Gray
    $change = Read-Host
    if ($change -match "^[yYдД]") {
        $origin = $null
        git remote remove origin 2>$null
    }
}

if (-not $origin) {
    Write-Host ""
    Write-Host "--------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "ИНСТРУКЦИЯ ПО ПРИВЯЗКЕ GITHUB:" -ForegroundColor Yellow
    Write-Host "1. Откройте в браузере: https://github.com/new" -ForegroundColor White
    Write-Host "2. Введите имя репозитория (например: glyph-studio)" -ForegroundColor White
    Write-Host "3. Нажмите кнопку 'Create repository' (Создать)" -ForegroundColor White
    Write-Host "4. Скопируйте ссылку HTTPS (например: https://github.com/ВАШ_НИК/glyph-studio.git)" -ForegroundColor White
    Write-Host "--------------------------------------------------------" -ForegroundColor Yellow
    Write-Host ""
    $repoUrl = Read-Host "Вставьте сюда ссылку на ваш репозиторий GitHub"
    $repoUrl = $repoUrl.Trim()

    if ([string]::IsNullOrWhiteSpace($repoUrl)) {
        Write-Host ""
        Write-Host "[ОТМЕНА] Ссылка не была введена." -ForegroundColor Red
        Write-Host "Нажмите любую клавишу для выхода..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }

    git remote remove origin 2>$null
    git remote add origin $repoUrl
    Write-Host "[+] Ссылка успешно сохранена!" -ForegroundColor Green
}

# 3. Commit changes
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host ""
Write-Host "[2/3] Подготовка файлов и сохранение бэкапа..." -ForegroundColor Yellow
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "Backup: $timestamp" | Out-Null
    Write-Host "[+] Создан снимок проекта ($timestamp)" -ForegroundColor Green
} else {
    Write-Host "[ИНФО] Все файлы уже зафиксированы в истории." -ForegroundColor Gray
}

# 4. Push to GitHub
Write-Host ""
Write-Host "[3/3] Отправка данных на GitHub (git push)..." -ForegroundColor Yellow
Write-Host "Если появится окно входа в браузер - нажмите 'Authorize' в браузере." -ForegroundColor Gray

git branch -M main | Out-Null
$pushOutput = git push -u origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host " [УСПЕХ] Бэкап успешно отправлен на GitHub!            " -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "Репозиторий обновлен. GitHub Actions автоматически" -ForegroundColor White
    Write-Host "создаст релиз и zip-архив с резервной копией." -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host " [ОШИБКА ПРИ ОТПРАВКЕ НА GITHUB]                       " -ForegroundColor Red
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host $pushOutput -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Возможные причины:" -ForegroundColor White
    Write-Host "1. Репозиторий еще не создан на https://github.com/new" -ForegroundColor Gray
    Write-Host "2. Неправильная ссылка или нет прав доступа к аккаунту." -ForegroundColor Gray
    Write-Host "3. В репозитории на GitHub уже были файлы (README/License). В таком случае запустите: git pull origin main --rebase" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Нажмите любую клавишу для закрытия окна..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
