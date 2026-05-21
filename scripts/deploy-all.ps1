# Deploy Vitro: sync, git push, Firebase
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "=== 1. Sync public/ ===" 
node scripts/sync-public.js

Write-Host "`n=== 2. Git push (triggers Railway if connected) ==="
git add -A
$status = git status --porcelain
if ($status) {
    git commit -m "deploy: sync and update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}
git push origin main

Write-Host "`n=== 3. Firebase hosting ==="
npm run deploy:firebase

Write-Host "`n=== Done ==="
Write-Host "Local:  http://localhost:3001"
Write-Host "Firebase: https://vitro-hosting-20260520.web.app"
Write-Host "Health:   https://vitro1-production-be78.up.railway.app/health"
Write-Host ""
Write-Host "If /health has no 'version' field -> Redeploy on Railway dashboard (see DEPLOY_AR.md)"
