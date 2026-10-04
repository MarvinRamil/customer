# OTA Logs Viewer Script
# This script clears the logcat buffer and streams OTA update logs

Write-Host "Clearing logcat buffer..." -ForegroundColor Yellow
& "C:\Users\Inso\AppData\Local\Android\Sdk\platform-tools\adb.exe" logcat -c

Write-Host "`nStreaming OTA logs (Press Ctrl+C to stop)..." -ForegroundColor Green
Write-Host "Launch your app now to see OTA update logs`n" -ForegroundColor Cyan

# Filter for OTA-related logs with multiple patterns
& "C:\Users\Inso\AppData\Local\Android\Sdk\platform-tools\adb.exe" logcat | Select-String -Pattern "OTA|Updates|DEBUG|Checking status|Update URL|Error checking|Update available|Update fetched|reloadAsync" -CaseSensitive:$false

