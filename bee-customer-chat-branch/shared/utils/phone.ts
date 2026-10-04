/**
 * Normalize a Philippine mobile number to E.164 (+63XXXXXXXXXX).
 * Accepts: 9XXXXXXXXX, 09XXXXXXXXX, 639XXXXXXXXX, +639XXXXXXXXX
 */
export function normalizePhilippineMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '');

  if (digits.startsWith('63') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11 && digits[1] === '9') {
    return `+63${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `+63${digits}`;
  }

  return null;
}

/** Display prefix for Philippine mobile entry fields */
export const PHILIPPINE_MOBILE_PREFIX = '+63';
