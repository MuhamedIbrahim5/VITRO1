# Run as Administrator: Right-click -> Run with PowerShell (Admin)
$ruleName = "Vitro Node 3001 Inbound"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Firewall rule already exists: $ruleName"
} else {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -Profile Private
    Write-Host "Created firewall rule: $ruleName (TCP 3001, Private network)"
}
Write-Host ""
Write-Host "From another device on same Wi-Fi, open:"
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress
Write-Host "  http://${ip}:3001"
