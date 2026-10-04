/**
 * Feature flags sourced from EXPO_PUBLIC_* env vars.
 *
 * These are inlined at build time by Expo, so a change to .env only takes effect
 * after restarting the bundler (`npx expo start -c`) — and for a release build,
 * after a rebuild.
 */

/**
 * One-time post-KYC welcome screen (app/welcome.tsx).
 *
 * Shown exactly once per account, right after their first KYC approval;
 * "Got it" marks it seen and moves on to the tabs. Every later app open
 * skips straight past it. See shared/hooks/usePostAuthDestination.ts for
 * the per-account "seen" check that this flag feeds into.
 *
 * true  → verified users see /welcome once
 * false → verified users go straight into the tabs, and are marked as
 *         having seen welcome so re-enabling this flag later doesn't
 *         surface it retroactively
 */
export const WELCOME_SCREEN_ENABLED =
  process.env.EXPO_PUBLIC_WELCOME_SCREEN_ENABLED !== "false";
