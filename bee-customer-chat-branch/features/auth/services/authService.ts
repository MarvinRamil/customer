import { apiClient } from '@/shared/services/apiClient';
import { setBiometricEnabled } from '@/shared/services/biometricService';
import { tokenStorage } from '@/shared/services/tokenStorage';
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  CheckEmailResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RegistrationStatusResponse,
  ResendOtpRequest,
  ResendOtpResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ResetPasswordMobileRequest,
  SecurityQuestionsResponse,
  SendOtpRequest,
  SendOtpResponse,
  SendSmsOtpRequest,
  SendSmsOtpResponse,
  RegisterByPhoneRequest,
  RegisterByPhoneResponse,
  VerifySmsOtpRequest,
  VerifySmsOtpResponse,
  User,
  VerifyEmailRequest,
  VerifyEmailResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '../types';

/**
 * Authentication service for handling login, logout, and user session management
 * Provides methods for authenticating users and managing their sessions
 */
class AuthService {
  /**
   * Login user with email and password
   * Calls POST /api/auth/login endpoint
   * @param credentials - User login credentials (email and password)
   * @returns Promise resolving to LoginResponse with token and user data
   * @throws Error if login fails (invalid credentials, account deactivated, etc.)
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // CRITICAL: Clear any existing tokens before login to ensure fresh start
      // This prevents issues where stale tokens might interfere with new login
      // Especially important after password reset when old tokens are invalidated
      try {
        await tokenStorage.clearAllTokens();
        if (__DEV__) {
          console.log('[AuthService] ✓ Cleared existing tokens before login');
        }
      } catch (clearError) {
        // Log but don't fail - token clearing is best effort
        console.warn('[AuthService] Failed to clear tokens before login:', clearError);
      }

      // Call login API endpoint
      const response = await apiClient.post<LoginResponse>('/api/auth/login', {
        body: credentials,
        requiresAuth: false, // Login endpoint doesn't require authentication
      });
      // Check if request was successful
      if (!response.success || !response.data) {
        // Handle error response
        const errorMessage = response.message || 'Login failed';
        
        // Check for specific error cases based on status code
        if (response.statusCode === 401) {
          // Check error message for specific cases
          const errorText = typeof response.error === 'string' ? response.error : errorMessage;
          
          if (errorText === 'Invalid credentials' || errorMessage === 'Invalid credentials') {
            throw new Error('Invalid credentials');
          }
          if (errorText === 'Account is deactivated' || errorMessage.includes('deactivated')) {
            throw new Error('Account is deactivated');
          }
          
          // Generic 401 error
          throw new Error('Invalid credentials');
        }
        
        // Handle 400 Bad Request (validation errors)
        if (response.statusCode === 400) {
          throw new Error(errorMessage || 'Validation error. Please check your input.');
        }
        
        throw new Error(errorMessage);
      }

      const loginData = response.data;

      // Handle both camelCase and PascalCase token properties (backend may return Token or token)
      const token = (loginData as any).token ?? (loginData as any).Token ?? (loginData as any).accessToken;
      
      // Validate that we have a token before storing
      if (!token) {
        console.error('[AuthService] Login response structure:', {
          hasToken: !!(loginData as any).token,
          hasTokenCapital: !!(loginData as any).Token,
          hasAccessToken: !!(loginData as any).accessToken,
          loginDataKeys: Object.keys(loginData || {}),
        });
        throw new Error('Login response missing token');
      }

      // Store token securely
      await tokenStorage.setAccessToken(token);
      
      // Verify token was stored (for debugging)
      const storedToken = await tokenStorage.getAccessToken();
      if (storedToken) {
        // Always log in dev mode, and log in production if there are issues
        if (__DEV__ || process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
          console.log('[AuthService] ✓ Token stored successfully');
          console.log('[AuthService] Token preview:', storedToken.substring(0, 30) + '...');
          console.log('[AuthService] Token length:', storedToken.length);
        }
        
        // Verify tokens match (sanity check)
        if (storedToken !== token) {
          console.error('[AuthService] ⚠️ Token mismatch! Stored token differs from received token');
        }
      } else {
        console.error('[AuthService] ⚠️ Token storage failed - token not found after storing');
        console.error('[AuthService] Original token preview:', token.substring(0, 30) + '...');
      }

      // Store refresh token if provided (for 401 refresh/retry)
      const refreshToken = (loginData as any).refreshToken ?? (loginData as any).RefreshToken;
      if (refreshToken) {
        await tokenStorage.setRefreshToken(refreshToken);
        if (process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
          console.log('[AuthService] ✓ Refresh token stored');
        }
      }

      // CRITICAL: Verify token can be retrieved after storage (ensures SecureStore persistence)
      // Add a small delay to ensure SecureStore has fully persisted the token
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // Verify token is accessible and valid format
      const verifyToken = await tokenStorage.getAccessToken();
      if (!verifyToken || verifyToken !== token) {
        console.error('[AuthService] ⚠️ Token verification failed after storage:', {
          stored: !!verifyToken,
          matches: verifyToken === token,
          originalLength: token.length,
          retrievedLength: verifyToken?.length,
        });
        // Don't throw here - let it fail naturally if token is invalid
        // The API call will fail with 401 if token is invalid, which is handled properly
      } else if (__DEV__) {
        console.log('[AuthService] ✓ Token verified after storage');
      }

      return loginData;
    } catch (error) {
      // Clear any tokens that might have been stored (defensive cleanup)
      // This ensures no partial state remains on login failure
      try {
        await tokenStorage.clearAllTokens();
      } catch (clearError) {
        // Ignore errors when clearing tokens - we're already handling a login error
        console.warn('[AuthService] Failed to clear tokens after login error:', clearError);
      }

      // Log the actual error for debugging
      console.error('[AuthService] Login error details:', {
        error,
        errorType: typeof error,
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : [],
        errorMessage: error instanceof Error ? error.message : String(error),
        hasStatus: error && typeof error === 'object' && 'status' in error,
        status: error && typeof error === 'object' && 'status' in error ? (error as { status?: number }).status : undefined,
      });

      // Handle ApiError with specific status codes
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string; details?: unknown };
        
        // Handle 401 Unauthorized
        if (apiError.status === 401) {
          const errorText = apiError.message || 'Login failed';
          
          // Check for specific error messages
          if (errorText === 'Invalid credentials' || errorText.includes('Invalid credentials')) {
            throw new Error('Invalid credentials');
          }
          if (errorText === 'Account is deactivated' || errorText.includes('deactivated')) {
            throw new Error('Account is deactivated');
          }
          
          throw new Error('Invalid credentials');
        }
        
        // Handle 400 Bad Request (validation errors)
        if (apiError.status === 400) {
          throw new Error(apiError.message || 'Validation error. Please check your input.');
        }

        // Handle other HTTP errors
        throw new Error(apiError.message || `Login failed (HTTP ${apiError.status})`);
      }

      // Handle network errors (no status code means network/fetch error)
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Network error or fetch failure
        if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
          throw new Error('Request timeout. Please check your connection and try again.');
        }
        if (
          errorMessage.includes('failed to fetch') ||
          errorMessage.includes('networkerror') ||
          errorMessage.includes('network request failed') ||
          errorMessage.includes('networkerror')
        ) {
          throw new Error('Network error. Please check your connection and ensure the API server is running.');
        }
        
        // Re-throw the original error message if it's informative
        throw error;
      }

      // Fallback for unknown error types
      console.error('[AuthService] Unknown error type:', error);
      throw new Error('Login failed. Please try again.');
    }
  }

  /**
   * Get current authenticated user information
   * Calls GET /api/auth/me endpoint
   * @returns Promise resolving to User object
   * @throws Error if user is not authenticated or token is invalid
   */
  async getCurrentUser(): Promise<User> {
    try {
      // Call /auth/me endpoint (requires authentication)
      const response = await apiClient.get<User>('/api/auth/me', {
        requiresAuth: true, // This endpoint requires authentication
      });

      // Check if request was successful
      if (!response.success || !response.data) {
        const errorMessage = response.message || 'Failed to get user information';
        
        // Handle 401 Unauthorized (token expired or invalid)
        if (response.statusCode === 401) {
          // Clear stored token
          await tokenStorage.clearAllTokens();
          throw new Error('Session expired. Please login again.');
        }
        
        throw new Error(errorMessage);
      }

      return response.data;
    } catch (error) {
      // Handle ApiError with 401 status
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 401
      ) {
        // Clear stored token on 401
        await tokenStorage.clearAllTokens();
        throw new Error('Session expired. Please login again.');
      }

      // Re-throw with user-friendly message
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get user information');
    }
  }

  /**
   * Restore session using the stored refresh token (e.g. after biometric auth).
   * @returns User if refresh succeeded and /api/auth/me returned user; null otherwise
   */
  async restoreSessionFromRefreshToken(): Promise<User | null> {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) return null;
    const refreshed = await apiClient.refreshSession();
    if (!refreshed) return null;
    try {
      return await this.getCurrentUser();
    } catch {
      return null;
    }
  }

  /**
   * Logout user and clear session completely.
   * Clears all tokens and the biometric login flag so the user must sign in again.
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    try {
      await tokenStorage.clearAllTokens();
      await setBiometricEnabled(false);
      // Defensive: ensure tokens are really gone (e.g. if clearAllTokens failed partway)
      const [access, refresh] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getRefreshToken(),
      ]);
      if (access != null) await tokenStorage.removeAccessToken();
      if (refresh != null) await tokenStorage.removeRefreshToken();
    } catch (error) {
      throw new Error(
        `Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if user is currently authenticated
   * Checks for presence of access token
   * @returns Promise resolving to true if authenticated, false otherwise
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await tokenStorage.getAccessToken();
      return token !== null && token.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if email is available for registration
   * Calls POST /api/auth/check-email (no auth)
   * @param email - Email to check (will be normalized: trim, lowercase)
   * @returns Promise resolving to CheckEmailResponse (available, message, existingRole?)
   * @throws Error on 400 (e.g. email required) or 429 (rate limit)
   */
  async checkEmail(email: string): Promise<CheckEmailResponse> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email is required');
    }
    try {
      const response = await apiClient.post<CheckEmailResponse>('/api/auth/check-email', {
        body: { email: normalized },
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Check email failed');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeRegistrationError(error);
    }
  }

  /**
   * Send OTP to email for verification
   * Calls POST /api/auth/send-otp (no auth)
   * This is the first step in the OTP-based registration flow (recommended)
   * @param email - Email address to send OTP to (will be normalized: trim, lowercase)
   * @returns Promise resolving to SendOtpResponse (success, message)
   * @throws Error on 400 (email locked, invalid email) or 429 (rate limit)
   */
  async sendOtp(email: string): Promise<SendOtpResponse> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email is required');
    }
    try {
      const response = await apiClient.post<SendOtpResponse>('/api/auth/send-otp', {
        body: { email: normalized } as SendOtpRequest,
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to send OTP');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeOtpError(error);
    }
  }

  /**
   * Verify OTP code sent to email
   * Calls POST /api/auth/verify-otp (no auth)
   * This is the second step in the OTP-based registration flow
   * After successful verification, the email is marked as verified for registration
   * @param email - Email address that received the OTP (will be normalized: trim, lowercase)
   * @param otp - OTP code (6 digits)
   * @returns Promise resolving to VerifyOtpResponse (success, message)
   * @throws Error on 400 (invalid/expired OTP, email locked) or 429 (rate limit)
   */
  async verifyOtp(email: string, otp: string): Promise<VerifyOtpResponse> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email is required');
    }
    if (!otp || otp.trim().length === 0) {
      throw new Error('OTP code is required');
    }
    try {
      const response = await apiClient.post<VerifyOtpResponse>('/api/auth/verify-otp', {
        body: { email: normalized, otp: otp.trim() } as VerifyOtpRequest,
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to verify OTP');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeOtpError(error);
    }
  }

  /**
   * Resend OTP to email
   * Calls POST /api/auth/resend-otp (no auth)
   * Invalidates the previous OTP and sends a new one
   * @param email - Email address to resend OTP to (will be normalized: trim, lowercase)
   * @returns Promise resolving to ResendOtpResponse (success, message)
   * @throws Error on 400 (email locked, invalid email) or 429 (rate limit)
   */
  async resendOtp(email: string): Promise<ResendOtpResponse> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email is required');
    }
    try {
      const response = await apiClient.post<ResendOtpResponse>('/api/auth/resend-otp', {
        body: { email: normalized } as ResendOtpRequest,
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to resend OTP');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeOtpError(error);
    }
  }

  /**
   * Get registration status for an email
   * Calls GET /api/auth/registration-status (no auth)
   * Useful for checking if email is verified and registration is complete
   * @param email - Email address to check (will be normalized: trim, lowercase)
   * @returns Promise resolving to RegistrationStatusResponse (emailVerified, registrationComplete, canResume)
   * @throws Error on 400 (invalid email) or request failure
   */
  async getRegistrationStatus(email: string): Promise<RegistrationStatusResponse> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email is required');
    }
    try {
      const response = await apiClient.get<RegistrationStatusResponse>(
        `/api/auth/registration-status?email=${encodeURIComponent(normalized)}`,
        {
          requiresAuth: false,
        }
      );
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to get registration status');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeRegistrationError(error);
    }
  }

  /**
   * Register a new Client account
   * Calls POST /api/auth/register (no auth)
   * Note: This app only supports Client registration. Role is always "Client" (API default).
   * 
   * If email was verified via OTP (using verifyOtp), the account is created with EmailConfirmed = true.
   * Otherwise, an email verification link is sent and requiresEmailVerification will be true.
   * 
   * @param payload - RegisterRequest (email, password, fullName, optional phoneNumber, referralCode, etc.)
   * @returns Promise resolving to RegisterResponse (message, requiresEmailVerification, email)
   * @throws Error on 400 (validation, email already registered), 500, or 429
   */
  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    // Normalize email and ensure role is Client (API defaults to Client if omitted)
    // Note: API accepts role in request body, but RegisterRequest type omits it to enforce Client-only
    const body: RegisterRequest & { role: 'Client' } = {
      ...payload,
      email: payload.email.trim().toLowerCase(),
      role: 'Client',
    };
    try {
      const response = await apiClient.post<RegisterResponse>('/api/auth/register', {
        body,
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Registration failed');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeRegistrationError(error);
    }
  }

  /**
   * Verify email using token from verification link
   * Calls POST /api/auth/verify-email (no auth)
   * @param payload - VerifyEmailRequest (email, token from link)
   * @returns Promise resolving to VerifyEmailResponse (message)
   * @throws Error on 400 (invalid/expired token) or 429
   */
  async verifyEmail(payload: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    try {
      const response = await apiClient.post<VerifyEmailResponse>('/api/auth/verify-email', {
        body: payload,
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Verification failed');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeRegistrationError(error);
    }
  }

  /**
   * Resend verification email
   * Calls POST /api/auth/resend-verification (no auth)
   * @param payload - ResendVerificationRequest (email)
   * @returns Promise resolving to ResendVerificationResponse (message)
   * @throws Error on 400 or 429
   */
  async resendVerification(payload: ResendVerificationRequest): Promise<ResendVerificationResponse> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Email is required');
    }
    try {
      const response = await apiClient.post<ResendVerificationResponse>('/api/auth/resend-verification', {
        body: { email },
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Resend verification failed');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeRegistrationError(error);
    }
  }

  /**
   * Get list of security questions for signup / forgot password
   * Calls GET /api/auth/security-questions (no auth)
   * @returns Promise resolving to SecurityQuestionsResponse (questions with id 1–20)
   * @throws Error on request failure or 429
   */
  async getSecurityQuestions(): Promise<SecurityQuestionsResponse> {
    try {
      const response = await apiClient.get<SecurityQuestionsResponse>('/api/auth/security-questions', {
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to load security questions');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeRegistrationError(error);
    }
  }

  /**
   * Send SMS OTP to a Philippine mobile number for phone registration.
   * Calls POST /api/auth/send-sms-otp (no auth)
   */
  async sendSmsOtp(phoneNumber: string): Promise<SendSmsOtpResponse> {
    if (!phoneNumber.trim()) {
      throw new Error('Phone number is required');
    }
    try {
      const response = await apiClient.post<SendSmsOtpResponse>('/api/auth/send-sms-otp', {
        body: { phoneNumber: phoneNumber.trim() } as SendSmsOtpRequest,
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to send SMS code');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeOtpError(error);
    }
  }

  /**
   * Verify SMS OTP and receive a registration token for the final register-by-phone call.
   * Calls POST /api/auth/verify-sms-otp (no auth)
   */
  async verifySmsOtp(phoneNumber: string, otp: string): Promise<VerifySmsOtpResponse> {
    if (!phoneNumber.trim()) {
      throw new Error('Phone number is required');
    }
    if (!otp.trim()) {
      throw new Error('Verification code is required');
    }
    try {
      const response = await apiClient.post<VerifySmsOtpResponse>('/api/auth/verify-sms-otp', {
        body: { phoneNumber: phoneNumber.trim(), otp: otp.trim() } as VerifySmsOtpRequest,
        requiresAuth: false,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to verify SMS code');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeOtpError(error);
    }
  }

  /**
   * Complete phone registration after SMS OTP verification.
   * Calls POST /api/auth/register-by-phone (no auth)
   */
  async registerByPhone(payload: RegisterByPhoneRequest): Promise<RegisterByPhoneResponse> {
    try {
      const response = await apiClient.post<RegisterByPhoneResponse>('/api/auth/register-by-phone', {
        body: payload,
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Registration failed');
      }
      return response.data;
    } catch (error) {
      throw this.normalizeRegistrationError(error);
    }
  }

  /**
   * Map OTP API errors to user-facing Error messages
   * Handles OTP-specific errors: email locked, invalid/expired OTP, rate limits
   */
  private normalizeOtpError(error: unknown): Error {
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status?: number; message?: string };
      
      // Handle rate limiting
      if (apiError.status === 429) {
        return new Error('Too many attempts, try again later.');
      }
      
      // Handle email locked (too many failed attempts)
      if (apiError.status === 400) {
        const message = apiError.message || '';
        if (message.toLowerCase().includes('locked') || message.toLowerCase().includes('too many')) {
          return new Error('Too many failed attempts. Please try again later.');
        }
        if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('expired')) {
          return new Error('Invalid or expired OTP. Please request a new code.');
        }
        // Return the API message for other 400 errors (e.g., invalid email format)
        return new Error(message || 'Invalid request. Please check your input.');
      }
      
      // Handle other errors
      return new Error(apiError.message || 'Something went wrong. Please try again.');
    }
    
    if (error instanceof Error) {
      // Check for specific error messages
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('locked') || errorMessage.includes('too many')) {
        return new Error('Too many failed attempts. Please try again later.');
      }
      if (errorMessage.includes('invalid') || errorMessage.includes('expired')) {
        return new Error('Invalid or expired OTP. Please request a new code.');
      }
      return error;
    }
    
    return new Error('Something went wrong. Please try again.');
  }

  /**
   * Map registration API errors to user-facing Error messages
   * Handles 429 (rate limit), 400/500 (validation, server error)
   */
  private normalizeRegistrationError(error: unknown): Error {
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status?: number; message?: string };
      if (apiError.status === 429) {
        return new Error('Too many attempts, try again later.');
      }
      return new Error(apiError.message || 'Something went wrong. Please try again.');
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error('Something went wrong. Please try again.');
  }

  /**
   * Verify current session by checking token and fetching user
   * Useful for app initialization to check if user is still logged in
   * @returns Promise resolving to User if session is valid, null otherwise
   */
  async verifySession(): Promise<User | null> {
    try {
      // Check if token exists
      const hasToken = await this.isAuthenticated();
      if (!hasToken) {
        if (__DEV__) {
          console.log('[AuthService] verifySession: No token found');
        }
        return null;
      }

      // Get token for debugging
      const token = await tokenStorage.getAccessToken();
      if (__DEV__) {
        console.log('[AuthService] verifySession: Token found, verifying with API...');
        console.log('[AuthService] verifySession: Token preview:', token?.substring(0, 30) + '...');
      }

      // Try to fetch current user
      const user = await this.getCurrentUser();
      
      if (__DEV__) {
        console.log('[AuthService] verifySession: ✓ Session verified successfully');
      }
      
      return user;
    } catch (error) {
      // Session is invalid, clear tokens
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[AuthService] verifySession: Session verification failed:', errorMessage);
      
      // Log token info before clearing for debugging
      try {
        const tokenBeforeClear = await tokenStorage.getAccessToken();
        if (__DEV__) {
          console.log('[AuthService] verifySession: Token before clearing:', tokenBeforeClear?.substring(0, 30) + '...');
        }
      } catch {
        // Ignore errors when checking token
      }
      
      await tokenStorage.clearAllTokens();
      return null;
    }
  }

  /**
   * Request password reset (forgot password)
   * Calls POST /api/auth/forgot-password (no auth)
   * @param payload - ForgotPasswordRequest (email, optional securityAnswers)
   * @returns Promise resolving to ForgotPasswordResponse
   * @throws Error on request failure
   */
  async forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Email is required');
    }
    try {
      const response = await apiClient.post<ForgotPasswordResponse>('/api/auth/forgot-password', {
        body: {
          email,
          securityAnswers: payload.securityAnswers,
        },
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to request password reset');
      }
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string };
        if (apiError.status === 429) {
          throw new Error('Too many attempts, try again later.');
        }
        throw new Error(apiError.message || 'Failed to request password reset');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to request password reset');
    }
  }

  /**
   * Reset password with token from email
   * Calls POST /api/auth/reset-password (no auth)
   * @param payload - ResetPasswordRequest (email, token, newPassword)
   * @returns Promise resolving to ResetPasswordResponse
   * @throws Error on request failure
   */
  async resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Email is required');
    }
    // Must provide either token OR otp
    if (!payload.token && !payload.otp) {
      throw new Error('Either reset token or OTP code is required');
    }
    if (!payload.newPassword || payload.newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }
    try {
      // Build request body matching .NET record structure
      // Backend has PropertyNameCaseInsensitive = true, so camelCase works
      // Backend record: ResetPasswordRequest(string Email, string? Token, string? Otp, string NewPassword, List<SecurityAnswerRequest>? SecurityAnswers)
      const requestBody: any = {
        email, // Maps to Email property
        newPassword: payload.newPassword, // Maps to NewPassword property
      };
      
      // Only include token or otp if provided (not both)
      if (payload.token) {
        requestBody.token = payload.token; // Maps to Token property
      }
      if (payload.otp) {
        requestBody.otp = payload.otp; // Maps to Otp property
      }
      
      // Only include securityAnswers if provided
      if (payload.securityAnswers && payload.securityAnswers.length > 0) {
        requestBody.securityAnswers = payload.securityAnswers.map(a => ({
          questionNumber: a.questionNumber, // Maps to QuestionNumber property
          answer: a.answer, // Maps to Answer property
        }));
      }
      
      const response = await apiClient.post<ResetPasswordResponse>('/api/auth/reset-password', {
        body: requestBody,
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to reset password');
      }
      
      // CRITICAL: Clear all tokens after successful password reset
      // The backend invalidates all existing tokens for this user, so we must clear
      // any stored tokens on the device to prevent using stale/invalid tokens
      try {
        await tokenStorage.clearAllTokens();
        if (__DEV__) {
          console.log('[ResetPassword] ✓ Tokens cleared after password reset');
        }
      } catch (clearError) {
        // Log but don't fail - token clearing is best effort
        console.warn('[ResetPassword] Failed to clear tokens after password reset:', clearError);
      }
      
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string };
        throw new Error(apiError.message || 'Failed to reset password');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to reset password');
    }
  }

  /**
   * Change password (requires authentication)
   * Calls POST /api/auth/change-password (auth required)
   * @param payload - ChangePasswordRequest (currentPassword, newPassword, optional otp)
   * @returns Promise resolving to ChangePasswordResponse
   * @throws Error on request failure
   */
  async changePassword(payload: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    if (!payload.newPassword || payload.newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }
    if (!payload.currentPassword && !payload.otp) {
      throw new Error('Either current password or OTP is required');
    }
    try {
      const response = await apiClient.post<ChangePasswordResponse>('/api/auth/change-password', {
        body: {
          currentPassword: payload.currentPassword,
          newPassword: payload.newPassword,
          otp: payload.otp || null,
        },
        requiresAuth: true,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to change password');
      }
      
      // After successful password change, clear tokens (user needs to login again)
      // The backend invalidates tokens, but we should also clear locally
      await tokenStorage.clearAllTokens();
      
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string };
        if (apiError.status === 401) {
          // Clear tokens on 401
          await tokenStorage.clearAllTokens();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(apiError.message || 'Failed to change password');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to change password');
    }
  }

  /**
   * Request password reset OTP for mobile apps
   * Calls POST /api/auth/forgot-password/mobile (no auth)
   * @param payload - ForgotPasswordRequest (email)
   * @returns Promise resolving to ForgotPasswordResponse
   * @throws Error on request failure
   */
  async forgotPasswordMobile(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Email is required');
    }
    try {
      const response = await apiClient.post<ForgotPasswordResponse>('/api/auth/forgot-password/mobile', {
        body: {
          email,
        },
        requiresAuth: false,
      });
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to request password reset code');
      }
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string };
        if (apiError.status === 429) {
          throw new Error('Too many attempts, try again later.');
        }
        throw new Error(apiError.message || 'Failed to request password reset code');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to request password reset code');
    }
  }

  /**
   * Reset password with OTP and security questions (mobile flow)
   * Calls POST /api/auth/reset-password/mobile (no auth)
   * @param payload - ResetPasswordMobileRequest (email, otp, newPassword, optional securityAnswers)
   * @returns Promise resolving to ResetPasswordResponse
   * @throws Error on request failure
   */
  async resetPasswordMobile(payload: ResetPasswordMobileRequest): Promise<ResetPasswordResponse> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Email is required');
    }
    if (!payload.otp) {
      throw new Error('OTP code is required');
    }
    if (!payload.newPassword || payload.newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }
    try {
      // Ensure OTP is cleaned and exactly 6 digits - preserve leading zeros
      // Convert to string explicitly to prevent any number conversion
      const otpString = String(payload.otp || "");
      const otpCleaned = otpString.trim().replace(/\D/g, "");
      
      if (!otpCleaned || otpCleaned.length !== 6) {
        throw new Error('OTP must be exactly 6 digits');
      }
      
      // Ensure it's exactly 6 digits (pad with zeros if somehow shorter, though it shouldn't be)
      const otpFinal = otpCleaned.padStart(6, "0").slice(0, 6);
      
      const requestBody = {
        email: String(email), // Ensure string
        otp: String(otpFinal), // Ensure string, exactly 6 digits
        newPassword: String(payload.newPassword),
        securityAnswers: payload.securityAnswers || null,
      };
      
      // Debug logging
      if (__DEV__) {
        console.log('[ResetPasswordMobile] Request payload:', {
          email,
          otp: otpCleaned,
          otpLength: otpCleaned.length,
          otpType: typeof otpCleaned,
          passwordLength: payload.newPassword?.length,
          hasSecurityAnswers: !!payload.securityAnswers,
        });
      }
      
      const response = await apiClient.post<ResetPasswordResponse>('/api/auth/reset-password/mobile', {
        body: requestBody,
        requiresAuth: false,
      });
      
      if (!response.success || response.data === undefined) {
        throw new Error(response.message || 'Failed to reset password');
      }
      
      // CRITICAL: Clear all tokens after successful password reset
      // The backend invalidates all existing tokens for this user, so we must clear
      // any stored tokens on the device to prevent using stale/invalid tokens
      try {
        await tokenStorage.clearAllTokens();
        if (__DEV__) {
          console.log('[ResetPasswordMobile] ✓ Tokens cleared after password reset');
        }
      } catch (clearError) {
        // Log but don't fail - token clearing is best effort
        console.warn('[ResetPasswordMobile] Failed to clear tokens after password reset:', clearError);
      }
      
      return response.data;
    } catch (error) {
      // Handle ApiError from apiClient
      if (error instanceof Error) {
        // ApiError extends Error, so it has a message property
        // The message should already contain the backend error message
        const errorMessage = error.message || 'Failed to reset password';
        
        // Debug logging
        if (__DEV__) {
          console.error('[ResetPasswordMobile] Error:', {
            message: error.message,
            name: error.name,
            // @ts-ignore - ApiError has these properties
            status: (error as any).status,
            // @ts-ignore
            details: (error as any).details,
          });
        }
        
        throw new Error(errorMessage);
      }
      throw new Error('Failed to reset password');
    }
  }
}

/**
 * Singleton instance of auth service
 * Use this instance throughout the application for authentication operations
 */
export const authService = new AuthService();

