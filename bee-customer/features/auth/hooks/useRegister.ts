import { validateEmail } from '@/shared/utils/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { registerSchema, type RegisterFormData } from '../schemas/validationSchemas';
import { authService } from '../services/authService';
import type { RegisterRequest } from '../types';
import { useCheckEmail } from './useCheckEmail';

/**
 * Optional OTP verification state
 * Used to track if email was verified via OTP before registration
 */
export interface OtpVerificationState {
  /** Whether email was verified via OTP */
  isVerified: boolean;
  /** Email address that was verified */
  email: string | null;
}

/**
 * Return type for useRegister hook
 */
interface UseRegisterReturn {
  // Form fields
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  referralCode: string;
  
  // Setters
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setFullName: (fullName: string) => void;
  setPhoneNumber: (phoneNumber: string) => void;
  setReferralCode: (referralCode: string) => void;
  
  // State
  isLoading: boolean;
  error: string | null;
  emailCheck: {
    available: boolean | null;
    message: string | null;
    existingRole?: string;
    isChecking: boolean;
  };
  /** OTP verification state (if email was verified via OTP before registration) */
  otpVerification: OtpVerificationState;
  registrationSuccess: boolean;
  registeredEmail: string | null;
  
  // Actions
  handleRegister: () => Promise<void>;
  handleResendVerification: () => Promise<void>;
  /** Set OTP verification state (called after successful OTP verification) */
  setOtpVerification: (email: string) => void;
  /** Clear OTP verification state */
  clearOtpVerification: () => void;
  clearError: () => void;
  clearSuccess: () => void;
}

/**
 * Custom hook for managing registration form state and submission
 * Provides form state management, email availability checking, validation, and registration functionality
 * @returns Object containing form state, handlers, and registration functions
 */
export function useRegister(): UseRegisterReturn {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [referralCode, setReferralCode] = useState<string>('');
  const [registrationSuccess, setRegistrationSuccess] = useState<boolean>(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [otpVerification, setOtpVerificationState] = useState<OtpVerificationState>({
    isVerified: false,
    email: null,
  });

  // Email availability check using separate hook
  const emailCheckQuery = useCheckEmail(email);
  
  // Transform email check query to expected format
  const emailCheck = {
    available: emailCheckQuery.available,
    message: emailCheckQuery.message,
    existingRole: emailCheckQuery.existingRole,
    isChecking: emailCheckQuery.isChecking,
  };

  // Get normalized email for invalidation
  const emailValidation = validateEmail(email);
  const normalizedEmail = emailValidation.valid && emailValidation.normalized 
    ? emailValidation.normalized 
    : null;

  // Registration mutation using TanStack Query
  const registrationMutation = useMutation({
    mutationFn: async (payload: RegisterRequest) => {
      return authService.register(payload);
    },
    onSuccess: (response, variables) => {
      // Registration successful
      setRegistrationSuccess(true);
      setRegisteredEmail(response.email || variables.email);
      
      // Clear password for security
      setPassword('');
      
      // Clear OTP verification state after successful registration
      setOtpVerificationState({ isVerified: false, email: null });
      
      // Invalidate email check query since email is now registered
      if (normalizedEmail) {
        queryClient.invalidateQueries({ queryKey: ['auth', 'checkEmail', normalizedEmail] });
      }
    },
    onError: () => {
      // Clear password on error for security
      setPassword('');
    },
  });

  /**
   * Handle registration form submission
   * Validates inputs using Zod schema and calls register API via mutation
   */
  const handleRegister = useCallback(async () => {
    // Clear previous errors
    setValidationError(null);
    registrationMutation.reset();

    // Validate form data using Zod schema
    const validationResult = registerSchema.safeParse({
      email,
      password,
      fullName,
      phoneNumber,
      referralCode,
    });

    if (!validationResult.success) {
      // Get first error message from Zod validation
      const firstError = validationResult.error.issues[0];
      setValidationError(firstError.message);
      return;
    }

    // Check if email is available (if we checked it)
    // This is a business rule check, not a format validation
    if (emailCheck.available === false) {
      setValidationError(emailCheck.message || 'This email is already registered');
      return;
    }

    // Validation passed - use transformed data from Zod
    const validatedData: RegisterFormData = validationResult.data;

    // Build payload matching RegisterRequest type
    const payload: RegisterRequest = {
      email: validatedData.email, // Already trimmed and lowercased by Zod transform
      password: validatedData.password,
      fullName: validatedData.fullName, // Already trimmed by Zod transform
      phoneNumber: validatedData.phoneNumber, // Already trimmed or undefined by Zod transform
      referralCode: validatedData.referralCode, // Already trimmed or undefined by Zod transform
    };

    registrationMutation.mutate(payload);
  }, [email, password, fullName, phoneNumber, referralCode, emailCheck, registrationMutation]);

  // Resend verification mutation using TanStack Query
  const resendVerificationMutation = useMutation({
    mutationFn: (payload: { email: string }) => {
      return authService.resendVerification(payload);
    },
  });

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setValidationError(null);
    registrationMutation.reset();
    resendVerificationMutation.reset();
  }, [registrationMutation, resendVerificationMutation]);

  /**
   * Handle email change - email check hook automatically handles refetching
   */
  const handleEmailChange = useCallback((emailValue: string) => {
    setEmail(emailValue);
    setValidationError(null);
    registrationMutation.reset();
    resendVerificationMutation.reset();
    
    // Email check hook automatically refetches when email changes
    // Small delay to debounce (TanStack Query will cache, so rapid changes won't trigger multiple requests)
    if (emailValue.trim().length > 0) {
      // Use basic email validation to check format before checking availability
      const validation = validateEmail(emailValue);
      if (validation.valid && validation.normalized) {
        setTimeout(() => {
          emailCheckQuery.refetch();
        }, 500);
      }
    }
  }, [emailCheckQuery, registrationMutation, resendVerificationMutation]);

  /**
   * Handle resend verification email
   */
  const handleResendVerification = useCallback(async () => {
    if (!registeredEmail) {
      return;
    }

    resendVerificationMutation.mutate({ email: registeredEmail });
  }, [registeredEmail, resendVerificationMutation]);

  /**
   * Get error from mutations or validation
   */
  const error = validationError || registrationMutation.error?.message || resendVerificationMutation.error?.message || null;

  /**
   * Get loading state from mutations
   */
  const isLoading = registrationMutation.isPending || resendVerificationMutation.isPending;

  /**
   * Set OTP verification state
   * Called after successful OTP verification to track that email is verified
   * @param verifiedEmail - Email address that was verified via OTP
   */
  const setOtpVerification = useCallback((verifiedEmail: string) => {
    const emailValidation = validateEmail(verifiedEmail);
    const normalized = emailValidation.valid && emailValidation.normalized 
      ? emailValidation.normalized 
      : verifiedEmail.trim().toLowerCase();
    
    setOtpVerificationState({
      isVerified: true,
      email: normalized,
    });
  }, []);

  /**
   * Clear OTP verification state
   */
  const clearOtpVerification = useCallback(() => {
    setOtpVerificationState({ isVerified: false, email: null });
  }, []);

  /**
   * Clear success state (e.g., when navigating away)
   */
  const clearSuccess = useCallback(() => {
    setRegistrationSuccess(false);
    setRegisteredEmail(null);
  }, []);

  return {
    email,
    password,
    fullName,
    phoneNumber,
    referralCode,
    setEmail: handleEmailChange,
    setPassword,
    setFullName,
    setPhoneNumber,
    setReferralCode,
    isLoading,
    error,
    emailCheck,
    otpVerification,
    registrationSuccess,
    registeredEmail,
    handleRegister,
    handleResendVerification,
    setOtpVerification,
    clearOtpVerification,
    clearError,
    clearSuccess,
  };
}
