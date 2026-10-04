# My Bookings API Integration Plan

## Overview

This document outlines the implementation plan for integrating the `/api/bookings/my-bookings` endpoint. This endpoint returns all bookings for the authenticated user, automatically filtered by the user's email from the JWT token.

## Objectives

1. Update booking types to match the new API response structure
2. Update booking service to use `/api/bookings/my-bookings` endpoint
3. Ensure proper authentication token injection
4. Update hooks to work with the new endpoint
5. Handle new booking fields (bookingNumber, assignmentStatus, GPS coordinates, etc.)
6. Update UI components to display new booking information
7. Maintain backward compatibility with existing booking features

## API Endpoint Details

### GET /api/bookings/my-bookings

- **Purpose**: Get all bookings for the authenticated user
- **Auth Required**: Yes (JWT Bearer Token)
- **Request**: None (GET request, no query parameters)
- **Response**: `{ success: boolean, data: Booking[] }`
- **Auto-filtering**: Bookings are automatically filtered by user's email from JWT token

## Phase 1: Update Booking Types

### Tasks

1. **Update `shared/types/booking.ts`**

   - Add new fields from API response:
     - `bookingNumber: string` - Human-readable booking number (e.g., "BK-20240101001")
     - `customerId: string` - Customer ID (Guid)
     - `cargoDescription: string` - Description of cargo
     - `size: string | null` - Booking size ("Small", "Medium", "Large")
     - `assignmentStatus: string` - Assignment status ("Unassigned", "Assigned", "Broadcasting")
     - `assignedToTenantId: string | null` - Assigned tenant ID
     - `assignedByUserId: string | null` - User who assigned the booking
     - `assignedAt: Date | null` - Assignment timestamp
     - `beeTenantId: string | null` - Bee platform tenant ID
     - `weightKg: number | null` - Weight in kilograms
     - `pickupLatitude: number | null` - GPS latitude
     - `pickupLongitude: number | null` - GPS longitude
   - Update `BookingStatus` type to include new statuses:
     - Add: "Assigned", "Broadcasting", "Confirmed", "InProgress"
     - Keep existing: "Pending", "Completed", "Cancelled"
   - Add `AssignmentStatus` type union
   - Update field names if needed to match API:
     - `description` → `cargoDescription` (or keep both for compatibility)
     - `notes` field (nullable)

2. **Update `features/bookings/types.ts`**
   - Re-export updated types from `shared/types/booking.ts`
   - Add `AssignmentStatus` type export
   - Update `BookingFilter` if needed to match new statuses

### Files to Update

- `shared/types/booking.ts` (Update)
- `features/bookings/types.ts` (Update)

### Dependencies

- None (foundation phase)

**Estimated Complexity**: Low-Medium

---

## Phase 2: Update Booking Service

### Tasks

1. **Update `features/bookings/services/bookingService.ts`**

   - Update `getBookings()` method:
     - Change endpoint from `/bookings` to `/bookings/my-bookings`
     - Remove filter parameter (API handles filtering automatically)
     - Ensure authentication is required (default behavior)
     - Handle new response structure `{ success: boolean, data: Booking[] }`
     - Map API response fields to Booking type
     - Convert date strings to Date objects
     - Handle nullable fields properly
   - Update error handling:
     - Handle 401 Unauthorized (token expired/invalid)
     - Handle "User email not found in token" error
     - Provide user-friendly error messages
   - Keep other methods unchanged (getBookingById, createBooking, etc.) for now

2. **Add helper methods if needed**
   - Method to parse booking dates
   - Method to handle GPS coordinates
   - Method to format booking numbers

### Files to Update

- `features/bookings/services/bookingService.ts` (Update)

### Dependencies

- Phase 1 (updated types)

**Estimated Complexity**: Medium

---

## Phase 3: Update Booking Hooks

### Tasks

1. **Update `features/bookings/hooks/useBookings.ts`**

   - Remove filter parameter (API handles filtering)
   - Update to use new endpoint
   - Handle new booking fields
   - Update loading and error states
   - Add client-side filtering if needed (by status, date, etc.)
   - Ensure proper error handling for 401 responses

2. **Update `features/bookings/hooks/useBookingStats.ts`** (if needed)

   - Update to work with new booking structure
   - Calculate stats from new status values
   - Handle new status types

3. **Create new hooks if needed**
   - `useMyBookings()` - Specific hook for my-bookings endpoint
   - `useBookingFilters()` - Client-side filtering hook

### Files to Update

- `features/bookings/hooks/useBookings.ts` (Update)
- `features/bookings/hooks/useBookingStats.ts` (Update if needed)

### Dependencies

- Phase 2 (updated service)

**Estimated Complexity**: Low-Medium

---

## Phase 4: Update UI Components

### Tasks

1. **Update `features/bookings/components/BookingCard.tsx`**

   - Display new fields:
     - Booking number (bookingNumber)
     - Assignment status badge
     - GPS coordinates (if available)
     - Weight (if available)
     - Size (if available)
   - Update status badge to handle new statuses
   - Show assignment information if assigned
   - Update styling if needed

2. **Update `features/bookings/components/StatusBadge.tsx`**

   - Add new status colors:
     - "Assigned" → Blue
     - "Broadcasting" → Yellow/Amber
     - "Confirmed" → Green
     - "InProgress" → Orange
   - Handle assignment status display

3. **Create new components if needed**
   - `AssignmentStatusBadge.tsx` - Display assignment status
   - `BookingNumber.tsx` - Display formatted booking number
   - `LocationCoordinates.tsx` - Display GPS coordinates

### Files to Update/Create

- `features/bookings/components/BookingCard.tsx` (Update)
- `features/bookings/components/StatusBadge.tsx` (Update)
- `features/bookings/components/AssignmentStatusBadge.tsx` (Create - optional)

### Dependencies

- Phase 3 (updated hooks)

**Estimated Complexity**: Medium

---

## Phase 5: Update Screens

### Tasks

1. **Update `app/(tabs)/explore.tsx` (Bookings Screen)**

   - Remove filter tabs (API handles filtering)
   - Or keep client-side filtering for UI purposes
   - Update to use new booking fields
   - Display booking numbers
   - Show assignment status
   - Handle empty state properly

2. **Update `app/(tabs)/index.tsx` (Dashboard)**

   - Update recent bookings display
   - Show booking numbers
   - Update stats calculation if needed

3. **Update `app/booking.tsx` (Create Booking Screen)**
   - Keep as-is (creates new bookings)
   - Ensure created bookings will appear in my-bookings list

### Files to Update

- `app/(tabs)/explore.tsx` (Update)
- `app/(tabs)/index.tsx` (Update if needed)
- `app/booking.tsx` (Review - likely no changes needed)

### Dependencies

- Phase 4 (updated components)

**Estimated Complexity**: Low-Medium

---

## Phase 6: Error Handling and Edge Cases

### Tasks

1. **Handle authentication errors**

   - 401 Unauthorized → Clear tokens, redirect to login
   - "User email not found in token" → Show error, prompt re-login
   - Token expiration → Auto-refresh or redirect

2. **Handle empty states**

   - No bookings → Show friendly empty state message
   - Loading state → Show loading indicator
   - Error state → Show error message with retry option

3. **Handle new field edge cases**

   - Nullable fields (size, weight, GPS coordinates)
   - Missing assignment information
   - Date parsing errors

4. **Add retry logic**
   - Retry on network errors
   - Retry on 401 if token refresh available

### Files to Update

- `features/bookings/services/bookingService.ts` (Update error handling)
- `features/bookings/hooks/useBookings.ts` (Update error handling)
- `app/(tabs)/explore.tsx` (Add error/empty states)

### Dependencies

- Phase 2-5 (all previous phases)

**Estimated Complexity**: Medium

---

## Type Definitions

### Updated Booking Interface

```typescript
export interface Booking {
  /** Unique booking identifier (Guid) */
  id: string;
  /** Human-readable booking number (e.g., "BK-20240101001") */
  bookingNumber: string;
  /** Customer ID (Guid) */
  customerId: string;
  /** Pickup location address */
  pickupLocation: string;
  /** Dropoff/delivery location address */
  dropoffLocation: string;
  /** Required truck type */
  truckType: TruckType;
  /** Description of cargo being transported */
  cargoDescription: string;
  /** Scheduled pickup date and time (ISO 8601) */
  scheduleDate: Date;
  /** Current booking status */
  status: BookingStatus;
  /** Additional notes (nullable) */
  notes: string | null;
  /** When booking was created (ISO 8601) */
  createdAt: Date;
  /** When booking was last updated (ISO 8601, nullable) */
  updatedAt: Date | null;
  /** Booking size classification (nullable) */
  size: "Small" | "Medium" | "Large" | null;
  /** Assignment status */
  assignmentStatus: AssignmentStatus;
  /** ID of tenant assigned to handle booking (nullable) */
  assignedToTenantId: string | null;
  /** ID of user who assigned booking (nullable) */
  assignedByUserId: string | null;
  /** When booking was assigned (ISO 8601, nullable) */
  assignedAt: Date | null;
  /** Bee platform tenant ID (nullable) */
  beeTenantId: string | null;
  /** Weight of cargo in kilograms (nullable) */
  weightKg: number | null;
  /** GPS latitude of pickup location (nullable) */
  pickupLatitude: number | null;
  /** GPS longitude of pickup location (nullable) */
  pickupLongitude: number | null;
}
```

### Updated BookingStatus Type

```typescript
export type BookingStatus =
  | "Pending"
  | "Assigned"
  | "Broadcasting"
  | "Confirmed"
  | "InProgress"
  | "Completed"
  | "Cancelled";
```

### New AssignmentStatus Type

```typescript
export type AssignmentStatus = "Unassigned" | "Assigned" | "Broadcasting";
```

### API Response Type

```typescript
export interface MyBookingsResponse {
  success: boolean;
  data: Booking[];
}
```

---

## Implementation Order

1. **Phase 1**: Update types (Foundation)
2. **Phase 2**: Update booking service (API integration)
3. **Phase 3**: Update hooks (State management)
4. **Phase 4**: Update components (UI)
5. **Phase 5**: Update screens (Integration)
6. **Phase 6**: Error handling (Polish)

---

## Migration Strategy

### Backward Compatibility

- Keep existing `Booking` interface fields for compatibility
- Add new fields as optional initially if needed
- Gradually migrate components to use new fields
- Maintain existing filter functionality (client-side if needed)

### Testing Strategy

1. **Unit Tests**

   - Booking service methods
   - Type conversions
   - Date parsing
   - Error handling

2. **Integration Tests**

   - API call with authentication
   - Response parsing
   - Hook behavior
   - Component rendering

3. **Manual Testing**
   - Login → Fetch bookings
   - Display bookings list
   - Handle empty state
   - Handle error states
   - Test with different booking statuses

---

## Error Scenarios and Handling

### 401 Unauthorized

- **Cause**: Missing or invalid token
- **Handling**: Clear tokens, redirect to login
- **User Message**: "Your session has expired. Please login again."

### 401 - User Email Not Found in Token

- **Cause**: Token doesn't contain email claim
- **Handling**: Prompt user to re-login
- **User Message**: "Authentication error. Please login again."

### Empty Bookings List

- **Cause**: User has no bookings
- **Handling**: Show friendly empty state
- **User Message**: "You don't have any bookings yet. Create your first booking!"

### Network Error

- **Cause**: API server unreachable
- **Handling**: Show error with retry option
- **User Message**: "Network error. Please check your connection and try again."

---

## Success Flow

1. User is authenticated (has valid JWT token)
2. App calls `/api/bookings/my-bookings` with Bearer token
3. API validates token and extracts user email
4. API returns bookings filtered by user email
5. App parses response and converts dates
6. App displays bookings in UI
7. User can view booking details, status, assignment info

---

## Future Enhancements

1. **Pagination**: If API adds pagination support
2. **Filtering**: Client-side filtering by status, date range
3. **Sorting**: Sort by date, status, booking number
4. **Search**: Search by booking number, location
5. **Refresh**: Pull-to-refresh functionality
6. **Real-time Updates**: WebSocket/SSE for live updates
7. **Map Integration**: Display bookings on map using GPS coordinates
8. **Assignment Details**: Show tenant/operator information when assigned

---

## Dependencies

- Existing `shared/services/apiClient.ts` (with token injection)
- Existing `shared/services/tokenStorage.ts`
- Existing `features/auth` (for authentication)
- Existing booking feature structure

---

## Estimated Timeline

- **Phase 1**: 1-2 hours (Types update)
- **Phase 2**: 2-3 hours (Service update)
- **Phase 3**: 1-2 hours (Hooks update)
- **Phase 4**: 2-3 hours (Components update)
- **Phase 5**: 1-2 hours (Screens update)
- **Phase 6**: 2-3 hours (Error handling)

**Total**: ~9-15 hours

---

## Notes

1. The endpoint automatically filters by user email from JWT token
2. No query parameters needed - API handles filtering
3. Returns empty array `[]` if user has no bookings (not an error)
4. All date fields are ISO 8601 format strings that need conversion
5. Many fields are nullable - handle null checks in UI
6. GPS coordinates available for map integration (future enhancement)
7. Assignment status provides visibility into booking workflow

---

## Approval

This plan should be reviewed and approved before implementation begins. Each phase can be implemented and tested independently.
