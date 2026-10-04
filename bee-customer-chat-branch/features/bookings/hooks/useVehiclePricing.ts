import { useQuery } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';
import type { VehiclePricing } from '../types';

/** Query key for vehicle pricing (used for cache and invalidation) */
export const VEHICLE_PRICING_QUERY_KEY = ['vehicle-pricing'] as const;

/**
 * Return type for useVehiclePricing hook
 */
export interface UseVehiclePricingReturn {
  /** List of vehicle types and pricing from API (for dropdown) */
  vehiclePricingList: VehiclePricing[];
  /** Whether the list is loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refetch vehicle pricing */
  refetch: () => void;
}

/**
 * Fetches available vehicle types and pricing from GET /api/vehicle-pricing
 * Call when booking page loads so vehicle selection reflects backend (no hardcoded enum)
 * Uses TanStack Query for caching; list is cached so refetch is not needed on every mount
 *
 * @returns Vehicle list (vehicleType = value for API, types = display label), loading, error, refetch
 *
 * @example
 * ```tsx
 * function BookingScreen() {
 *   const { vehiclePricingList, isLoading, error } = useVehiclePricing();
 *   // Dropdown: label = item.types, value = item.vehicleType
 *   // Send vehicleType in calculate-fare and create booking
 * }
 * ```
 */
export function useVehiclePricing(): UseVehiclePricingReturn {
  const {
    data: vehiclePricingList = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: VEHICLE_PRICING_QUERY_KEY,
    queryFn: () => bookingService.getVehiclePricing(),
    staleTime: 5 * 60 * 1000, // 5 minutes - vehicle pricing changes rarely
    retry: 2,
  });

  return {
    vehiclePricingList,
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch,
  };
}
