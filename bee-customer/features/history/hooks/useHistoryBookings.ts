import type { Booking } from '@/shared/types/booking';
import { useMemo } from 'react';
import type { HistoryFilter } from '../types';

/**
 * Custom hook for filtering and sorting history bookings
 * @param allBookings - Array of all bookings
 * @param filter - Filter to apply (default: 'All')
 * @param limit - Maximum number of bookings to return (default: 10)
 * @returns Filtered and sorted array of bookings
 */
export function useHistoryBookings(
  allBookings: Booking[],
  filter: HistoryFilter = 'All',
  limit: number = 10
): Booking[] {
  return useMemo(() => {
    // Filter bookings based on status
    let filtered = allBookings;
    
    if (filter !== 'All') {
      filtered = allBookings.filter((b) => {
        switch (filter) {
          case 'Pending':
            return b.status === 'Pending';
          case 'Completed':
            return b.status === 'Completed';
          case 'Cancelled':
            return b.status === 'Cancelled';
          case 'InProgress':
            return b.status === 'InProgress';
          default:
            return true;
        }
      });
    } else {
      // When filter is 'All', show all bookings (including Pending, Completed, Cancelled, InProgress)
      filtered = filtered.filter(
        (b) =>
          b.status === 'Pending' ||
          b.status === 'Completed' ||
          b.status === 'Cancelled' ||
          b.status === 'InProgress'
      );
    }

    // Sort by most recent first
    const sorted = filtered.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Limit results
    return sorted.slice(0, limit);
  }, [allBookings, filter, limit]);
}

