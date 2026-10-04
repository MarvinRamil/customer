/**
 * Common API types used across features
 * These types define the standard structure for API requests and responses
 */

/**
 * Standard API response wrapper
 * @template T - The type of data in the response
 */
export interface ApiResponse<T = unknown> {
  /** Response data */
  data: T;
  /** Success status */
  success: boolean;
  /** Optional message */
  message?: string;
  /** Optional error details */
  error?: string;
  /** HTTP status code */
  statusCode?: number;
}

/**
 * API error response structure (interface for type checking)
 */
export interface ApiErrorData {
  /** Error message */
  message: string;
  /** Error code */
  code?: string | number;
  /** Additional error details */
  details?: unknown;
  /** HTTP status code */
  status?: number;
}

/**
 * API Error class that extends Error for proper error handling
 * This ensures instanceof checks work correctly with try/catch and TanStack Query
 */
export class ApiError extends Error {
  /** Error code */
  code?: string | number;
  /** Additional error details */
  details?: unknown;
  /** HTTP status code */
  status?: number;

  constructor(data: ApiErrorData) {
    super(data.message);
    this.name = 'ApiError';
    this.code = data.code;
    this.details = data.details;
    this.status = data.status;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * HTTP request method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Request configuration options for API calls
 */
export interface RequestConfig {
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Whether to include auth token (default: true) */
  requiresAuth?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Internal flag to prevent infinite retry loops */
  isRetry?: boolean;
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  /** Base URL for API requests */
  baseURL: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Default headers */
  defaultHeaders?: Record<string, string>;
}

