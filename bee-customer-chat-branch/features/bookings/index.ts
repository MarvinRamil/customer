/**
 * Bookings feature public API
 * This file exports all public components, hooks, services, and types from the bookings feature
 * Other features should import from this file, not from internal paths
 */

// Export components
export { AssignmentStatusBadge } from './components/AssignmentStatusBadge';
export { BookingCard } from './components/BookingCard';
export { getStatusDisplayLabel, StatusBadge } from './components/StatusBadge';
export { getEffectiveBookingStatus, isFirstStopCompleted } from './utils/bookingStatus';
export { FARE_CHANGED_MESSAGE_FRAGMENT, isFareChangedError } from './utils/fareErrors';

// Export hooks
export { useBookingFlow } from './hooks/useBookingFlow';
export type {
  BookingFlowStep,
  UseBookingFlowReturn
} from './hooks/useBookingFlow';
export { useBookings } from './hooks/useBookings';
export { useBookingStats } from './hooks/useBookingStats';
export { useCalculateFare } from './hooks/useCalculateFare';
export type { UseCalculateFareReturn } from './hooks/useCalculateFare';
export { BOOKINGS_QUERY_KEY, useCreateMultiStopBooking } from './hooks/useCreateMultiStopBooking';
export type { UseCreateMultiStopBookingReturn } from './hooks/useCreateMultiStopBooking';
export { useVehiclePricing, VEHICLE_PRICING_QUERY_KEY } from './hooks/useVehiclePricing';
export type { UseVehiclePricingReturn } from './hooks/useVehiclePricing';

// Export services
export { bookingService } from './services/bookingService';

// Export types
export type {
  Booking,
  BookingFilter,
  BookingListResponse,
  BookingStats,
  BookingStop,
  BookingStopType,
  CalculateFareRequest,
  CreateBookingRequest,
  CreateMultiStopBookingRequest,
  PricingResult,
  UpdateBookingRequest,
  VehiclePricing
} from './types';
export type { DeliveryMode } from '@/shared/types/booking';

