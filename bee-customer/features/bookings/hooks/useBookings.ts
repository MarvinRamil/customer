import type { Booking, BookingStatus } from '@/shared/types/booking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingService } from '../services/bookingService';
import type { BookingFilter } from '../types';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/types/api';

/**
 * Return type for useBookings hook
 */
interface UseBookingsReturn {
  /** Array of bookings (filtered client-side) */
  bookings: Booking[];
  /** All bookings from API (unfiltered) */
  allBookings: Booking[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Function to refresh bookings */
  refresh: () => Promise<void>;
  /** Function to set filter */
  setFilter: (filter: BookingFilter) => void;
  /** Current filter */
  filter: BookingFilter;
}

/**
 * Filter bookings by status (client-side filtering)
 * @param bookings - Array of bookings to filter
 * @param filter - Filter to apply
 * @returns Filtered array of bookings
 */
function filterBookingsByStatus(
  bookings: Booking[],
  filter: BookingFilter
): Booking[] {
  if (filter === 'All') {
    return bookings;
  }

  if (filter === 'Active') {
    // Active bookings: Pending, Assigned, Broadcasting, Confirmed, InProgress
    const activeStatuses: BookingStatus[] = [
      'Pending',
      'Assigned',
      'Broadcasting',
      'Confirmed',
      'InProgress',
    ];
    return bookings.filter((booking) => activeStatuses.includes(booking.status));
  }

  if (filter === 'Completed') {
    // Completed bookings: Completed, Cancelled
    return bookings.filter(
      (booking) => booking.status === 'Completed' || booking.status === 'Cancelled'
    );
  }

  return bookings;
}

/**
 * Custom hook for fetching and managing bookings
 * Uses /api/bookings/my-bookings endpoint which automatically filters by authenticated user
 * Provides client-side filtering for UI purposes
 * @param initialFilter - Initial filter to apply (default: 'All')
 * @returns Object containing bookings, loading state, error, and control functions
 */
export function useBookings(initialFilter: BookingFilter = 'All'): UseBookingsReturn {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BookingFilter>(initialFilter);

  /**
   * Fetch bookings from API
   * API automatically filters by authenticated user's email
   * Includes retry logic for network errors
   */
  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // API handles filtering by user email automatically
      // Retry logic is handled in bookingService
      const data = await bookingService.getBookings();
      setAllBookings(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bookings';
      setAllBookings([]);

      // Check if it's an ApiError with status code
      if (err instanceof ApiError) {
        // Handle 401 Unauthorized errors - these are authentication errors, not network errors
        if (err.status === 401) {
          // The bookingService already provides user-friendly messages for 401 errors
          // Just use the error message as-is
          setError(errorMessage);
          // Auth context will handle redirect if needed
          return;
        }
        
        // Handle other HTTP errors (4xx, 5xx)
        // Use the error message from the API if available
        setError(errorMessage);
        return;
      }

      // Handle authentication errors by message content (fallback for non-ApiError auth errors)
      if (
        errorMessage.includes('session has expired') ||
        errorMessage.includes('Authentication error') ||
        errorMessage.includes('login again') ||
        errorMessage.includes('Unauthorized')
      ) {
        // Error is already user-friendly, just set it
        setError(errorMessage);
        // The auth context will handle redirect if needed
        return;
      }

      // Handle actual network errors (fetch failures, timeouts, etc.)
      // Only show "Network error" for actual network/fetch failures
      const isNetworkError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('network request failed') ||
        (err instanceof TypeError && errorMessage.includes('fetch'));
      
      if (isNetworkError) {
        // Network errors are already retried by bookingService
        // Set user-friendly error message
        setError('Network error. Please check your connection and try again.');
      } else {
        // For other errors, use the error message as-is
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh bookings list
   * Re-fetches all bookings from API
   */
  const refresh = useCallback(async () => {
    await fetchBookings();
  }, [fetchBookings]);

  /**
   * Update filter (client-side filtering)
   */
  const handleSetFilter = useCallback((newFilter: BookingFilter) => {
    setFilter(newFilter);
  }, []);

  /**
   * Apply client-side filtering based on current filter
   */
  const filteredBookings = useMemo(() => {
    return filterBookingsByStatus(allBookings, filter);
  }, [allBookings, filter]);

  // Fetch bookings on mount, but only if user is authenticated and auth is not loading
  useEffect(() => {
    // Wait for auth to finish loading before attempting to fetch bookings
    if (isAuthLoading) {
      // Auth is still loading - keep loading state
      return;
    }

    if (user) {
      // User is authenticated - fetch bookings
      fetchBookings();
    } else {
      // User not logged in - clear bookings and set loading to false
      setAllBookings([]);
      setIsLoading(false);
      setError(null);
    }
  }, [fetchBookings, user, isAuthLoading]);

  return {
    bookings: filteredBookings,
    allBookings,
    isLoading,
    error,
    refresh,
    setFilter: handleSetFilter,
    filter,
  };
}

