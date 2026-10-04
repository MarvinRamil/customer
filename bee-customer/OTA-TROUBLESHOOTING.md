# OTA Updates Troubleshooting Guide

## Quick Checklist

### ✅ Step 1: Verify Build Has Hook Code
**Problem:** Your current EAS build doesn't include the `useOTAUpdates` hook.

**Solution:**
```bash
# Rebuild with latest code
eas build --profile preview --platform android

# After build completes, install the new APK on your device
```

**How to verify:** After rebuilding, you should see these logs when the app starts:
- `========== OTA DEBUG ==========`
- `[OTA Updates] Checking status:`

---

### ✅ Step 2: Check if Updates are Enabled
**Problem:** `Updates.isEnabled` is `false`.

**What to check:**
1. Make sure you're using an **EAS build** (not `expo start`)
2. OTA updates **don't work** in development mode (`expo start`)

**Expected logs:**
- If running `expo start`: `[OTA Updates] Skipping - running in development mode`
- If EAS build: `[OTA Updates] Checking for updates...`

---

### ✅ Step 3: Verify Network Connectivity
**Problem:** `ERR_UPDATES_CHECK` error - device can't reach Expo's update server.

**Symptoms:**
```
[OTA Updates] Error checking for updates: Error: Call to function 'ExpoUpdates.checkForUpdateAsync' has been rejected.
??? Caused by: Failed to check for update] code: 'ERR_UPDATES_CHECK'
```

**Solutions:**
1. **Check device internet connection**
   - Open browser on device → Navigate to `https://u.expo.dev`
   - If it doesn't load → Network/firewall issue

2. **Verify device time is correct**
   - Settings → Date & Time
   - SSL certificates require valid time

3. **Try different network**
   - Switch between Wi-Fi and mobile data
   - Try different Wi-Fi network
   - Check for corporate firewall/proxy

4. **Verify update URL in logs**
   - Look for: `[OTA Updates] Update URL: https://u.expo.dev/0ddd0c10-7ef3-42d7-b2d8-25fc887dbe0d`
   - If it shows "Not configured" → Check `app.config.js`

---

### ✅ Step 4: Verify Update Configuration

**Check `app.config.js`:**
```javascript
updates: {
  url: "https://u.expo.dev/0ddd0c10-7ef3-42d7-b2d8-25fc887dbe0d",
},
runtimeVersion: {
  policy: "appVersion"  // Uses version from app.config.js (1.0.0)
},
```

**Check `eas.json`:**
```json
{
  "build": {
    "preview": {
      "channel": "preview"  // Must match when publishing updates
    }
  }
}
```

---

### ✅ Step 5: Verify Updates are Published

**Check if updates exist:**
```bash
# List updates for preview channel
eas update:list --branch preview

# List updates for development channel  
eas update:list --branch development
```

**If no updates found:**
```bash
# Publish an update
eas update --branch preview --message "Test OTA update"
```

---

### ✅ Step 6: Verify Channel and Runtime Version Match

**Problem:** Update published to wrong channel or runtime version mismatch.

**Check in logs:**
```
[OTA Updates] Current app state: {
  channel: "preview",           // Must match eas update --branch
  runtimeVersion: "1.0.0",      // Must match app.config.js version
}
```

**Solution:**
- Make sure `eas update --branch preview` matches your build's channel
- Make sure `app.config.js` version matches the update's runtime version

---

## Viewing Logs

### Windows PowerShell Commands:

**1. Stream OTA logs in real-time:**
```powershell
C:\Users\Inso\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -c; C:\Users\Inso\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat | Select-String -Pattern "OTA|Updates|DEBUG|Checking status|Update URL"
```

**2. Use the script:**
```powershell
.\view-ota-logs.ps1
```

**3. View ALL React Native logs:**
```powershell
C:\Users\Inso\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat | Select-String -Pattern "ReactNativeJS"
```

---

## Common Issues

### Issue 1: No OTA Logs Appearing
**Cause:** Build doesn't have the hook code.

**Solution:** Rebuild the app with `eas build --profile preview --platform android`

---

### Issue 2: "Updates are not enabled"
**Cause:** Running in development mode (`expo start`).

**Solution:** Use an EAS build instead.

---

### Issue 3: ERR_UPDATES_CHECK Error
**Cause:** Network connectivity issue.

**Solutions:**
- Check device internet connection
- Verify device can access `https://u.expo.dev`
- Check device time is correct
- Try different network (Wi-Fi vs mobile data)
- Check for firewall/proxy blocking connection

---

### Issue 4: "No update available"
**Cause:** No updates published to the channel, or channel/runtimeVersion mismatch.

**Solutions:**
- Publish an update: `eas update --branch preview`
- Verify channel matches: `eas update:list --branch preview`
- Check runtime version matches `app.config.js` version

---

### Issue 5: Update Downloaded But Not Applied
**Cause:** `reloadAsync()` didn't execute or failed silently.

**Check logs for:**
- `[OTA Updates] Update downloaded successfully, reloading app to apply...`
- `[OTA Updates] reloadAsync completed but app did not reload`

**Solution:** Manually restart the app after update is downloaded.

---

## Testing Workflow

1. **Build the app:**
   ```bash
   eas build --profile preview --platform android
   ```

2. **Install the APK on your device**

3. **Start logcat:**
   ```powershell
   .\view-ota-logs.ps1
   ```

4. **Launch the app** - You should see:
   - `========== OTA DEBUG ==========`
   - `[OTA Updates] Checking status:`
   - `[OTA Updates] Checking for updates...`
   - `[OTA Updates] Update URL: ...`

5. **Make a code change** (e.g., change text in a component)

6. **Publish an update:**
   ```bash
   eas update --branch preview --message "Test update"
   ```

7. **Restart the app** - It should check for updates and apply them

---

## Verification Commands

```bash
# Check EAS project info
eas project:info

# List published updates
eas update:list --branch preview

# Check build info
eas build:list --platform android --limit 1

# View update details
eas update:view <update-id>
```

