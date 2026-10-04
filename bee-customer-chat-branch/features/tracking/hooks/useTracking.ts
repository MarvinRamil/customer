import { useCallback, useEffect, useState } from 'react';
import { trackingService } from '../services/trackingService';
import type { TrackingData } from '../types';

/**
 * Return type for useTracking hook
 */
interface UseTrackingReturn {
  /** Tracking data */
  trackingData: TrackingData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Function to refresh tracking data */
  refresh: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing tracking data
 * @param bookingId - Booking ID to track
 * @returns Object containing tracking data, loading state, error, and refresh function
 */
export function useTracking(bookingId: string | undefined): UseTrackingReturn {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch tracking data from API
   */
  const fetchTrackingData = useCallback(async () => {
    if (!bookingId) {
      setTrackingData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await trackingService.getTrackingData(bookingId);
      setTrackingData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tracking data';
      setError(errorMessage);
      setTrackingData(null);
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  /**
   * Refresh tracking data
   */
  const refresh = useCallback(async () => {
    await fetchTrackingData();
  }, [fetchTrackingData]);

  // Fetch tracking data on mount and when bookingId changes
  useEffect(() => {
    fetchTrackingData();
  }, [fetchTrackingData]);

  return {
    trackingData,
    isLoading,
    error,
    refresh,
  };
}

