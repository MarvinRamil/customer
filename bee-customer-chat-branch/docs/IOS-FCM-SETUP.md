# iOS Push (FCM/APNs) Setup — bee-customer

Bundle ID: `com.mybeeapp.customer` · Firebase project: `mybeeapp-f3911`

Android push is live. iOS is **not** yet — this doc covers what's configured in the
repo and what still has to be done in the Firebase / Apple consoles.

## What's configured in the repo

`app.config.js` (the only place to change native config — never hand-edit
`ios/`, it is prebuild output):

| Setting | Value | Purpose |
|---|---|---|
| `ios.bundleIdentifier` | `com.mybeeapp.customer` | must match the Firebase iOS app and the Apple App ID |
| `ios.googleServicesFile` | `./GoogleService-Info.plist` | Firebase client config; **conditionally applied** — only set if the file exists, so builds don't fail while it's missing |
| `ios.infoPlist.UIBackgroundModes` | `["remote-notification"]` | lets the OS wake the app for silent/data-only pushes |
| `ios.infoPlist.NSUserNotificationsUsageDescription` | (already present) | permission prompt copy |
| `expo-notifications` plugin `mode` | `"production"` | generates the `aps-environment: production` entitlement |

`aps-environment` is plugin-generated and the final entitlement comes from the
provisioning profile at EAS Build time. Do not set it by hand.

If `GoogleService-Info.plist` is absent, `app.config.js` prints a warning at
config-eval time rather than silently producing a push-less build.

> **Precondition for all of the above:** `bee-customer/ios/` exists on disk, so
> EAS treats this as a bare project and **does not run prebuild**. Neither
> `UIBackgroundModes` nor `googleServicesFile` reaches the binary until
> `npx expo prebuild -p ios` regenerates the native project. Run it before any
> iOS build, and commit the result.

## First: decide the token type

**This decision gates which console steps matter**, so make it before touching
Firebase. The delivery path today is broken for iOS:

- `shared/services/notificationService.ts` calls `getDevicePushTokenAsync()`,
  which on iOS returns a **raw APNs device token**, registered as `tokenType: 'apns'`.
- The backend's `RoutingPushNotificationService` routes `apns` → Firebase, and
  `FirebaseNotificationService` passes the token straight to `FirebaseMessaging`,
  which only accepts **FCM registration tokens**.

An APNs token sent that way is rejected with `InvalidArgument`. Both
`SendToDeviceAsync` and `SendToMultipleDevicesAsync` then call
`DeleteByTokenAsync` on that error — so the device silently unregisters itself
on the first send attempt.

| | **Option A — client-side (recommended)** | **Option B — backend-side** |
|---|---|---|
| Change | add `@react-native-firebase/app` + `/messaging`, get the token via `messaging().getToken()`, register as `tokenType: 'fcm'` | add a direct APNs sender so `apns` tokens bypass Firebase |
| Backend | untouched — keeps the single Firebase Admin delivery path | new provider + `.p8` in backend config |
| Client | new native deps; needs `expo-build-properties` / `useFrameworks: "static"` and APNs-delegate interaction with `expo-notifications` validated against a real build | untouched |
| `GoogleService-Info.plist` | load-bearing | **unused** — nothing would read it |

Note that with no Firebase SDK in the app today, the plist is inert even once
prebuild copies it into the Xcode project. It only becomes functional under
Option A.

## Console steps

### Required either way

1. **Apple Developer → Certificates, IDs & Profiles → Identifiers**: enable the
   **Push Notifications** capability on the `com.mybeeapp.customer` App ID.
2. **Apple Developer → Keys**: create a key with **Apple Push Notifications
   service (APNs)** enabled. Download the `.p8` (one download only) and note the
   **Key ID** and **Team ID**.
3. Rebuild: `npx expo prebuild -p ios`, then an EAS iOS build. A real device is
   required — `Device.isDevice` must be true, no simulator.

### Option A only

4. **Firebase → Add app → iOS**, bundle ID `com.mybeeapp.customer`. Download
   `GoogleService-Info.plist` and drop it at `bee-customer/GoogleService-Info.plist`.
   - This is **public client config**, same category as the already-committed
     `google-services.json`. Commit it. Don't treat it as a secret and stash it
     outside the repo — the config guard resolves it relative to the app root.
5. **Firebase → Project settings → Cloud Messaging → Apple app configuration**:
   upload the `.p8` with its Key ID + Team ID. This is how FCM relays to APNs;
   without it every iOS send fails.

### Option B only

4. Put the `.p8` (plus Key ID, Team ID, bundle ID) in backend config alongside
   the existing `Firebase:ServiceAccountJson`, and route `apns` tokens to the new
   sender in `RoutingPushNotificationService`.

## Checklist

Common:

- [ ] Token-type option chosen (A or B — see above)
- [ ] Push Notifications capability enabled on the Apple App ID
- [ ] APNs `.p8` key created (Key ID + Team ID noted)
- [ ] `npx expo prebuild -p ios` run and committed
- [ ] End-to-end test push on a physical device

If Option A:

- [ ] iOS app registered in Firebase for `com.mybeeapp.customer`
- [ ] `GoogleService-Info.plist` downloaded to `bee-customer/` and committed
- [ ] `.p8` uploaded to Firebase → Cloud Messaging → Apple app configuration
- [ ] `@react-native-firebase/app` + `/messaging` added, client registers `tokenType: 'fcm'` on iOS

If Option B:

- [ ] APNs sender implemented in the backend, `apns` routed to it
- [ ] `.p8` + Key ID / Team ID in backend config
