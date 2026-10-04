# Tracking Screen – Side Effects and Race Condition Notes

This document notes the side effects in **`app/tracking.tsx`** and highlights those that touch the same data. When changing this file, check that overlapping effects cannot cause race conditions or stale state.

---

## 1. Inventory of side effects

There are **9 side-effect hooks** in `app/tracking.tsx` (8 `useEffect`, 1 `useFocusEffect`).

| # | Line (approx) | Hook | What it does | Data read/written |
|---|----------------|------|----------------|--------------------|
| 1 | 74 | `useEffect` | Pulsating animation when broadcasting | Animation only |
| 2 | 172 | `useEffect` | Debug log (bookingId, driverId) | Read-only log |
| 3 | 177 | `useEffect` | Debug log (SignalR connection) | Read-only log |
| 4 | 185 | `useEffect` | Persist driver location on SignalR update | **Writes** `driverLocationStorage` |
| 5 | 218 | `useEffect` | Fetch booking on mount | **Calls** `fetchBooking()` → **writes** `booking`, `bookingError`, `isLoadingBooking` |
| 6 | 226 | `useFocusEffect` | On focus: refresh + fetch + load persisted location | **Calls** `refreshTracking()`, `fetchBooking()`, `getLastDriverLocation()` → **writes** `booking`, `trackingData` (via hook), `persistedDriverLocation` |
| 7 | 247 | `useEffect` | 30s interval: refresh + fetch | **Calls** `refreshTracking()`, `fetchBooking()` → same as above |
| 8 | 274 | `useEffect` | AppState 'active': refresh + fetch | **Calls** `refreshTracking()`, `fetchBooking()` → same as above |
| 9 | 418 | `useEffect` | Auto-update booking status to InProgress | **Calls** `updateBookingStatus()` → **writes** `booking` via `setBooking(updatedBooking)` |

---

## 2. Shared data and overlapping writers

These pieces of state are written by more than one effect or by async callbacks. That is where race conditions are most likely.

### 2.1 Booking state (`booking`, `bookingError`, `isLoadingBooking`)

- **Written by**
  - **fetchBooking()** (used in effects 5, 6, 7, 8): sets `booking`, `bookingError`, `isLoadingBooking`.
  - **Effect 9**: `setBooking(updatedBooking)` after `updateBookingStatus()`.

- **Risk**
  - **Stale response**: User focuses screen (effect 6) and AppState goes active (effect 8) close together → two `fetchBooking()` in flight. Whichever finishes last wins; if the first response is older, it can overwrite newer data.
  - **Status vs fetch**: Effect 9 runs when `getEffectiveBookingStatus === "InProgress"` and updates status via API then `setBooking(updatedBooking)`. If, at the same time, effect 6/7/8 runs `fetchBooking()` and completes after the update, `setBooking(bookingData)` can overwrite the result of the status update (or the opposite), depending on order of completion.
  - **Loading state**: Multiple concurrent `fetchBooking()` calls both set `setIsLoadingBooking(true)` at start and `false` in `finally`; order of completion can make loading flicker or end at the wrong time.

### 2.2 Tracking data (from `useTracking(id)` – `trackingData`)

- **Written by**
  - **refreshTracking()** (used in effects 6, 7, 8): updates the data returned by `useTracking` (hook internal state).

- **Risk**
  - **Multiple refresh**: Focus (6) + 30s timer (7) + AppState active (8) can trigger several `refreshTracking()` close together. If the hook or API does not cancel in-flight requests, the last response wins; out-of-order responses can briefly show stale tracking data.

### 2.3 Persisted driver location (`persistedDriverLocation` + storage)

- **Read/written by**
  - **useFocusEffect (6)**: reads from `driverLocationStorage.getLastDriverLocation(id)` and **writes** `setPersistedDriverLocation(...)`.
  - **useEffect (4)**: **writes** `driverLocationStorage.setLastDriverLocation(...)` on every SignalR update.

- **Risk**
  - **Read vs write**: On focus we load from storage and set state; SignalR might be writing at the same time. Usually acceptable: we read a snapshot and the next focus will get the latest. No direct state conflict, but if we ever depended on “exact same moment” consistency between storage and SignalR, we’d need to design for it.
  - **Rapid SignalR updates**: Effect 4 runs on every `realTimeDriverLocation` change; many updates in a short time mean many async writes to the same storage key. The storage layer serializes by read-modify-write; worst case is redundant work, not corruption.

---

## 3. What to check when changing this file

- **Multiple callers of the same fetch/refresh**
  - **fetchBooking** is triggered from: mount (5), focus (6), 30s interval (7), AppState active (8). Consider:
    - Cancelling the previous request when a new one starts (e.g. AbortController + `useRef` for current request), or
    - Ignoring responses that are no longer relevant (e.g. compare `id` or a request id before calling `setBooking`).
  - **refreshTracking** is triggered from focus (6), interval (7), and AppState (8). Same idea: avoid applying stale responses if multiple refreshes are in flight.

- **Auto-update status (effect 9) vs fetchBooking**
  - Effect 9 and any effect that calls `fetchBooking()` both update `booking`. If both run close together, decide which source of truth should win, or avoid one overwriting the other (e.g. only run status update when we know fetch is not in progress, or merge fields instead of full replace).

- **Loading and error state**
  - With concurrent `fetchBooking()` calls, `isLoadingBooking` and `bookingError` can be set by multiple flows. Ensure the last completion does not leave loading true or show an error that no longer applies.

- **Dependencies of effects**
  - Effects 6, 7, 8 depend on `[id, refreshTracking, fetchBooking]`. If `refreshTracking` or `fetchBooking` identity changes often, these effects re-run more than intended and can add more overlapping requests.

- **Cleanup**
  - Effect 7 clears the interval on unmount; effect 8 removes the AppState subscription. When adding new subscriptions or timers, always clean them up in the effect return to avoid leaks and updates after unmount.

---

## 4. Summary

- **Total side effects**: 9 (8 `useEffect`, 1 `useFocusEffect`).
- **Same-data overlap**:
  - **Booking state**: written by `fetchBooking()` (effects 5, 6, 7, 8) and by effect 9 (`setBooking` after status update). Risk of out-of-order responses and overwriting.
  - **Tracking data**: refreshed by same three triggers (focus, interval, AppState). Risk of stale or out-of-order `refreshTracking()` results.
  - **Persisted driver location**: written by effect 4 (SignalR), read and pushed to state in useFocusEffect (6). Lower risk; mainly avoid assuming strict consistency between storage and live SignalR at the same instant.

When adding or changing effects in `app/tracking.tsx`, re-check this document and the shared data table to avoid introducing or worsening race conditions.
