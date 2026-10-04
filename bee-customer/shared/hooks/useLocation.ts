/**
 * Hook for location services using expo-location
 * Handles location permissions and getting current user location
 */

import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import type { LocationCoordinates } from '@/shared/types/booking';

/**
 * Location permission status
 */
export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied' | 'restricted';

/**
 * Return type for useLocation hook
 */
export interface UseLocationReturn {
  /** Current user location coordinates */
  location: LocationCoordinates | null;
  /** Whether location is being fetched */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Current permission status */
  permissionStatus: LocationPermissionStatus;
  /** Request location permission */
  requestPermission: () => Promise<boolean>;
  /** Get current user location */
  getCurrentLocation: () => Promise<LocationCoordinates | null>;
  /** Check if location services are enabled */
  checkLocationEnabled: () => Promise<boolean>;
}

/**
 * Hook for location services
 * Provides methods to request permissions and get current user location
 * 
 * @returns Object containing location state and methods
 * 
 * @example
 * ```typescript
 * const { location, getCurrentLocation, requestPermission, error } = useLocation();
 * 
 * const handleUseMyLocation = async () => {
 *   const hasPermission = await requestPermission();
 *   if (hasPermission) {
 *     const coords = await getCurrentLocation();
 *     if (coords) {
 *       // Use coordinates
 *     }
 *   }
 * };
 * ```
 */
export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('undetermined');

  /**
   * Check current permission status
   */
  const checkPermissionStatus = useCallback(async (): Promise<LocationPermissionStatus> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      
      let permissionStatus: LocationPermissionStatus = 'undetermined';
      if (status === Location.PermissionStatus.GRANTED) {
        permissionStatus = 'granted';
      } else if (status === Location.PermissionStatus.DENIED) {
        permissionStatus = 'denied';
      } else if (status === Location.PermissionStatus.UNDETERMINED) {
        permissionStatus = 'undetermined';
      }
      
      setPermissionStatus(permissionStatus);
      return permissionStatus;
    } catch (err) {
      console.error('[useLocation] Error checking permission status:', err);
      setPermissionStatus('undetermined');
      return 'undetermined';
    }
  }, []);

  /**
   * Request location permission
   * @returns Promise resolving to true if permission granted, false otherwise
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check current permission status
      const currentStatus = await checkPermissionStatus();
      
      // If already granted, return true
      if (currentStatus === 'granted') {
        return true;
      }

      // If denied, return false with user-friendly error
      if (currentStatus === 'denied') {
        setError(
          'Location permission was denied. Please enable location access in your device settings to use this feature.'
        );
        return false;
      }

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === Location.PermissionStatus.GRANTED) {
        setPermissionStatus('granted');
        setError(null);
        return true;
      } else {
        setPermissionStatus('denied');
        setError(
          'Location permission is required to use this feature. Please enable location access in your device settings.'
        );
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request location permission';
      console.error('[useLocation] Error requesting permission:', err);
      setError(errorMessage);
      setPermissionStatus('denied');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkPermissionStatus]);

  /**
   * Get current user location
   * Automatically requests permission if not granted
   * @returns Promise resolving to location coordinates or null if unavailable
   */
  const getCurrentLocation = useCallback(async (): Promise<LocationCoordinates | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        setError(
          'Location services are disabled. Please enable location services in your device settings.'
        );
        return null;
      }

      // Request permission if not granted
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        // Error already set by requestPermission
        return null;
      }

      // Get current location
      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Balanced accuracy for better battery life
        maximumAge: 60000, // Accept location up to 1 minute old
        timeout: 15000, // 15 second timeout
      });

      const coordinates: LocationCoordinates = {
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      };

      setLocation(coordinates);
      setError(null);
      return coordinates;
    } catch (err) {
      let errorMessage = 'Failed to get your location. Please try again.';
      
      if (err instanceof Error) {
        // Handle specific error cases
        if (err.message.includes('timeout')) {
          errorMessage = 'Location request timed out. Please check your GPS signal and try again.';
        } else if (err.message.includes('permission')) {
          errorMessage = 'Location permission is required. Please enable location access in your device settings.';
        } else {
          errorMessage = err.message;
        }
      }
      
      console.error('[useLocation] Error getting location:', err);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [requestPermission]);

  /**
   * Check if location services are enabled on the device
   * @returns Promise resolving to true if enabled, false otherwise
   */
  const checkLocationEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        setError('Location services are disabled. Please enable location services in your device settings.');
      }
      return isEnabled;
    } catch (err) {
      console.error('[useLocation] Error checking location services:', err);
      setError('Unable to check location services status.');
      return false;
    }
  }, []);

  // Check permission status on mount
  useEffect(() => {
    checkPermissionStatus();
  }, [checkPermissionStatus]);

  return {
    location,
    isLoading,
    error,
    permissionStatus,
    requestPermission,
    getCurrentLocation,
    checkLocationEnabled,
  };
}

