import { z } from 'zod';

/**
 * Zod validation schemas for authentication forms
 * Provides type-safe validation with automatic type inference
 */

/**
 * Login form validation schema
 * Validates email and password for login
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Infer TypeScript type from login schema
 */
export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Registration form validation schema
 * Validates all registration fields according to API requirements
 */
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters long')
    .regex(/\d/, 'Password must contain at least one digit (0-9)')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter (a-z)')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter (A-Z)')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character (!@#$%^&* etc.)')
    .refine(
      (val) => new Set(val).size >= 4,
      'Password must contain at least 4 unique characters'
    ),
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters')
    .transform((val) => val.trim()),
  phoneNumber: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim().length === 0) {
          return true; // Optional field
        }
        const digitsOnly = val.trim().replace(/[\s\-\(\)\+]/g, '');
        return /^\d+$/.test(digitsOnly) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
      },
      {
        message: 'Phone number must be between 7 and 15 digits',
      }
    )
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  referralCode: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
});

/**
 * Infer TypeScript type from registration schema
 */
export const emailOnlySchema = registerSchema.pick({ email: true });

export const registrationDetailsSchema = registerSchema.pick({
  fullName: true,
  password: true,
});

export type EmailOnlyFormData = z.infer<typeof emailOnlySchema>;
export type RegistrationDetailsFormData = z.infer<typeof registrationDetailsSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
