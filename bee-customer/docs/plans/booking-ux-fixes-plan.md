# Booking Screen UX Fixes Implementation Plan

## Overview

This plan addresses multiple UX issues in the booking screen:

1. **Focus Issue**: After confirming a dropoff location, focus incorrectly returns to the pickup input, reopening the pickup modal
2. **Schedule Date Validation**: The "future date" validation is too strict - should allow scheduling at least 1 hour from current time
3. **Multi-Stop Route**: Map only shows route to first dropoff - need to support multiple stops with proper distance/time calculation and route rendering

## Issues Analysis

### Issue 1: Focus After Dropoff Confirmation

**Current Behavior:**
- User opens map to select dropoff location
- User confirms the dropoff location
- Map closes and focus jumps to pickup input
- Pickup modal/map opens unexpectedly

**Root Cause:**
- When the full-screen map closes, React Native auto-focuses the first focusable input (pickup)
- The `onFocus` handler on pickup input triggers `handleMapFullScreen()`

**Solution:**
- Add a flag to prevent auto-focus after location confirmation
- Clear `activeLocationType` properly
- Use `Keyboard.dismiss()` before closing map
- Optionally, use `ref` to manage focus explicitly

### Issue 2: Schedule Date Validation

**Current Behavior:**
- Date picker doesn't allow selecting current date
- When selecting next day, validation still fails with "must be in the future"
- Default time is "10:00" which may be in the past relative to combined date+time

**Root Cause:**
In `features/bookings/schemas/validationSchemas.ts` (lines 141-154):
```typescript
if (combinedDateTime <= now) {
  // Error: "Scheduled date and time must be in the future"
}
```

This checks if the combined date+time is `<= now`, but:
- If user selects tomorrow at 10:00 AM, and it's currently 2:00 PM today, the check passes
- But if default time is 10:00 and user doesn't change it, validation may behave unexpectedly

**User Requirement:**
- Minimum scheduling time = current time + 1 hour
- Users should be able to schedule pickups at least 1 hour from now

**Solution:**
- Change validation from `> now` to `> now + 1 hour`
- Update date picker to allow current date but validate time is at least 1 hour away
- Set default scheduled time to current time + 1 hour (rounded to nearest 15 min)

---

## Phase 1: Fix Focus After Location Confirmation

**Objective:** Prevent pickup input from receiving focus after dropoff confirmation

**Files to modify:**
- `app/booking.tsx`

**Tasks:**

1. Add a ref flag to track when returning from map confirmation
2. Modify `handleConfirmLocation` to:
   - Call `Keyboard.dismiss()` before closing map
   - Set a "just confirmed" flag
3. Modify pickup `onFocus` handler to check the flag and prevent opening map
4. Clear the flag after a short delay

**Implementation:**
```typescript
// Add state/ref
const justConfirmedLocationRef = useRef(false);

// In handleConfirmLocation
const handleConfirmLocation = useCallback(() => {
  if (!pendingLocation) return;
  
  Keyboard.dismiss(); // Dismiss keyboard first
  justConfirmedLocationRef.current = true;
  
  handleLocationSelect(pendingLocation);
  setPendingLocation(null);
  setIsMapFullScreen(false);
  setIsMapExpanded(false);
  
  // Clear flag after delay
  setTimeout(() => {
    justConfirmedLocationRef.current = false;
  }, 500);
}, [pendingLocation, handleLocationSelect]);

// In pickup onFocus
onFocus={() => {
  if (justConfirmedLocationRef.current) {
    // Don't open map if we just confirmed a location
    return;
  }
  setActiveLocationType('pickup');
  handleMapFullScreen();
}}
```

**Estimated time:** 30 minutes

---

## Phase 2: Fix Schedule Date/Time Validation

**Objective:** Allow scheduling at least 1 hour from current time

**Files to modify:**
- `features/bookings/schemas/validationSchemas.ts` - Update Zod validation
- `app/booking.tsx` - Update default time and date picker behavior

**Tasks:**

### 2.1 Update Zod Schema

Change the validation from `combinedDateTime <= now` to `combinedDateTime < now + 1 hour`:

```typescript
// Validate that combined date/time is at least 1 hour in the future
if (data.scheduledDate && data.scheduledTime) {
  const combinedDateTime = new Date(`${data.scheduledDate}T${data.scheduledTime}:00`);
  if (!isNaN(combinedDateTime.getTime())) {
    const now = new Date();
    const minimumScheduleTime = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
    
    if (combinedDateTime < minimumScheduleTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Scheduled pickup must be at least 1 hour from now',
        path: ['scheduledDate'],
      });
    }
  }
}
```

### 2.2 Update Default Scheduled Time

Set default time to current time + 1 hour, rounded to nearest 15 minutes:

```typescript
// Helper function
const getDefaultScheduledTime = (): string => {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  // Round to nearest 15 minutes
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(minutes % 60);
  if (minutes >= 60) now.setHours(now.getHours() + 1);
  
  const hours = now.getHours().toString().padStart(2, '0');
  const mins = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
};

// In defaultValues
scheduledTime: getDefaultScheduledTime(),
```

### 2.3 Update Date Picker Minimum Date

Allow current date but rely on time validation:

```typescript
// Date picker should allow today
minimumDate={new Date()} // Current date, not tomorrow
```

### 2.4 Remove Duplicate Validation in onSubmit

The Zod schema handles validation; remove duplicate check in `onSubmit`:

```typescript
// Remove this block from onSubmit (lines 316-320):
// const now = new Date();
// if (scheduleDateObj < now) {
//   Alert.alert("Error", "Scheduled date and time must be in the future");
//   return;
// }
```

**Estimated time:** 1 hour

---

## Phase 3: Multi-Stop Route Support

**Objective:** Calculate and render routes for multiple dropoff stops

### Current Behavior Analysis

**Problems Identified:**

1. **MapView only supports single dropoff**:
   - Props: `pickupLocation` and `dropoffLocation` (singular)
   - In `booking.tsx` line 980: `dropoffLocation={dropoffs[0]?.coordinates ?? undefined}`
   - Only first dropoff is passed to the map

2. **Route calculation only between 2 points**:
   - `mapService.getRoute(origin, destination)` only takes 2 coordinates
   - Google Maps Directions API **does support waypoints** for multi-stop routes
   - Current implementation ignores additional stops

3. **Distance/Duration only for first leg**:
   - Route distance/duration shown is only pickup → first dropoff
   - Should sum all legs: pickup → dropoff1 → dropoff2 → ... → dropoffN

**Files to modify:**
- `shared/services/mapService.ts` - Add waypoints support to `getRoute()`
- `shared/types/map.ts` - Update `Route` type for multi-leg routes
- `shared/components/MapView.tsx` - Accept array of dropoff locations
- `app/booking.tsx` - Pass all dropoffs to MapView

### Tasks

#### 3.1 Update `mapService.getRoute()` to Support Waypoints

Google Maps Directions API supports `waypoints` parameter:
```
GET /directions/json?origin=A&destination=C&waypoints=B1|B2|B3&key=API_KEY
```

Update the function signature:
```typescript
export async function getRoute(
  origin: LocationCoordinates,
  destination: LocationCoordinates,
  waypoints?: LocationCoordinates[] // NEW: intermediate stops
): Promise<Route> {
  // ...
  
  // Build waypoints string if provided
  let waypointsStr = '';
  if (waypoints && waypoints.length > 0) {
    waypointsStr = waypoints
      .map(wp => `${wp.latitude},${wp.longitude}`)
      .join('|');
  }
  
  const url = waypointsStr
    ? `${apiBaseUrl}/directions/json?origin=${originStr}&destination=${destStr}&waypoints=${waypointsStr}&key=${apiKey}`
    : `${apiBaseUrl}/directions/json?origin=${originStr}&destination=${destStr}&key=${apiKey}`;
  
  // ... fetch and process
  
  // Sum up all legs for total distance/duration
  let totalDistance = 0;
  let totalDuration = 0;
  for (const leg of route.legs) {
    totalDistance += leg.distance.value;
    totalDuration += leg.duration.value;
  }
}
```

#### 3.2 Update `Route` Type

```typescript
export interface Route {
  coordinates: LocationCoordinates[];
  distance: number;      // Total distance in meters
  duration: number;      // Total duration in seconds
  distanceText: string;  // Formatted total distance
  durationText: string;  // Formatted total duration
  legs?: RouteLeg[];     // NEW: Individual leg details
}

export interface RouteLeg {
  distance: number;
  duration: number;
  distanceText: string;
  durationText: string;
  startAddress?: string;
  endAddress?: string;
}
```

#### 3.3 Update `MapViewProps` to Accept Multiple Dropoffs

```typescript
export interface MapViewProps {
  // ... existing props
  
  /** Single dropoff location (for backwards compatibility) */
  dropoffLocation?: LocationCoordinates;
  
  /** NEW: Multiple dropoff locations (takes precedence over dropoffLocation) */
  dropoffLocations?: LocationCoordinates[];
}
```

Update MapView to:
- Render markers for all dropoff locations (numbered 1, 2, 3...)
- Pass waypoints to `getRoute()` when multiple dropoffs exist
- Show total distance/duration for entire route

#### 3.4 Update `booking.tsx` to Pass All Dropoffs

```typescript
// Current (only first dropoff):
dropoffLocation={dropoffs[0]?.coordinates ?? undefined}

// New (all dropoffs):
dropoffLocations={dropoffs
  .filter(d => d.coordinates)
  .map(d => d.coordinates!)
}
```

#### 3.5 Render Route Polyline Through All Stops

The polyline from Google Directions API already includes all waypoints, so this should work automatically once we pass waypoints to the API.

**Estimated time:** 2-3 hours

---

## Phase 4: Testing & Polish

**Objective:** Verify all fixes work correctly

**Tasks:**

1. **Focus fix testing:**
   - Select dropoff location → confirm → verify no focus jump to pickup
   - Add multiple dropoffs in sequence → verify each works correctly

2. **Schedule validation testing:**
   - Today + 1 hour → Should pass
   - Today + 30 minutes → Should fail with clear message
   - Tomorrow any time → Should pass
   - Midnight crossover (11:30 PM for 12:30 AM next day)

3. **Multi-stop route testing:**
   - Add 2 dropoffs → verify route goes through both
   - Add 3+ dropoffs → verify complete path rendered
   - Verify distance/duration is total for all stops
   - Test marker numbers (1, 2, 3...) display correctly

4. Verify error messages are clear and helpful

**Estimated time:** 45 minutes

---

## Summary

| Phase | Description | Files | Time |
|-------|-------------|-------|------|
| 1 | Fix focus after location confirmation | `app/booking.tsx` | 30 min |
| 2 | Fix schedule date/time validation | `validationSchemas.ts`, `app/booking.tsx` | 1 hour |
| 3 | Multi-stop route support | `mapService.ts`, `map.ts`, `MapView.tsx`, `booking.tsx` | 2-3 hours |
| 4 | Testing & polish | - | 45 min |

**Total estimated time:** 4.5-5.5 hours

---

## Approval Required

Please confirm which phases to implement:
- [x] Phase 1: Fix focus after dropoff confirmation ✅
- [x] Phase 2: Fix schedule date/time validation ✅  
- [x] Phase 3: Multi-stop route support (distance/time for all stops + path rendering) ✅
- [ ] Phase 4: Testing & polish

