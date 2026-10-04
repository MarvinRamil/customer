# Push Notifications – Local Debugging Guide

This guide explains how to debug Firebase Cloud Messaging (FCM) push notifications locally for the Bee Customer app.

## Overview

The app uses `expo-notifications` with native FCM tokens on Android and APNs tokens on iOS. Push notifications **do not work** in Expo Go. You need either a development build (EAS) or a local native build.

## Prerequisites

Before debugging push notifications, ensure:

1. **EAS CLI installed and authenticated:**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **FCM credentials uploaded to EAS:**
   ```bash
   eas credentials
   ```
   - Select **Android** → your build profile (e.g. `development` or `preview`)
   - Go to **Google Service Account** → **Set up FCM V1**
   - Upload your Firebase service account JSON

3. **Physical device:** Push notifications do not work on emulators or simulators.

4. **google-services.json** in project root (already present).

---

## Method 1: Development Build (Recommended)

This is the **recommended** way to test push notifications locally. The app is built by EAS (with FCM credentials), then you run the Metro bundler locally for fast iteration.

### Step 1: Build the Development Client

```bash
eas build --platform android --profile development
```

Wait for the build to complete. EAS will provide a download link for the APK.

### Step 2: Install the APK on Your Device

1. Download the APK from the EAS build page.
2. Transfer to your device and install (enable "Install from unknown sources" if prompted).

### Step 3: Start the Dev Server

```bash
npx expo start --dev-client
```

### Step 4: Connect and Test

1. Open the installed app on your device.
2. The app will connect to your Metro bundler (same Wi‑Fi or tunnel).
3. Log in and grant notification permission when prompted.
4. The device token will be registered with your backend.
5. Send a test notification from your backend or Firebase Console.

**Benefits:**
- Push notifications work (FCM credentials are in the build).
- Fast refresh and hot reload for code changes.
- Full debugging with Metro logs.
- No need to rebuild for JavaScript changes.

---

## Method 2: `expo run:android` (Local Native Build)

`expo run:android` builds the app locally. **FCM may not work** because FCM credentials are stored in EAS and are typically only injected during EAS builds.

### When to Use

- Testing native module changes.
- Quick local build without EAS.
- **Note:** Push notification token retrieval may fail with "Firebase not initialized" or similar.

### Steps

1. **Prebuild** (if not already done):
   ```bash
   npx expo prebuild
   ```

2. **Run on device:**
   ```bash
   npx expo run:android
   ```

   Or using npm script:
   ```bash
   npm run android
   ```

3. Ensure a physical device is connected via USB with USB debugging enabled.

### Limitation

If you see errors like `FirebaseApp not initialized` or `getDevicePushTokenAsync` fails, FCM is not configured for the local build. Use **Method 1 (Development Build)** instead.

---

## Viewing Logs

### Development Build (Metro)

When using `npx expo start --dev-client`, logs appear in the Metro terminal:

```
LOG  Notification permission granted and device registered
LOG  Notification received: { ... }
LOG  Notification tapped: { ... }
```

### Android Logcat (Any Build)

For standalone builds or when Metro isn’t connected:

**1. Connect device via USB** and enable USB debugging.

**2. Verify device:**
```powershell
adb devices
```

**3. View notification-related logs:**
```powershell
# PowerShell (Windows)
adb logcat | findstr /i "notification"
adb logcat | findstr /i "expo"
adb logcat | findstr /i "FCM"
adb logcat | findstr /i "firebase"

# Git Bash / WSL / Linux / macOS
adb logcat | grep -i notification
adb logcat | grep -i FCM
```

**4. Dump existing logs (no streaming):**
```powershell
adb logcat -d | findstr /i "notification"
```

---

## Testing Push Notifications

### Option A: Firebase Console (Quick Test)

1. Go to [Firebase Console](https://console.firebase.google.com) → **mybeeapp-f3911** → **Cloud Messaging**.
2. Click **Create your first campaign** or **New campaign** → **Firebase Notification messages**.
3. Enter title and body.
4. Under **Target**, select your app or use **Send test message** and paste the FCM token.
5. To get the token: check app logs after registration, or add a temporary `console.log` of the token in `notificationService.ts`.

### Option B: Backend API

Your backend should use the Firebase Admin SDK to send notifications. Example (Node.js):

```javascript
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

await admin.messaging().send({
  token: deviceToken, // From register-device API
  notification: { title: 'Test', body: 'Hello from backend' },
  data: { type: 'booking', bookingId: '123' },
});
```

### Option C: cURL (Manual Test)

If your backend has a test endpoint, you can send a request manually. The device must be registered first via `POST /api/notifications/register-device`.

---

## Troubleshooting

### "FirebaseApp not initialized" / "Firebase" error

- **Cause:** FCM credentials are not available in the current build.
- **Fix:**
  1. Upload FCM V1 service account to EAS: `eas credentials`.
  2. Build with EAS: `eas build --platform android --profile development`.
  3. Do not rely on `expo run:android` for FCM.

### Push notifications don't work in Expo Go

- **Expected:** Expo Go does not support custom FCM setup.
- **Fix:** Use a development build (Method 1).

### Token is null / "Could not retrieve device token"

- Check that you are on a **physical device** (not an emulator).
- Confirm notification permission was granted.
- Ensure the app was built with EAS and FCM credentials are uploaded.
- Inspect logs for Firebase/FCM errors.

### Device not registering with backend

- Verify the user is logged in (JWT required for `register-device`).
- Check API base URL (e.g. `EXPO_PUBLIC_API_URL` or `apiUrl` in app config).
- Ensure the backend endpoint is `POST /api/notifications/register-device`.
- Check network connectivity and backend logs.

### Notifications received but no sound/banner

- Verify `Notifications.setNotificationHandler` in `notificationService.ts`.
- Ensure `shouldShowAlert`, `shouldPlaySound`, `shouldShowBanner`, `shouldShowList` are set as desired.

### Can't see logs

- **Dev client:** Logs go to the Metro terminal where you ran `npx expo start --dev-client`.
- **Standalone build:** Use `adb logcat` (see [Viewing Logs](#viewing-logs)).

---

## Quick Reference

| Scenario              | Command / Action                                      | Push Works? |
|-----------------------|--------------------------------------------------------|-------------|
| Expo Go               | `npx expo start`                                      | No          |
| Development build     | `eas build --profile development` then `npx expo start --dev-client` | Yes         |
| Preview build (APK)   | `eas build --profile preview`                         | Yes         |
| Local native build    | `npx expo run:android`                                | Usually no  |

---

## Checklist Before Testing

- [ ] FCM V1 credentials uploaded to EAS
- [ ] App built with EAS (`development` or `preview` profile)
- [ ] Physical device (not emulator)
- [ ] User logged in (for device registration)
- [ ] Notification permission granted
- [ ] Backend can send via Firebase Admin SDK (or use Firebase Console for quick tests)

---

## Related Files

- `shared/services/notificationService.ts` – Notification logic, token retrieval, registration
- `shared/hooks/useNotifications.ts` – Initialization and listeners
- `shared/components/NotificationPermissionModal.tsx` – Permission prompt
- `app.config.js` – `expo-notifications` plugin config
- `google-services.json` – Firebase Android config

## Further Reading

- [Expo Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo FCM Credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)
- [Send Notifications with FCM](https://docs.expo.dev/push-notifications/sending-notifications-custom/)
