# Export cookies.txt as base64 for Railway INSTAGRAM_COOKIES_BASE64
$root = Split-Path $PSScriptRoot -Parent
$bat = Join-Path $root "export-instagram-cookies.bat"
$cookies = Join-Path $root "cookies.txt"

if (Test-Path $bat) {
    Write-Host "Refreshing Instagram cookies from Chrome..."
    cmd /c $bat
}

if (-not (Test-Path $cookies)) {
    Write-Host "ERROR: cookies.txt not found. Login to Instagram in Chrome, then run export-instagram-cookies.bat"
    exit 1
}

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($cookies))
Write-Host ""
Write-Host "Railway -> Variables -> INSTAGRAM_COOKIES_BASE64"
Write-Host ""
Write-Host $b64
Write-Host ""
Write-Host "Then Redeploy Railway."
