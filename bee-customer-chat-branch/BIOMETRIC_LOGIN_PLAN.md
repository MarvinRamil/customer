## Biometric Login Plan (Implemented)

### Overview

- **Goal:** Allow customers to log in using Face ID / fingerprint (biometrics) instead of re‑entering their password.
- **Storage:** Only tokens and a simple boolean flag are stored in `SecureStore`. **No email or password is persisted.**
- **Visibility rule:** Show biometric login only when:
  - Device has biometric hardware,
  - User has enrolled biometrics,
  - The **biometric enabled flag** is `true`.

### Data & Services

- **SecureStore keys**
  - `access_token` – short‑lived token for API calls.
  - `refresh_token` – long‑lived token used to restore a session (needed for biometric login).
  - `biometric_login_enabled` – `"true"` when biometric login is enabled; key absent when disabled.

- **Service:** `shared/services/biometricService.ts`
  - `hasBiometricHardware(): Promise<boolean>`
  - `isBiometricEnrolled(): Promise<boolean>`
  - `authenticateAsync(options?): Promise<boolean>` – wraps `LocalAuthentication.authenticateAsync`.
  - `getBiometricEnabled(): Promise<boolean>`
  - `setBiometricEnabled(enabled: boolean): Promise<void>`

### Enabling Biometric Login

Biometric login can be turned on in two ways:

1. **Post-login prompt (login screen)**
   - After a successful email/password login:
     - Checks hardware + enrollment.
     - If **biometric is not already enabled**, shows:
       - Title: “Use Face ID next time?”
       - Message: “You can sign in with Face ID or fingerprint instead of your password.”
       - Actions:
         - **Not now** – do nothing.
         - **Enable** – calls `setBiometricEnabled(true)`.

2. **Profile settings toggle**
   - Screen: `app/(tabs)/profile.tsx`
   - State:
     - `biometricAvailable` – `hasBiometricHardware() && isBiometricEnrolled()`.
     - `biometricEnabled` – loaded via `getBiometricEnabled()`.
   - UI:
     - A row “Login with Face ID” with a `Switch`, only shown when `biometricAvailable && biometricEnabled !== null`.
     - Toggling the switch calls `setBiometricEnabled(value)` and updates local state.

### Biometric Login Flow (Login Screen)

- Screen: `app/login.tsx`

1. **Decide whether to show the biometric button**
   - On mount, the login screen runs:
     - `hasBiometricHardware()`
     - `isBiometricEnrolled()`
     - `getBiometricEnabled()`
   - If all are `true`, it sets `showFaceIDButton = true`.

2. **UI placement**
   - Biometric login is exposed as a **fingerprint icon inside the password field**:
     - Shown only when `showFaceIDButton` is `true`.
     - Tapping the icon triggers the biometric login flow.

3. **Biometric login behavior**
   - Uses `loginWithBiometric()` from `AuthContext`:
     1. Calls `authenticateAsync({ promptMessage: "Sign in to BEE APP" })`.
     2. If biometric auth fails or is cancelled:
        - Sets a user‑visible error: “Biometric authentication failed or was cancelled.”
     3. If biometric auth succeeds:
        - Reads `refresh_token` from `tokenStorage`.
        - If there is **no** refresh token:
          - Calls `setBiometricEnabled(false)`.
          - Sets error: “Please sign in with email and password.”
        - If refresh token exists:
          - Calls `authService.restoreSessionFromRefreshToken()`:
            - Triggers `/api/auth/refresh` via the API client.
            - On success, stores a new access token (and refresh token, if returned), and calls `/api/auth/me` to get the current user.
          - If restore fails or the refresh token is invalid:
            - Clears tokens.
            - Calls `setBiometricEnabled(false)`.
            - Sets error: “Session expired. Please sign in with email and password.”
          - If a user is returned:
            - Sets the user in `AuthContext`.
            - Clears any auth error.
            - Navigation guard redirects into the app.

### Logout Behavior

- Service: `features/auth/services/authService.ts`
- Method: `logout()`

- Logic:
  - Reads `biometric_login_enabled` via `getBiometricEnabled()`.
  - If **biometric login is enabled**:
    - Removes only the **access token**:
      - Ends the current session.
      - Keeps the refresh token and biometric flag so the user can log back in with Face ID on the next launch.
  - If **biometric login is not enabled**:
    - Clears both access and refresh tokens (`clearAllTokens()`).

### Files Involved (Implementation)

- `package.json`
  - Dependency: `expo-local-authentication`.

- `app.config.js`
  - Plugin entry:
    - `"expo-local-authentication"` with `faceIDPermission: "Allow BEE APP to use Face ID to sign in."`

- `shared/services/biometricService.ts`
  - Biometric capability checks, prompt wrapper, and `biometric_login_enabled` flag storage.

- `shared/services/tokenStorage.ts`
  - Secure storage for `access_token` and `refresh_token`, used by both normal and biometric login flows.

- `shared/services/apiClient.ts`
  - `refreshSession()` method, wrapping the existing refresh‑token logic to support biometric login without a prior 401.

- `features/auth/services/authService.ts`
  - `restoreSessionFromRefreshToken(): Promise<User | null>` – refresh and fetch current user.
  - `logout()` – conditional token clearing depending on whether biometric login is enabled.

- `features/auth/context/AuthContext.tsx`
  - Exposes `loginWithBiometric(): Promise<void>`.
  - Manages errors and user state for biometric login.

- `app/login.tsx`
  - Post‑login biometric opt‑in alert.
  - Decides whether to show the biometric button.
  - Inline biometric icon next to the password input, wired to `loginWithBiometric()`.

- `app/(tabs)/profile.tsx`
  - “Login with Face ID” switch, reading/writing `biometric_login_enabled`.
  - Only shown when device supports biometrics and the user has an enrolled face/fingerprint.

