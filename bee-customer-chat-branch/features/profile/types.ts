/**
 * Profile feature-specific types
 */

/**
 * Profile update request payload
 */
export interface UpdateProfileRequest {
  /** User's full name */
  fullName?: string;
  /** User's email address */
  email?: string;
  /** User's phone number */
  phoneNumber?: string;
  /** Default pickup address */
  defaultPickupAddress?: string;
}

/**
 * Profile update response
 */
export interface UpdateProfileResponse {
  /** Updated user information */
  user: {
    id: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    defaultPickupAddress?: string;
  };
  /** Success message */
  message?: string;
}

/**
 * Profile statistics
 */
export interface ProfileStats {
  /** Total bookings */
  totalBookings: number;
  /** Completed bookings */
  completedBookings: number;
  /** Average rating */
  averageRating: number;
  /** Total spent */
  totalSpent: number;
}

