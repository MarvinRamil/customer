# Biometric Login Implementation Plan

## Overview

Add Face ID (iOS) and fingerprint / device credentials (Android) so users can sign in without entering a password after they have logged in at least once and opted in. The existing "Login with Face ID" button on the login screen is a placeholder; this plan wires it to real biometric auth and session restore.

## Goals

1. **Optional biometric sign-in** – After a successful email/password login, user can enable "Login with Face ID" for future launches.
2. **No password storage** – We do not store the user's password. Biometric login restores session using the existing **refresh token** in SecureStore.
3. **Same security as today** – Tokens remain in `expo-secure-store`; biometric only gates *when* we use them to restore the session.

## Prerequisites

| Item | Status |
|------|--------|
| `expo-secure-store` | Already in use for tokens |
| `expo-local-authentication` | **To add** |
| Login screen with Face ID button | Present (placeholder) |
| Auth: `authService.login()`, refresh, `getCurrentUser()` | Present |
| `tokenStorage` (access + refresh) | Present |

## Security Model

- **After email/password login:** Tokens are stored as they are today. We add an optional **"biometric enabled"** flag (e.g. in SecureStore) set only when the user explicitly enables it.
- **Biometric login flow:** User taps "Login with Face ID" → system biometric prompt → on success we read refresh token from SecureStore, call refresh API, get access token and user, then set session. No password or new secrets stored.
- **Logout:** Clear tokens and clear the biometric-enabled flag so the next launch shows email/password only until they log in and enable biometric again.

## Implementation Phases

### Phase 1: Add package and native config

1. **Install**
   ```bash
   npx expo install expo-local-authentication
   ```

2. **iOS – Face ID permission**  
   In `app.config.js`, add the plugin (if not already present):
   ```js
   [
     "expo-local-authentication",
     {
       "faceIDPermission": "Allow BEE APP to use Face ID to sign in."
     }
   ]
   ```

3. **Android**  
   No extra config required; `USE_BIOMETRIC` is added by the library.

4. **Caveats**
   - Face ID is not supported in Expo Go; use a development build to test.
   - Test on a physical device with biometrics enrolled.

---

### Phase 2: Biometric capability and "enabled" flag

1. **Biometric helper (new file or in auth feature)**  
   - `hasBiometricHardware()` – `LocalAuthentication.hasHardwareAsync()`  
   - `isBiometricEnrolled()` – `LocalAuthentication.isEnrolledAsync()`  
   - `authenticateAsync(options?)` – wrapper around `LocalAuthentication.authenticateAsync()` (e.g. prompt message).

2. **Biometric-enabled flag**  
   - Store in SecureStore, e.g. key `biometric_login_enabled` → `"true"` when user opts in.  
   - Clear on logout (together with tokens).  
   - Optional: add `setBiometricEnabled(enabled: boolean)` and `getBiometricEnabled()` in a small service or alongside `tokenStorage`.

---

### Phase 3: Enable biometric after first login

1. **When to offer**  
   After a successful email/password login (e.g. before or after navigation to home), show a one-time or occasional prompt:  
   "Use Face ID / fingerprint to sign in next time?"

2. **If user accepts**  
   - Call `setBiometricEnabled(true)` (or equivalent).  
   - Tokens are already stored by the existing login flow; no need to store anything else.

3. **If user declines**  
   - Do nothing; next launch will show email/password only (or existing session restore if token still valid).

4. **UX**  
   - Can be a small in-screen prompt or Alert; avoid blocking navigation for long.

---

### Phase 4: Biometric login on the login screen

1. **When to show "Login with Face ID"**  
   Show the existing Face ID button only when:
   - `hasBiometricHardware()` and `isBiometricEnrolled()` are true, and  
   - `getBiometricEnabled()` is true (user previously enabled it), and  
   - We have a refresh token in SecureStore (or we consider "biometric enabled" sufficient and attempt refresh; if no token, fall back to "Invalid credentials" or "Please sign in with email and password").

2. **On tap "Login with Face ID"**  
   - Call `LocalAuthentication.authenticateAsync()` (or your wrapper) with a prompt string, e.g. "Sign in to BEE APP".  
   - On success:  
     - Read refresh token from `tokenStorage.getRefreshToken()`.  
     - If no refresh token, show error (e.g. "Please sign in with email and password") and optionally clear biometric-enabled flag.  
     - If present: call auth service **refresh token** (or equivalent) to get new access token, then `getCurrentUser()` (or whatever sets the user in AuthContext).  
     - Store new access token (and refresh if returned) via `tokenStorage`.  
     - Update AuthContext so the app navigates to the main app (same as after email/password login).  
   - On failure (user cancels or fails biometric): show nothing or a short "Biometric failed" message; stay on login screen.

3. **Errors**  
   - Refresh token expired or invalid: clear tokens and biometric-enabled flag, show "Session expired. Please sign in with email and password."  
   - Network error: show retry or generic error; do not clear tokens so user can try again.

---

### Phase 5: Logout and flag cleanup

1. **On logout**  
   - Clear tokens as today (`tokenStorage.clearAllTokens()`).  
   - Clear biometric-enabled flag so "Login with Face ID" is hidden until the user logs in again and opts in.

2. **Optional: "Turn off Face ID" in settings**  
   - If you add a profile/settings screen, a "Use Face ID to sign in" toggle can call `setBiometricEnabled(false)` (and optionally clear tokens if you want to require password on next launch).

---

## Files to touch (summary)

| File | Change |
|------|--------|
| `package.json` | Add `expo-local-authentication` (via `npx expo install`) |
| `app.config.js` | Add `expo-local-authentication` plugin with `faceIDPermission` |
| New: `shared/services/biometricStorage.ts` or `features/auth/services/biometricService.ts` | Flag get/set + optional wrapper for `expo-local-authentication` |
| `features/auth/services/authService.ts` | Add `refreshSession()` or use existing refresh + getCurrentUser for biometric login path |
| `app/login.tsx` | Implement `handleFaceIDLogin`: check capability + flag, call authenticate, then refresh session; show/hide Face ID button based on flag + capability |
| Post-login (e.g. login flow or home): prompt "Use Face ID next time?" and set flag on accept |
| Logout flow (authService or AuthContext) | Clear biometric-enabled flag when clearing tokens |

---

## API usage (existing)

- **Refresh token:** Use existing refresh flow (e.g. `apiClient` refresh or `authService` method that uses refresh token to get new access token).
- **User after refresh:** Call `GET /api/auth/me` or equivalent and set user in AuthContext so NavigationGuard and UI see the user as logged in.

No new backend endpoints are required; biometric login is a client-only flow that reuses refresh + me.

---

## Testing checklist

- [ ] Install `expo-local-authentication`, add plugin, run on **device** (not Expo Go for iOS Face ID).
- [ ] Enable biometric: log in with email/password, accept "Use Face ID next time?", then log out.
- [ ] Login screen shows "Login with Face ID" when biometric is enrolled and enabled.
- [ ] Tapping "Login with Face ID" prompts biometric; on success, session restores and app navigates to main app.
- [ ] Cancel/fail biometric: no navigation, user can still use email/password.
- [ ] After logout, "Login with Face ID" is hidden until user logs in again and enables it.
- [ ] Expired refresh token: biometric login fails with clear message and clears flag.

---

## References

- [Expo Local Authentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- Existing: `shared/services/tokenStorage.ts`, `features/auth/services/authService.ts`, `app/login.tsx`, `docs/plans/login-feature-implementation-plan.md`
