/**
 * Booking feature-specific types
 * These types are used only within the bookings feature
 */

import type {
    AssignmentStatus,
    Booking,
    BookingSize,
    BookingStats,
    DeliveryMode,
    MyBookingsResponse,
} from '@/shared/types/booking';

/**
 * Booking filter options
 * Used for client-side filtering of bookings
 */
export type BookingFilter = 'All' | 'Active' | 'Completed';

/**
 * Create booking request payload
 * Matches the API endpoint POST /api/bookings
 */
export interface CreateBookingRequest {
  /** Pickup location address (required, max 500 characters) */
  pickupLocation: string;
  /** Dropoff location address (required, max 500 characters) */
  dropoffLocation: string;
  /** Type of truck required (required, max 50 characters) */
  truckType: string;
  /** Scheduled pickup date/time in ISO 8601 format (required, must be today or future) */
  scheduleDate: string;
  /** Description of cargo (optional, max 1000 characters) */
  cargoDescription?: string;
  /** Additional notes (optional, max 1000 characters) */
  notes?: string;
  /** Weight in kilograms (optional, 0 to 100,000 kg) */
  weightKg?: number;
  /** Pickup GPS latitude (optional, -90 to 90, must provide with longitude) */
  pickupLatitude?: number;
  /** Pickup GPS longitude (optional, -180 to 180, must provide with latitude) */
  pickupLongitude?: number;
  /** Dropoff GPS latitude (optional, -90 to 90, must provide with longitude) */
  dropoffLatitude?: number;
  /** Dropoff GPS longitude (optional, -180 to 180, must provide with latitude) */
  dropoffLongitude?: number;
  /** Customer ID (optional, auto-resolved from JWT token) */
  customerId?: string;
}

/**
 * Update booking request payload
 */
export interface UpdateBookingRequest {
  /** Optional pickup location update */
  pickupLocation?: string;
  /** Optional dropoff location update */
  dropoffLocation?: string;
  /** Optional truck type update */
  truckType?: string;
  /** Optional schedule date update */
  scheduleDate?: string;
  /** Optional status update */
  status?: string;
  /** Optional description update */
  description?: string;
  /** Optional weight update */
  weight?: number;
}

/**
 * Booking list response
 */
export interface BookingListResponse {
  /** Array of bookings */
  bookings: Booking[];
  /** Total count of bookings */
  total: number;
  /** Current page number */
  page?: number;
  /** Number of items per page */
  limit?: number;
}

/**
 * Vehicle pricing from GET /api/vehicle-pricing
 * Used to populate vehicle type dropdown; vehicleType is sent in calculate-fare and create booking
 */
export interface VehiclePricing {
  /** Unique id (UUID) */
  id?: string;
  /** Value to send in API (e.g. Van, L300, Aluminum2000) */
  vehicleType: string;
  /** Display label for UI (e.g. "Aluminum", "7-seater SUV / Small Van") */
  types: string;
  /** Whether this vehicle type is active and available */
  isActive?: boolean;
  /** Base fare */
  baseFare?: number;
  /** Rate per km for 0–5 km */
  perKm0to5?: number;
  /** Rate per km above 5 km */
  perKmAbove5?: number;
  /** Fee per additional stop */
  additionalStopFee?: number;
  /** Weight limit in kg */
  weightLimitKg?: number;
  /** Surcharge per kg over weight limit */
  weightSurchargePerKg?: number;
  /** Size limit (e.g. "3x1.7x1.7m") */
  sizeLimit?: string;
  /** Long distance: base fare */
  longDistanceBaseFare?: number;
  /** Long distance: rate per km for 41–60 km */
  longDistancePerKm41to60?: number;
  /** Long distance: rate per km above 60 km */
  longDistancePerKmAbove60?: number;
  /** High demand / peak hours surcharge notice */
  surchargeInfo?: string;
  /** General fare disclaimer / remarks */
  remarks?: string;
  /** Version for optimistic locking */
  version?: number;
  /** User id of last updater */
  updatedByUserId?: string | null;
  /** Display name of last updater */
  updatedByUserName?: string | null;
  /** Created at (ISO 8601) */
  createdAt?: string;
  /** Updated at (ISO 8601) */
  updatedAt?: string | null;
  /** Other fields from API as needed */
  [key: string]: unknown;
}

/**
 * Stop type for multi-stop booking
 * Matches API stop object in calculate-fare and create booking endpoints
 */
export type BookingStopType = 'Pickup' | 'Dropoff';

/**
 * Single stop in a multi-stop booking (pickup or dropoff)
 * Used in calculate-fare and create booking requests
 */
export interface BookingStop {
  /** 0-based order in the route */
  sequence: number;
  /** Full address */
  address: string;
  /** Pickup or Dropoff */
  type: BookingStopType;
  /** Latitude (-90 to 90), optional */
  latitude?: number;
  /** Longitude (-180 to 180), optional */
  longitude?: number;
  /** Contact name at stop, optional */
  contactName?: string;
  /** Contact phone at stop, optional */
  contactPhone?: string;
  /** Notes for this stop, optional */
  notes?: string;
}

/**
 * Request payload for POST /api/bookings/calculate-fare
 * Get estimated fare for a route (all stops) before creating booking
 */
export interface CalculateFareRequest {
  /** Vehicle type (e.g. Van, Truck) */
  vehicleType: string;
  /** Exactly 2 stops: one Pickup, one Dropoff */
  stops: BookingStop[];
  /** Weight in kg, optional */
  weightKg?: number;
  /** Priority fee, optional. Ignored server-side; any mode premium is derived server-side. */
  priorityFee?: number;
  /** Scheduled date/time (ISO), optional; for scheduled deliveries */
  scheduledDateTime?: string;
  /** "Regular" | "Pooling" | "OnDemand", case-insensitive. Absent/omitted means Regular. */
  deliveryMode?: DeliveryMode;
}

/**
 * Pricing result from calculate-fare API
 * Matches API response data from POST /api/bookings/calculate-fare
 */
export interface PricingResult {
  /** Total fare for the route */
  totalFare: number;
  /** Base fare component, optional */
  baseFare?: number;
  /** Distance-based fare, optional */
  distanceFare?: number;
  /** Weight surcharge, optional */
  weightSurcharge?: number;
  /** Priority fee, optional */
  priorityFee?: number;
  /** High demand surcharge, optional */
  highDemandSurcharge?: number;
  /** Toll fee, optional */
  tollFee?: number;
  /** Total distance in km, optional */
  distanceKm?: number;
  /** Human-readable breakdown, e.g. "Base Fare: ₱49.00\nDistance (8.00 km): ₱45.00\nOn-Demand Premium: ₱25.00\nTotal: ₱119.00". Ready to render as-is. */
  breakdown?: string | null;
  /** Positive magnitude already subtracted from totalFare, when the mode is Pooling with a configured discount */
  poolingDiscount?: number;
  /** Which mode this quote priced */
  deliveryMode?: DeliveryMode;
}

/**
 * Request payload for POST /api/bookings (multi-stop create)
 * Create booking with multi-stop route and estimated fare
 */
export interface CreateMultiStopBookingRequest {
  /** Vehicle type (e.g. Van, Truck) */
  vehicleType: string;
  /** Description of cargo */
  cargoDescription: string;
  /** Schedule date/time (ISO) */
  scheduleDate: string;
  /** "Immediate" or "Scheduled" */
  serviceType: 'Immediate' | 'Scheduled';
  /** Exactly 2 stops: one Pickup, one Dropoff; same structure as calculate-fare */
  stops: BookingStop[];
  /** Use totalFare from calculate-fare response */
  estimatedFare: number;
  /** "Regular" | "Pooling" | "OnDemand", case-insensitive. Absent/omitted means Regular. Must match what calculate-fare quoted. */
  deliveryMode?: DeliveryMode;
  /** Customer GUID; use empty GUID to use logged-in user, optional */
  customerId?: string;
  /** Weight in kg, optional */
  weightKg?: number;
  /** Priority fee, optional */
  priorityFee?: number;
  /** Scheduled date/time (ISO), optional */
  scheduledDateTime?: string;
  /** Scheduled pickup window, optional */
  scheduledPickupWindow?: string;
  /** Preferred driver GUID, optional */
  favouriteDriverId?: string;
  /** Item image path, optional; not used when sending multipart with itemImage file */
  itemImagePath?: string;
  /** Item dimensions in cm, optional */
  itemLengthCm?: number;
  itemWidthCm?: number;
  itemHeightCm?: number;
  /** Additional notes, optional */
  notes?: string;
  /** Payment method: "Cash" (pay driver on delivery) or "PayOnline" (pay online / Xendit). Optional; when Cash, backend creates cash-on-delivery payment. */
  paymentMethod?: 'Cash' | 'PayOnline';
}

/**
 * Optional file for multipart create (POST /api/bookings with item image).
 * When present, the create request is sent as multipart/form-data with payload + itemImage.
 */
export interface CreateMultiStopBookingItemImage {
  uri: string;
  type?: string;
  name?: string;
}

/**
 * Re-export shared types for convenience
 */
export type {
    AssignmentStatus,
    Booking,
    BookingSize,
    BookingStats,
    MyBookingsResponse
};

