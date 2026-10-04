# Lalamove-Style Booking Implementation Plan

## Implementation Checklist (Steps 1 & 2 Only)

### Phase 1: Types and Service Layer
- [x] Add `BookingStop` interface to `shared/types/booking.ts` or `features/bookings/types.ts`
- [x] Add `CalculateFareRequest` interface
- [x] Add `CalculateFareResponse` / `PricingResult` interface (totalFare, distanceKm, breakdown, etc.)
- [x] Add `CreateLalamoveBookingRequest` interface (stops, estimatedFare, serviceType, etc.)
- [x] Add `calculateFare()` method to `features/bookings/services/bookingService.ts`
- [x] Add `createLalamoveBooking()` method to `features/bookings/services/bookingService.ts`
- [x] Map Lalamove create response to existing `Booking` type (legacy DTO shape)
- [x] Export new types from `features/bookings/index.ts`
- [x] Add `VehiclePricing` interface (vehicleType, types, baseFare, perKm0to5, perKmAbove5, additionalStopFee, weightLimitKg, sizeLimit, etc.)
- [x] Add `getVehiclePricing()` method to `features/bookings/services/bookingService.ts` (`GET /api/vehicle-pricing`, no auth)
- [x] Export `VehiclePricing` from `features/bookings/index.ts`

**Status:** ✅ Completed

---

### Phase 2: Hooks
- [x] Create `features/bookings/hooks/useVehiclePricing.ts` (TanStack Query: `GET /api/vehicle-pricing`) for vehicle-type dropdown
- [x] Create `features/bookings/hooks/useCalculateFare.ts` (TanStack Mutation)
- [x] Create `features/bookings/hooks/useCreateLalamoveBooking.ts` (TanStack Mutation)
- [ ] Optional: Create `useLalamoveBookingFlow.ts` to orchestrate calculate → show fare → create
- [x] Export new hooks from `features/bookings/index.ts`

**Status:** ✅ Completed

---

### Phase 3: UI Integration
- [x] Load vehicle types from `GET /api/vehicle-pricing` (e.g. via `useVehiclePricing`); **do not** hardcode vehicle type enum
- [x] Vehicle dropdown: display label = `types`, value = `vehicleType`; send `vehicleType` in calculate-fare and lalamove
- [x] Update `app/booking.tsx` to support multi-stop entry (1 pickup + 0–19 dropoffs) or add new flow entry point
- [x] Validate required fields for calculate-fare (vehicle type from API, 1 pickup + ≥1 dropoff, address per stop); auto-trigger calculate-fare when valid (with debounce 300–500 ms), show totalFare (and optional distanceKm/breakdown)
- [x] Add “Confirm & create” step: call lalamove with same stops + estimatedFare + cargoDescription, scheduleDate, serviceType
- [x] Handle loading and error states for both steps
- [x] Preserve existing single pickup/dropoff flow or migrate to Lalamove flow (product decision)
- [x] Safe area and theme compliance for any new screens

**Status:** ✅ Completed

---

## Overall Progress

**Completed Phases:** 3 / 3  
**Current Phase:** —  
**Next Phase:** —  
**Overall Status:** ⏳ Not Started

**Scope:** This plan covers **Step 1 (calculate-fare)** and **Step 2 (create booking / lalamove)** only. Steps 3 (available drivers) and 4 (select driver) are out of scope and can be planned separately.

---

## Overview

This document outlines the implementation plan for integrating the **Lalamove-style multi-step booking flow** into the Bee Customer app. The flow is: **calculate fare** (one request with all stops) → **create booking** (same stops + estimated fare). Optional steps (get available drivers, select driver) are not included in this plan.

**Reference:** API contract is documented in `docs/lalamove-booking-api.md`.

---

## Current State Analysis

### Existing Implementation

**Current booking flow:**
- Single pickup + single dropoff form on `app/booking.tsx`
- `features/bookings/services/bookingService.ts`: `createBooking()` using legacy payload (pickupLocation, dropoffLocation, truckType, etc.)
- `features/bookings/types.ts`: `CreateBookingRequest` (single pickup/dropoff)
- `shared/types/booking.ts`: `Booking`, `TruckType`, etc.

**Existing API usage:**
- `GET /api/bookings/my-bookings` – list user bookings ✅
- `POST /api/bookings` – create booking (legacy single pickup/dropoff) ✅

### New API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|--------|
| `GET /api/vehicle-pricing` | None (AllowAnonymous) | List available vehicle types for dropdown |
| `GET /api/vehicle-pricing/vehicle-type/{vehicleType}` | None | Get pricing for one vehicle type (optional) |
| `POST /api/bookings/calculate-fare` | Bearer | Get estimated fare for a route (all stops) |
| `POST /api/bookings/lalamove` | Bearer | Create booking with stops and estimated fare |

**Vehicle types:** Vehicle types are **not** a fixed enum. They come from `GET /api/vehicle-pricing`. Each item has `vehicleType` (value to send in calculate-fare and lalamove) and `types` (display label). The UI must load this list and use it for the vehicle dropdown; do **not** hardcode vehicle type options.

---

## Implementation Phases (Detail)

### Phase 1: Type Definitions and Service Layer

**Objective:** Add types and service methods for calculate-fare and create Lalamove booking.

**Tasks:**

1. **Add stop and request/response types**  
   - **Stop shape:** `sequence`, `address`, `type` ("Pickup" | "Dropoff"), optional `latitude`, `longitude`, `contactName`, `contactPhone`, `notes`.  
   - **CalculateFareRequest:** `vehicleType`, `stops`, optional `weightKg`, `priorityFee`, `scheduledDateTime`.  
   - **CalculateFareResponse / PricingResult:** `totalFare`, optional `baseFare`, `distanceFare`, `multiStopFee`, `weightSurcharge`, `priorityFee`, `distanceKm`, `breakdown`.  
   - **CreateLalamoveBookingRequest:** `vehicleType`, `cargoDescription`, `scheduleDate`, `serviceType`, `stops`, `estimatedFare`; optional `customerId`, `weightKg`, `priorityFee`, `notes`, etc.  
   - Place in `shared/types/booking.ts` (if used across features) or `features/bookings/types.ts` (if booking-feature only). Export from feature `index.ts` if other features need them.

2. **Update `features/bookings/services/bookingService.ts`**  
   - **`calculateFare(payload: CalculateFareRequest): Promise<PricingResult>`**  
     - `POST /api/bookings/calculate-fare` with auth.  
     - Return `data` (totalFare, distanceKm, breakdown, etc.).  
   - **`createLalamoveBooking(payload: CreateLalamoveBookingRequest): Promise<Booking>`**  
     - `POST /api/bookings/lalamove` with auth.  
     - Map response `data` to existing `Booking` type (legacy DTO: pickupLocation, dropoffLocation, truckType, etc.); backend does not return `stops` in response.

3. **Vehicle pricing (vehicle types)**  
   - **`VehiclePricing` type:** Fields from API: `vehicleType` (string, value for API), `types` (string, display label), `baseFare`, `perKm0to5`, `perKmAbove5`, `additionalStopFee`, `weightLimitKg`, `sizeLimit`, and any other fields the API returns.  
   - **`getVehiclePricing(): Promise<VehiclePricing[]>`** in `bookingService`: `GET /api/vehicle-pricing`, **no auth** (`requiresAuth: false`). Return array of vehicle pricings. Unwrap nested `{ success, data }` if present.  
   - Export `VehiclePricing` from `features/bookings/index.ts`.

4. **Error handling**  
   - Use existing `apiClient` error handling; surface validation/error messages from API in hooks/UI.

**Files to create/modify:**
- `shared/types/booking.ts` or `features/bookings/types.ts`
- `features/bookings/services/bookingService.ts`
- `features/bookings/index.ts` (exports)

**Estimated time:** 2–3 hours (plus ~30 min for vehicle pricing)

---

### Phase 2: Hooks

**Objective:** Expose vehicle pricing, calculate-fare, and create Lalamove booking via TanStack Query.

**Tasks:**

1. **Create `features/bookings/hooks/useVehiclePricing.ts`**  
   - `useQuery` that calls `bookingService.getVehiclePricing()`.  
   - Returns list of vehicle types for the dropdown. Cache so it’s called once per session (or on booking screen mount).  
   - Used by UI to populate vehicle dropdown: display `types`, value `vehicleType`.

2. **Create `features/bookings/hooks/useCalculateFare.ts`**  
   - `useMutation` that calls `bookingService.calculateFare`.  
   - Input: request payload (vehicleType, stops, optional weightKg, priorityFee, scheduledDateTime).  
   - Return: mutation (mutate, mutateAsync), `data` (PricingResult), `isPending`, `error`, `reset`.  
   - Used to get `totalFare` (and optionally distanceKm/breakdown) before creating booking.

2. **Create `features/bookings/hooks/useCreateLalamoveBooking.ts`**  
   - `useMutation` that calls `bookingService.createLalamoveBooking`.  
   - Input: CreateLalamoveBookingRequest (stops, estimatedFare, cargoDescription, scheduleDate, serviceType, etc.).  
   - Return: mutation, `data` (Booking), `isPending`, `error`, `reset`.  
   - On success, can invalidate my-bookings query and/or navigate to booking detail or list.

3. **Optional: `useLalamoveBookingFlow.ts`**  
   - Orchestrates: run calculate-fare → store result → on confirm, run create Lalamove with same stops + `estimatedFare: totalFare`.  
   - Can hold stops, vehicleType, and fare result in state and expose “calculate”, “create” actions and current step (calculating / showing fare / creating).

4. **Export hooks** from `features/bookings/index.ts`.

**Files to create:**
- `features/bookings/hooks/useCalculateFare.ts`
- `features/bookings/hooks/useCreateLalamoveBooking.ts`
- Optionally `features/bookings/hooks/useLalamoveBookingFlow.ts`
- Update `features/bookings/index.ts`

**Estimated time:** 2–3 hours

---

### Phase 3: UI Integration

**Objective:** Allow user to enter multi-stop route, see fare, then create Lalamove booking.

**When to trigger calculate-fare**

- **Trigger:** **Automatic** when all required fields for calculate-fare are valid (no “Get fare” button required).
- **Required for calculate-fare:**  
  - **Vehicle type** selected.  
  - **Stops:** exactly 1 pickup + at least 1 dropoff.  
  - **Each stop:** `address` filled (lat/long optional per API).  
- **When it runs:** Once the above are satisfied, call calculate-fare **once** for the full route. Use a **short debounce** (e.g. 300–500 ms) after the last change so we don’t fire while the user is still typing the last address.
- **Re-run:** If the user later changes stops or vehicle type (or other fare inputs), re-validate and trigger calculate-fare again (with the same debounce) so the displayed fare stays in sync.
- **After** calculate-fare returns: show `totalFare` (and optionally `distanceKm` / `breakdown`), and enable **“Confirm & book”** which calls create Lalamove with the same stops and `estimatedFare: totalFare`. If required fields become invalid (e.g. address cleared), clear or hide the fare and disable confirm until valid again.

**Tasks:**

1. **Vehicle type dropdown**  
   - Load options from `useVehiclePricing()` (from Phase 2).  
   - Display label = each item’s **`types`**; value = **`vehicleType`**.  
   - Do **not** hardcode vehicle types (e.g. Van, Truck); they come from the API and can change (admin config).

2. **Stops entry**  
   - Support 1 pickup + 0–19 dropoffs (same structure as API).  
   - Reuse or extend existing location search/map (e.g. `useLocationSearch`, map pins) for each stop.  
   - Enforce exactly one Pickup; rest Dropoff.  
   - Validate at least one stop, max 20, before calling calculate-fare.

3. **Calculate fare step**  
   - When required fields are valid (vehicle type, 1 pickup + ≥1 dropoff, address per stop), auto-call `useCalculateFare` with vehicleType + stops (+ optional weightKg, priorityFee, scheduledDateTime). Use debounce (e.g. 300–500 ms) after last change.  
   - Show `totalFare` and optionally `distanceKm` / `breakdown`; handle loading and error.

4. **Create booking step**  
   - User taps “Confirm & book” (or equivalent).  
   - Call `useCreateLalamoveBooking` with same stops, `estimatedFare: totalFare`, plus `cargoDescription`, `scheduleDate`, `serviceType`, and other required/optional fields.  
   - On success: show success state, invalidate my-bookings, navigate to booking detail or list.  
   - Handle loading and error (e.g. validation, conflict).

5. **Product/UX decisions**  
   - Whether to replace current single pickup/dropoff flow with Lalamove flow or add Lalamove as an alternative path.  
   - Whether to keep existing `POST /api/bookings` for simple bookings or migrate all creates to Lalamove.

6. **Compliance**  
   - Safe area insets on all new/full-screen UI.  
   - Theme (light/dark) and existing design system.

**Files to modify:**
- `app/booking.tsx` (or new screen(s) for Lalamove flow)
- Possibly new components under `features/bookings/components/` for stop list, fare summary, etc.

**Estimated time:** 4–6 hours (depends on UX scope)

---

## Out of Scope (Future Work)

- **Step 3:** `GET /api/bookings/{bookingId}/available-drivers` – list available drivers.  
- **Step 4:** `POST /api/bookings/{bookingId}/select-driver` – select driver for booking.  
These can be documented in the same API doc and implemented in a later plan.

---

## Dependencies

- **API:** Backend must expose `POST /api/bookings/calculate-fare` and `POST /api/bookings/lalamove` as described in `docs/lalamove-booking-api.md`.  
- **Auth:** All requests use Bearer token (existing `apiClient` and auth flow).  
- **Existing:** `apiClient`, `bookingService` patterns, `shared/types/booking.ts`, `app/booking.tsx`.

---

## Related Docs

- **Lalamove API (Steps 1 & 2):** `docs/lalamove-booking-api.md`
- **API client & TanStack Query:** `docs/API.md`
- **Registration / Auth:** `docs/registration-api.md`
