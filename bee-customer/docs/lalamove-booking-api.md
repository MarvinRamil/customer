# Lalamove-Style Booking API (Calculate Fare & Create Booking)

This document describes the **multi-stop Lalamove-style booking flow** for the Bee Customer app: **Step 1 – Calculate fare** and **Step 2 – Create booking**. Steps 3 (available drivers) and 4 (select driver) are out of scope for this doc.

**Base URL:** From `EXPO_PUBLIC_API_URL` (e.g. `https://your-api.com`)  
**Auth:** All requests require `Authorization: Bearer <token>` (handled by `apiClient`).

---

## Overview

| Step | Endpoint | Purpose |
|------|----------|--------|
| 0 | `GET /api/vehicle-pricing` | Get available vehicle types (for dropdown) |
| 1 | `POST /api/bookings/calculate-fare` | Get estimated fare before creating |
| 2 | `POST /api/bookings/lalamove` | Create booking with stops and estimated fare |
| 3 (optional) | `GET /api/bookings/{id}/available-drivers` | List drivers for booking |
| 4 (optional) | `POST /api/bookings/{id}/select-driver` | Select a driver |

**Fare flow:** Call **calculate-fare once** with **all stops** (one pickup + 0–19 dropoffs). The API returns **one total fare** for the entire route. Do **not** call calculate-fare per stop.

**Vehicle types:** Vehicle types are **not** a fixed enum. They come from **Step 0** (`GET /api/vehicle-pricing`). Use each item’s `vehicleType` in the dropdown and send that same string as `vehicleType` in calculate-fare and lalamove.

---

## Step 0: Vehicle Types (Vehicle Pricing)

**Endpoint:** `GET /api/vehicle-pricing`  
**Auth:** None (`AllowAnonymous`).

**Purpose:** Get the list of available vehicle types for the booking flow. Use this list to populate the vehicle-type dropdown; send the **same** `vehicleType` value in `POST /api/bookings/calculate-fare` and `POST /api/bookings/lalamove`.

### Response (200 OK)

List of active vehicle pricings. Each item includes:

| Field | Type | Notes |
|-------|------|--------|
| vehicleType | string | **Value to send** in calculate-fare and lalamove (e.g. `"Van"`, `"L300"`) |
| types | string | **Display label** for UI (e.g. `"7-seater SUV / Small Van"`) |
| baseFare | number | Base fare |
| perKm0to5 | number | Rate per km for 0–5 km |
| perKmAbove5 | number | Rate per km above 5 km |
| additionalStopFee | number | Fee per additional stop |
| weightLimitKg | number | Weight limit (kg) |
| sizeLimit | string | Size limit (e.g. dimensions) |
| (others) | — | Other pricing/limit fields as defined by API |

### Flow

1. Call `GET /api/vehicle-pricing` **once** (e.g. on app load or when the booking screen mounts).
2. In the UI dropdown: **display** each item’s `types` (label), **value** each option as `vehicleType`.
3. When calling `POST /api/bookings/calculate-fare` and `POST /api/bookings/lalamove`, send the selected **`vehicleType`** string (not the display label).

### Get one by type (optional)

**Endpoint:** `GET /api/vehicle-pricing/vehicle-type/{vehicleType}`  
**Auth:** None.

Returns pricing for a single vehicle type (e.g. for fare breakdown or validation). `{vehicleType}` is the same string used in calculate-fare and lalamove (e.g. `Van`, `L300`).

### Seeded defaults (examples)

After initial seed, the API may expose vehicle types like below. The **actual list** depends on your database and admin configuration.

| vehicleType | types (display) |
|-------------|------------------|
| Sedan | Hatchback/Sedan |
| SUV | Subcompact SUV / Crossover |
| Van | 7-seater SUV / Small Van |
| Pickup | Pickup |
| L300 | L300 / Cargo Van |
| FB2000 | FB |
| Aluminum2000 | Aluminum |
| Truck3000 | 3,000kg Truck (Aluminum) |
| Truck7000 | 7,000kg Truck |
| Truck12000 | Aluminum / Wing Van |

---

## Step 1: Calculate Fare

**Endpoint:** `POST /api/bookings/calculate-fare`  
**Content-Type:** `application/json`  
**Auth:** Required (Bearer token).

### Request Body

```json
{
  "vehicleType": "Van",
  "stops": [
    {
      "sequence": 0,
      "address": "123 Pickup St",
      "type": "Pickup",
      "latitude": 14.5,
      "longitude": 121.0
    },
    {
      "sequence": 1,
      "address": "456 Dropoff St",
      "type": "Dropoff",
      "latitude": 14.6,
      "longitude": 121.1
    }
  ],
  "weightKg": 10,
  "priorityFee": 50,
  "scheduledDateTime": "2026-02-01T10:00:00Z"
}
```

### Request Fields

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| vehicleType | string | Yes | Must be a value from `GET /api/vehicle-pricing` (e.g. Van, L300) |
| stops | array | Yes | 1–20 stops; exactly one `type: "Pickup"` |
| weightKg | number | No | |
| priorityFee | number | No | |
| scheduledDateTime | string (ISO) | No | For scheduled deliveries |

### Stop Object (in `stops` array)

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| sequence | number | Yes | 0-based order |
| address | string | Yes | Full address |
| type | string | Yes | `"Pickup"` or `"Dropoff"` |
| latitude | number | No | -90 to 90 |
| longitude | number | No | -180 to 180 |
| contactName | string | No | |
| contactPhone | string | No | |
| notes | string | No | |

### Rules

- At least 1 stop; maximum 20 stops.
- **Exactly one pickup:** one stop must have `type: "Pickup"` (multi-stop is for **destinations only**, not multiple pickups).
- **Multiple dropoffs:** remaining stops use `type: "Dropoff"` (0–19 destinations).

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "baseFare": 100,
    "distanceFare": 80,
    "multiStopFee": 20,
    "weightSurcharge": 10,
    "priorityFee": 50,
    "highDemandSurcharge": 0,
    "tollFee": 0,
    "totalFare": 260,
    "distanceKm": 5.2,
    "breakdown": null
  }
}
```

Use **`data.totalFare`** (and optionally `distanceKm`, `breakdown`) when creating the booking in Step 2.

---

## Step 2: Create Booking

**Endpoint:** `POST /api/bookings/lalamove`  
**Content-Type:** `application/json`  
**Auth:** Required (Bearer token).

### Request Body

```json
{
  "vehicleType": "Van",
  "cargoDescription": "Documents",
  "scheduleDate": "2026-02-01T00:00:00Z",
  "serviceType": "Immediate",
  "stops": [
    {
      "sequence": 0,
      "address": "123 Pickup St",
      "type": "Pickup",
      "latitude": 14.5,
      "longitude": 121.0,
      "contactName": "John",
      "contactPhone": "+639171234567"
    },
    {
      "sequence": 1,
      "address": "456 Dropoff St",
      "type": "Dropoff",
      "latitude": 14.6,
      "longitude": 121.1,
      "contactName": "Jane",
      "contactPhone": "+639179876543"
    }
  ],
  "estimatedFare": 260,
  "weightKg": 10,
  "priorityFee": 50,
  "notes": "Handle with care"
}
```

### Required Fields

| Field | Type | Notes |
|-------|------|--------|
| customerId | string (GUID) | Use `"00000000-0000-0000-0000-000000000000"` to use the logged-in user as customer; or send a specific customer GUID |
| vehicleType | string | Must be a value from `GET /api/vehicle-pricing` (e.g. Van, L300) |
| cargoDescription | string | Description of cargo |
| scheduleDate | string (ISO) | Date/time for the booking |
| serviceType | string | `"Immediate"` or `"Scheduled"` |
| stops | array | Same structure as Step 1; 1–20 stops, one Pickup |
| estimatedFare | number | Use `totalFare` from Step 1 |

### Optional Fields

| Field | Type | Notes |
|-------|------|--------|
| weightKg | number | |
| priorityFee | number | |
| scheduledDateTime | string (ISO) | For scheduled service |
| scheduledPickupWindow | string | |
| favouriteDriverId | string (GUID) | Preferred driver |
| itemImagePath | string | |
| notes | string | |

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "guid",
    "bookingNumber": "BKG-...",
    "customerId": "guid",
    "customerName": "...",
    "pickupLocation": "...",
    "dropoffLocation": "...",
    "truckType": "Van",
    "cargoDescription": "Documents",
    "scheduleDate": "...",
    "status": "Pending",
    "notes": "...",
    "createdAt": "...",
    "updatedAt": null,
    "itemImagePath": null
  }
}
```

Save **`data.id`** for optional later steps (e.g. available drivers, select driver).

**Note:** The response is the standard `BookingDto` (legacy shape: `pickupLocation`, `dropoffLocation`, `truckType`, etc.). It does **not** include a `stops` array; the backend stores stops but returns the legacy DTO for compatibility.

---

## Service Types

| Value | Description |
|-------|-------------|
| Immediate | On-demand delivery |
| Scheduled | Scheduled delivery (e.g. up to 30 days ahead) |

---

## Frontend Flow Summary

1. **Load vehicle types:** Call `GET /api/vehicle-pricing` once (e.g. on app load or booking screen mount). Use each item’s **`vehicleType`** as the dropdown value and **`types`** as the display label.
2. **User enters:** Stops (1 pickup + 0–19 dropoffs), vehicle type (from dropdown), optional weight/priority.
3. **Auto-trigger calculate-fare** when required fields are valid: vehicle type selected (a `vehicleType` from Step 0), at least 1 pickup + 1 dropoff, and each stop has an address. Call `POST /api/bookings/calculate-fare` with the **full** `stops` array **once** (use a short debounce, e.g. 300–500 ms, after the last change). Re-run when the user changes stops or vehicle type so the fare stays in sync.
4. **Show:** `data.totalFare` (and optionally `distanceKm`, `breakdown`) to the user when the response returns.
5. **User confirms** → **Call:** `POST /api/bookings/lalamove` with the **same stops** and `estimatedFare: data.totalFare`, plus `cargoDescription`, `scheduleDate`, `serviceType` (and the same `vehicleType` from the dropdown).
6. **Optional:** Call `GET /api/bookings/{id}/available-drivers`, then `POST /api/bookings/{id}/select-driver` with chosen `driverId`.

---

## Related Docs

- **API client usage:** `docs/API.md`
- **Existing bookings:** `docs/API.md` (my-bookings, create booking)
- **Registration / Auth:** `docs/registration-api.md`
