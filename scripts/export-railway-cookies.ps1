# Export youtube_cookies.txt as base64 for Railway variable YOUTUBE_COOKIES_BASE64
$root = Split-Path $PSScriptRoot -Parent
$bat = Join-Path $root "export_youtube_cookies.bat"
$cookies = Join-Path $root "youtube_cookies.txt"

if (Test-Path $bat) {
    Write-Host "Refreshing cookies from Chrome..."
    & $bat
}

if (-not (Test-Path $cookies)) {
    Write-Host "ERROR: youtube_cookies.txt not found. Run export_youtube_cookies.bat first."
    exit 1
}

$bytes = [IO.File]::ReadAllBytes($cookies)
$b64 = [Convert]::ToBase64String($bytes)
Write-Host ""
Write-Host "=== Railway setup ==="
Write-Host "1. Open Railway project -> Variables"
Write-Host "2. Add variable: YOUTUBE_COOKIES_BASE64"
Write-Host "3. Paste this value:"
Write-Host ""
Write-Host $b64
Write-Host ""
Write-Host "4. Click Redeploy on the latest deployment"
Write-Host ""
