# Sentry / GlitchTip Crash & Error Reporting — Implementation Plan

Tracks GitLab issue [beeondemand/bee-customer#26](https://gitlab.ilocosscript.live/beeondemand/bee-customer/-/work_items/26) on branch `26-integrate-sentry-crash-error-reporting-mobile-app`. Companion driver-app ticket: beeondemand/bee-driver#23 (out of scope here).

Backend is **GlitchTip** (self-hosted, Sentry-protocol compatible) at `glitchtip.ilocosscript.live`, project 2. `@sentry/react-native` is used as the client SDK since GlitchTip speaks the Sentry protocol; GlitchTip does not support Sentry "sessions" or full performance tracing, which shapes a couple of the config choices below.

## Status when this plan was written

The branch already has uncommitted work covering the JS-only path:

- `@sentry/react-native ~7.2.0` added to `package.json`.
- DSN plumbed through `app.config.js` (`extra.sentryDsn`) from `EXPO_PUBLIC_SENTRY_DSN`, documented in `.env.example`.
- `Sentry.init()` at the top of `app/_layout.tsx` (`autoSessionTracking: false`, `tracesSampleRate: 0`, `debug: __DEV__`).
- Root `Sentry.ErrorBoundary` + `Sentry.wrap(RootLayout)`, with a static fallback view.
- TanStack Query `QueryCache`/`MutationCache` `onError` forwarding to `Sentry.captureException`.
- The `@sentry/react-native/expo` config plugin is **deliberately not yet registered** (commented out in `app.config.js`) — no `SENTRY_AUTH_TOKEN` exists yet, so native source-map/dSYM upload can't run.

## Phases

### Phase 1 — Harden the existing JS-only init (no secrets needed) — ✅ done

- Added `release` / `dist` to `Sentry.init()` (`bee-customer-app@<version>+<runtimeVersion>`, `dist` from `Updates.updateId`) so events are attributable to a specific build even before source maps exist. Also fixed a real bug found while doing this: the existing code used `autoSessionTracking`, which isn't a valid `ReactNativeOptions` key — corrected to `enableAutoSessionTracking`.
- Set `sampleRate: 1.0` explicitly (error sampling) — matches the acceptance criterion "keep errors at 100%"; `tracesSampleRate: 0` already covers the performance side.
- Added `beforeBreadcrumb` / `beforeSend` scrubbing (`SENSITIVE_KEY_PATTERN` in `app/_layout.tsx`): strips auth/token/password keys and lat/lng/latitude/longitude keys from breadcrumb data and event extras/contexts, and drops `event.request.headers/cookies/data/query_string` outright.
- Root error boundary fallback is now recoverable: `Sentry.ErrorBoundary`'s `fallback` is a render-prop passing `resetError`, wired to a "Try again" button.

### Phase 2 — `Sentry.setUser` (Clerk id only) — ✅ done

- `features/auth/context/AuthContext.tsx`, `ClerkAuthProvider`: calls `Sentry.setUser({ id: userId })` (Clerk's own id, from `useClerkAuth()`) when signed in, `Sentry.setUser(null)` on sign-out/not-loaded. No email/phone/name.
- `LegacyAuthProvider` (non-Clerk path) is out of scope per the ticket's wording ("Clerk user id").

### Phase 6 — Docs: Play data safety + privacy policy — ✅ done (this repo's part)

- Created `docs/PLAY_DATA_SAFETY.md`: maps every data type the app collects (location, camera/photos, device fingerprint, FCM push token, and the new crash/diagnostic data via Sentry/GlitchTip) to purpose/sharing/deletion, and lists the action items for whoever owns the actual Play Console listing, App Store Connect listing, and the published privacy policy (none of which live in this repo).
- Documented `EXPO_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in `docs/ENVIRONMENT_VARIABLES.md`.

### Phase 3 — Native crash capture + source maps — ⏸️ deferred (no GlitchTip auth token available)

- Register the `@sentry/react-native/expo` config plugin in `app.config.js` (already stubbed as a comment), then `npx expo prebuild --clean`.
- Requires a **GlitchTip auth token** (Sentry-protocol equivalent of a Sentry auth token) — must be stored as an **EAS secret** (`eas secret:create`), never committed. Confirmed 2026-08-17: no token exists yet. JS + native crash capture already work without this (native crashes are still captured natively; what's missing is *symbolicated* stack traces, i.e. real file/line instead of minified bundle offsets).
- Revisit once a token is issued — EAS CLI is already authenticated (`ilocosscriptdevs`) in this environment, so creating the secret and running prebuild is a short follow-up, not a big lift.

### Phase 4 — Source maps on every `eas update` — ⏸️ deferred (depends on Phase 3)

- `eas.json`/`package.json` currently only have `update:preview`, no production update script, and `.gitlab-ci.yml` is entirely commented out — updates are pushed manually today, so there's no CI hook to piggyback on.
- Wire `sentry-expo-upload-sourcemaps` (already vendored via `@sentry/react-native`, present in `node_modules/.bin`) into an npm script that must run right after every `eas update`, and document the two-step manual flow (`eas update` → upload sourcemaps) since there's no CI currently invoking `eas update`.

### Phase 5 — Lockfile / EAS install sanity check — ⏸️ deferred (depends on Phase 3's prebuild)

- The ticket flags that native deps have broken `npm ci` on EAS before (Clerk transitive-dep issues). After Phase 3's prebuild, diff `package-lock.json`, check for peer conflicts, and confirm `npm ci` installs cleanly. Full confirmation ultimately requires an actual `eas build --profile production` run, which is outside what can be done from this environment.

## Follow-up when a GlitchTip auth token exists

Phases 3, 4, and 5 above are the entire remaining scope — nothing else is blocked. Come back to this
plan and pick up from Phase 3.
