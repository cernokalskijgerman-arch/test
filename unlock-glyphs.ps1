# Nothing Glyph Studio - 1-Click Glyph Unlock & APK Installer
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "    NOTHING PHONE (3A PRO) - GLYPH HARDWARE UNLOCKER    " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$adbPath = Join-Path $PSScriptRoot "tools\platform-tools\adb.exe"
$apkPath = Join-Path $PSScriptRoot "NothingGlyphStudio-debug.apk"

if (-not (Test-Path $adbPath)) {
    Write-Host "[ОШИБКА] ADB не найден в tools\platform-tools!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "ШАГ 1: ПРОВЕРКА ПОДКЛЮЧЕНИЯ СМАРТФОНА" -ForegroundColor Yellow
Write-Host "1. Подключите ваш Nothing Phone проводом USB к компьютеру." -ForegroundColor White
Write-Host "2. Убедитесь, что на телефоне включена 'Отладка по USB':" -ForegroundColor White
Write-Host "   (Настройки -> Система -> Для разработчиков -> Отладка по USB = ВКЛ)" -ForegroundColor Gray
Write-Host "3. Если на экране телефона появится окно 'Разрешить отладку по USB' -" -ForegroundColor White
Write-Host "   поставьте галочку 'Всегда разрешать' и нажмите 'РАЗРЕШИТЬ'." -ForegroundColor Green
Write-Host ""
Write-Host "Поиск подключенных устройств Nothing..." -ForegroundColor Yellow

$devicesOutput = & $adbPath devices
Write-Host $devicesOutput -ForegroundColor Gray

# Wait for authorized device
$deviceFound = $false
while (-not $deviceFound) {
    $lines = (& $adbPath devices) -split "`r?`n" | Where-Object { $_ -match "\bdevice\b" -and $_ -notmatch "List of" }
    if ($lines) {
        $deviceFound = $true
        Write-Host "[+] Смартфон успешно подключен и авторизован!" -ForegroundColor Green
    } else {
        $unauth = (& $adbPath devices) -split "`r?`n" | Where-Object { $_ -match "\bunauthorized\b" }
        if ($unauth) {
            Write-Host "[!] ВНИМАНИЕ: Телефон подключен, но не подтверждена отладка!" -ForegroundColor Magenta
            Write-Host "--> РАЗБЛОКИРУЙТЕ ЭКРАН ТЕЛЕФОНА И НАЖМИТЕ 'РАЗРЕШИТЬ' В ПОЯВИВШЕМСЯ ОКНЕ!" -ForegroundColor Yellow
        } else {
            Write-Host "[-] Смартфон не обнаружен. Проверьте провод и режим 'Отладка по USB'." -ForegroundColor Gray
        }
        Write-Host "Нажмите ENTER для повторной проверки или Ctrl+C для выхода..." -ForegroundColor White
        $null = Read-Host
    }
}

Write-Host ""
Write-Host "ШАГ 2: РАЗБЛОКИРОВКА АППАРАТНОГО ДОСТУПА К ГЛИФАМ..." -ForegroundColor Yellow
& $adbPath shell settings put global nt_glyph_interface_debug_enable 1

$val = (& $adbPath shell settings get global nt_glyph_interface_debug_enable).Trim()
if ($val -eq "1") {
    Write-Host "[УСПЕХ] Аппаратный интерфейс Glyph разблокирован! (nt_glyph_interface_debug_enable = 1)" -ForegroundColor Green
} else {
    Write-Host "[ПРЕДУПРЕЖДЕНИЕ] Команда выполнена, значение: $val" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "ШАГ 3: УСТАНОВКА ТЕСТОВОГО APK НА СМАРТФОН..." -ForegroundColor Yellow
if (Test-Path $apkPath) {
    Write-Host "Удаление старой конфликтующей версии (если была)..." -ForegroundColor Gray
    & $adbPath uninstall com.nothing.glyphstudio 2>$null | Out-Null
    
    Write-Host "Установка NothingGlyphStudio-debug.apk на телефон..." -ForegroundColor White
    $installResult = & $adbPath install -r -d $apkPath
    Write-Host $installResult -ForegroundColor Cyan
    
    if ($installResult -match "Success") {
        Write-Host ""
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "  ГОТОВО! ПРИЛОЖЕНИЕ УСТАНОВЛЕНО И ГОТОВО К ТЕСТАМ!    " -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "Откройте 'Glyph Studio' в меню приложений на телефоне." -ForegroundColor White
        Write-Host "Нажмите 'ВКЛ ВСЕ' или 'БУТЫЛОЧКА' - физические диоды на спинке зажгутся!" -ForegroundColor Cyan
        
        Write-Host ""
        Write-Host "Запустить приложение на телефоне прямо сейчас? (Y/n): " -NoNewline -ForegroundColor Yellow
        $runApp = Read-Host
        if ($runApp -notmatch "^[nNнН]") {
            & $adbPath shell monkey -p com.nothing.glyphstudio -c android.intent.category.LAUNCHER 1 | Out-Null
            Write-Host "[+] Приложение запущено на экране смартфона!" -ForegroundColor Green
        }
    } else {
        Write-Host "[!] Ошибка установки через ADB: $installResult" -ForegroundColor Red
        Write-Host "Вы можете установить NothingGlyphStudio-debug.apk вручную, предварительно удалив старое приложение." -ForegroundColor Yellow
    }
} else {
    Write-Host "[!] Файл APK не найден в $apkPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "Нажмите любую клавишу для закрытия..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
