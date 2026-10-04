import { useMutation } from '@tanstack/react-query';
import { authService } from '../services/authService';
import type { VerifyEmailRequest } from '../types';

/**
 * Return type for useVerifyEmail hook
 */
export interface UseVerifyEmailReturn {
  /** Whether verification is in progress */
  isLoading: boolean;
  /** Error message if verification failed */
  error: string | null;
  /** Whether verification was successful */
  isSuccess: boolean;
  /** Success message */
  successMessage: string | null;
  /** Verify email function */
  verifyEmail: (payload: VerifyEmailRequest) => void;
  /** Clear error */
  clearError: () => void;
}

/**
 * Custom hook for email verification
 * Uses TanStack Query mutation to handle email verification API call
 * @param email - Email address to verify
 * @param token - Verification token from email link
 * @returns Object containing verification state and handlers
 */
export function useVerifyEmail(email: string, token: string): UseVerifyEmailReturn {
  // Verify email mutation using TanStack Query
  const verifyMutation = useMutation({
    mutationFn: (payload: VerifyEmailRequest) => {
      return authService.verifyEmail(payload);
    },
  });

  /**
   * Verify email with provided email and token
   */
  const verifyEmail = (payload: VerifyEmailRequest) => {
    verifyMutation.mutate(payload);
  };

  /**
   * Get error from mutation
   */
  const error = verifyMutation.error?.message || null;

  /**
   * Get loading state from mutation
   */
  const isLoading = verifyMutation.isPending;

  /**
   * Check if verification was successful
   */
  const isSuccess = verifyMutation.isSuccess;

  /**
   * Success message
   */
  const successMessage = isSuccess
    ? 'Email verified successfully. You can now log in.'
    : null;

  /**
   * Clear error message
   */
  const clearError = () => {
    verifyMutation.reset();
  };

  return {
    isLoading,
    error,
    isSuccess,
    successMessage,
    verifyEmail,
    clearError,
  };
}
