import type { BookingStats } from '@/shared/types/booking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingService } from '../services/bookingService';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/types/api';

/**
 * Return type for useBookingStats hook
 */
interface UseBookingStatsReturn {
  /** Booking statistics */
  stats: BookingStats | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Function to refresh statistics */
  refresh: () => Promise<void>;
}

/**
 * Calculate booking statistics from bookings array
 * @param bookings - Array of bookings to calculate stats from
 * @returns BookingStats object
 */
function calculateStats(bookings: any[]): BookingStats {
  const total = bookings.length;
  const pending = bookings.filter((b) => b.status === 'Pending').length;
  const inTransit = bookings.filter(
    (b) =>
      b.status === 'Assigned' ||
      b.status === 'Broadcasting' ||
      b.status === 'Confirmed' ||
      b.status === 'InProgress'
  ).length;
  const completed = bookings.filter((b) => b.status === 'Completed').length;

  return {
    total,
    pending,
    inTransit,
    completed,
  };
}

/**
 * Custom hook for fetching booking statistics
 * Calculates statistics from the user's bookings list
 * Uses /api/bookings/my-bookings endpoint to get bookings, then calculates stats client-side
 * @returns Object containing stats, loading state, error, and refresh function
 */
export function useBookingStats(): UseBookingStatsReturn {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch bookings from API and calculate statistics
   * Includes retry logic for network errors
   */
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get all bookings for the user (API handles filtering)
      // Retry logic is handled in bookingService
      const data = await bookingService.getBookings();
      setBookings(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch booking statistics';
      setBookings([]);

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
   * Calculate statistics from bookings
   */
  const stats = useMemo(() => {
    if (bookings.length === 0) {
      return {
        total: 0,
        pending: 0,
        inTransit: 0,
        completed: 0,
      };
    }
    return calculateStats(bookings);
  }, [bookings]);

  /**
   * Refresh statistics
   * Re-fetches bookings and recalculates statistics
   */
  const refresh = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  // Fetch stats on mount, but only if user is authenticated and auth is not loading
  useEffect(() => {
    // Wait for auth to finish loading before attempting to fetch stats
    if (isAuthLoading) {
      // Auth is still loading - keep loading state
      return;
    }

    if (user) {
      // User is authenticated - fetch stats
      fetchStats();
    } else {
      // User not logged in - clear stats and set loading to false
      setBookings([]);
      setIsLoading(false);
      setError(null);
    }
  }, [fetchStats, user, isAuthLoading]);

  return {
    stats,
    isLoading,
    error,
    refresh,
  };
}

