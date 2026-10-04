# Tracking Screen: Booking API and SignalR Driver ID Plan

## Overview

This document defines the plan for (1) using **GET /api/bookings/:bookingId** as the source of booking information on the tracking screen, and (2) using the booking’s **SelectedDriverId** as the driver ID for SignalR real-time location updates.

## Objectives

1. Use **GET /api/bookings/:bookingId** as the single source of truth for booking data on the tracking screen.
2. Add **SelectedDriverId** (and related driver fields) to the Booking type and API mapping.
3. Pass **SelectedDriverId** from the fetched booking into SignalR so live driver location updates are scoped to the assigned driver.
4. **Home screen:** Show driver name and vehicle info on booking/delivery cards when the booking has an assigned driver (from Booking DTO).
5. **Tracking screen drawer:** Display driver info (name, vehicle, plate, and image from **DriverImageUrl**) in the driver card; derive from booking when available.
6. **Tracking screen progress bar:** Derive progress from **booking status** (e.g. DriverAssigned → “Pickup”, PickedUp/InProgress → “On the Way”, Completed → “Delivered”).

## Current State

- **Tracking screen** already loads booking details via `bookingService.getBookingById(id)`, which calls **GET /api/bookings/:id**.
- **SignalR**: `useSignalRLocationUpdates(driverId)` is used in tracking, but `driverId` is currently hardcoded to `undefined`, so no driver-specific updates are received.
- **Booking type**: Does not yet include `selectedDriverId` or other driver fields from the API (e.g. DriverName, DriverPhone, DriverAssignedAt, etc.).

## API Contract

### GET /api/bookings/:bookingId

- **Purpose**: Return a single booking by ID (used for tracking and detail views).
- **Auth**: Required (JWT).
- **Response**: **Booking DTO** – the API returns the backend Booking DTO. The frontend `Booking` type in `shared/types/booking.ts` should mirror this DTO so that responses from this endpoint map 1:1 to the `Booking` interface.
- **Booking DTO** is expected to include (among other fields):
  - **SelectedDriverId** (Guid?, nullable) – ID of the driver assigned to this booking. Used as the SignalR driver ID for location updates.
  - Other driver fields (as defined on the DTO): e.g. DriverName, DriverPhone, DriverAssignedAt, DriverVehicle, DriverPlate, DriverVehicleColor, DriverVehicleModel, DriverImageUrl.

## Implementation Phases

### Phase 1: Booking type and API mapping ✅ Done

**Goal:** Align the frontend `Booking` type with the backend **Booking DTO** returned by GET /api/bookings/:bookingId, and ensure `mapApiBookingToBooking` maps all relevant DTO fields (including SelectedDriverId and other driver fields).

**Tasks:**

1. **Update `shared/types/booking.ts`**
   - Add optional driver-related fields to the `Booking` interface:
     - `selectedDriverId: string | null` (Guid from API)
     - Optionally: `driverName`, `driverPhone`, `driverAssignedAt`, `driverVehicle`, `driverPlate`, `driverVehicleColor`, `driverVehicleModel`, `driverImageUrl` (all optional/nullable as per API).
   - Keep existing legacy fields (e.g. `driverId`) for backward compatibility if still used elsewhere; align naming with API (e.g. `selectedDriverId` for the new field).

2. **Update `features/bookings/services/bookingService.ts`**
   - In `mapApiBookingToBooking()`, map from API response:
     - `SelectedDriverId` → `selectedDriverId` (normalize Guid to string or null).
     - Map any other driver fields the API returns to the new Booking properties.
   - Ensure `getBookingById()` continues to use this mapper so GET /api/bookings/:bookingId responses are consistent with the rest of the app.

**Files:**

- `shared/types/booking.ts`
- `features/bookings/services/bookingService.ts`

**Dependencies:** None.

**Estimated complexity:** Low–Medium.

---

### Phase 2: Tracking screen – use booking as source of truth and pass SelectedDriverId to SignalR ✅ Done

**Goal:** Tracking screen relies on the booking returned by GET /api/bookings/:bookingId and uses `booking.selectedDriverId` as the SignalR driver ID.

**Tasks:**

1. **Single source of truth for booking**
   - Ensure the tracking screen uses **only** the booking data from `bookingService.getBookingById(id)` (i.e. GET /api/bookings/:bookingId). Remove or avoid any other source of “booking” data for the same screen that could override or conflict with this API.
   - Keep existing flow: fetch booking by `id` (from route params) on mount and when needed (e.g. focus), store in state, and derive all displayed booking info from that state.

2. **SignalR driver ID from booking**
   - After booking is successfully loaded, derive the driver ID from the booking:
     - `driverId = booking?.selectedDriverId ?? undefined`
   - Pass this `driverId` into `useSignalRLocationUpdates(driverId)`.
   - Handle timing: booking is loaded asynchronously, so `driverId` may be `undefined` until the first fetch completes. The hook already supports `driverId` changing (e.g. leave/join driver group when `driverId` updates), so no hook changes are required beyond passing the value from booking state.

3. **Edge cases**
   - If the API does not return a driver for the booking (e.g. Pending, no assignment), `selectedDriverId` will be null → `driverId` stays `undefined` → SignalR will not filter by driver (or will receive no updates for a specific driver). This is acceptable.
   - If the user navigates away before booking loads, no need to join a driver group.

**Files:**

- `app/tracking.tsx`

**Dependencies:** Phase 1 (Booking type and mapper include `selectedDriverId`).

**Estimated complexity:** Low.

---

### Phase 2b: Tracking screen drawer – driver info and progress bar ✅ Done

**Goal:** Show driver info in the drawer from the booking DTO and make the progress bar reflect booking status.

**Tasks:**

1. **Driver card in drawer**
   - Use booking driver fields when available: `driverName`, `driverVehicle`, `driverPlate`, `driverImageUrl`, `driverPhone`.
   - If `booking.driverImageUrl` is present, display the driver image (e.g. via `Image`/`expo-image` with `source={{ uri: booking.driverImageUrl }}`). Otherwise keep the existing placeholder (e.g. person icon).
   - Show driver name, vehicle, and plate (and optional phone). Fall back to `trackingData?.driver` only if booking driver fields are empty.

2. **Progress bar**
   - Derive **current step** and **progress %** from **booking status** (not only from `trackingData.steps`):
     - **Placed** (step 0): Pending, Assigned, Broadcasting, Confirmed.
     - **Pickup** (step 1): DriverAssigned, Dispatched (driver assigned / picking up).
     - **On the Way** (step 2): PickedUp, InProgress (in transit).
     - **Delivered** (step 3): Completed.
   - Progress bar UI: same four steps; fill and current step come from this status-based index. Progress % = (currentStepIndex / 3) × 100.

**Files:**

- `app/tracking.tsx`

**Dependencies:** Phase 1.

**Estimated complexity:** Low–Medium.

---

### Phase 2c: Home screen – driver name and vehicle on cards ✅ Done

**Goal:** Show driver name and vehicle info on delivery/booking cards when the booking has an assigned driver (from Booking DTO).

**Tasks:**

1. **Update `shared/components/DeliveryCard.tsx`**
   - When the booking has `driverName` or `driverVehicle` (from Booking DTO), display them on the card (e.g. under the booking number or vehicle details): e.g. “Driver: {driverName}” and “{driverVehicle}” (and optionally plate).
   - Apply for both **Active Delivery** and **Scheduled** (and optionally **Completed**) card variants so driver info is visible wherever the DTO provides it.

**Files:**

- `shared/components/DeliveryCard.tsx`

**Dependencies:** Phase 1 (Booking type includes driver fields; my-bookings or getBookingById returns them).

**Estimated complexity:** Low.

---

### Phase 3: Documentation and verification ✅ Done

**Tasks:**

1. Update any relevant docs (e.g. `docs/API.md`, `docs/TRACKING-LIVE-UPDATES.md`) to state:
   - Tracking screen uses GET /api/bookings/:bookingId for booking data.
   - SignalR driver ID is taken from `booking.selectedDriverId`.
2. Verification checklist (manual):
   - Opening a tracking screen for a booking with an assigned driver: driver ID should appear in logs (if logging is enabled), and SignalR should join the correct driver group.
   - When the booking has no driver (e.g. Pending), no driver-specific SignalR filtering is applied (`driverId` is `undefined`).

**Files updated:**

- `docs/API.md` – noted that tracking uses `getBookingById` and `booking.selectedDriverId` for SignalR.
- `docs/TRACKING-LIVE-UPDATES.md` – flow and diagram updated: booking from GET /api/bookings/:bookingId, driver ID from `booking.selectedDriverId`.

**Dependencies:** Phase 2.

**Estimated complexity:** Low.

---

## Summary

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Add `selectedDriverId` and driver fields to Booking type; map them in `mapApiBookingToBooking` for GET /api/bookings/:bookingId. |
| 2 | ✅ Done | Tracking: use booking as source of truth and pass `booking?.selectedDriverId` to `useSignalRLocationUpdates`. |
| 2b | ✅ Done | Tracking drawer: show driver info (name, vehicle, plate, image from DriverImageUrl); progress bar derived from booking status (Placed → Pickup → On the Way → Delivered). |
| 2c | ✅ Done | Home: show driver name and vehicle on DeliveryCard when booking has driver info. |
| 3 | ✅ Done | Update docs and verify behavior. |

## Out of scope (for this plan)

- Changes to the SignalR hub or backend API.
- Other screens that use booking data (they can adopt the same type/mapper as needed).
