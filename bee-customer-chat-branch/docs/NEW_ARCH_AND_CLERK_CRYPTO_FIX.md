# Fix: Dev build crash `NoClassDefFoundError: expo.modules.kotlin.types.AnyTypeCache` + New Architecture build failure

**Date:** 2026-06-13
**App:** `bee-customer` (Expo SDK 54, React Native 0.81.5)

## Symptoms

Two distinct but related failures surfaced together:

### 1. Runtime crash (dev client)
On launching the development build, the app crashed into the Expo Dev Launcher
error screen:

```
java.lang.NoClassDefFoundError: Failed resolution of: Lexpo/modules/kotlin/types/AnyTypeCache;
    at expo.modules.crypto.CryptoModule.definition(CryptoModule.kt:76)
    at expo.modules.kotlin.ModuleRegistry.register(...)
    at expo.modules.adapters.react.ModuleRegistryAdapter.createNativeModules(...)
    ...
Caused by: java.lang.ClassNotFoundException: Didn't find class "expo.modules.kotlin.types.AnyTypeCache"
```

The crash fires during **full native module registry init** (when the JS project
actually loads via Metro), not just on the Dev Launcher home screen — so it can
look like the app "starts fine" and only dies when you open the project.

### 2. Gradle build failure
A clean rebuild failed with:

```
:react-native-worklets:assertNewArchitectureEnabledTask FAILED
  > [Worklets] Worklets require new architecture to be enabled.
:react-native-reanimated:assertNewArchitectureEnabledTask FAILED
  > [Reanimated] Reanimated requires new architecture to be enabled.
```

## Root causes

There were **two independent problems**.

### Cause A — New Architecture disabled, but Reanimated 4 requires it
`react-native-reanimated` had been bumped to **v4** (which mandates the New
Architecture and pulls in `react-native-worklets`), but `app.config.js` had
`newArchEnabled: false` (originally disabled because of an old
`@react-native-community/datetimepicker` codegen issue). Reanimated 4 + Worklets
hard-fail the build when new arch is off.

### Cause B — Clerk's open-ended peer deps pulled in wrong-lineage Expo packages (the actual runtime crash)
`@clerk/clerk-expo@2.19.31` declares these as **peerDependencies with no upper
bound**:

```json
"expo-auth-session": ">=5",
"expo-crypto": ">=12"
```

Because they were **not pinned at the project's top level**, npm satisfied those
ranges with the **latest published** versions — from a *newer Expo lineage*:

| Package (nested under expo-auth-session) | Installed | SDK 54 expects |
|---|---|---|
| expo-auth-session (top-level) | 56.0.14 | ~7.0.11 |
| expo-crypto | 56.0.4 | ~15.0.9 |
| expo-web-browser | 56.0.5 | ~15.0.11 |
| expo-application | 56.0.3 | (SDK 54) |
| expo-constants | 56.0.18 | ~18.0.13 |
| expo-linking | 56.0.14 | ~8.0.x |

These `56.x` packages are compiled expecting newer `expo-modules-core` Kotlin
classes (e.g. `expo.modules.kotlin.types.AnyTypeCache`) that **do not exist** in
SDK 54's `expo-modules-core@3.0.30`. Expo autolinking picks up the nested
`expo-crypto@56.0.4`, and at runtime `CryptoModule` can't resolve its classes →
`NoClassDefFoundError`.

> ⚠️ `npx expo install --check` reported "Dependencies are up to date" because it
> only validates **direct** dependencies, not nested transitive ones. The
> contaminants were nested and invisible to that check.

## Solution

### Step 1 — Enable the New Architecture (fixes the build)
In `app.config.js`:

```js
// New Architecture required by react-native-reanimated v4 / react-native-worklets (SDK 54 default)
newArchEnabled: true,
```

The old datetimepicker codegen concern did **not** reappear — `datetimepicker@8.4.4`
is the SDK 54-recommended version and works fine on new arch; the original failure
had been a stale build cache.

### Step 2 — Pin the Expo packages Clerk needs to SDK 54 versions (fixes the crash)
```bash
npx expo install expo-auth-session expo-crypto
```

This installs `expo-auth-session@7.0.11` and `expo-crypto@15.0.9` at the top
level. They still satisfy Clerk's `>=5` / `>=12` peer ranges, and npm dedupes the
6 contaminant `56.x` packages away. (Installing these Expo peers yourself is also
what Clerk's own Expo docs instruct.)

### Step 3 — Regenerate native project and rebuild
This is a **CNG (Continuous Native Generation) project** — `android/` and `ios/`
are git-ignored and generated from `app.config.js`. Do **not** hand-edit files in
`android/`; regenerate instead:

```bash
npx expo prebuild -p android --clean   # also clears stale .cxx / autolinking CMake caches
cd android && ./gradlew app:assembleDebug -x lint -x test
```

> A plain `gradlew clean` failed first with a stale CMake/Ninja error
> (`add_subdirectory ... datetimepicker ... not an existing directory`) because
> the `.cxx` cache still referenced the old module graph. `prebuild --clean`
> wipes that, so always regenerate after changing the native module set.

### Step 4 — Reinstall and verify
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
# with Metro running, launch and load the project; confirm:
#   ResumedActivity: com.mybeeapp.customer/.MainActivity   (not DevLauncherErrorActivity)
#   ReactNativeJS: Running "main" with {... "fabric":true}  (new arch active)
```

## Verification result
- App loads to `MainActivity`, no `CryptoModule` / `AnyTypeCache` crash.
- `"fabric":true` in the `Running "main"` log confirms New Architecture is active.
- Mapbox initializes cleanly and the old "RNMapbox: upgrade to New Architecture"
  deprecation warning is gone (it was the original symptom that started this).

## Follow-ups / cautions
- **Bump the app version before any `eas update`.** `runtimeVersion` uses the
  `appVersion` policy and was still `1.1.2` despite a native + arch change. Pushing
  this JS bundle to existing `1.1.2` (old-arch) builds in the field would crash
  them. Bump to a new version so the new-arch build gets an isolated runtimeVersion.
- Commit the `package.json` / `package-lock.json` changes. Native folders are
  git-ignored (CNG), so there's nothing to commit there; EAS builds run prebuild
  and pick up `newArchEnabled: true` for both platforms automatically.
- iOS needs no separate arch change (CNG drives it from `app.config.js`; its
  `Podfile.properties.json` already reflects `newArchEnabled: true`).
- Two map libraries are present (`react-native-maps` + `@rnmapbox/maps`) — worth
  confirming both are actually needed.

## TL;DR
1. `newArchEnabled: true` in `app.config.js` (Reanimated 4 requires it).
2. `npx expo install expo-auth-session expo-crypto` (pin Clerk's Expo peers to SDK
   54; removes the `56.x` contaminants that caused the `AnyTypeCache` crash).
3. `npx expo prebuild -p android --clean` + rebuild + reinstall.
