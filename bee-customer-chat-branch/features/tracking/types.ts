/**
 * Tracking feature-specific types
 */

/**
 * Tracking status enumeration
 */
export type TrackingStatus = 
  | "Booking Confirmed"
  | "Driver Assigned"
  | "Pickup Completed"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";

/**
 * Tracking timeline step
 */
export interface TrackingStep {
  /** Step label */
  label: TrackingStatus;
  /** Whether step is completed */
  completed: boolean;
  /** Time when step occurred (ISO 8601 or formatted time string) */
  time: string;
}

/**
 * Driver information for tracking
 */
export interface DriverInfo {
  /** Driver name */
  name: string;
  /** Vehicle type/model */
  vehicle: string;
  /** License plate number */
  licensePlate: string;
  /** Driver phone number */
  phoneNumber?: string;
}

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
 * Tracking data for a booking
 */
export interface TrackingData {
  /** Booking ID */
  bookingId: string;
  /** Current tracking status */
  status: TrackingStatus;
  /** Whether live tracking is active */
  isLive: boolean;
  /** Pickup location coordinates */
  pickupLocation: LocationCoordinates;
  /** Dropoff location coordinates */
  dropoffLocation: LocationCoordinates;
  /** Current driver location (if live tracking) */
  driverLocation?: LocationCoordinates;
  /** Driver information */
  driver?: DriverInfo;
  /** Estimated arrival time (ISO 8601) */
  estimatedArrival?: string;
  /** Tracking timeline steps */
  steps: TrackingStep[];
}

