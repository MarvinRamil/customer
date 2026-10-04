# Play Data Safety / Privacy Policy Reference

Internal reference for filling out the Google Play Console **Data safety** form and the
App Store **Privacy Nutrition Label**, and for briefing whoever maintains the external
privacy policy. This file is not itself the published privacy policy — it's the mapping
from "what the app actually does" (from `app.config.js` permissions and the services in
`shared/services/`) to "what has to be disclosed."

Added by [beeondemand/bee-customer#26](https://gitlab.ilocosscript.live/beeondemand/bee-customer/-/work_items/26): this file previously didn't exist, and Sentry/GlitchTip crash reporting is a new declarable data type. See [docs/plans/sentry-glitchtip-integration-plan.md](plans/sentry-glitchtip-integration-plan.md) for the integration itself.

## Data collected

| Data type | Source in this app | Purpose | Shared with a third party? | User can request deletion? |
|---|---|---|---|---|
| Precise location | `expo-location` (`ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`) | Pickup/delivery tracking during an active booking | No | Yes (account deletion) |
| Photos/camera | `expo-image-picker`, `expo-camera` | Item photo for delivery, identity verification | No | Yes (account deletion) |
| Device / other IDs | `shared/services/deviceFingerprint.ts` (installation ID, model, OS) | Refresh-token theft detection (see `docs/DEVICE_FINGERPRINTING_GUIDE.md`) | No | Yes (account deletion) |
| Push token | FCM (`google-services.json`), `notificationService` | Booking status push notifications | Firebase (Google), as the delivery transport | Yes (disable notifications / account deletion) |
| **Crash logs / diagnostics** *(new)* | `@sentry/react-native` → **GlitchTip**, self-hosted at `glitchtip.ilocosscript.live` | Crash and error reporting for debugging | **No** — GlitchTip instance is self-hosted, not a third party the way Firebase/Google is | No user-facing deletion flow yet; data is a stack trace + device/OS context, **not** tied to name/email/phone (see below) |

## What the Sentry/GlitchTip integration does and does not send

Per the ticket's acceptance criteria and `app/_layout.tsx`:

- **Sent**: JS/native stack traces, breadcrumbs (nav, console, network method/URL/status — no
  headers/body), device model/OS/locale, app version + release/update id, and the signed-in
  user's **Clerk user id only**.
- **Not sent**: name, email, phone, address, precise coordinates, auth tokens, or request/response
  bodies — stripped by the `beforeSend`/`beforeBreadcrumb` scrubbing in `app/_layout.tsx` (see the
  `SENSITIVE_KEY_PATTERN` scrub, which also removes `event.request.headers/cookies/data`).
- Sessions/performance tracing are off (`enableAutoSessionTracking: false`, `tracesSampleRate: 0`) — GlitchTip doesn't support Sentry "sessions", and tracing was deferred to control quota.

## Action items for whoever owns the external privacy policy / store listings

1. **Play Console → App content → Data safety**: add "Crash logs" / "Diagnostics" under
   **App activity** or **App info and performance**, purpose "App functionality", not shared with
   third parties (self-hosted), not linked to a user identity beyond an opaque account id.
2. **App Store Connect → App Privacy**: add **Crash Data** and **Performance Data** under
   "Diagnostics", linked to user: **No** (only an internal account id, not contact info),
   used for tracking: **No**.
3. **Published privacy policy**: add a short clause, e.g. *"We use crash and error reporting
   (GlitchTip, a self-hosted crash-reporting service) to diagnose app failures. Reports include
   device information, app version, and a stack trace, and are associated with your account id
   but not your name, email, or phone number."* Insert wherever the policy already covers Firebase/
   push notifications, and update the "third parties we share data with" section only if the
   Sentry/GlitchTip instance is not already covered by "self-hosted infrastructure" language.

This doc doesn't submit anything to Play Console or App Store Connect and isn't the customer-facing
privacy policy — both of those live outside this repo and need to be updated by whoever has access
to them, using the table above as the source of truth for what changed.
