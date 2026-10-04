# Commit Message

```
feat: Implement booking API integration, vehicle selection UI, and tracking enhancements

## Overview
This commit implements comprehensive booking management features including API integration,
vehicle type selection UI redesign, tracking screen enhancements, and various UI/UX improvements.

## Features Added

### 1. Vehicle Type Selection UI Redesign
- Replace modal picker with card-based horizontal scrollable selection
- Add 8 vehicle types: Small, Medium, Large, Flatbed, Refrigerated, Container, Closed Van, L300
- Each card displays icon, name, time range, price, and selected state
- Implement horizontal ScrollView with fixed card width (140px)
- Add selected state styling with yellow border and checkmark badge
- Remove deprecated modal picker component

**Files Modified:**
- app/booking.tsx

### 2. Create Booking API Integration
- Integrate POST /api/bookings endpoint with full request format
- Update CreateBookingRequest interface to match API specification:
  - cargoDescription (replaces description)
  - notes (optional field)
  - weightKg (replaces weight)
  - pickupLatitude, pickupLongitude
  - dropoffLatitude, dropoffLongitude
  - customerId (from authenticated user)
- Add comprehensive error handling with validation error extraction
- Implement coordinate validation (both lat/lng required together)
- Add schedule date validation (must be today or future)
- Display booking number in success message
- Include customer ID from authenticated user context

**Files Modified:**
- app/booking.tsx
- features/bookings/services/bookingService.ts
- features/bookings/types.ts

### 3. Booking API Response Updates
- Add dropoffLatitude and dropoffLongitude fields to Booking interface
- Add "Dispatched" status to BookingStatus type
- Expand AssignmentStatus to include:
  - PendingAssignment
  - AssignedToOperator
  - BroadcastingToDrivers
  - AcceptedByDriver
  - RejectedByAllDrivers
- Update mapApiBookingToBooking() to parse dropoff coordinates
- Add validation for dropoff coordinates with proper error handling

**Files Modified:**
- shared/types/booking.ts
- features/bookings/services/bookingService.ts

### 4. Home Screen Pull-to-Refresh
- Add RefreshControl to ScrollView for recent activities
- Integrate with useBookings hook's refresh() function
- Show loading indicator during refresh
- Use yellow tint color matching app theme
- Refresh all bookings data including recent activities

**Files Modified:**
- app/(tabs)/index.tsx

### 5. DeliveryCard Component Updates
- Update Scheduled Card: vertical layout with separate lines for pickup/dropoff
- Add green location icon for pickup, red for dropoff
- Add labels ("Pickup" and "Dropoff") above addresses
- Update Active Card: replace timeline dots with icon containers
- Improve address wrapping (2 lines max)
- Match icon styling with booking screen design

**Files Modified:**
- shared/components/DeliveryCard.tsx

### 6. Tracking Screen Enhancements
- Fetch booking details from API using getBookingById()
- Display booking number in header from booking data
- Add "Location Details" section with pickup/dropoff addresses
- Show actual booking addresses (not static text)
- Add getStatusDisplayName() function for status display
- Update status badge to show actual booking status
- Map API statuses to MapView booking status format
- Implement route rendering for Pending/Assigned bookings (shortest path)
- Add "No Driver" card when driver is not assigned
- Fix header safe area handling
- Add null checks for driver data access

**Files Modified:**
- app/tracking.tsx

## Bug Fixes

### Status Display Error
- Fix TypeError: Cannot read property 'toUpperCase' of undefined
- Add null checks and fallback values in getStatusDisplayName()
- Add defensive optional chaining in status badge text

### Location Display Logic
- Fix locations showing static text instead of booking addresses
- Simplify logic to directly display booking?.pickupLocation and booking?.dropoffLocation
- Remove incorrect trackingData coordinate checks

### Header Safe Area
- Fix header overlapping with status bar/notch
- Add dynamic paddingTop: insets.top to header style
- Change padding from fixed to paddingHorizontal + paddingBottom

## Technical Details

### API Integration
- Endpoint: POST /api/bookings
- Authentication: JWT Bearer Token (required)
- Error Format: { success: false, message: string, errors: string[] }
- Success Format: { success: true, data: Booking }

### Coordinate Validation
- Latitude: -90 to 90
- Longitude: -180 to 180
- Both coordinates required together (cannot provide only one)
- Invalid coordinates set to null with console warnings

### Status Mapping
- Pending → 'pending' (shows shortest path route)
- Assigned/Dispatched → 'assigned' (shows shortest path route)
- InProgress → 'on_the_way_to_dropoff'
- Completed → 'delivered'
- Cancelled → 'cancelled'

## UI/UX Improvements
- Card-based vehicle selection for better mobile experience
- Clear visual separation of locations with icons and labels
- Real-time status display with proper formatting
- Intuitive pull-to-refresh gesture
- Proper empty states for missing data
- Consistent safe area handling across screens

## Testing
- ✅ Vehicle type selection works correctly
- ✅ Booking creation sends correct API format
- ✅ Error messages display properly
- ✅ Pull-to-refresh updates bookings
- ✅ Location addresses display from booking data
- ✅ Status names display correctly
- ✅ Route renders for Pending/Assigned bookings
- ✅ Null driver handled gracefully
- ✅ Safe areas respected on all screens

## Breaking Changes
None - all changes are backward compatible

## Migration Notes
- Vehicle type selection UI changed from modal to cards (no API changes)
- CreateBookingRequest interface updated (old description field still supported via legacy mapping)

## Related Issues
- Booking API integration
- Vehicle type selection UI improvement
- Tracking screen booking details display
- Location display enhancements

---

Co-authored-by: AI Assistant <assistant@cursor.sh>
```

