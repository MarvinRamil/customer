# Delivery Card Implementation Plan

## Overview

This plan outlines the implementation of delivery/booking cards based on the provided HTML design. The cards will display booking information in different states (Active/In Transit, Scheduled, Completed) using the existing theme colors.

## Objectives

1. Create reusable delivery card components that match the HTML design structure
2. Support multiple booking states (In Transit, Scheduled, Completed)
3. Use existing theme colors from the codebase
4. Integrate with the my-bookings API data
5. Maintain consistency with the current design system

## Card Types Analysis

### 1. Active Delivery Card (In Transit)

**Design Elements:**

- Icon: Shipping/truck icon with primary color background (primary/20 opacity)
- Header: Booking number (#TRK-2940) and vehicle details (Standard Truck • 15kg)
- Status Badge: "In Transit" with primary color background
- Timeline: Vertical dashed line with two points
  - Pickup: Gray dot, uppercase label, address, time
  - Drop-off: Primary color dot with shadow, uppercase label, address, estimated time
- Action Button: "Track Live" button with dark background

**Data Required:**

- `bookingNumber`
- `truckType`
- `weightKg`
- `status` (must be "InProgress")
- `pickupLocation`
- `dropoffLocation`
- `scheduleDate` or pickup time
- Estimated arrival time

### 2. Scheduled Card

**Design Elements:**

- Icon: Vehicle icon (motorbike/truck) with gray background
- Header: Booking number (#BKE-1102) and vehicle details (Motorbike • Document)
- Status Badge: "Scheduled" with gray background
- Calendar Box: Shows scheduled date/time with calendar icon
- Location Row: Pickup and dropoff with dashed line between them
  - Pickup: Empty circle dot, truncated address
  - Dropoff: Filled circle dot, truncated address
- Action Button: "View Details" button with border

**Data Required:**

- `bookingNumber`
- `truckType`
- `cargoDescription` or type
- `status` (Pending, Assigned, Broadcasting, Confirmed)
- `scheduleDate`
- `pickupLocation`
- `dropoffLocation`

### 3. Completed Card

**Design Elements:**

- Icon: Package icon with gray background
- Header: Booking number (#PKG-8832) and delivery status text
- Status Indicator: Green checkmark with "Done" text
- Reduced opacity (80%) to indicate completed state
- No action buttons

**Data Required:**

- `bookingNumber`
- `status` (must be "Completed")
- `updatedAt` or `createdAt` for "Delivered Yesterday" text

## Implementation Phases

### Phase 1: Create Base Delivery Card Component (Shared Component)

**Files to Create:**

- `shared/components/DeliveryCard.tsx`

**Tasks:**

1. Create base `DeliveryCard` component as a shared/reusable component
2. Implement card container with theme-aware styling
3. Add header section (icon, booking number, vehicle details)
4. Add status badge component
5. Use existing theme colors:
   - Background: `theme.surface`
   - Border: `theme.border`
   - Text: `theme.text`, `theme.textSecondary`
   - Primary: `BeeColors.yellow[400]`
   - Status colors: Use existing status badge colors
6. Design component to be reusable across:
   - Home screen (Recent Activity section)
   - History screen (Booking list)
   - Any other screens that display bookings

**Why Shared Component:**

- Delivery cards will be used in multiple screens (Home, History, potentially Explore/Bookings list)
- Maintains consistency across the app
- Single source of truth for card design
- Easier to maintain and update

**Estimated Time:** 1-2 hours

### Phase 2: Implement Active Delivery Card (In Transit)

**Files to Modify:**

- `shared/components/DeliveryCard.tsx`

**Tasks:**

1. Add timeline component with vertical dashed line
2. Implement pickup point (gray dot, uppercase label, address, time)
3. Implement dropoff point (primary color dot with shadow, uppercase label, address, estimated time)
4. Add "Track Live" button with dark background
5. Calculate estimated arrival time (15 mins from now or use scheduleDate)
6. Handle navigation to tracking screen

**Estimated Time:** 2-3 hours

### Phase 3: Implement Scheduled Card

**Files to Modify:**

- `shared/components/DeliveryCard.tsx`

**Tasks:**

1. Add calendar date/time box component
2. Implement location row with pickup and dropoff
3. Add dashed line between locations
4. Add "View Details" button with border style
5. Format scheduled date/time display
6. Handle truncation for long addresses

**Estimated Time:** 2-3 hours

### Phase 4: Implement Completed Card

**Files to Modify:**

- `shared/components/DeliveryCard.tsx`

**Tasks:**

1. Add completed state styling (reduced opacity)
2. Implement green checkmark with "Done" text
3. Format "Delivered Yesterday" or relative date text
4. Remove action buttons for completed state

**Estimated Time:** 1 hour

### Phase 5: Integrate Cards into Home Screen

**Files to Modify:**

- `app/(tabs)/index.tsx`

**Tasks:**

1. Import `DeliveryCard` from `@/shared/components/DeliveryCard`
2. Replace existing booking card displays with new `DeliveryCard` component
3. Map booking data to card props
4. Handle different card types based on booking status
5. Update Recent Activity section to use new cards
6. Test with real API data

**Estimated Time:** 2-3 hours

### Phase 5b: Integrate Cards into History Screen

**Files to Modify:**

- `app/(tabs)/history.tsx`

**Tasks:**

1. Import `DeliveryCard` from `@/shared/components/DeliveryCard`
2. Replace existing booking card displays with new `DeliveryCard` component
3. Map booking data to card props
4. Ensure consistent styling with home screen
5. Test with real API data

**Estimated Time:** 1-2 hours

### Phase 6: Add Cancelled Card State (Optional)

**Files to Modify:**

- `shared/components/DeliveryCard.tsx`

**Tasks:**

1. Add cancelled state styling
2. Show cancelled status indicator
3. Apply strikethrough or muted styling
4. Similar to completed but with different visual treatment

**Estimated Time:** 1 hour

## Component Structure

```typescript
interface DeliveryCardProps {
  booking: Booking;
  onTrack?: (bookingId: string) => void;
  onViewDetails?: (bookingId: string) => void;
}

// Card will automatically determine type based on booking.status:
// - "InProgress" → Active Delivery Card
// - "Pending" | "Assigned" | "Broadcasting" | "Confirmed" → Scheduled Card
// - "Completed" → Completed Card
// - "Cancelled" → Cancelled Card (optional)
```

## Theme Colors to Use

**From existing theme:**

- Primary: `BeeColors.yellow[400]` (#FFCD36)
- Primary Dark: `BeeColors.yellow[500]` (#eab308)
- Background: `theme.surface` (white in light, dark surface in dark)
- Border: `theme.border` (gray[200] in light, gray[700] in dark)
- Text: `theme.text`, `theme.textSecondary`
- Success: `BeeColors.green[600]` (#16a34a)
- Gray backgrounds: `BeeColors.gray[100]`, `BeeColors.gray[50]`

## Design Specifications

### Card Container

- Border radius: 16px (rounded-2xl)
- Padding: 16px
- Border: 1px solid theme.border
- Shadow: Subtle shadow for elevation
- Background: theme.surface

### Status Badges

- Border radius: 6px (rounded-md)
- Padding: 4px 10px (py-1 px-2.5)
- Font: Bold, uppercase, tracking-wider
- Font size: 12px (text-xs)

### Timeline

- Line: 2px dashed, vertical
- Pickup dot: 12px circle, gray border, empty
- Dropoff dot: 12px circle, primary color, with shadow effect
- Spacing: 24px between items (gap-6)

### Buttons

- Height: 40px (h-10)
- Border radius: 8px (rounded-lg)
- Font: Semibold, 14px (text-sm)
- Track Live: Dark background, white/primary text
- View Details: Border only, transparent background

## Dependencies

- Existing `Booking` type from `shared/types/booking.ts`
- Existing theme colors from `constants/theme.ts`
- Existing hooks: `useBookings`, `useTheme`
- Navigation: `useRouter` from expo-router

## Component Location

**Shared Component:** `shared/components/DeliveryCard.tsx`

**Why Shared:**

- Reusable across multiple screens (Home, History, etc.)
- Maintains design consistency
- Single source of truth for delivery card UI
- Follows feature-based architecture where shared UI components go in `shared/components/`

**Usage Examples:**

```typescript
// In Home Screen
import { DeliveryCard } from "@/shared/components/DeliveryCard";

// In History Screen
import { DeliveryCard } from "@/shared/components/DeliveryCard";

// Usage
<DeliveryCard
  booking={booking}
  onTrack={handleTrack}
  onViewDetails={handleViewDetails}
/>;
```

## Testing Considerations

1. Test with different booking statuses
2. Test with long addresses (truncation)
3. Test with missing data (weight, cargo description)
4. Test in light and dark modes
5. Test navigation to tracking/details screens
6. Test with empty bookings list

## Estimated Total Time

8-12 hours across all phases

## Notes

- Cards should be responsive and handle edge cases
- Use existing icon library (Ionicons) instead of Material Symbols
- Maintain accessibility (proper labels, touch targets)
- Follow existing code style and patterns
- Add JSDoc comments for all components and functions
