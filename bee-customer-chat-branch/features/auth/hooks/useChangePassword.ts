import { useMutation } from '@tanstack/react-query';
import { authService } from '../services/authService';
import type { ChangePasswordRequest } from '../types';

export interface UseChangePasswordReturn {
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
  message: string | null;
  changePassword: (request: ChangePasswordRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for change password functionality
 * Uses TanStack Query mutation for changing password
 * Validates password requirements before submitting
 * 
 * @returns Object containing loading state, success state, error, and changePassword function
 */
export function useChangePassword(): UseChangePasswordReturn {
  // Change password mutation using TanStack Query
  const changePasswordMutation = useMutation({
    mutationFn: async (request: ChangePasswordRequest) => {
      // Validate password length
      if (!request.newPassword || request.newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters');
      }
      
      // Validate that either current password or OTP is provided
      if (!request.currentPassword && !request.otp) {
        throw new Error('Either current password or OTP is required');
      }
      
      return authService.changePassword(request);
    },
  });

  /**
   * Change password
   * @param request - ChangePasswordRequest (currentPassword, newPassword, optional otp)
   */
  const changePassword = async (request: ChangePasswordRequest): Promise<void> => {
    await changePasswordMutation.mutateAsync(request);
  };

  /**
   * Reset hook state (clear success/error)
   */
  const reset = () => {
    changePasswordMutation.reset();
  };

  return {
    isLoading: changePasswordMutation.isPending,
    isSuccess: changePasswordMutation.isSuccess,
    error: changePasswordMutation.error?.message || null,
    message: changePasswordMutation.data?.message || null,
    changePassword,
    reset,
  };
}
