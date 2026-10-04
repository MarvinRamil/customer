/**
 * Detection helper for the server-authoritative fare-change error.
 * The backend (with Pricing:FareTrust:Enforce on) rejects POST /api/bookings with
 * HTTP 400 when the client's quoted fare no longer matches the server-recomputed fare.
 */

/** Lower-cased substring the backend's fare-changed 400 message always contains. */
export const FARE_CHANGED_MESSAGE_FRAGMENT = 'fare has changed since your quote';

/**
 * Returns true only when the error is the specific fare-changed 400
 * ("The fare has changed since your quote (now PXX.XX). Please review the price and try again.").
 * Requires BOTH status 400 AND the message fragment, so other 400s (validation errors, etc.)
 * fall through to existing generic error handling unchanged.
 */
export function isFareChangedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: number; message?: string };
  if (e.status !== 400) return false;
  const msg = (e.message ?? '').toLowerCase();
  return msg.includes(FARE_CHANGED_MESSAGE_FRAGMENT);
}
