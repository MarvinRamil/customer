# API Client Documentation

This document describes how to use the API client and services in the Bee Customers App.

## Overview

The application uses:

1. **Centralized API client** (`shared/services/apiClient.ts`) – Handles HTTP requests, auth tokens, error transformation
2. **TanStack Query** (`@tanstack/react-query`) – **REQUIRED** for all data fetching. Provides caching, automatic refetching, loading/error states.

**CRITICAL**: All API calls MUST use TanStack Query (`useQuery` for GET, `useMutation` for POST/PUT/PATCH/DELETE). Do NOT use manual `useState`/`useEffect` patterns for API calls.

See [`.cursor/rules/api/tanstack-query.md`](../.cursor/rules/api/tanstack-query.md) for the full rule.

## API Client

### Basic Usage

The API client is a singleton instance exported from `shared/services/apiClient.ts`:

```typescript
import { apiClient } from "@/shared/services/apiClient";

// GET request
const response = await apiClient.get<DataType>("/api/endpoint");

// POST request
const response = await apiClient.post<DataType>("/api/endpoint", {
  body: { key: "value" },
});
```

### Configuration

The API client can be configured via environment variables:

```env
EXPO_PUBLIC_API_URL=https://api.example.com
```

Use the **base URL only** (no `/api` suffix, no trailing slash). Endpoints like `/api/bookings` are appended by the client.

Default configuration:

- Base URL: `https://api.example.com` (or from `EXPO_PUBLIC_API_URL`)
- Timeout: 30 seconds
- Default headers: `Content-Type: application/json`

### Request Methods

#### GET Request

```typescript
const response = await apiClient.get<ResponseType>("/api/bookings", {
  params: { status: "active" },
  requiresAuth: true, // default: true
});
```

#### POST Request

```typescript
const response = await apiClient.post<ResponseType>("/api/bookings", {
  body: {
    pickupLocation: "123 Main St",
    dropoffLocation: "456 Oak Ave",
  },
  requiresAuth: true,
});
```

#### PUT Request

```typescript
const response = await apiClient.put<ResponseType>(`/api/bookings/${id}`, {
  body: { status: "completed" },
});
```

#### PATCH Request

```typescript
const response = await apiClient.patch<ResponseType>(
  `/api/bookings/${id}/status`,
  {
    body: { status: "dispatched" },
  }
);
```

#### DELETE Request

```typescript
const response = await apiClient.delete(`/api/bookings/${id}`);
```

### Request Configuration

The `RequestConfig` interface allows you to customize requests:

```typescript
interface RequestConfig {
  headers?: Record<string, string>; // Custom headers
  body?: unknown; // Request body (for POST/PUT/PATCH)
  params?: Record<string, string | number | boolean>; // Query parameters
  requiresAuth?: boolean; // Whether to include auth token (default: true)
  timeout?: number; // Request timeout in milliseconds
}
```

### Response Format

All API responses follow the `ApiResponse<T>` format:

```typescript
interface ApiResponse<T> {
  data: T; // Response data
  success: boolean; // Success status
  message?: string; // Optional message
  error?: string; // Optional error details
}
```

### Error Handling

The API client throws `ApiError` objects:

```typescript
interface ApiError {
  message: string; // Error message
  status?: number; // HTTP status code
  code?: string | number; // Error code
  details?: unknown; // Additional error details
}
```

Example error handling:

```typescript
try {
  const response = await apiClient.get<Booking>("/api/bookings/123");
  if (response.success && response.data) {
    // Handle success
  }
} catch (error) {
  if (error && typeof error === "object" && "message" in error) {
    console.error("API Error:", error.message);
    console.error("Status:", error.status);
  }
}
```

## Authentication

### Token Storage

Authentication tokens are stored securely using `expo-secure-store`:

```typescript
import { tokenStorage } from "@/shared/services/tokenStorage";

// Store tokens
await tokenStorage.setAccessToken("access_token");
await tokenStorage.setRefreshToken("refresh_token");

// Retrieve tokens
const accessToken = await tokenStorage.getAccessToken();
const refreshToken = await tokenStorage.getRefreshToken();

// Clear tokens
await tokenStorage.clearAllTokens();
```

### Automatic Token Injection

The API client automatically injects the access token into request headers:

```typescript
// Token is automatically added to Authorization header
const response = await apiClient.get("/api/bookings");

// To disable auth for a specific request:
const response = await apiClient.get("/api/public-endpoint", {
  requiresAuth: false,
});
```

## TanStack Query (React Query)

**REQUIRED**: All API data fetching MUST use TanStack Query. See [`.cursor/rules/api/tanstack-query.md`](../.cursor/rules/api/tanstack-query.md) for the complete rule.

### Setup

The `QueryClientProvider` is already configured in `app/_layout.tsx`. The `queryClient` instance is exported from `shared/services/queryClient.ts`.

### Using useQuery (GET requests)

```typescript
import { useQuery } from '@tanstack/react-query';
import { bookingService } from '@/features/bookings';

export function useBookings() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingService.getBookings(),
  });

  return {
    bookings: data || [],
    isLoading,
    error: error?.message || null,
    refresh: refetch,
  };
}
```

### Using useMutation (POST/PUT/PATCH/DELETE)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '@/features/bookings';

export function useCreateBooking() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: CreateBookingRequest) => 
      bookingService.createBooking(payload),
    onSuccess: () => {
      // Invalidate bookings list to refetch
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  return {
    createBooking: mutation.mutate,
    isSubmitting: mutation.isPending,
    error: mutation.error?.message || null,
  };
}
```

### Query Keys

Use consistent, hierarchical query keys:

- `['bookings']` – All bookings list
- `['bookings', id]` – Single booking by ID
- `['bookings', 'stats']` – Booking statistics
- `['auth', 'user']` – Current authenticated user
- `['profile']` – User profile data

### Benefits

- **Automatic caching** – Data cached and reused across components
- **Background refetching** – Stale data automatically refreshes
- **Request deduplication** – Multiple components = one request
- **Less boilerplate** – No manual `useState`/`useEffect`
- **Optimistic updates** – Easy optimistic UI patterns

## Feature Services

### Booking Service

The booking service (`features/bookings/services/bookingService.ts`) provides methods for booking operations:

```typescript
import { bookingService } from "@/features/bookings";

// Get all bookings
const bookings = await bookingService.getBookings("All");

// Get bookings with filter
const activeBookings = await bookingService.getBookings("Active");

// Get single booking (GET /api/bookings/:id – returns Booking DTO)
const booking = await bookingService.getBookingById("BK-123");

// Tracking screen: the tracking screen uses getBookingById(id) as the single source of truth
// for booking data. The returned booking includes selectedDriverId (and other driver fields);
// selectedDriverId is passed to useSignalRLocationUpdates(driverId) for real-time driver location.

// Create booking
const newBooking = await bookingService.createBooking({
  pickupLocation: "123 Main St",
  dropoffLocation: "456 Oak Ave",
  truckType: "Small Truck",
  scheduleDate: "2024-12-25",
});

// Update booking
const updated = await bookingService.updateBooking("BK-123", {
  status: "Dispatched",
});

// Delete booking
await bookingService.deleteBooking("BK-123");

// Get statistics
const stats = await bookingService.getBookingStats();

// Update status
const updated = await bookingService.updateBookingStatus("BK-123", "Completed");
```

### Auth Service

The auth service (`features/auth/services/tokenService.ts`) provides authentication methods:

```typescript
import { tokenService } from "@/features/auth";

// Login
const authResponse = await tokenService.login({
  email: "user@example.com",
  password: "password",
});

// Check authentication status
const isAuthenticated = await tokenService.isAuthenticated();

// Refresh access token
const newToken = await tokenService.refreshAccessToken();

// Logout
await tokenService.logout();
```

## Custom Hooks

### useBookings Hook

Fetch and manage bookings with filtering:

```typescript
import { useBookings } from "@/features/bookings";

function BookingsScreen() {
  const { bookings, isLoading, error, filter, setFilter, refresh } =
    useBookings("All");

  // Filter options: 'All' | 'Active' | 'Completed'
  setFilter("Active");

  // Refresh data
  await refresh();
}
```

### useBookingStats Hook

Fetch booking statistics:

```typescript
import { useBookingStats } from "@/features/bookings";

function DashboardScreen() {
  const { stats, isLoading, error, refresh } = useBookingStats();

  if (stats) {
    console.log("Total:", stats.total);
    console.log("Pending:", stats.pending);
  }
}
```

## Best Practices

1. **Always use feature services**: Don't call `apiClient` directly from components. Use feature-specific services instead.

2. **Handle errors gracefully**: Always wrap API calls in try-catch blocks and provide user-friendly error messages.

3. **Use TypeScript types**: Always specify the response type when calling API methods.

4. **Check response success**: Always check `response.success` before accessing `response.data`.

5. **Use hooks for data fetching**: Prefer using custom hooks (`useBookings`, `useBookingStats`) over direct service calls in components.

6. **Handle loading states**: Always show loading indicators while fetching data.

7. **Implement refresh functionality**: Provide users with the ability to refresh data.

## Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_API_URL=https://api.example.com
```

## Testing

When testing API calls, you can mock the API client:

```typescript
jest.mock("@/shared/services/apiClient", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    // ... other methods
  },
}));
```

## Troubleshooting

### Token Not Being Injected

- Ensure `tokenStorage.setAccessToken()` was called after login
- Check that `requiresAuth` is not set to `false`
- Verify token storage is working correctly

### Request Timeout

- Increase timeout in request config: `{ timeout: 60000 }`
- Check network connectivity
- Verify API server is accessible

### CORS Issues

- Ensure API server allows requests from your app's origin
- Check API server CORS configuration

### Type Errors

- Ensure response types match API response structure
- Check that `ApiResponse<T>` wrapper is handled correctly
