/**
 * Booking form validation schemas using Zod
 * Per .cursor/rules/validation/zod-validation.md - all form validation MUST use Zod
 */

import { z } from 'zod';

/**
 * Philippine mobile number in local format: 11 digits starting with 09 (e.g. 09171234567)
 */
export const PH_PHONE_REGEX = /^09\d{9}$/;
export const PHONE_VALIDATION_MESSAGE = 'Phone number must be 11 digits in the format 09XXXXXXXXX';

/**
 * Schema for location coordinates (latitude/longitude)
 */
const locationCoordinatesSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .nullable();

/**
 * Schema for the dropoff. A booking is exactly one pickup and one dropoff, so this is
 * always required, matching the pickup fields below.
 */
const dropoffEntrySchema = z.object({
  address: z.string().min(1, 'Dropoff address is required').transform((val) => val.trim()),
  coordinates: locationCoordinatesSchema,
  contactName: z.string().min(1, 'Dropoff contact name is required').transform((val) => val.trim()),
  contactPhone: z
    .string()
    .min(1, 'Dropoff contact phone number is required')
    .refine((val) => PH_PHONE_REGEX.test(val.trim()), {
      message: PHONE_VALIDATION_MESSAGE,
    })
    .transform((val) => val.trim()),
  notes: z.string().default('').transform((val) => (val ? val.trim() : '')),
});

/**
 * Booking form schema
 * Validates all fields in the booking form including conditional validation for Scheduled bookings
 */
export const bookingSchema = z
  .object({
    /** Pickup address (required) */
    pickup: z
      .string()
      .min(1, 'Pickup address is required')
      .transform((val) => val.trim()),
    /** Pickup contact (required) and notes (optional) */
    pickupContactName: z
      .string()
      .min(1, 'Pickup contact name is required')
      .transform((val) => val.trim()),
    pickupContactPhone: z
      .string()
      .min(1, 'Pickup contact phone number is required')
      .refine((val) => val.trim().length === 0 || PH_PHONE_REGEX.test(val.trim()), {
        message: PHONE_VALIDATION_MESSAGE,
      })
      .transform((val) => val.trim()),
    pickupNotes: z.string().default('').transform((val) => (val ? val.trim() : '')),
    /** The single dropoff (required) - a booking is exactly one pickup and one dropoff */
    dropoff: dropoffEntrySchema,
    /** Vehicle type (required) */
    truckType: z.string().min(1, 'Vehicle type is required'),
    /** On Demand (false) vs Scheduled (true) */
    isScheduled: z.boolean(),
    /** Scheduled date (YYYY-MM-DD) - required when isScheduled is true */
    scheduledDate: z
      .string()
      .default('')
      .transform((val) => (val ? val.trim() : '')),
    /** Scheduled time (HH:mm) - required when isScheduled is true */
    scheduledTime: z
      .string()
      .default('')
      .transform((val) => (val ? val.trim() : '')),
    /** Optional pickup window - only used when isScheduled is true */
    scheduledPickupWindow: z
      .string()
      .default('')
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : '')),
    /** Cargo description (optional) */
    description: z
      .string()
      .default('')
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : '')),
    /** Dimensions (optional, UI only; not sent to API) – separate number values in cm */
    lengthCm: z
      .string()
      .default('')
      .refine((val) => !val || val.trim() === '' || !Number.isNaN(parseFloat(val.trim())),
        { message: 'Length must be a number' })
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : '')),
    widthCm: z
      .string()
      .default('')
      .refine((val) => !val || val.trim() === '' || !Number.isNaN(parseFloat(val.trim())),
        { message: 'Width must be a number' })
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : '')),
    heightCm: z
      .string()
      .default('')
      .refine((val) => !val || val.trim() === '' || !Number.isNaN(parseFloat(val.trim())),
        { message: 'Height must be a number' })
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : '')),
    /** Notes for driver (optional), separate from cargo description */
    notesForDriver: z
      .string()
      .default('')
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : '')),
    /**
     * Weight (required, must be a valid positive number).
     * This only enforces a generous sanity ceiling (50,000 kg) against garbage input - the real,
     * meaningful cap is each vehicle's own weightLimitKg, enforced in the booking screen against
     * the currently selected vehicle (see selectedVehicleWeightLimitKg in app/booking.tsx), since
     * that limit varies per vehicle and isn't known to this static schema.
     */
    weight: z
      .string()
      .min(1, 'Weight is required')
      .refine(
        (val) => {
          const trimmed = val.trim();
          if (!trimmed) return false;
          const num = parseFloat(trimmed);
          return !Number.isNaN(num) && num > 0;
        },
        {
          message: 'Weight must be a valid positive number (e.g. 5.5)',
        }
      )
      .refine(
        (val) => {
          const trimmed = val.trim();
          if (!trimmed) return false;
          const num = parseFloat(trimmed);
          if (Number.isNaN(num)) return false;
          return num <= 50000;
        },
        {
          message: 'Weight must not exceed 50,000 kg',
        }
      )
      .transform((val) => val.trim()),
    /** Extra / Tip amount (optional, positive PHP amount if provided) */
    tipAmount: z
      .string()
      .default('')
      .refine(
        (val) => {
          if (!val || val.trim().length === 0) return true;
          const normalized = val.replace(/[₱,\s]/g, '');
          const num = parseFloat(normalized);
          return !Number.isNaN(num) && num >= 0;
        },
        {
          message: 'Extra / Tip must be a valid amount',
        }
      )
      .transform((val) => (val ? val.trim() : '')),
    /** Extra / Tip message/comment (optional) */
    tipMessage: z
      .string()
      .default('')
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : '')),
  })
  .superRefine((data, ctx) => {
    // Conditional validation: scheduledDate and scheduledTime required when isScheduled is true
    if (data.isScheduled) {
      // Validate scheduledDate
      if (!data.scheduledDate || data.scheduledDate.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Scheduled date is required and must be a valid date (YYYY-MM-DD)',
          path: ['scheduledDate'],
        });
      } else {
        // Validate date format YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(data.scheduledDate)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Scheduled date must be a valid date (YYYY-MM-DD)',
            path: ['scheduledDate'],
          });
        } else {
          const date = new Date(data.scheduledDate);
          if (isNaN(date.getTime())) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Scheduled date must be a valid date',
              path: ['scheduledDate'],
            });
          }
        }
      }

      // Validate scheduledTime
      if (!data.scheduledTime || data.scheduledTime.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Scheduled time is required and must be a valid time (HH:mm)',
          path: ['scheduledTime'],
        });
      } else {
        // Validate time format HH:mm
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(data.scheduledTime)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Scheduled time must be a valid time (HH:mm)',
            path: ['scheduledTime'],
          });
        }
      }

      // Validate that combined date/time is at least 1 hour in the future
      // This allows users to schedule pickups with reasonable advance notice
      if (data.scheduledDate && data.scheduledTime) {
        const combinedDateTime = new Date(`${data.scheduledDate}T${data.scheduledTime}:00`);
        if (!isNaN(combinedDateTime.getTime())) {
          const now = new Date();
          const minimumScheduleTime = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
          if (combinedDateTime < minimumScheduleTime) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Scheduled pickup must be at least 1 hour from now (minimum: ${minimumScheduleTime.toLocaleTimeString()})`,
              path: ['scheduledDate'],
            });
          }
        }
      }
    }
  });

/**
 * Get default scheduled time: current time + 1 hour, rounded up to nearest 15 minutes
 * This ensures the default time is always valid per the validation rules
 * @returns Time string in HH:mm format
 */
export function getDefaultScheduledTime(): string {
  const now = new Date();
  // Add 1 hour
  now.setHours(now.getHours() + 1);
  // Round up to nearest 15 minutes
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  if (minutes >= 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  } else {
    now.setMinutes(minutes);
  }
  
  const hours = now.getHours().toString().padStart(2, '0');
  const mins = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

/**
 * Get default scheduled date: today if current time + 1 hour is still today, otherwise tomorrow
 * @returns Date string in YYYY-MM-DD format
 */
export function getDefaultScheduledDate(): string {
  const now = new Date();
  // Add 1 hour to check if we're still in today
  now.setHours(now.getHours() + 1);
  // Round up to nearest 15 minutes (same logic as time)
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  if (minutes >= 60) {
    now.setHours(now.getHours() + 1);
  }
  
  // Use local date methods to avoid timezone issues with toISOString()
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Inferred type from booking schema
 * Use this type for form data instead of manually defining types
 */
export type BookingFormData = z.infer<typeof bookingSchema>;
