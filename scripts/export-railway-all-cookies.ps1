# Export all cookies as base64 for Railway environment variables
$root = Split-Path $PSScriptRoot -Parent

function To-RailwayVar($path, $varName) {
    if (-not (Test-Path $path)) {
        Write-Host "SKIP $varName - file not found: $path" -ForegroundColor Yellow
        return
    }
    $bytes = [IO.File]::ReadAllBytes($path)
    $b64 = [Convert]::ToBase64String($bytes)
    Write-Host ""
    Write-Host "========== $varName ==========" -ForegroundColor Cyan
    Write-Host "Railway -> Variables -> New Variable -> Name: $varName"
    Write-Host "Paste this value:"
    Write-Host ""
    Write-Host $b64
    Write-Host ""
}

Write-Host "Vitro Railway cookies export"
Write-Host "Project: vitro1-production-be78.up.railway.app"
Write-Host ""

To-RailwayVar (Join-Path $root "www.facebook.com_cookies.txt") "FACEBOOK_COOKIES_BASE64"
To-RailwayVar (Join-Path $root "cookies.txt") "INSTAGRAM_COOKIES_BASE64"
To-RailwayVar (Join-Path $root "youtube_cookies.txt") "YOUTUBE_COOKIES_BASE64"

Write-Host "After adding variables: Railway -> Deployments -> Redeploy" -ForegroundColor Green
Write-Host "Check: https://vitro1-production-be78.up.railway.app/health"
Write-Host "  facebookCookies: true"
Write-Host "  instagramCookies: true"
