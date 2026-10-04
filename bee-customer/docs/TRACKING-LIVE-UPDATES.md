# Live Updates on the Tracking Screen

This document describes how real-time and refreshed data are implemented on the **Tracking** screen (`app/tracking.tsx`).

---

## Overview

The tracking screen uses **two mechanisms** for “live” data:

| Data | Mechanism | Purpose |
|------|------------|--------|
| **Driver location** (lat/lng) | **SignalR** (WebSocket) | Real-time position updates for the map |
| **Booking status, driver info, timeline** | **REST API + polling / focus refresh** | Booking details and tracking state |

---

## 1. Real-time driver location (SignalR)

### Flow

1. **Booking ID** comes from the route (`useLocalSearchParams<{ id: string }>()`).
2. **Booking data** is loaded via **`GET /api/bookings/:bookingId`** (`bookingService.getBookingById(id)` in `tracking.tsx`). The response is the **Booking DTO**, which includes **`selectedDriverId`** (and other driver fields such as driverName, driverVehicle, driverImageUrl).
3. **Driver ID** for SignalR is taken from the booking: **`driverId = booking?.selectedDriverId ?? undefined`**. When the booking has an assigned driver, that ID is passed to the SignalR hook; when there is no driver (e.g. Pending), `driverId` is `undefined` and no driver-specific filtering is applied.
4. **SignalR hook** is called with that driver ID:
   ```ts
   const driverId = booking?.selectedDriverId ?? undefined;
   const { latestUpdate: realTimeDriverLocation, isConnected: isSignalRConnected } =
     useSignalRLocationUpdates(driverId);
   ```
5. **Hub connection** (in `shared/hooks/useSignalR.ts`):
   - Builds a **single shared** `HubConnection` to `{API_URL}/hubs/location`.
   - Uses JWT from `tokenStorage.getAccessToken()` in `accessTokenFactory`.
   - After connect, the tracking screen **invokes** `JoinDriverGroup(driverId)` so the server sends updates only for that driver (when `driverId` is set from `booking.selectedDriverId`).
6. **Server pushes** location updates with event name **`ReceiveLocationUpdate`**.
7. **Payload** is normalized to `LocationUpdate`: `driverId`, `latitude`, `longitude`, optional `speed`, `heading`, `timestamp`.
8. The hook **filters** by `driverId` (if provided), keeps the **latest** update per driver in state, and exposes **`latestUpdate`** (and `isConnected`).
9. **Tracking screen** uses it for the map:
   - **Driver position:** `currentDriverLocation` is derived from `realTimeDriverLocation` (SignalR) with fallback to `trackingData.driverLocation` (REST).
   - That value is passed to `MapViewComponent` as `driverLocation` and used for the driver marker and route (e.g. driver → pickup or driver → dropoff).

### Relevant files

- **`app/tracking.tsx`**  
  - Fetches booking via `getBookingById(id)` (GET /api/bookings/:bookingId). Uses **`booking.selectedDriverId`** as `driverId` for `useSignalRLocationUpdates(driverId)`. Builds `currentDriverLocation` from `realTimeDriverLocation` / `trackingData.driverLocation`, passes it to the map.
- **`shared/hooks/useSignalR.ts`**  
  - Shared SignalR connection, `ReceiveLocationUpdate` handler, `JoinDriverGroup` / `LeaveDriverGroup`, `useSignalRLocationUpdates(driverId)` hook exposing `latestUpdate` and `isConnected`.

### Backend expectation

- **Hub URL:** `{API_URL}/hubs/location` (e.g. `https://api.mybeeapp.com/hubs/location`).
- **Auth:** Bearer token from `accessTokenFactory`.
- **Server methods:** Clients call `JoinDriverGroup(driverId)` and `LeaveDriverGroup(driverId)`.
- **Server event:** Server sends `ReceiveLocationUpdate` with an object containing at least `driverId`, `latitude`, `longitude`, and optionally `speed`, `heading`, `timestamp`.

---

## 2. Booking and tracking state (REST + refresh)

### useTracking (tracking data)

- **Hook:** `useTracking(id)` in `features/tracking/hooks/useTracking.ts`.
- **API:** `trackingService.getTrackingData(bookingId)` → REST (e.g. `GET /api/...` tracking endpoint).
- **Returns:** `trackingData` (status, steps, driver info, pickup/dropoff, optional static `driverLocation`), `isLoading`, `error`, `refresh()`.
- **When it runs:** On mount and when `bookingId` changes. **No** automatic polling inside the hook.

### Booking details

- **API:** `bookingService.getBookingById(id)` in `tracking.tsx`.
- **State:** `booking` (booking number, status, addresses, schedule, etc.), `isLoadingBooking`, `bookingError`.
- **When it runs:** On mount via `fetchBooking()`, and whenever the screen triggers a refresh (see below).

### When tracking and booking are refreshed

1. **On focus**  
   `useFocusEffect` runs when the user navigates to the tracking screen and calls:
   - `refreshTracking()` (re-fetches `trackingData`),
   - `fetchBooking()` (re-fetches `booking`).
2. **Every 30 seconds**  
   A `setInterval` in `tracking.tsx` (cleaned up on unmount) calls the same `refreshTracking()` and `fetchBooking()`.
3. **When app comes to foreground**  
   An `AppState.addEventListener('change', ...)` calls the same refresh when `nextAppState === 'active'`.

So **“live” booking/tracking state** is not true real-time; it’s **REST + refresh on focus, every 30s, and on app foreground**. Only **driver location** is real-time via SignalR.

---

## 3. How the map uses the data

- **Pickup / dropoff:** From `booking` or `trackingData` (coordinates and addresses).
- **Driver marker and route:** From `currentDriverLocation`:
  - Prefer **SignalR** `realTimeDriverLocation` when available.
  - Fallback to **REST** `trackingData.driverLocation` when SignalR has no update yet or is disconnected.
- **Booking status** (pending, assigned, on the way to pickup, etc.) is derived from `booking.status` (and fallback `trackingData.status`) and passed as `bookingStatus` to the map so it can draw the correct route (e.g. driver → pickup vs driver → dropoff).
- **Route ETA:** `MapViewComponent` calls `onRouteCalculated(distance, duration)`; the screen stores that in `routeETA` and shows it in the bottom sheet (e.g. “Arriving in …”).

---

## 4. Summary diagram

```
Tracking Screen (app/tracking.tsx)
│
├─ Route param: id (bookingId)
│
├─ fetchBooking()
│  └─ GET /api/bookings/:bookingId (bookingService.getBookingById(id))  →  booking (Booking DTO)
│     └─ booking.selectedDriverId  →  driverId for SignalR
│
├─ useSignalRLocationUpdates(driverId)
│  └─ SignalR hub: {API_URL}/hubs/location
│     ├─ JoinDriverGroup(driverId)   // when booking has selectedDriverId
│     └─ on('ReceiveLocationUpdate')  →  realTimeDriverLocation
│
├─ useTracking(id)
│  └─ trackingService.getTrackingData(id)  →  trackingData (REST)
│
├─ Refresh triggers
│  ├─ useFocusEffect  →  refreshTracking() + fetchBooking()
│  ├─ setInterval(30s)  →  refreshTracking() + fetchBooking()
│  └─ AppState 'active'  →  refreshTracking() + fetchBooking()
│
└─ Map
   ├─ driverLocation = realTimeDriverLocation ?? trackingData.driverLocation
   ├─ pickupLocation, dropoffLocation from booking / trackingData
   ├─ bookingStatus from booking.status / trackingData.status
   └─ onRouteCalculated  →  routeETA (distance, duration)
```

---

## 5. Optional: future real-time booking/status

The **tracking service** has a placeholder for subscribing to tracking updates:

- **`features/tracking/services/trackingService.ts`**  
  `subscribeToTracking(bookingId, callback)` is stubbed with a TODO (“Implement WebSocket or polling for real-time updates”) and returns a no-op unsubscribe.

Today, booking and tracking state stay “live” only via the **periodic and focus/foreground refresh** described above. Driver **location** is the only part that uses a real-time channel (SignalR).
