/**
 * Effective booking status helpers – aligned with driver app logic.
 * When the first stop (pickup) is completed, the effective status is InProgress (In Transit)
 * even if the API still returns Pending or PickedUp, so the UI does not revert to "Pending".
 */

import type { Booking, BookingStatus } from '@/shared/types/booking';

/**
 * Returns true if the booking has stops and the first stop (pickup) has status Completed.
 * Finds the pickup stop by sorting stops by sequence and checking the first one (or by type).
 */
export function isFirstStopCompleted(booking: Booking | null): boolean {
  if (!booking?.stops || booking.stops.length === 0) return false;
  
  // Sort stops by sequence to ensure we get the correct first stop
  const sortedStops = [...booking.stops].sort((a, b) => a.sequence - b.sequence);
  
  // Find the pickup stop (should be first, but check by type to be safe)
  const pickupStop = sortedStops.find(stop => stop.type === 'Pickup') || sortedStops[0];
  
  // Return true if the pickup stop is completed
  return pickupStop.status === 'Completed';
}

/**
 * Get effective booking status considering stop completion.
 * When the first stop (pickup) is completed, returns InProgress so the UI shows "In Transit"
 * and does not revert to Pending. Aligns with the method used in the driver app.
 */
export function getEffectiveBookingStatus(booking: Booking | null): BookingStatus | null {
  if (!booking) return null;
  if (booking.status === 'Completed') return 'Completed';
  if (booking.status === 'Cancelled') return 'Cancelled';
  
  // Check if first stop (pickup) is completed - if so, show as InProgress (In Transit)
  if (isFirstStopCompleted(booking)) {
    return 'PickedUp';
  }
  
  return booking.status as BookingStatus;
}
