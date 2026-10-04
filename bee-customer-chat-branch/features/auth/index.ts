/**
 * Auth feature public API
 * This file exports all public components, hooks, services, and types from the auth feature
 * Other features should import from this file, not from internal paths
 */

// Export context
export { AuthProvider, useAuthContext } from './context/AuthContext';

// Export hooks
export { useAuth } from './hooks/useAuth';
export { useCheckEmail } from './hooks/useCheckEmail';
export type { UseCheckEmailReturn } from './hooks/useCheckEmail';
export { useLogin } from './hooks/useLogin';
export { useRegister } from './hooks/useRegister';
export type { OtpVerificationState } from './hooks/useRegister';
// Clerk-native registration (email OTP handled by Clerk).
export { useClerkRegistration } from './hooks/useClerkRegistration';
export type {
  ClerkRegistrationStep,
  UseClerkRegistrationReturn
} from './hooks/useClerkRegistration';
export { usePhoneRegistration } from './hooks/usePhoneRegistration';
export type {
  PhoneRegistrationStep,
  UsePhoneRegistrationReturn,
  SecurityQuestionField,
} from './hooks/usePhoneRegistration';
export { useRegistrationStatus } from './hooks/useRegistrationStatus';
export type {
  RegistrationStatusHint,
  UseRegistrationStatusReturn,
} from './hooks/useRegistrationStatus';
export { useVerifyEmail } from './hooks/useVerifyEmail';
export type { UseVerifyEmailReturn } from './hooks/useVerifyEmail';
// Clerk-native password reset (email-code). Replaces legacy useForgotPassword/useResetPassword.
export { useClerkPasswordReset } from './hooks/useClerkPasswordReset';
export type {
  ClerkPasswordResetStep,
  UseClerkPasswordResetReturn
} from './hooks/useClerkPasswordReset';
export { useChangePassword } from './hooks/useChangePassword';
export type { UseChangePasswordReturn } from './hooks/useChangePassword';

// Export components
export { OtpInput } from './components/OtpInput';
export type { OtpInputProps } from './components/OtpInput';

// Export services
export { authService } from './services/authService';
export { registrationService } from './services/registrationService';
export { tokenService } from './services/tokenService';

// Export validation schemas
export { loginSchema, registerSchema, emailOnlySchema, registrationDetailsSchema } from './schemas/validationSchemas';
export type {
  LoginFormData,
  RegisterFormData,
  EmailOnlyFormData,
  RegistrationDetailsFormData,
} from './schemas/validationSchemas';

// Export types
export type {
  AuthResponse,
  AuthState,
  BusinessType,
  CheckEmailRequest,
  CheckEmailResponse,
  LoginCredentials,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  RegistrationStatusRequest,
  RegistrationStatusResponse,
  ResendOtpRequest,
  ResendOtpResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  SecurityQuestion,
  SecurityQuestionAnswer,
  SecurityQuestionsResponse,
  SendOtpRequest,
  SendOtpResponse,
  User,
  UserRole,
  VerifyEmailRequest,
  VerifyEmailResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SecurityAnswerRequest,
  SendSmsOtpRequest,
  SendSmsOtpResponse,
  VerifySmsOtpRequest,
  VerifySmsOtpResponse,
  RegisterByPhoneRequest,
  RegisterByPhoneResponse,
} from './types';

