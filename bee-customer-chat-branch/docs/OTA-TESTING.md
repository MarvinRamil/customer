# OTA (Over-The-Air) Updates Testing Guide

This guide explains how to test OTA updates for the Bee Customer app using Expo Updates.

## Overview

OTA updates allow you to push JavaScript and asset updates to your app without requiring users to download a new build from the app stores. The app uses Expo Updates (`expo-updates`) with EAS Update service.

## Prerequisites

1. **EAS CLI installed and authenticated:**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **EAS Build installed on device:**
   - OTA updates **work in EAS builds** (built with `eas build`)
   - They **do NOT work** in development mode (`expo start` - Metro bundler)
   - They **DO work** in development builds (EAS Build with `development` profile)
   - Available build profiles: `development`, `preview`, or `production`

3. **Update channels configured:**
   - `development` - for development builds
   - `preview` - for internal testing (APK/IPA)
   - `production` - for production releases

## Testing Workflow

### Step 1: Build the App

First, create a build for testing. You can use any profile:

**For Development Builds (with dev client):**
```bash
eas build --platform android --profile development
eas build --platform ios --profile development
```

**For Preview Builds (APK/IPA for testing):**
```bash
npm run build:preview:android
# or
eas build --platform android --profile preview

npm run build:preview:ios
# or
eas build --platform ios --profile preview
```

**For Production Builds:**
```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

**Note:** All EAS builds support OTA updates. The difference is the channel they use:
- `development` profile → `development` channel
- `preview` profile → `preview` channel  
- `production` profile → `production` channel

### Step 2: Install the Build

1. Download the build from EAS (APK for Android, IPA for iOS)
2. Install it on your test device:
   - **Android:** Transfer APK and install manually
   - **iOS:** Install via TestFlight or ad-hoc distribution

### Step 3: Make a Code Change

Make a visible change to test the update. For example, modify a text string or add a console log:

```tsx
// Example: Change a text in app/(tabs)/index.tsx
<Text>Hello from OTA Update! 🚀</Text>
```

### Step 4: Publish an Update

Publish the update to the appropriate channel:

**For Preview Channel:**
```bash
npm run update:preview
# or
eas update --branch preview --message "Test OTA update"
```

**For Production Channel:**
```bash
eas update --branch production --message "Production update"
```

**For Development Channel:**
```bash
eas update --branch development --message "Development update"
```

**Note:** Make sure you publish to the same channel as your build profile:
- Development builds → `development` channel
- Preview builds → `preview` channel
- Production builds → `production` channel

### Step 5: Test the Update

1. **Open the installed app** on your device
2. **Check the console logs** (if using a debugger):
   - Look for `[OTA Updates]` logs
   - The app automatically checks for updates on launch
   - You should see logs like:
     ```
     [OTA Updates] Checking for updates...
     [OTA Updates] Update available, downloading...
     [OTA Updates] Update fetched: { isNew: true, ... }
     [OTA Updates] Reloading app to apply update...
     ```

3. **Verify the change:**
   - The app should reload automatically
   - Your code change should be visible
   - Check that the update was applied

## Viewing Console Logs

To debug OTA updates, you need to see the console logs. Here are different methods depending on your setup:

### Method 1: Development Mode (`expo start`)

If running in development mode, logs appear in the Metro bundler terminal:

```bash
npm start
# or
expo start
```

Logs will appear directly in the terminal where you ran the command.

### Method 2: Development Builds (Dev Client)

If using a development build (EAS Build with `development` profile):

**Option A: Metro Bundler (Recommended)**
1. Start Metro bundler:
   ```bash
   npm start
   # or
   expo start --dev-client
   ```
2. Connect your device to the dev client
3. Logs appear in the Metro bundler terminal

**Option B: Remote Debugging**
1. Shake device (or Cmd+D on iOS simulator, Cmd+M on Android emulator)
2. Select "Debug Remote JS"
3. Open Chrome DevTools (usually opens automatically)
4. View logs in Chrome DevTools Console

**Option C: React Native Debugger**
1. Install React Native Debugger: https://github.com/jhen0409/react-native-debugger
2. Shake device and select "Debug"
3. View logs in React Native Debugger

### Method 3: Production/Preview Builds (Standalone Apps)

For standalone builds (preview/production), console logs **do NOT appear in Metro bundler**. You must use device-specific logging:

**Option A: Android Logcat (Android - Recommended)**

**Step 1: Find ADB (Android Debug Bridge)**

**If you have Android Studio installed (recommended):**
ADB is already installed! Find it at:
```
C:\Users\<YourUsername>\AppData\Local\Android\Sdk\platform-tools\adb.exe
```

**Option A: Use full path (quick test):**
```powershell
# For user "Inso" (update if different):
C:\Users\Inso\AppData\Local\Android\Sdk\platform-tools\adb.exe devices

# Or use environment variable (works for any user):
$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe devices
```

**Option B: Add to PATH (permanent solution):**
1. Find your Android SDK path:
   - Open Android Studio
   - File → Settings → Appearance & Behavior → System Settings → Android SDK
   - Note the "Android SDK Location" (usually `C:\Users\<YourUsername>\AppData\Local\Android\Sdk`)
2. Add platform-tools to PATH:
   - Press `Win + X` → System → Advanced system settings → Environment Variables
   - Edit "Path" under "User variables"
   - Click "New" and add: `C:\Users\<YourUsername>\AppData\Local\Android\Sdk\platform-tools`
   - Click OK on all dialogs
   - **Restart PowerShell/terminal** for changes to take effect

**If you don't have Android Studio:**
1. Download Android SDK Platform Tools: https://developer.android.com/tools/releases/platform-tools
2. Extract to a folder (e.g., `C:\platform-tools`)
3. Add to PATH (same steps as above)

**Or use Chocolatey (if installed):**
```powershell
choco install adb
```

**Or use Scoop (if installed):**
```powershell
scoop install adb
```

**Step 2: Verify ADB is installed**
```powershell
adb version
```

**Step 3: Connect device and view logs**
```powershell
# 1. Connect Android device via USB
# 2. Enable USB debugging on device (Settings → Developer Options → USB Debugging)
# 3. Verify device is connected:
adb devices

# View only OTA-related logs (PowerShell - use findstr):
# If adb is in PATH:
adb logcat | findstr /i "OTA"

# If adb is NOT in PATH, use full path:
C:\Users\Inso\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat | findstr /i "OTA"

# Or if you have grep installed (Git Bash, WSL, or via Chocolatey):
adb logcat | grep -i "OTA"

# View all React Native logs:
adb logcat | findstr /i "react"

# View all Expo logs:
adb logcat | findstr /i "expo"

# View ALL logs (can be overwhelming):
adb logcat

# Clear log buffer and start fresh:
adb logcat -c
adb logcat | findstr /i "OTA"

# IMPORTANT: Understanding logcat output
# - `adb logcat` (without -d): Streams logs in real-time (waits for new logs)
#   → If no new logs are generated, it appears to have no output
#   → Press Ctrl+C to stop streaming
# - `adb logcat -d`: Dumps existing logs from buffer and exits
#   → Shows all logs that were already captured
#   → Use this to see past logs without waiting
# 
# Example: View past OTA logs (dumps and exits):
C:\Users\Inso\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -d | findstr /i "OTA"
```

**Note for Windows PowerShell:**
- Use `findstr /i` instead of `grep` (Windows native, no installation needed)
- The `/i` flag makes it case-insensitive
- Or use Git Bash, WSL, or install grep via Chocolatey

**Option B: iOS Console.app (iOS - Recommended)**
1. Connect iOS device to Mac via USB
2. Open **Console.app** (built into macOS - search Spotlight for "Console")
3. Select your device from the left sidebar (under "Devices")
4. In the search box, type: `OTA` or `expo` or your app name
5. Watch logs in real-time as you use the app

**Option C: Android Studio Logcat (Android - Alternative)**
1. Open Android Studio
2. Connect device via USB
3. Open Logcat tab (bottom panel)
4. Filter by: `OTA` or `expo` or package name

**Option D: Xcode Console (iOS - Alternative)**
1. Connect iOS device to Mac
2. Open Xcode
3. Window → Devices and Simulators
4. Select your device
5. Click "Open Console" button
6. Filter by app name or search for "OTA"

**Option E: Remote Debugging (Limited - may not work)**
1. Shake device (or Cmd+D on simulator, Cmd+M on Android emulator)
2. If dev menu appears, try "Debug Remote JS"
3. Note: This often doesn't work in standalone builds
4. If it works, Chrome DevTools will open with console logs

**Option F: Add Visual Debugging (Temporary)**
If you can't access device logs, temporarily add on-screen debugging:
```tsx
// In your app, temporarily add:
import { useOTAUpdates } from '@/shared/hooks/useOTAUpdates';

function MyComponent() {
  const { getCurrentUpdateInfo } = useOTAUpdates();
  const info = getCurrentUpdateInfo();
  
  return (
    <View>
      <Text>Channel: {info.channel}</Text>
      <Text>Update ID: {info.updateId}</Text>
      <Text>Runtime: {info.runtimeVersion}</Text>
    </View>
  );
}
```

### Method 4: EAS Build Logs

For builds created with EAS Build, you can view build-time logs:

```bash
# View build logs
eas build:list
eas build:view <build-id>
```

### Quick Reference

| Setup | Method | Command/App |
|-------|--------|-------------|
| Development (`expo start`) | Metro bundler | `npm start` |
| Dev Client | Metro bundler | `expo start --dev-client` |
| Dev Client | Chrome DevTools | Shake → "Debug Remote JS" |
| Android Standalone | Logcat | `adb logcat` |
| iOS Standalone | Console.app | macOS Console.app |
| Any | React Native Debugger | Install separately |

### Filtering OTA Update Logs

To see only OTA-related logs:

**Metro Bundler:**
- Look for lines containing `[OTA Updates]` or `OTA DEBUG`

**Android Logcat:**
```bash
adb logcat | grep -i "OTA"
```

**iOS Console:**
- Search for "OTA Updates" or "OTA DEBUG"

**Chrome DevTools:**
- Use filter: `OTA` or `Updates`

### What to Look For

When debugging OTA updates, look for these log messages:

```
========== OTA DEBUG ==========
channel: preview
runtimeVersion: 1.0.0
updateId: <update-id>
isEmbeddedLaunch: false
================================

[OTA Updates] Checking status: { ... }
[OTA Updates] Checking for updates...
[OTA Updates] Update check result: { ... }
[OTA Updates] Update available!
[OTA Updates] Update fetched: { ... }
[OTA Updates] Reloading app to apply update...
```

### Troubleshooting: No Logs Appearing

If you don't see any logs:

1. **Standalone builds don't show logs in Metro:**
   - ✅ **Expected:** Standalone builds (preview/production) don't connect to Metro
   - **Solution:** Use device-specific methods:
     - **Android:** `adb logcat | grep -i "OTA"`
     - **iOS:** Console.app on Mac

2. **Check if device is connected:**
   - **Android:** Run `adb devices` to verify device is connected
   - **iOS:** Check Console.app shows your device in sidebar
   - Ensure USB debugging is enabled (Android)

3. **Verify logging is enabled:**
   - Check that `console.log` statements are in code
   - Standalone builds preserve console.log statements
   - Logs appear in device logs, not Metro

4. **Try different methods:**
   - **Android:** Use `adb logcat` (most reliable)
   - **iOS:** Use Console.app (most reliable)
   - **Both:** Try remote debugging if dev menu is available

5. **Check log filtering:**
   - Make sure you're filtering correctly (case-insensitive)
   - Try viewing all logs first: `adb logcat` (Android) or unfiltered in Console.app (iOS)
   - Then filter to find OTA logs

6. **Verify app is running:**
   - Make sure the app is actually running on the device
   - Logs only appear when the app is active
   - Try opening/closing the app to trigger logs

## Debugging OTA Updates

### Check Update Status

The `useOTAUpdates` hook logs debug information on app launch. Look for:

```
========== OTA DEBUG ==========
channel: preview
runtimeVersion: 1.0.0
updateId: <update-id>
isEmbeddedLaunch: false
================================
```

### Common Issues

1. **Updates not working in dev mode (`expo start`):**
   - ✅ **Expected:** OTA updates don't work with Metro bundler (`expo start`)
   - **Solution:** Build with EAS Build using any profile (`development`, `preview`, or `production`)
   - **Note:** Development builds (EAS Build with `development` profile) DO support OTA updates

2. **"Updates are not enabled" warning:**
   - **Cause:** App was not built with EAS Build
   - **Solution:** Build with `eas build` instead of `expo run:android` or `expo run:ios`

3. **Update not downloading / "No update available":**
   - **Check channel mismatch:**
     - Verify the update was published to the correct channel
     - Check console logs for `channel:` value
     - Run: `eas update:list --branch <channel>` to see published updates
     - Example: If your build uses `preview` channel, publish with: `eas update --branch preview`
   
   - **Check runtimeVersion mismatch:**
     - Verify `runtimeVersion` matches between build and update
     - Check console logs for `runtimeVersion:` value
     - Your app uses `runtimeVersion: { policy: "appVersion" }` which means it uses the version from `app.config.js` (currently `1.0.0`)
     - Updates must be published with the same runtimeVersion
     - If you changed the app version, you need a new build
   
   - **Verify update was published:**
     ```bash
     # List updates for your channel
     eas update:list --branch preview
     # or
     eas update:list --branch development
     # or
     eas update:list --branch production
     ```
   
   - **Check network connectivity:**
     - Ensure device has internet connection
     - Check if device can reach `https://u.expo.dev`
   
   - **Review console logs:**
     - Look for `[OTA Updates]` messages in device logs
     - Check for error messages
     - Verify `isEnabled: true` in the debug output

4. **"ERR_UPDATES_CHECK" / "Failed to check for update" error:**
   - **Symptom:** Console shows: `Error: Call to function 'ExpoUpdates.checkForUpdateAsync' has been rejected. Caused by: Failed to check for update] code: 'ERR_UPDATES_CHECK'`
   - **Possible causes:**
     - **Network connectivity issue:** Device cannot reach Expo's update server (`https://u.expo.dev`)
     - **Invalid update URL configuration:** Check `app.config.js` for `updates.url` - should point to Expo's update server
     - **Missing or invalid credentials:** EAS credentials may be missing or expired
     - **App not properly configured for updates:** Missing `expo-updates` configuration in `app.config.js`
   
   - **Solutions:**
     - **Check network:** Ensure device has internet connection and can access `https://u.expo.dev`
     - **Verify app.config.js:** Ensure `expo-updates` is properly configured:
       ```javascript
       updates: {
         url: "https://u.expo.dev/...", // Should be set automatically by EAS
       }
       ```
     - **Rebuild the app:** If configuration was changed, rebuild with `eas build`
     - **Check EAS credentials:** Run `eas whoami` to verify you're logged in
     - **Check device time:** Ensure device time is correct (SSL certificates require valid time)
   
   - **Debug steps:**
     ```bash
     # 1. Check if you can reach Expo's update server
     # On device browser, try: https://u.expo.dev
     
     # 2. Verify EAS credentials
     eas whoami
     
     # 3. Check app configuration
     # Look in app.config.js for updates.url
     
     # 4. View detailed logs
     adb logcat | findstr /i "expo updates"
     ```

5. **Wrong channel:**
   - Builds are tied to specific channels (see `eas.json`)
   - Make sure you publish to the same channel as your build
   - Preview builds → `preview` channel
   - Production builds → `production` channel

6. **Update downloaded but not applied / App not reloading:**
   - **Symptom:** Console shows "Update fetched" but app doesn't reload or update doesn't appear
   - **Check console logs:**
     - Look for `[OTA Updates] Update fetched:` message
     - Check if `isNew: true` in the logs
     - Verify `reloadAsync` was called
   
   - **Possible causes:**
     - **reloadAsync not working:** Some platforms may require manual app restart
     - **Update already applied:** Check if `isNew: false` - means you already have this update
     - **Silent failure:** reloadAsync might fail silently in some cases
   
   - **Solutions:**
     - **Manual restart:** Close and reopen the app completely (not just background/foreground)
     - **Check update ID:** Compare the `updateId` in logs before and after restart
     - **Verify update was applied:** After restart, check console logs for the new `updateId`
     - **Force reload:** If using development build, try shaking device and selecting "Reload"
     - **Check for errors:** Look for any error messages in console after `reloadAsync` call
   
   - **Debug steps:**
     ```bash
     # 1. Check what update the app currently has
     # Look in console logs for: updateId: <id>
     
     # 2. Check what update was published
     eas update:list --branch <channel> --limit 1
     
     # 3. Compare the IDs - they should match after update is applied
     ```
   
   - **Platform-specific behavior:**
     - **iOS:** `reloadAsync()` usually works and app reloads automatically
     - **Android:** `reloadAsync()` may not always work - manual app restart often required
     - **Solution:** Always manually close and reopen the app after update is downloaded to ensure it's applied
   
   - **Best practice:** After seeing "Update fetched" in logs, manually close the app completely and reopen it

### Manual Update Check

If you need to manually trigger an update check, you can use the hook's return value:

```tsx
const { checkForUpdates, getCurrentUpdateInfo } = useOTAUpdates();

// Check for updates manually
await checkForUpdates();

// Verify current update info (useful for debugging)
const updateInfo = getCurrentUpdateInfo();
console.log('Current update:', updateInfo);
// Compare updateId before and after update to verify it was applied
```

### Verifying Update Was Applied

After an update is downloaded, verify it was applied:

1. **Before update:** Note the `updateId` from console logs
2. **Publish update:** `eas update --branch <channel> --message "Test"`
3. **App downloads update:** Check console for "Update fetched" message
4. **Restart app:** Close completely and reopen (important!)
5. **After restart:** Check console logs for new `updateId`
6. **Compare:** The `updateId` should be different if update was applied

If the `updateId` is the same, the update wasn't applied. Try:
- Force close the app (swipe away from recent apps)
- Restart the device
- Check for errors in console logs

### Example: Verifying Your Published Update

When you publish an update, you'll see output like:

```
Branch             preview
Runtime version    1.0.0
Platform           android, ios
Update group ID    0f2413f1-d92c-4dec-ac60-575222db2825
Android update ID  019c7433-f920-74c9-b2d6-4d923b3a83ce
iOS update ID      019c7433-f920-7ae6-82b3-3defaf88e7fd
Message            Booking Update
```

**To verify the app receives this update:**

1. **Check console logs when app starts:**
   - Look for: `channel: preview` (must match your published branch)
   - Look for: `runtimeVersion: 1.0.0` (must match)
   - Look for: `updateId: <some-id>` (current update ID)

2. **After app checks for updates:**
   - Look for: `[OTA Updates] Update check result: { isAvailable: true }`
   - Look for: `[OTA Updates] Update available!`
   - Look for: `[OTA Updates] Update fetched: { isNew: true, manifest: { id: "..." } }`
   - The manifest ID should match one of your update IDs (Android or iOS)

3. **After restarting the app:**
   - Check the new `updateId` in console logs
   - It should match the update ID from your published update
   - If it matches, the update was successfully applied!

**Quick verification command:**
```bash
# List recent updates to see what was published
eas update:list --branch preview --limit 5

# Compare the update IDs with what you see in console logs
```

### Verification Checklist

When you see output like this from `eas update:list`:

```
Platforms                 android, ios
Runtime Version           1.0.0
Message                   "Booking Update" (2 minutes ago)
Group ID                  0f2413f1-d92c-4dec-ac60-575222db2825
```

**Follow these steps:**

1. ✅ **Update is published** - Confirmed by `eas update:list` output
2. ⏳ **Check app console logs** - Look for `[OTA Updates]` messages
3. ⏳ **Verify channel matches** - Console should show `channel: preview`
4. ⏳ **Verify runtimeVersion matches** - Console should show `runtimeVersion: 1.0.0`
5. ⏳ **Check if update is detected** - Look for `isAvailable: true`
6. ⏳ **Verify update is downloaded** - Look for `Update fetched: { isNew: true }`
7. ⏳ **Restart app** - Close completely and reopen
8. ⏳ **Verify updateId changed** - Compare before/after `updateId` values

**If update is not detected:**
- Check that your build uses `preview` channel (from `eas.json`)
- Verify `runtimeVersion` matches exactly (`1.0.0`)
- Check network connectivity
- Review console logs for errors

**If update is detected but not applied:**
- Manually close and reopen the app (don't just background/foreground)
- On Android, `reloadAsync()` may not work - always manually restart
- Check console logs for errors during download/apply

## Testing Different Scenarios

### Scenario 1: First Update After Build

1. Build and install app
2. Make a code change
3. Publish update
4. Open app → should download and apply update automatically

### Scenario 2: Multiple Updates

1. Publish update #1
2. Publish update #2
3. Open app → should get the latest update (#2)

### Scenario 3: Update While App is Running

1. Open app (no update available)
2. Publish update while app is open
3. Close and reopen app → should download update

### Scenario 4: Network Issues

1. Turn off device network
2. Open app → should handle gracefully (no crash)
3. Turn on network
4. App should check for updates on next launch

## Channel Configuration

Current channels (from `eas.json`):

- **development:** Development builds with dev client (built with `development` profile)
- **preview:** Internal testing builds (APK/IPA, built with `preview` profile)
- **production:** Production releases (built with `production` profile)

Each build profile uses a specific channel. Updates must be published to the matching channel.

### Testing with Development Builds

Development builds are great for testing OTA updates during active development:

1. **Build a development build:**
   ```bash
   eas build --platform android --profile development
   ```

2. **Install the dev client** on your device

3. **Make code changes** and publish updates:
   ```bash
   eas update --branch development --message "Test update"
   ```

4. **Open the app** - it will automatically download and apply the update

**Benefits:**
- Can use dev client features (fast refresh, debugging)
- Still supports OTA updates
- Faster iteration cycle

## Runtime Version

The `runtimeVersion` determines update compatibility:

- Updates can only be applied to builds with the same `runtimeVersion`
- If you change native code or dependencies, you need a new build
- JavaScript-only changes can use OTA updates

Check your `runtimeVersion` in:
- `app.config.js` (if configured)
- Or it defaults to your app version

## Best Practices

1. **Test on real devices:** OTA updates work best on physical devices
2. **Use development or preview channel for testing:** Don't test on production channel
3. **Development builds for active development:** Use `development` profile builds for faster iteration with OTA updates
4. **Make visible changes:** Use clear visual changes to verify updates
5. **Check logs:** Monitor console logs for update status
6. **Test network scenarios:** Test with poor/no connectivity
7. **Version compatibility:** Ensure `runtimeVersion` matches

## Commands Reference

```bash
# Build for preview
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Publish update to preview
eas update --branch preview --message "Your update message"

# Publish update to production
eas update --branch production --message "Your update message"

# List recent updates
eas update:list

# View update details
eas update:view <update-id>

# Rollback an update (if needed)
eas update:rollback
```

## Monitoring Updates

You can monitor updates in the EAS dashboard:

1. Go to https://expo.dev
2. Select your project
3. Navigate to "Updates" section
4. View update history, status, and analytics

## Troubleshooting

### Step-by-Step Debugging

If updates are not being received, follow these steps:

1. **Check what channel your build is using:**
   - Open the app and check console logs
   - Look for: `channel: preview` (or `development`, `production`)
   - Note this value

2. **Verify updates were published to that channel:**
   ```bash
   eas update:list --branch <your-channel>
   ```
   - Replace `<your-channel>` with the channel from step 1
   - If no updates appear, you haven't published to that channel yet

3. **Check runtimeVersion compatibility:**
   - In console logs, note the `runtimeVersion:` value
   - Your app uses `runtimeVersion: { policy: "appVersion" }`
   - This means runtimeVersion = app version from `app.config.js` (currently `1.0.0`)
   - Updates must match this runtimeVersion

4. **Verify the update command used the correct channel:**
   ```bash
   # If your build uses preview channel:
   eas update --branch preview --message "Your update"
   
   # If your build uses development channel:
   eas update --branch development --message "Your update"
   
   # If your build uses production channel:
   eas update --branch production --message "Your update"
   ```

5. **Check if update was published successfully:**
   ```bash
   eas update:list --branch <channel> --limit 5
   ```
   - Should show recent updates with their IDs and status

6. **Force a manual update check:**
   - Close and reopen the app
   - Check console logs for `[OTA Updates]` messages
   - Look for "No update available" message and the troubleshooting info

### Check Update Status via EAS CLI

```bash
# List all updates for a specific channel
eas update:list --branch preview
eas update:list --branch development
eas update:list --branch production

# View specific update details
eas update:view <update-id>

# Check which channel a build uses
# (Check eas.json or build logs)
```

### Verify Build Configuration

```bash
# Check EAS configuration
cat eas.json

# Verify app config
cat app.config.js | grep -A 5 updates

# Check runtimeVersion in app.config.js
cat app.config.js | grep -A 3 runtimeVersion
```

### Quick Diagnostic Checklist

Run these commands to diagnose why updates aren't being received:

```bash
# 1. Check what channel your build uses (from eas.json)
cat eas.json

# 2. List published updates for your channel
# Replace <channel> with preview, development, or production
eas update:list --branch <channel>

# 3. Check if you published to the wrong channel
eas update:list  # Shows all channels

# 4. Verify your app's runtimeVersion
# Check app.config.js - should show version: "1.0.0"
# And runtimeVersion: { policy: "appVersion" }
cat app.config.js | grep -E "(version|runtimeVersion)"

# 5. Check the latest update details
eas update:view <update-id>
```

**Common Fix:**
If you see updates in a different channel, republish to the correct channel:
```bash
# Example: If your build uses 'preview' but you published to 'production'
eas update --branch preview --message "Fix: republish to correct channel"
```

### Test Update Manually

If automatic updates aren't working, you can test manually by:

1. Adding a button to trigger `checkForUpdates()`
2. Checking the return values: `isUpdateAvailable`, `isUpdating`, `updateError`

## Additional Resources

- [Expo Updates Documentation](https://docs.expo.dev/versions/latest/sdk/updates/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [Runtime Versions Guide](https://docs.expo.dev/eas-update/runtime-versions/)

