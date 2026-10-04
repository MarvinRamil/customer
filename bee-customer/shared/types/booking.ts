/**
 * Common booking types used across features
 * These types are shared and can be used by multiple features
 */

/**
 * Booking status enumeration
 * Matches API booking status values
 */
export type BookingStatus =
  | "Pending"
  | "Assigned"
  | "Broadcasting"
  | "Confirmed"
  | "DriverAssigned"
  | "Dispatched"
  | "PickedUp"
  | "InProgress"
  | "Arrived"
  | "InTransit"
  | "Completed"
  | "Cancelled";

/**
 * Assignment status enumeration
 * Indicates the assignment state of a booking
 */
export type AssignmentStatus =
  | "Unassigned"
  | "PendingAssignment"
  | "Assigned"
  | "AssignedToOperator"
  | "Broadcasting"
  | "BroadcastingToDrivers"
  | "AcceptedByDriver"
  | "RejectedByAllDrivers";

/**
 * Booking size classification
 */
export type BookingSize = "Small" | "Medium" | "Large";

/**
 * Delivery mode: what the customer bought beyond the delivery itself.
 * Orthogonal to serviceType (Immediate/Scheduled), which says only when.
 * Absent/omitted on a request means Regular.
 */
export type DeliveryMode = "Regular" | "Pooling" | "OnDemand";

/**
 * Truck type enumeration
 * Matches API truck type values
 */
export type TruckType =
  | "Small"
  | "Medium"
  | "Large"
  | "Flatbed"
  | "Refrigerated"
  | "Container"
  | "Closed Van"
  | "L300"
  | "Small Truck"
  | "Medium Truck"
  | "Large Truck";

/**
 * Location coordinates
 */
export interface LocationCoordinates {
  /** Latitude */
  latitude: number;
  /** Longitude */
  longitude: number;
}

/**
 * Stop type enumeration
 */
export type StopType = "Pickup" | "Dropoff";

/**
 * Stop status enumeration
 * Represents the status of a stop in the booking
 */
export type StopStatus = "Pending" | "InProgress" | "Completed" | "Cancelled" | "Arrived" | "InTransit";

/**
 * Booking stop interface
 * Represents a single stop (pickup or dropoff) in a multi-stop booking
 * Matches API response structure from /api/bookings/my-bookings
 */
export interface BookingStop {
  /** Unique stop identifier (Guid) */
  id: string;
  /** Sequence order in the route (0-based) */
  sequence: number;
  /** Full address of the stop */
  address: string;
  /** Type of stop: Pickup or Dropoff */
  type: StopType;
  /** Current status of the stop */
  status: StopStatus;
  /** Timestamp when driver arrived at this stop (ISO 8601, nullable) */
  arrivedAt: Date | null;
  /** Timestamp when this stop was completed (ISO 8601, nullable) */
  completedAt: Date | null;
  /** GPS latitude of the stop */
  latitude: number;
  /** GPS longitude of the stop */
  longitude: number;
  /** Contact name at this stop (nullable) */
  contactName: string | null;
  /** Contact phone number at this stop (nullable) */
  contactPhone: string | null;
  /** Additional notes for this stop (nullable) */
  notes: string | null;
}

/**
 * Proof of delivery for a stop
 * Matches API response (e.g. GET /api/bookings/:id) – list can be empty or null
 */
export interface ProofOfDelivery {
  /** Unique identifier (Guid) */
  id: string;
  /** Booking ID (Guid) */
  bookingId: string;
  /** Stop ID (Guid) */
  stopId: string;
  /** URL to delivery image (nullable) */
  imagePath: string | null;
  /** URL to signature image (nullable) */
  signaturePath: string | null;
  /** When delivery was completed (ISO 8601) */
  deliveredAt: string;
  /** Recipient name at delivery (nullable) */
  recipientName: string | null;
  /** Notes (nullable) */
  notes: string | null;
}

/**
 * Booking entity interface
 * Represents a booking/order in the system
 * Matches the API response structure from /api/bookings/my-bookings
 */
export interface Booking {
  /** Unique booking identifier (Guid) */
  id: string;
  /** Human-readable booking number (e.g., "BK-20240101001") */
  bookingNumber: string;
  /** Customer ID (Guid) */
  customerId: string;
  /** Pickup location address */
  pickupLocation: string;
  /** Dropoff/delivery location address */
  dropoffLocation: string;
  /** Type of truck required */
  truckType: TruckType;
  /** Description of cargo being transported */
  cargoDescription: string;
  /** Scheduled pickup date and time (ISO 8601) */
  scheduleDate: Date;
  /** Current booking status */
  status: BookingStatus;
  /** Service type: Immediate (on-demand) or Scheduled */
  serviceType?: 'Immediate' | 'Scheduled';
  /** Delivery mode: Regular, Pooling, or On-Demand (orthogonal to serviceType) */
  deliveryMode?: DeliveryMode;
  /** Additional notes (nullable) */
  notes: string | null;
  /** When booking was created (ISO 8601) */
  createdAt: Date;
  /** When booking was last updated (ISO 8601, nullable) */
  updatedAt: Date | null;
  /** Booking size classification (nullable) */
  size: BookingSize | null;
  /** Assignment status */
  assignmentStatus: AssignmentStatus;
  /** ID of tenant assigned to handle booking (nullable) */
  assignedToTenantId: string | null;
  /** ID of user who assigned booking (nullable) */
  assignedByUserId: string | null;
  /** When booking was assigned (ISO 8601, nullable) */
  assignedAt: Date | null;
  /** Bee platform tenant ID (nullable) */
  beeTenantId: string | null;
  /** Weight of cargo in kilograms (nullable) */
  weightKg: number | null;
  /** GPS latitude of pickup location (nullable) */
  pickupLatitude: number | null;
  /** GPS longitude of pickup location (nullable) */
  pickupLongitude: number | null;
  /** GPS latitude of dropoff location (nullable) */
  dropoffLatitude: number | null;
  /** GPS longitude of dropoff location (nullable) */
  dropoffLongitude: number | null;

  /** Driver fields from Booking DTO (GET /api/bookings/:id, my-bookings) */
  /** Selected driver ID (Guid) – used for SignalR location updates */
  selectedDriverId: string | null;
  /** Driver display name */
  driverName: string | null;
  /** Driver phone number */
  driverPhone: string | null;
  /** When the driver was assigned (ISO 8601, nullable) */
  driverAssignedAt: Date | null;
  /** Driver vehicle type/name */
  driverVehicle: string | null;
  /** License plate */
  driverPlate: string | null;
  /** Vehicle color */
  driverVehicleColor: string | null;
  /** Vehicle model */
  driverVehicleModel: string | null;
  /** Driver profile image URL */
  driverImageUrl: string | null;

  /** Estimated fare for the booking (nullable) */
  estimatedFare: number | null;
  /** Final fare after completion (nullable) */
  finalFare: number | null;

  // Legacy fields for backward compatibility
  /** Optional description of cargo (legacy - use cargoDescription) */
  description?: string;
  /** Optional weight in kg (legacy - use weightKg) */
  weight?: number;
  /** Optional driver ID assigned to this booking (legacy — prefer selectedDriverId) */
  driverId?: string;
  /** Optional driver location coordinates (legacy) */
  driverLocation?: LocationCoordinates;

  /** Array of stops (pickup and dropoff locations) for multi-stop bookings */
  stops?: BookingStop[];

  /** Proof of deliveries (image/signature per stop); can be empty or null */
  proofOfDeliveries?: ProofOfDelivery[] | null;

  /** Cancellation reason (nullable) */
  cancellationReason: string | null;
  /** User ID who cancelled the booking (nullable) */
  cancelledBy: string | null;
  /** When booking was cancelled (nullable) */
  cancelledAt: Date | null;
}

/**
 * Cancellation reason enumeration
 * Must match backend BeeLogistics.Modules.Bookings.Application.DTOs.CancellationReason
 */
export enum CancellationReason {
  CustomerRequest = 'CustomerRequest',
  DriverUnavailable = 'DriverUnavailable',
  NoDriverFound = 'NoDriverFound',
  PickupLocationInaccessible = 'PickupLocationInaccessible',
  DeliveryLocationInaccessible = 'DeliveryLocationInaccessible',
  ItemNotReady = 'ItemNotReady',
  WeatherConditions = 'WeatherConditions',
  VehicleBreakdown = 'VehicleBreakdown',
  Emergency = 'Emergency',
  Other = 'Other',
}

/**
 * Human-readable labels for cancellation reasons (for UI)
 */
export const CancellationReasonLabels: Record<CancellationReason, string> = {
  [CancellationReason.CustomerRequest]: 'Changed my plans / Customer request',
  [CancellationReason.DriverUnavailable]: 'Driver unavailable',
  [CancellationReason.NoDriverFound]: 'No driver found',
  [CancellationReason.PickupLocationInaccessible]: 'Pickup location inaccessible',
  [CancellationReason.DeliveryLocationInaccessible]: 'Delivery location inaccessible',
  [CancellationReason.ItemNotReady]: 'Item not ready for pickup',
  [CancellationReason.WeatherConditions]: 'Weather conditions',
  [CancellationReason.VehicleBreakdown]: 'Vehicle breakdown',
  [CancellationReason.Emergency]: 'Emergency situation',
  [CancellationReason.Other]: 'Other',
};

/**
 * Booking statistics interface
 * Represents aggregated statistics about bookings
 */
export interface BookingStats {
  /** Total number of bookings */
  total: number;
  /** Number of pending bookings */
  pending: number;
  /** Number of bookings in transit */
  inTransit: number;
  /** Number of completed bookings */
  completed: number;
}

/**
 * API response structure for my-bookings endpoint
 */
export interface MyBookingsResponse {
  /** Success indicator */
  success: boolean;
  /** Array of bookings */
  data: Booking[];
}
