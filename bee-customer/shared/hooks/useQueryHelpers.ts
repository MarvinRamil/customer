/**
 * Helper utilities for TanStack Query
 * Provides common patterns and utilities for query/mutation hooks
 */

import { useQueryClient } from '@tanstack/react-query';

/**
 * Helper to invalidate multiple related queries
 * Useful after mutations that affect multiple data sources
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  /**
   * Invalidate bookings-related queries
   */
  const invalidateBookings = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  /**
   * Invalidate a specific booking
   */
  const invalidateBooking = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['bookings', id] });
  };

  /**
   * Invalidate booking stats
   */
  const invalidateBookingStats = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings', 'stats'] });
  };

  /**
   * Invalidate user/profile queries
   */
  const invalidateUser = () => {
    queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  /**
   * Invalidate all queries (use sparingly)
   */
  const invalidateAll = () => {
    queryClient.invalidateQueries();
  };

  return {
    invalidateBookings,
    invalidateBooking,
    invalidateBookingStats,
    invalidateUser,
    invalidateAll,
  };
}
