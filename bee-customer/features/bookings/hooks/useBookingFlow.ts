import type { Booking } from '@/shared/types/booking';
import { useCallback } from 'react';
import type { CalculateFareRequest, CreateMultiStopBookingRequest, PricingResult } from '../types';
import { useCalculateFare } from './useCalculateFare';
import { useCreateMultiStopBooking } from './useCreateMultiStopBooking';

/**
 * Step in the booking flow
 */
export type BookingFlowStep =
  | 'idle'           // No fare yet
  | 'calculating'    // Calculate-fare in progress
  | 'showing-fare'   // Fare result available; user can confirm and create
  | 'creating';      // Create booking in progress

/**
 * Return type for useBookingFlow hook
 */
export interface UseBookingFlowReturn {
  /** Current step in the flow */
  step: BookingFlowStep;
  /** Fare result from calculate-fare (totalFare, distanceKm, breakdown); set after calculateFare succeeds */
  fareResult: PricingResult | null;
  /** Created booking from create; set after createBooking succeeds */
  createdBooking: Booking | null;
  /** Run calculate-fare; on success step becomes 'showing-fare' and fareResult is set */
  calculateFare: (payload: CalculateFareRequest) => Promise<void>;
  /** Run create booking; uses fareResult.totalFare as estimatedFare. Call after calculateFare succeeded. */
  createBooking: (payload: Omit<CreateMultiStopBookingRequest, 'estimatedFare'>) => Promise<Booking>;
  /** Whether calculate-fare is in progress */
  isCalculating: boolean;
  /** Whether create booking is in progress */
  isCreating: boolean;
  /** Whether any operation is in progress */
  isLoading: boolean;
  /** Error from calculate-fare or create (whichever failed last) */
  error: string | null;
  /** Reset flow state (step, fareResult, createdBooking, errors) */
  reset: () => void;
}

/**
 * Orchestrates the booking flow: calculate-fare → show fare → create booking
 * Holds fare result and step state; exposes calculateFare() and createBooking() actions
 *
 * @returns step, fareResult, createdBooking, calculateFare, createBooking, loading states, error, reset
 *
 * @example
 * ```tsx
 * const flow = useBookingFlow();
 * await flow.calculateFare({ vehicleType: 'Van', stops });
 * // flow.step === 'showing-fare', flow.fareResult.totalFare
 * await flow.createBooking({
 *   vehicleType: 'Van',
 *   cargoDescription: 'Documents',
 *   scheduleDate: new Date().toISOString(),
 *   serviceType: 'Immediate',
 *   stops,
 * });
 * ```
 */
export function useBookingFlow(): UseBookingFlowReturn {
  const calculateFareMutation = useCalculateFare();
  const createBookingMutation = useCreateMultiStopBooking();

  const step: BookingFlowStep =
    createBookingMutation.isPending
      ? 'creating'
      : calculateFareMutation.isPending
        ? 'calculating'
        : calculateFareMutation.data
          ? 'showing-fare'
          : 'idle';

  const fareResult: PricingResult | null = calculateFareMutation.data ?? null;
  const createdBooking: Booking | null = createBookingMutation.data ?? null;

  const calculateFare = useCallback(
    async (payload: CalculateFareRequest) => {
      createBookingMutation.reset();
      await calculateFareMutation.mutateAsync(payload);
    },
    [calculateFareMutation, createBookingMutation]
  );

  const createBooking = useCallback(
    async (payload: Omit<CreateMultiStopBookingRequest, 'estimatedFare'>): Promise<Booking> => {
      if (!fareResult?.totalFare) {
        throw new Error('Calculate fare first to get estimatedFare');
      }
      const fullPayload: CreateMultiStopBookingRequest = {
        ...payload,
        estimatedFare: fareResult.totalFare,
      };
      return createBookingMutation.mutateAsync(fullPayload);
    },
    [fareResult?.totalFare, createBookingMutation]
  );

  const reset = useCallback(() => {
    calculateFareMutation.reset();
    createBookingMutation.reset();
  }, [calculateFareMutation, createBookingMutation]);

  const error =
    calculateFareMutation.error ?? createBookingMutation.error ?? null;

  return {
    step,
    fareResult,
    createdBooking,
    calculateFare,
    createBooking,
    isCalculating: calculateFareMutation.isPending,
    isCreating: createBookingMutation.isPending,
    isLoading: calculateFareMutation.isPending || createBookingMutation.isPending,
    error,
    reset,
  };
}
