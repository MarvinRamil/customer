/**
 * Validation utilities for forms
 * Provides reusable validation functions for password, email, and other common inputs
 */

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  /** Whether the password meets all requirements */
  valid: boolean;
  /** List of error messages if validation fails */
  errors?: string[];
}

/**
 * Email validation result
 */
export interface EmailValidationResult {
  /** Whether the email format is valid */
  valid: boolean;
  /** Normalized email (trimmed, lowercase) if valid */
  normalized?: string;
}

/**
 * Password validation rules (from API docs)
 * - Minimum length: 8
 * - At least one digit
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one non-alphanumeric character (e.g. !@#$%)
 * - At least 4 unique characters
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MIN_UNIQUE_CHARS = 4;

/**
 * Validate password against API requirements
 * @param password - Password to validate
 * @returns PasswordValidationResult with valid flag and error messages
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length === 0) {
    return {
      valid: false,
      errors: ['Password is required'],
    };
  }

  // Minimum length: 8
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }

  // At least one digit
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one digit (0-9)');
  }

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }

  // At least one non-alphanumeric character
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
  }

  // At least 4 unique characters
  const uniqueChars = new Set(password).size;
  if (uniqueChars < PASSWORD_MIN_UNIQUE_CHARS) {
    errors.push(`Password must contain at least ${PASSWORD_MIN_UNIQUE_CHARS} unique characters`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate and normalize email address
 * Uses lenient validation during typing to allow incomplete emails
 * @param email - Email to validate
 * @param strict - If true, performs strict validation (default: false for typing, true for submission)
 * @returns EmailValidationResult with valid flag and normalized email
 */
export function validateEmail(email: string, strict: boolean = false): EmailValidationResult {
  if (!email || email.trim().length === 0) {
    return {
      valid: false,
    };
  }

  // During typing (lenient mode), ALWAYS return valid - NO VALIDATION AT ALL
  // This completely prevents any validation from interfering with typing
  if (!strict) {
    // Return valid for ANY non-empty input during typing
    // This allows users to type ANYTHING without validation blocking them
    const trimmed = email.trim();
    return {
      valid: true,
      normalized: trimmed.toLowerCase(),
    };
  }

  // For strict validation, normalize
  const normalized = email.trim().toLowerCase();

  // Strict validation (for submission/blur)
  // Must contain @ and .
  if (!normalized.includes('@') || !normalized.includes('.')) {
    return {
      valid: false,
    };
  }

  // Check that @ appears before the last .
  const atIndex = normalized.indexOf('@');
  const lastDotIndex = normalized.lastIndexOf('.');
  if (atIndex === -1 || lastDotIndex === -1 || atIndex >= lastDotIndex) {
    return {
      valid: false,
    };
  }

  // Check that there's at least one character before @ and after .
  if (atIndex === 0 || lastDotIndex === normalized.length - 1) {
    return {
      valid: false,
    };
  }

  // Additional strict checks: domain should have at least 2 characters after last dot
  const domainAfterDot = normalized.substring(lastDotIndex + 1);
  if (domainAfterDot.length < 2) {
    return {
      valid: false,
    };
  }

  return {
    valid: true,
    normalized,
  };
}

/**
 * Validate full name (non-empty, reasonable length)
 * @param fullName - Full name to validate
 * @returns Object with valid flag and optional error message
 */
export function validateFullName(fullName: string): { valid: boolean; error?: string } {
  if (!fullName || fullName.trim().length === 0) {
    return {
      valid: false,
      error: 'Full name is required',
    };
  }

  const trimmed = fullName.trim();
  if (trimmed.length < 2) {
    return {
      valid: false,
      error: 'Full name must be at least 2 characters',
    };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      error: 'Full name must be less than 100 characters',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validate phone number (optional, but if provided should be reasonable format)
 * @param phoneNumber - Phone number to validate
 * @returns Object with valid flag and optional error message
 */
export function validatePhoneNumber(phoneNumber: string | undefined): { valid: boolean; error?: string } {
  // Phone number is optional
  if (!phoneNumber || phoneNumber.trim().length === 0) {
    return {
      valid: true,
    };
  }

  const trimmed = phoneNumber.trim();
  // Basic check: should contain digits and be reasonable length (7-15 digits is common)
  // Remove common formatting characters for validation
  const digitsOnly = trimmed.replace(/[\s\-\(\)\+]/g, '');
  
  if (!/^\d+$/.test(digitsOnly)) {
    return {
      valid: false,
      error: 'Phone number must contain only digits and common formatting characters',
    };
  }

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return {
      valid: false,
      error: 'Phone number must be between 7 and 15 digits',
    };
  }

  return {
    valid: true,
  };
}
