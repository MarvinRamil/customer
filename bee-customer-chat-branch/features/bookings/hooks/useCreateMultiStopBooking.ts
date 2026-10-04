import type { Booking } from '@/shared/types/booking';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';
import type { CreateMultiStopBookingItemImage, CreateMultiStopBookingRequest } from '../types';

/** Query key prefix for bookings (invalidate my-bookings after create) */
export const BOOKINGS_QUERY_KEY = ['bookings'] as const;

/** Argument for create booking: payload + optional item image for multipart */
export type CreateMultiStopBookingInput = CreateMultiStopBookingRequest & {
  /** When set, request is sent as multipart/form-data with payload + itemImage file */
  itemImage?: CreateMultiStopBookingItemImage;
};

/**
 * Return type for useCreateMultiStopBooking hook
 */
export interface UseCreateMultiStopBookingReturn {
  /** Create booking with the given payload (and optional itemImage for multipart) */
  mutate: (input: CreateMultiStopBookingInput) => void;
  /** Create booking (async); throws on error */
  mutateAsync: (input: CreateMultiStopBookingInput) => Promise<Booking>;
  /** Created booking from last successful call */
  data: Booking | undefined;
  /** Whether the mutation is in progress */
  isPending: boolean;
  /** Error from last failed call */
  error: string | null;
  /** Reset mutation state (data, error) */
  reset: () => void;
}

/**
 * Mutation hook for POST /api/bookings
 * Creates a booking with multi-stop route and estimated fare (from calculate-fare)
 * On success invalidates bookings queries so lists refresh
 *
 * @returns mutate, mutateAsync, data (Booking), isPending, error, reset
 *
 * @example
 * ```tsx
 * const { mutateAsync: createBooking, isPending } = useCreateMultiStopBooking();
 * const booking = await createBooking({
 *   vehicleType: 'Van',
 *   cargoDescription: 'Documents',
 *   scheduleDate: new Date().toISOString(),
 *   serviceType: 'Immediate',
 *   stops,
 *   estimatedFare: totalFare,
 * });
 * ```
 */
export function useCreateMultiStopBooking(): UseCreateMultiStopBookingReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: CreateMultiStopBookingInput) => {
      const { itemImage, ...payload } = input;
      return bookingService.createMultiStopBooking(payload, { itemImage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error
      ? mutation.error instanceof Error
        ? mutation.error.message
        : String(mutation.error)
      : null,
    reset: mutation.reset,
  };
}
