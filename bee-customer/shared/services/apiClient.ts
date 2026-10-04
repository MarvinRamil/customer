import type { ApiClientConfig, ApiResponse, RequestConfig } from '@/shared/types/api';
import { ApiError } from '@/shared/types/api';
import Constants from 'expo-constants';
import { tokenStorage } from './tokenStorage';

/**
 * Get API base URL from environment or app config
 * Priority:
 * 1. app.config.js extra.apiUrl (resolved from environment-specific variables - highest priority)
 * 2. EXPO_PUBLIC_API_URL environment variable (for local development)
 * 3. Default fallback
 */
const getApiBaseUrl = (): string => {
  // First, try app.config.js extra.apiUrl (resolved from environment-specific variables)
  // This is the most reliable source as it's resolved at build time from .env or CI/CD variables
  const configApiUrl = Constants.expoConfig?.extra?.apiUrl;
  
  // Second, try direct environment variable (for local .env files)
  // Note: In Expo, EXPO_PUBLIC_* variables are loaded at build time, not runtime
  // So this might not work if .env wasn't loaded during build
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  
  // Always log in development to help debug
  if (__DEV__) {
    console.log('[API Client] Debug Info:');
    console.log('  - Constants.expoConfig?.extra?.apiUrl:', configApiUrl || 'undefined');
    console.log('  - process.env.EXPO_PUBLIC_API_URL:', envApiUrl || 'undefined');
    console.log('  - Constants.expoConfig?.extra:', JSON.stringify(Constants.expoConfig?.extra, null, 2));
  }
  
  // Prioritize app.config.js value (most reliable)
  if (configApiUrl && typeof configApiUrl === 'string' && configApiUrl.trim() !== '') {
    if (__DEV__) {
      console.log('[API Client] ✓ Using API URL from app.config.js extra.apiUrl:', configApiUrl);
    }
    return configApiUrl;
  }
  
  // Fallback to process.env (might work if Expo embedded it)
  if (envApiUrl && envApiUrl.trim() !== '') {
    if (__DEV__) {
      console.log('[API Client] ✓ Using API URL from process.env.EXPO_PUBLIC_API_URL:', envApiUrl);
    }
    return envApiUrl;
  }
  
  // Log warning if using fallback
  console.warn(
    '[API Client] ⚠ No API URL configured, using default fallback.\n' +
    '  - Set EXPO_PUBLIC_API_URL in .env file\n' +
    '  - Restart Expo with: npx expo start --clear\n' +
    '  - Or configure EXPO_PUBLIC_API_URL_DEVELOPMENT/STAGING/PRODUCTION\n' +
    '  - Current value from app.config.js:', configApiUrl || 'undefined\n' +
    '  - Current value from process.env:', envApiUrl || 'undefined'
  );
  
  // Fallback to default
  return 'https://api.example.com';
};

/**
 * API client configuration
 * Default base URL - should be configured via environment variables in production
 * Environment variables:
 *   - EXPO_PUBLIC_API_URL: Base URL for API (required)
 *   - EXPO_PUBLIC_API_DEBUG: Enable debug logging (optional, default: false)
 */
const DEFAULT_CONFIG: ApiClientConfig = {
  baseURL: getApiBaseUrl(),
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
};

// Enable debug logging if configured
const API_DEBUG = process.env.EXPO_PUBLIC_API_DEBUG === 'true';

/**
 * User-facing message shown when the server returns an HTML error page (e.g. a
 * 404 from a gateway/proxy or a default server error page) instead of a JSON
 * API response. We deliberately hide the HTML so it never renders in the UI.
 */
const UNREACHABLE_MESSAGE = 'Unable to reach the server. Please check your connection and try again.';

/**
 * API Client class for making HTTP requests with automatic token injection
 * Handles authentication, error handling, and request/response transformation
 */
class ApiClient {
  private config: ApiClientConfig;

  /**
   * Optional Clerk token provider. When Clerk is enabled, a hook wires this to
   * Clerk's getToken(); when null (no Clerk key), the client falls back to the
   * legacy tokenStorage path, so behaviour is unchanged until Clerk is turned on.
   */
  private clerkTokenProvider: (() => Promise<string | null>) | null = null;

  /**
   * Create a new API client instance
   * @param config - API client configuration
   */
  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register/clear the Clerk token provider (called from a React effect). */
  setClerkTokenProvider(provider: (() => Promise<string | null>) | null): void {
    this.clerkTokenProvider = provider;
  }

  /**
   * Get the full URL by combining base URL with endpoint
   * @param endpoint - API endpoint path
   * @returns Full URL string
   */
  private getUrl(endpoint: string): string {
    // Normalize both sides so a trailing slash on the base URL and/or a leading
    // slash on the endpoint can never combine into a double slash (e.g.
    // "https://host//api/auth/login"), which the API routes as a 404.
    const cleanBase = this.config.baseURL.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    return `${cleanBase}/${cleanEndpoint}`;
  }

  /**
   * Build query string from params object
   * @param params - Query parameters
   * @returns Query string
   */
  private buildQueryString(params: Record<string, string | number | boolean>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    return searchParams.toString();
  }

  /**
   * Get request headers with authentication token if required
   * @param config - Request configuration
   * @param endpoint - API endpoint path (for logging purposes)
   * @returns Headers object
   */
  private async getHeaders(config: RequestConfig = {}, endpoint: string = ''): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      ...this.config.defaultHeaders,
      ...config.headers,
    };

    // Automatically inject token if auth is required (default: true)
    if (config.requiresAuth !== false) {
      // Prefer a Clerk-issued token when Clerk is enabled; otherwise use legacy storage.
      let token: string | null = null;
      if (this.clerkTokenProvider) {
        try {
          token = await this.clerkTokenProvider();
        } catch (err) {
          if (__DEV__) console.warn('[API] Clerk token provider failed, falling back:', err);
        }
      }
      if (!token) {
        token = await tokenStorage.getAccessToken();
      }
      // One retry after short delay for cold start (e.g. app opened from push - storage may not be ready yet)
      if (!token) {
        await new Promise((r) => setTimeout(r, 350));
        token = await tokenStorage.getAccessToken();
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        
        // Enhanced logging for auth endpoints to debug token issues
        if (endpoint.includes('/auth/me') || endpoint.includes('/auth/verify') || __DEV__) {
          console.log('[API] Auth request with token:', {
            endpoint,
            tokenPreview: token.substring(0, 30) + '...',
            tokenLength: token.length,
            hasBearer: headers.Authorization.startsWith('Bearer '),
            requiresAuth: config.requiresAuth,
          });
        }
      } else {
        // Always log missing token - critical for debugging 401 errors
        console.error('[API] ⚠️ No token found for authenticated request:', {
          endpoint,
          requiresAuth: config.requiresAuth,
        });
      }
    }

    return headers;
  }

  /**
   * Try to refresh the access token using the stored refresh token.
   * Used on 401 to recover session without logging out.
   * @returns true if new tokens were saved and the original request can be retried; false otherwise
   */
  private async tryRefreshToken(): Promise<boolean> {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      if (process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
        console.log('[API] 401: No refresh token, cannot refresh');
      }
      return false;
    }
    
    // SECURITY: Include device fingerprinting for enhanced security (OWASP Top 10 - A07:2021)
    const { getDeviceId, getDeviceFingerprint } = await import('./deviceFingerprint');
    const deviceId = await getDeviceId();
    const deviceFingerprint = await getDeviceFingerprint();
    
    const url = `${this.config.baseURL}/api/auth/refresh`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          refreshToken,
          deviceId,
          deviceFingerprint,
        }),
      });
      const text = await res.text();
      const data = (() => {
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          return {};
        }
      })();
      if (!res.ok) {
        if (process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
          console.log('[API] Refresh failed:', res.status, data);
        }
        await tokenStorage.clearAllTokens();
        return false;
      }
      const newToken = data.token ?? data.Token;
      const newRefresh = data.refreshToken ?? data.RefreshToken;
      if (newToken) {
        await tokenStorage.setAccessToken(newToken);
        if (newRefresh) await tokenStorage.setRefreshToken(newRefresh);
        if (process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
          console.log('[API] Token refreshed, retrying request');
        }
        return true;
      }
      return false;
    } catch (e) {
      if (process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
        console.log('[API] Refresh request error:', e);
      }
      return false;
    }
  }

  /**
   * Refresh the access token using the stored refresh token (e.g. for biometric login).
   * @returns true if new tokens were saved; false otherwise
   */
  async refreshSession(): Promise<boolean> {
    return this.tryRefreshToken();
  }

  /**
   * Handle API errors and transform them into ApiError instance
   * @param error - Error object
   * @param status - HTTP status code
   * @returns ApiError instance
   */
  private handleError(error: unknown, status?: number): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (error instanceof Error) {
      return new ApiError({
        message: error.message,
        status,
      });
    }
    return new ApiError({
      message: 'An unknown error occurred',
      status,
    });
  }

  /**
   * Make an HTTP request
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  private async request<T>(
    method: string,
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = this.getUrl(endpoint);
    
    // Build URL with query parameters
    let fullUrl = url;
    if (config.params && Object.keys(config.params).length > 0) {
      const queryString = this.buildQueryString(config.params);
      fullUrl = `${url}?${queryString}`;
    }

    try {
      const headers = await this.getHeaders(config, endpoint);

      // For FormData we must NOT send Content-Type so the runtime sets multipart/form-data with boundary.
      // Sending application/json with FormData body causes 415 Unsupported Media Type.
      const isFormData = config.body && ['POST', 'PUT', 'PATCH'].includes(method) && config.body instanceof FormData;
      const headersForRequest: Record<string, string> = { ...(headers as Record<string, string>) };
      if (isFormData) {
        delete headersForRequest['Content-Type'];
      }

      const fetchOptions: RequestInit = {
        method,
        headers: headersForRequest,
      };

      if (config.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        if (config.body instanceof FormData) {
          fetchOptions.body = config.body;
        } else {
          fetchOptions.body = JSON.stringify(config.body);
        }
      }

      // Debug logging (if enabled via EXPO_PUBLIC_API_DEBUG)
      if (API_DEBUG) {
        console.log(`[API] ${method} ${fullUrl}`, {
          headers: headersForRequest,
          body: config.body instanceof FormData ? '[FormData]' : config.body,
        });
      }

      // Always log the API URL being called for login debugging
      if (endpoint.includes('/auth/login')) {
        console.log(`[API] Calling login endpoint: ${fullUrl}`);
        console.log(`[API] Base URL: ${this.config.baseURL}`);
      }

      // Make the request
      const response = await fetch(fullUrl, fetchOptions);

      // Debug logging for response
      if (API_DEBUG) {
        console.log(`[API] ${method} ${fullUrl} - Status: ${response.status}`);
      }

      // Always log errors for debugging
      if (!response.ok) {
        console.error(`[API] Error: ${method} ${fullUrl} - Status: ${response.status} ${response.statusText}`);
        
        // For 401 errors, log comprehensive authentication details
        if (response.status === 401) {
          console.error(`[API] ⚠️ 401 Unauthorized - Authentication failed`);
          console.error(`[API]   Endpoint: ${endpoint}`);
          console.error(`[API]   Method: ${method}`);
          console.error(`[API]   Requires Auth: ${config.requiresAuth !== false}`);
          console.error(`[API]   Has Authorization Header: ${!!headers.Authorization}`);
          
          if (headers.Authorization) {
            const authHeader = headers.Authorization as string;
            const tokenPreview = authHeader.substring(0, 50) + '...';
            console.error(`[API]   Authorization Header Preview: ${tokenPreview}`);
            console.error(`[API]   Has Bearer Prefix: ${authHeader.startsWith('Bearer ')}`);
            console.error(`[API]   Token Length: ${authHeader.replace('Bearer ', '').length}`);
            
            // Check if token was retrieved from storage
            const storedToken = await tokenStorage.getAccessToken();
            if (storedToken) {
              console.error(`[API]   Token exists in storage: Yes`);
              console.error(`[API]   Stored token matches header: ${authHeader.replace('Bearer ', '') === storedToken}`);
            } else {
              console.error(`[API]   ⚠️ Token NOT found in storage!`);
            }
          } else {
            console.error(`[API]   ⚠️ No Authorization header found!`);
            const storedToken = await tokenStorage.getAccessToken();
            console.error(`[API]   Token in storage: ${storedToken ? 'Yes' : 'No'}`);
          }
        }
      }

      // Parse response (handle both JSON and plain text)
      // Read response as text first, then try to parse as JSON
      const responseText = await response.text().catch(() => '');
      let data: any = {};
      const contentType = response.headers.get('content-type');

      // Detect HTML error pages (e.g. a 404/502 served by a gateway, load balancer,
      // or the server's default error page). We never want raw HTML to surface as an
      // error message in the UI, so replace it with a friendly connectivity message.
      const looksLikeHtml =
        (contentType?.includes('text/html') ?? false) ||
        /^\s*(<!doctype html|<html|<\?xml)/i.test(responseText);

      if (looksLikeHtml) {
        // Discard the HTML body entirely; surface a generic "can't reach server" message.
        data = { message: UNREACHABLE_MESSAGE };
      } else if (contentType && contentType.includes('application/json') && responseText) {
        // Try to parse as JSON
        try {
          data = JSON.parse(responseText);
        } catch {
          // If JSON parsing fails, treat as plain text
          data = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
        }
      } else {
        // Handle plain text responses (e.g., 401 "Invalid credentials")
        data = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
      }

      // Handle 401: try refresh token once and retry (prevent race conditions and session recovery)
      if (response.status === 401 && config.requiresAuth !== false && !config.isRetry && !endpoint.includes('auth/refresh')) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          return this.request<T>(method, endpoint, { ...config, isRetry: true });
        }
      }

      // Handle error responses
      if (!response.ok) {
        // For 401 errors, the API may return plain text, so use data.message or the text itself
        const errorMessage = data.message || data || `HTTP ${response.status}: ${response.statusText}`;
        
        // Throw ApiError class (extends Error) for proper error handling
        throw new ApiError({
          message: typeof errorMessage === 'string' ? errorMessage : `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          code: data.code,
          details: data,
        });
      }

      // Return successful response
      return {
        data: data as T,
        success: true,
        message: data.message,
        statusCode: response.status,
      };
    } catch (error) {
      // Log network/fetch errors for debugging
      console.error(`[API] Request failed: ${method} ${fullUrl}`, {
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
      });

      // Re-throw ApiError as-is (it already extends Error)
      if (error instanceof ApiError) {
        throw error;
      }

      // Transform other errors into ApiError
      throw this.handleError(error);
    }
  }

  /**
   * Make a GET request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, config);
  }

  /**
   * Make a POST request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async post<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, config);
  }

  /**
   * Make a PUT request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async put<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, config);
  }

  /**
   * Make a PATCH request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async patch<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, config);
  }

  /**
   * Make a DELETE request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, config);
  }
}

/**
 * Default API client instance
 * Use this instance for all API calls throughout the application
 */
export const apiClient = new ApiClient();

