/**
 * Hook for location search/autocomplete using Google Places API
 */

import { mapService } from '@/shared/services/mapService';
import type { LocationCoordinates } from '@/shared/types/booking';
import type {
  LocationWithAddress,
  PlaceDetails,
  PlacePrediction,
} from '@/shared/types/map';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Location search hook return type
 */
export interface UseLocationSearchReturn {
  /** Search query string */
  query: string;
  /** Set search query */
  setQuery: (query: string) => void;
  /** Array of place predictions */
  predictions: PlacePrediction[];
  /** Whether search is in progress */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Select a place from predictions */
  selectPlace: (prediction: PlacePrediction) => Promise<LocationWithAddress | null>;
  /** Clear search results */
  clearSearch: () => void;
}

/**
 * Hook for location search/autocomplete
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @param locationBias - Optional location to bias search results
 * @returns Location search state and methods
 */
export function useLocationSearch(
  debounceMs: number = 300,
  locationBias?: LocationCoordinates
): UseLocationSearchReturn {
  const [query, setQuery] = useState<string>('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Search for places when query changes
   */
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is too short
    if (query.trim().length < 3) {
      setPredictions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Set loading state
    setIsLoading(true);
    setError(null);

    // Debounce search
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await mapService.searchPlaces(query.trim(), locationBias);
        setPredictions(results);
        setError(null);
      } catch (err) {
        console.error('[useLocationSearch] Error searching places:', err);
        setPredictions([]);
        setError(
          err instanceof Error ? err.message : 'Failed to search locations'
        );
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, locationBias, debounceMs]);

  /**
   * Select a place from predictions and get full details
   */
  const selectPlace = useCallback(
    async (prediction: PlacePrediction): Promise<LocationWithAddress | null> => {
      try {
        setIsLoading(true);
        setError(null);

        // Get place details
        const placeDetails: PlaceDetails = await mapService.getPlaceDetails(
          prediction.placeId
        );

        // Return location with address
        const locationWithAddress: LocationWithAddress = {
          coordinates: placeDetails.coordinates,
          address: placeDetails.formattedAddress,
        };

        // Clear search
        setQuery('');
        setPredictions([]);
        setError(null);

        return locationWithAddress;
      } catch (err) {
        console.error('[useLocationSearch] Error getting place details:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to get place details'
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    setQuery('');
    setPredictions([]);
    setError(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    query,
    setQuery,
    predictions,
    isLoading,
    error,
    selectPlace,
    clearSearch,
  };
}

