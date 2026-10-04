# Architecture Migration & API Integration Plan

## Overview

This plan outlines the migration of the codebase to a feature-based architecture and the implementation of API integration with automatic token injection. The migration will reorganize existing code to follow the strict architectural rules defined in `.cursorrules`.

## Objectives

1. **Reorganize codebase** to follow feature-based architecture
2. **Create shared infrastructure** for API client and token management
3. **Establish booking feature** with proper structure
4. **Implement API integration** with automatic token injection
5. **Apply all coding rules** (comments, safe areas, TypeScript strict mode)
6. **Maintain backward compatibility** during migration

## Current State Analysis

### Existing Structure

```
components/          # Mixed: UI primitives + feature-specific components
constants/
  ├── theme.ts      # Theme constants
  └── types.ts       # Booking types (should be in shared/types/)
app/                 # Routes (correct location)
hooks/               # Shared hooks (should be in shared/hooks/)
```

### Issues Identified

1. **Components mixed**: UI primitives (BeeButton, themed-\*) mixed with feature-specific (BookingCard, StatusBadge)
2. **Types location**: Booking types in `constants/types.ts` instead of `shared/types/`
3. **No features directory**: Feature-based architecture not implemented
4. **No shared/services**: API infrastructure missing
5. **Missing comments**: Some components lack proper JSDoc comments
6. **No API integration**: No token management or API client

## Target Architecture

```
app/                    # Routes (Expo Router) - screens only
features/               # Feature modules (business domains)
  └── bookings/        # Booking feature
      ├── components/  # BookingCard, StatusBadge
      ├── services/    # Booking API service
      ├── hooks/       # useBookings, useBookingStats
      ├── types.ts     # Booking-specific types
      └── index.ts     # Public API exports
shared/                 # Shared across features
  ├── components/      # UI primitives (BeeButton, StatsCard, themed-*)
  ├── hooks/           # Shared hooks (use-color-scheme, etc.)
  ├── services/        # Base services (API client, token storage)
  ├── types/           # Common types (api.ts, base types)
  └── constants/       # Theme, config
context/                # Global context providers
  └── AuthContext.tsx  # Auth context (if needed)
```

## Implementation Phases

### Phase 1: Create Shared Infrastructure Foundation

**Objective**: Set up base shared services and types structure

**Tasks**:

1. Create `shared/services/` directory
2. Create `shared/types/api.ts` with common API types
3. Create `shared/services/tokenStorage.ts` - Secure token storage wrapper
4. Create `shared/services/apiClient.ts` - Base API client with auto token injection
5. Move `hooks/` to `shared/hooks/` and update imports
6. Create `shared/constants/` and move theme.ts there (or keep in constants/ if preferred)

**Files to Create**:

- `shared/types/api.ts`
- `shared/services/tokenStorage.ts`
- `shared/services/apiClient.ts`

**Files to Move**:

- `hooks/*` → `shared/hooks/*`

**Dependencies**: None

**Estimated Complexity**: Medium

---

### Phase 2: Create Auth Feature with Token Management

**Objective**: Implement authentication feature with token management

**Tasks**:

1. Create `features/auth/` directory structure
2. Create `features/auth/services/tokenService.ts` - Token management logic
3. Create `features/auth/types.ts` - Auth-specific types
4. Create `features/auth/index.ts` - Public API exports
5. Integrate token service with API client
6. Create auth context provider (if needed)

**Files to Create**:

- `features/auth/services/tokenService.ts`
- `features/auth/types.ts`
- `features/auth/index.ts`
- `context/AuthContext.tsx` (optional, if using context)

**Dependencies**: Phase 1 (API client, token storage)

**Estimated Complexity**: Medium

---

### Phase 3: Reorganize Components - UI Primitives to Shared

**Objective**: Move reusable UI components to shared/components

**Tasks**:

1. Create `shared/components/` directory
2. Move UI primitives to `shared/components/`:
   - `BeeButton.tsx` → `shared/components/BeeButton.tsx`
   - `StatsCard.tsx` → `shared/components/StatsCard.tsx`
   - `themed-text.tsx` → `shared/components/themed-text.tsx`
   - `themed-view.tsx` → `shared/components/themed-view.tsx`
   - `external-link.tsx` → `shared/components/external-link.tsx`
   - `ui/` folder → `shared/components/ui/`
3. Update all imports across the codebase
4. Add proper JSDoc comments to all moved components

**Files to Move**:

- `components/BeeButton.tsx` → `shared/components/BeeButton.tsx`
- `components/StatsCard.tsx` → `shared/components/StatsCard.tsx`
- `components/themed-text.tsx` → `shared/components/themed-text.tsx`
- `components/themed-view.tsx` → `shared/components/themed-view.tsx`
- `components/external-link.tsx` → `shared/components/external-link.tsx`
- `components/ui/*` → `shared/components/ui/*`
- `components/haptic-tab.tsx` → `shared/components/haptic-tab.tsx` (if shared)
- `components/parallax-scroll-view.tsx` → `shared/components/parallax-scroll-view.tsx` (if shared)
- `components/hello-wave.tsx` → Remove or move to shared if used

**Dependencies**: None

**Estimated Complexity**: Low-Medium (many import updates)

---

### Phase 4: Create Bookings Feature

**Objective**: Establish bookings feature with proper structure

**Tasks**:

1. Create `features/bookings/` directory structure
2. Move `constants/types.ts` → `shared/types/booking.ts` (common types)
3. Create `features/bookings/types.ts` for booking-specific types
4. Move feature-specific components:
   - `BookingCard.tsx` → `features/bookings/components/BookingCard.tsx`
   - `StatusBadge.tsx` → `features/bookings/components/StatusBadge.tsx`
5. Create `features/bookings/services/bookingService.ts` - Booking API service
6. Create `features/bookings/hooks/useBookings.ts` - Bookings hook
7. Create `features/bookings/hooks/useBookingStats.ts` - Stats hook
8. Create `features/bookings/index.ts` - Public API exports
9. Update all imports across the codebase
10. Add proper JSDoc comments to all components and services

**Files to Create**:

- `shared/types/booking.ts` (common booking types)
- `features/bookings/types.ts` (feature-specific types)
- `features/bookings/components/BookingCard.tsx`
- `features/bookings/components/StatusBadge.tsx`
- `features/bookings/services/bookingService.ts`
- `features/bookings/hooks/useBookings.ts`
- `features/bookings/hooks/useBookingStats.ts`
- `features/bookings/index.ts`

**Files to Move**:

- `components/BookingCard.tsx` → `features/bookings/components/BookingCard.tsx`
- `components/StatusBadge.tsx` → `features/bookings/components/StatusBadge.tsx`
- `constants/types.ts` → Split into `shared/types/booking.ts` and `features/bookings/types.ts`

**Dependencies**: Phase 1 (API client), Phase 3 (shared components)

**Estimated Complexity**: Medium-High (feature structure + API integration)

---

### Phase 5: Update App Screens to Use New Architecture

**Objective**: Update all app screens to use feature-based imports

**Tasks**:

1. Update `app/(tabs)/index.tsx` - Dashboard screen
2. Update `app/(tabs)/explore.tsx` - Bookings screen
3. Update `app/booking.tsx` - Booking creation screen
4. Update `app/tracking.tsx` - Tracking screen
5. Replace mock data with API calls using hooks
6. Ensure all screens follow safe area rules
7. Add proper comments to all screens

**Files to Update**:

- `app/(tabs)/index.tsx`
- `app/(tabs)/explore.tsx`
- `app/booking.tsx`
- `app/tracking.tsx`

**Dependencies**: Phase 4 (bookings feature)

**Estimated Complexity**: Medium

---

### Phase 6: Code Quality & Documentation

**Objective**: Apply all coding rules and ensure documentation

**Tasks**:

1. Add JSDoc comments to all functions, components, hooks, and services
2. Ensure all TypeScript types are properly defined (no `any`)
3. Verify safe area handling on all screens
4. Add inline comments for complex logic
5. Create `docs/API.md` documenting API client usage
6. Update `README.md` with new architecture structure

**Files to Update**:

- All files created/moved in previous phases
- `README.md`
- Create `docs/API.md`

**Dependencies**: All previous phases

**Estimated Complexity**: Low-Medium (thorough review)

---

## File Structure After Migration

```
app/
  ├── _layout.tsx
  ├── (tabs)/
  │   ├── _layout.tsx
  │   ├── index.tsx
  │   └── explore.tsx
  ├── booking.tsx
  ├── tracking.tsx
  └── modal.tsx

features/
  └── bookings/
      ├── components/
      │   ├── BookingCard.tsx
      │   └── StatusBadge.tsx
      ├── hooks/
      │   ├── useBookings.ts
      │   └── useBookingStats.ts
      ├── services/
      │   └── bookingService.ts
      ├── types.ts
      └── index.ts

shared/
  ├── components/
  │   ├── BeeButton.tsx
  │   ├── StatsCard.tsx
  │   ├── themed-text.tsx
  │   ├── themed-view.tsx
  │   ├── external-link.tsx
  │   ├── haptic-tab.tsx
  │   └── ui/
  ├── hooks/
  │   ├── use-color-scheme.ts
  │   └── use-theme-color.ts
  ├── services/
  │   ├── apiClient.ts
  │   └── tokenStorage.ts
  ├── types/
  │   ├── api.ts
  │   └── booking.ts
  └── constants/
      └── theme.ts (or keep in root constants/)

context/
  └── AuthContext.tsx (optional)

constants/
  └── theme.ts (if not moved to shared/constants/)
```

## Import Pattern Examples

### Before (Current)

```typescript
import { BookingCard } from "@/components/BookingCard";
import { BeeButton } from "@/components/BeeButton";
import { Booking } from "@/constants/types";
```

### After (Target)

```typescript
// From feature (always use index.ts)
import { BookingCard, useBookings } from "@/features/bookings";

// From shared (direct import)
import { BeeButton } from "@/shared/components/BeeButton";
import type { Booking } from "@/shared/types/booking";
```

## API Client Usage Example

```typescript
import { apiClient } from "@/shared/services/apiClient";
import { useAuth } from "@/features/auth";

// Automatic token injection
const response = await apiClient.get<Booking[]>("/api/bookings");
const booking = await apiClient.post<Booking>("/api/bookings", bookingData);
```

## Risk Assessment

### Low Risk

- Moving UI primitives to shared (straightforward)
- Creating shared infrastructure

### Medium Risk

- Updating all imports (many files, but straightforward)
- Creating bookings feature structure

### High Risk

- Breaking existing functionality during migration
- Missing import updates causing runtime errors

### Mitigation Strategies

1. **Incremental migration**: One phase at a time with testing
2. **Import updates**: Use IDE refactoring tools where possible
3. **Testing**: Verify each phase before proceeding
4. **Backup**: Ensure code is committed before major changes

## Timeline Estimate

- **Phase 1**: 1-2 hours
- **Phase 2**: 1-2 hours
- **Phase 3**: 1-2 hours
- **Phase 4**: 2-3 hours
- **Phase 5**: 1-2 hours
- **Phase 6**: 1-2 hours

**Total Estimated Time**: 7-13 hours

## Success Criteria

1. ✅ All code follows feature-based architecture
2. ✅ API client with automatic token injection working
3. ✅ All imports use correct paths (features via index.ts, shared direct)
4. ✅ All components have proper JSDoc comments
5. ✅ All screens handle safe areas correctly
6. ✅ No TypeScript errors (strict mode)
7. ✅ No runtime errors from import issues
8. ✅ Code is testable and maintainable

## Notes

- Keep `constants/theme.ts` in root if it's used by both shared and app code
- Consider creating a migration script to help with import updates
- Test each phase thoroughly before proceeding
- Document any deviations from the plan
