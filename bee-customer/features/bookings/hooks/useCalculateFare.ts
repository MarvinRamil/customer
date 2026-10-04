import { useMutation } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';
import type { CalculateFareRequest, PricingResult } from '../types';

/**
 * Return type for useCalculateFare hook
 */
export interface UseCalculateFareReturn {
  /** Run calculate-fare with the given payload */
  mutate: (payload: CalculateFareRequest) => void;
  /** Run calculate-fare (async); throws on error */
  mutateAsync: (payload: CalculateFareRequest) => Promise<PricingResult>;
  /** Pricing result from last successful call (totalFare, distanceKm, breakdown, etc.) */
  data: PricingResult | undefined;
  /** Whether the mutation is in progress */
  isPending: boolean;
  /** Error from last failed call */
  error: string | null;
  /** Reset mutation state (data, error) */
  reset: () => void;
}

/**
 * Mutation hook for POST /api/bookings/calculate-fare
 * Call once with all stops (1 pickup + 0–19 dropoffs) to get total fare for the route
 * Use totalFare (and optionally distanceKm, breakdown) when creating the booking
 *
 * @returns mutate, mutateAsync, data (PricingResult), isPending, error, reset
 *
 * @example
 * ```tsx
 * const { mutateAsync: calculateFare, data: pricing, isPending } = useCalculateFare();
 * const result = await calculateFare({ vehicleType: 'Van', stops });
 * // result.totalFare -> use in create booking
 * ```
 */
export function useCalculateFare(): UseCalculateFareReturn {
  const mutation = useMutation({
    mutationFn: (payload: CalculateFareRequest) => bookingService.calculateFare(payload),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error ? (mutation.error instanceof Error ? mutation.error.message : String(mutation.error)) : null,
    reset: mutation.reset,
  };
}
