/**
 * Authentication feature-specific types
 * These types match the API response structure
 */

/**
 * User role enumeration
 */
export type UserRole = "Admin" | "Owner" | "Driver" | "Client" | string;

/**
 * Business type enumeration
 */
export type BusinessType = "Fleet" | "Individual";

/**
 * Login request payload
 * Matches API POST /api/auth/login request body
 */
export interface LoginRequest {
  /** User email address */
  email: string;
  /** User password */
  password: string;
}

/**
 * Login response from API
 * Matches API POST /api/auth/login response
 */
export interface LoginResponse {
  /** JWT Bearer token for authenticated requests */
  token: string;
  /** Token expiration date/time (ISO 8601) */
  expiration: string;
  /** Current user information */
  user: User;
}

/**
 * User information
 * Matches API user object structure
 */
export interface User {
  /** User's unique identifier (Guid) */
  id: string;
  /** User's email address */
  email: string;
  /** User's full name */
  fullName: string;
  /** User's role (Admin, Owner, Driver, Client, etc.) */
  role: UserRole;
  /** Company/Tenant ID (Guid | null, null for customers) */
  tenantId: string | null;
  /** Whether user has completed onboarding */
  isOnboarded: boolean;
  /** Business type: "Fleet" or "Individual" (null if not set) */
  businessType: BusinessType | null;
  /** Whether driver is a solo/independent driver */
  isSoloDriver: boolean;
  /** Liveness verification timestamp (ISO 8601) */
  livenessVerifiedAt?: string | null;
}

/**
 * Authentication state
 * Used for managing auth state in context
 */
export interface AuthState {
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Current user information */
  user: User | null;
  /** Whether authentication is being checked */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Legacy type aliases for backward compatibility
 * @deprecated Use LoginRequest instead
 */
export type LoginCredentials = LoginRequest;

/**
 * Legacy AuthResponse type
 * @deprecated Use LoginResponse instead
 */
export interface AuthResponse {
  /** Access token (legacy name, maps to token) */
  accessToken: string;
  /** Refresh token (not provided by current API) */
  refreshToken?: string;
  /** Token expiration time in seconds (legacy) */
  expiresIn?: number;
  /** User information */
  user?: User;
}

/**
 * Token refresh response
 * Note: Refresh token endpoint not currently available in API
 */
export interface RefreshTokenResponse {
  /** New access token */
  accessToken: string;
  /** Optional new refresh token */
  refreshToken?: string;
  /** Token expiration time in seconds */
  expiresIn?: number;
}

// ---------------------------------------------------------------------------
// Registration API types (see docs/registration-api.md)
// ---------------------------------------------------------------------------

/**
 * Check email request
 * Matches API POST /api/auth/check-email request body
 */
export interface CheckEmailRequest {
  /** Email to check for availability */
  email: string;
}

/**
 * Check email response
 * Matches API POST /api/auth/check-email response (200)
 */
export interface CheckEmailResponse {
  success: boolean;
  /** Whether the email is available for registration */
  available: boolean;
  message: string;
  /** Present when available is false and email is already registered */
  existingRole?: string;
}

/**
 * Security question item from API
 * Matches GET /api/auth/security-questions response item (id 1–20)
 */
export interface SecurityQuestion {
  id: number;
  question: string;
}

/**
 * Security questions list response
 * Matches API GET /api/auth/security-questions response (200)
 */
export interface SecurityQuestionsResponse {
  success: boolean;
  questions: SecurityQuestion[];
}

/**
 * Security question answer for registration
 * Used in RegisterRequest.securityQuestion1/2/3
 */
export interface SecurityQuestionAnswer {
  questionId: number;
  answer: string;
}

/**
 * Register request payload (Client only)
 * Matches API POST /api/auth/register request body
 * Note: This app only supports Client registration. Role is always "Client" (default) and not sent to API.
 */
export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  companyId?: string;
  referralCode?: string;
  phoneNumber?: string;
  securityQuestion1?: SecurityQuestionAnswer;
  securityQuestion2?: SecurityQuestionAnswer;
  securityQuestion3?: SecurityQuestionAnswer;
}

/**
 * Register response
 * Matches API POST /api/auth/register success response (200)
 */
export interface RegisterResponse {
  success: boolean;
  message: string;
  requiresEmailVerification?: boolean;
  email?: string;
}

/**
 * Verify email request
 * Matches API POST /api/auth/verify-email request body (token from email link)
 */
export interface VerifyEmailRequest {
  email: string;
  token: string;
}

/**
 * Verify email response
 * Matches API POST /api/auth/verify-email success response (200)
 */
export interface VerifyEmailResponse {
  success: boolean;
  message: string;
}

/**
 * Resend verification request
 * Matches API POST /api/auth/resend-verification request body
 */
export interface ResendVerificationRequest {
  email: string;
}

/**
 * Resend verification response
 * Matches API POST /api/auth/resend-verification success response (200)
 */
export interface ResendVerificationResponse {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// OTP-Based Registration API types (see docs/plans/otp-registration-implementation-plan.md)
// ---------------------------------------------------------------------------

/**
 * Send OTP request
 * Matches API POST /api/auth/send-otp request body
 */
export interface SendOtpRequest {
  /** Email address to send OTP to */
  email: string;
}

/**
 * Send OTP response
 * Matches API POST /api/auth/send-otp success response (200)
 */
export interface SendOtpResponse {
  success: boolean;
  message: string;
}

/**
 * Verify OTP request
 * Matches API POST /api/auth/verify-otp request body
 */
export interface VerifyOtpRequest {
  /** Email address that received the OTP */
  email: string;
  /** OTP code (6 digits) */
  otp: string;
}

/**
 * Verify OTP response
 * Matches API POST /api/auth/verify-otp success response (200)
 */
export interface VerifyOtpResponse {
  success: boolean;
  message: string;
}

/**
 * Resend OTP request
 * Matches API POST /api/auth/resend-otp request body
 */
export interface ResendOtpRequest {
  /** Email address to resend OTP to */
  email: string;
}

/**
 * Resend OTP response
 * Matches API POST /api/auth/resend-otp success response (200)
 */
export interface ResendOtpResponse {
  success: boolean;
  message: string;
}

/**
 * Registration status request
 * Matches API GET /api/auth/registration-status query parameters
 */
export interface RegistrationStatusRequest {
  /** Email address to check registration status for */
  email: string;
}

/**
 * Registration status response
 * Matches API GET /api/auth/registration-status success response (200)
 */
export interface RegistrationStatusResponse {
  success: boolean;
  /** Whether the email has been verified */
  emailVerified: boolean;
  /** Whether registration is complete */
  registrationComplete: boolean;
  /** Whether user can resume registration (for drivers) */
  canResume: boolean;
}

// ---------------------------------------------------------------------------
// Password Reset/Change API types
// ---------------------------------------------------------------------------

/**
 * Security answer request for forgot password
 * Matches API POST /api/auth/forgot-password SecurityAnswerRequest
 */
export interface SecurityAnswerRequest {
  questionNumber: number | null;
  answer: string | null;
}

/**
 * Forgot password request
 * Matches API POST /api/auth/forgot-password request body
 */
export interface ForgotPasswordRequest {
  email: string;
  securityAnswers?: SecurityAnswerRequest[] | null;
}

/**
 * Forgot password response
 * Matches API POST /api/auth/forgot-password success response (200)
 */
export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

/**
 * Reset password request (supports both token and OTP)
 * Matches API POST /api/auth/reset-password request body
 */
export interface ResetPasswordRequest {
  email: string;
  token?: string; // For web flow (email link)
  otp?: string; // For mobile flow (OTP code)
  newPassword: string;
  securityAnswers?: SecurityAnswerRequest[] | null; // For mobile flow with security questions
}

/**
 * Reset password response
 * Matches API POST /api/auth/reset-password success response (200)
 */
export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

/**
 * Change password request
 * Matches API POST /api/auth/change-password request body
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  otp?: string | null;
}

/**
 * Change password response
 * Matches API POST /api/auth/change-password success response (200)
 */
export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

/**
 * Reset password mobile request
 * Matches API POST /api/auth/reset-password/mobile request body
 */
export interface ResetPasswordMobileRequest {
  email: string;
  otp: string;
  newPassword: string;
  securityAnswers?: SecurityAnswerRequest[] | null;
}

// ---------------------------------------------------------------------------
// Phone (SMS) registration API types
// ---------------------------------------------------------------------------

/**
 * Send SMS OTP request
 * Matches API POST /api/auth/send-sms-otp request body
 */
export interface SendSmsOtpRequest {
  phoneNumber: string;
}

/**
 * Send SMS OTP response
 * Matches API POST /api/auth/send-sms-otp success response (200)
 */
export interface SendSmsOtpResponse {
  success: boolean;
  message: string;
}

/**
 * Verify SMS OTP request
 * Matches API POST /api/auth/verify-sms-otp request body
 */
export interface VerifySmsOtpRequest {
  phoneNumber: string;
  otp: string;
}

/**
 * Verify SMS OTP response
 * Matches API POST /api/auth/verify-sms-otp success response (200)
 */
export interface VerifySmsOtpResponse {
  success: boolean;
  message: string;
  registrationToken: string;
}

/**
 * Register by phone request (after SMS OTP verification)
 * Matches API POST /api/auth/register-by-phone request body
 */
export interface RegisterByPhoneRequest {
  registrationToken: string;
  fullName: string;
  password: string;
  securityQuestion1: SecurityQuestionAnswer;
  securityQuestion2: SecurityQuestionAnswer;
  securityQuestion3: SecurityQuestionAnswer;
}

/**
 * Register by phone response
 * Matches API POST /api/auth/register-by-phone success response (200)
 */
export interface RegisterByPhoneResponse {
  success: boolean;
  message: string;
}