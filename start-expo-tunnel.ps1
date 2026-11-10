# Nothing Glyph Studio - Expo Go Launcher (Tunnel Mode)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   NOTHING GLYPH STUDIO - EXPO GO (TUNNEL MODE)        " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$projectDir = Join-Path $PSScriptRoot "expo-glyph-studio"
if (-not (Test-Path $projectDir)) {
    Write-Host "[ОШИБКА] Папка expo-glyph-studio не найдена!" -ForegroundColor Red
    pause
    exit 1
}

Set-Location $projectDir

# 1. Free port 8081 if occupied
$activeConns = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($activeConns) {
    Write-Host "[1/2] Освобождение порта 8081..." -ForegroundColor Yellow
    foreach ($conn in $activeConns) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "[1/2] Порт 8081 свободен." -ForegroundColor Green
}

Write-Host "[2/2] Запуск Metro Bundler с туннелем Cloudflare..." -ForegroundColor Yellow
Write-Host ""
Write-Host "--------------------------------------------------------" -ForegroundColor White
Write-Host "Туннель работает, даже если телефон на мобильном интернете!" -ForegroundColor Cyan
Write-Host "Отсканируйте появившийся QR-код в приложении Expo Go." -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor White
Write-Host ""

$expoBin = Join-Path $projectDir "node_modules\.bin\expo.cmd"
if (Test-Path $expoBin) {
    & $expoBin start --tunnel -c
} else {
    npx expo start --tunnel -c
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ОШИБКА] Metro Bundler завершился с кодом: $LASTEXITCODE" -ForegroundColor Red
    pause
}
