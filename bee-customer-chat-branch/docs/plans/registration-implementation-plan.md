# Registration Feature – Implementation Plan

Implementation plan for **Customer registration** in the Bee Customer App, based on [docs/registration-api.md](../registration-api.md). Driver registration (two-step, documents) is **out of scope** for this app; the plan covers only the Customer flow.

---

## Overview

| Item | Description |
|------|-------------|
| **Scope** | Customer registration only: check email (optional), register, verify email (via link), resend verification. |
| **Reference** | [docs/registration-api.md](../registration-api.md) – endpoints, request/response, validation, rate limits. |
| **Existing** | Login screen (`app/login.tsx`), `authService` (login, getCurrentUser, logout), `apiClient`, auth types. |
| **Out of scope** | Driver registration, `GET /api/auth/registration-status`, `POST /api/auth/register/driver/complete`, security questions UI (optional; can be Phase 5). |

---

## Objectives

1. Add registration types and extend `authService` with registration endpoints (check-email, register, verify-email, resend-verification; optional: security-questions).
2. Add client-side validation (password rules, email format) and optional check-email on blur.
3. Add registration screen (`app/register.tsx`) with form and “check your email” + resend flow.
4. Add verify-email handling: route that reads `email` + `token` from URL/query, calls API, shows result, redirects to login.
5. Wire navigation (Sign Up → register), allow unauthenticated routes (register, verify-email), and handle 429 rate limit in UI.

---

## Phases

### Phase 1: Types and auth service

**Goal:** Registration API is callable from the app with correct types and error handling.

**Files to create/update:**

- **`features/auth/types.ts`**
  - Add: `CheckEmailRequest`, `CheckEmailResponse`, `RegisterRequest`, `RegisterResponse`, `VerifyEmailRequest`, `VerifyEmailResponse`, `ResendVerificationRequest`, `ResendVerificationResponse`, `SecurityQuestion`, `SecurityQuestionsResponse`.
  - Align with [docs/registration-api.md](../registration-api.md) (success/error shapes, optional fields).
- **`features/auth/services/authService.ts`**
  - Add methods (no auth): `checkEmail(email)`, `register(payload)`, `verifyEmail({ email, token })`, `resendVerification({ email })`.
  - Optional: `getSecurityQuestions()` for GET `/api/auth/security-questions`.
  - Use `apiClient.post` / `apiClient.get`; map 400/500/429 to thrown errors with user-facing messages.
- **`features/auth/index.ts`**
  - Export new types.

**Acceptance:**

- Types match API doc.
- Each method calls the correct endpoint and throws on non-success with a clear message.
- 429 handled (e.g. “Too many attempts, try again later”).

**Dependencies:** None.

---

### Phase 2: Validation helpers

**Goal:** Reusable validation for password and email so the registration form can show inline errors and avoid unnecessary API calls.

**Files to create/update:**

- **`shared/utils/validation.ts`** (or `features/auth/utils/validation.ts` if preferred to keep auth-only)
  - Password rules (from API doc): min length 8, at least one digit, lowercase, uppercase, non-alphanumeric, at least 4 unique characters. Function e.g. `validatePassword(value): { valid: boolean; errors?: string[] }`.
  - Email: normalize (trim, toLowerCase), basic format (e.g. has `@` and `.`). Function e.g. `validateEmail(value): { valid: boolean; normalized?: string }`.
- Optionally: constants for min length, regexes, so they stay in one place.

**Acceptance:**

- Password validator returns clear error list for UI.
- Email validator returns normalized value for submission.

**Dependencies:** None.

---

### Phase 3: Registration screen and flow

**Goal:** User can open a registration form, optionally see “email available/taken” on blur, submit, and see “check your email” with a resend button.

**Files to create/update:**

- **`app/register.tsx`**
  - Form fields: email, password, full name (required); optional: phone number, referral code. Match `RegisterRequest`.
  - Optional: debounced check-email on email blur; show “Available” / “Already registered” (and optionally disable submit if taken).
  - Use validation helpers for password and email before submit.
  - On submit: call `authService.register({ ... payload, role: 'Customer' })`. On success: show “Check your email to verify your account” and a “Resend verification email” button that calls `authService.resendVerification({ email })`.
  - Safe areas: `useSafeAreaInsets()`; same pattern as `app/login.tsx` (top/bottom padding, ScrollView).
  - Theme: use `useTheme()` and existing Bee colors/layout patterns from login.
  - Loading and error state: disable submit, show error message (including 429).
- **`features/auth/hooks/useRegister.ts`** (optional but recommended)
  - Encapsulate form state (email, password, fullName, phoneNumber, referralCode), validation, checkEmail (debounced), register, resendVerification, success/error state. Expose to `app/register.tsx`.
- **`features/auth/index.ts`**
  - Export `useRegister` if created.

**Acceptance:**

- User can complete registration form and see “check your email” and resend.
- Validation errors shown inline; 429 and API errors shown in UI.

**Dependencies:** Phase 1 (authService + types), Phase 2 (validation).

---

### Phase 4: Verify-email handling

**Goal:** When user taps the link in the verification email, the app opens with `email` and `token`, calls verify-email API, and shows success or error then redirects to login.

**Files to create/update:**

- **`app/verify-email.tsx`** (or `app/verify-email/index.tsx` if using a segment)
  - Read `email` and `token` from Expo Router (e.g. `useLocalSearchParams()` or link query params). See [Expo Router linking](https://docs.expo.dev/guides/linking/) for how the backend link should be built (e.g. `yourapp://verify-email?email=...&token=...`).
  - Call `authService.verifyEmail({ email, token })`. On success: show “Email verified. You can now log in.” and a button/link to `/login`. On error: show “Invalid or expired link” (or API message) and link to login or register.
  - Safe areas and theme as in login/register.
- **`app/_layout.tsx`** (NavigationGuard)
  - Allow unauthenticated access to `register` and `verify-email` (same as `login`) so users are not redirected to login when on these screens.

**Acceptance:**

- Deep link with `email` + `token` triggers verify-email API and shows result; user can go to login.

**Dependencies:** Phase 1. Optional: document expected link format for backend in `docs/registration-api.md` or a short “Deep linking” section.

---

### Phase 5: Navigation and polish

**Goal:** Sign Up goes to register; unauthenticated users can reach register and verify-email; rate limit and edge cases are handled.

**Files to create/update:**

- **`app/login.tsx`**
  - Make “Sign Up” link navigate to `/register` (e.g. `router.push('/register')` or `<Link href="/register">`).
- **`app/_layout.tsx`**
  - Ensure NavigationGuard treats `register` and `verify-email` as allowed unauthenticated routes (no redirect to login when on these).
- **Error handling**
  - 429: already handled in Phase 1; ensure register screen and resend button show “Too many attempts, try again later” (or similar).
- **Optional**
  - Security questions: if adding later, fetch `getSecurityQuestions()` once and add dropdowns to register form; extend `RegisterRequest` with `securityQuestion1/2/3` (already in types in Phase 1).

**Acceptance:**

- From login, “Sign Up” opens registration screen; after verify-email, user can open login.
- No redirect loop; unauthenticated users can access login, register, verify-email only.

**Dependencies:** Phases 1–4.

---

## Summary table

| Phase | Focus | Key deliverables |
|-------|--------|-------------------|
| 1 | Types & auth service | Registration types; authService.checkEmail, register, verifyEmail, resendVerification (optional: getSecurityQuestions) |
| 2 | Validation | shared (or auth) validation: password rules, email format + normalize |
| 3 | Registration screen | app/register.tsx, optional useRegister hook; form + “check email” + resend |
| 4 | Verify-email | app/verify-email.tsx; read email+token from URL; call API; show result; link to login |
| 5 | Navigation & polish | Sign Up → /register; NavigationGuard allows register + verify-email; 429 messaging |

---

## Dependencies

- **API:** Base URL from env (`EXPO_PUBLIC_API_URL`); no `/api` suffix (see [docs/ENVIRONMENT_VARIABLES.md](../ENVIRONMENT_VARIABLES.md)).
- **Existing:** `apiClient`, `authService` (login), auth types, login screen and theme.

---

## Timeline (estimates)

| Phase | Estimate |
|-------|----------|
| 1 | ~1–2 hours |
| 2 | ~30 min |
| 3 | ~2–3 hours |
| 4 | ~1 hour |
| 5 | ~30 min |

Total: ~5–7 hours.

---

## Completion checklist

- [x] Phase 1: Types and auth service
- [x] Phase 2: Validation helpers
- [x] Phase 3: Registration screen and flow
- [x] Phase 4: Verify-email handling
- [x] Phase 5: Navigation and polish

---

*Plan follows [code-change-workflow](.cursor/rules/workflow/code-change-workflow.md). Implement only approved phases; update this checklist as phases are completed.*
