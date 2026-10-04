# Mapbox Implementation & Provider Switching (Google ↔ Mapbox)

This document describes how Mapbox is implemented in the Bee Customer App and how to switch between **Mapbox** (default) and **Google** for map display, directions, geocoding, and place search.

---

## Overview

- **Default provider:** **Mapbox**. If you do not set `EXPO_PUBLIC_MAP_PROVIDER`, the app uses Mapbox for the map and all map-related APIs.
- **Switching:** Set one environment variable to choose the provider. No code changes are required.
- **Scope:** Map display (tiles, markers, polylines), directions (routes), reverse geocoding (coordinates → address), and place search (autocomplete + place details) all use the selected provider.

---

## How Switching Works

### Environment variable

| Variable | Values | Default (when unset) |
|----------|--------|------------------------|
| `EXPO_PUBLIC_MAP_PROVIDER` | `mapbox` \| `google` | **mapbox** |

- **Unset or empty** → Mapbox  
- **`google`** (case-insensitive) → Google  
- **`mapbox`** or any other value → Mapbox  

### Where the provider is read

1. **`shared/services/mapService.ts`**  
   Used for directions, reverse geocoding, place search, and place details. At the start of each public function (`getRoute`, `reverseGeocode`, `searchPlaces`, `getPlaceDetails`), the code checks the provider and calls the corresponding Mapbox or Google implementation.

2. **`shared/components/MapView.tsx`**  
   Used for map display. The component reads the same env and renders either the Mapbox map (`@rnmapbox/maps`) or the Google map (`react-native-maps`). Same props and callbacks for both.

Consumers (e.g. `app/booking.tsx`, `app/tracking.tsx`, `useLocationSearch`) do not know which provider is active; they always use `mapService` and `MapView` the same way.

---

## What Uses Which Provider

| Feature | Mapbox | Google |
|--------|--------|--------|
| Map display (tiles, markers, polyline) | `@rnmapbox/maps` (MapView, Camera, PointAnnotation, ShapeSource + LineLayer) | `react-native-maps` with `PROVIDER_GOOGLE` |
| Directions (route between points) | Mapbox Directions API v5 | Google Directions API |
| Reverse geocode (coordinates → address) | Mapbox Geocoding API v5 | Google Geocoding API |
| Place search (autocomplete) | Mapbox Geocoding (forward) | Google Places Autocomplete |
| Place details (by place ID) | Cached from search (Mapbox has no retrieve-by-id in v5) | Google Place Details |

All of the above follow the single switch: when provider is **mapbox**, Mapbox is used for all; when **google**, Google is used for all.

---

## Implementation Details

### Map service (`shared/services/mapService.ts`)

- **Provider check:** `getMapProvider()` returns `'google'` only when `EXPO_PUBLIC_MAP_PROVIDER` is exactly `'google'` (after trim/lowercase); otherwise returns `'mapbox'`.
- **Public API unchanged:** `getRoute`, `reverseGeocode`, `searchPlaces`, `getPlaceDetails` keep the same signatures and return types. Internally they branch:
  - If Mapbox: call `getRouteMapbox`, `reverseGeocodeMapbox`, `searchPlacesMapbox`, `getPlaceDetailsMapbox`.
  - If Google: call the existing Google implementations (e.g. `getRouteGoogle`, etc.).
- **Types:** `shared/types/map.ts` stays provider-agnostic (`Route`, `PlacePrediction`, `PlaceDetails`, `LocationCoordinates`, etc.). Mapbox responses are mapped to these types inside the service.
- **Mapbox token:** Read from `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`. Required when provider is Mapbox.
- **Google key:** Read from `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Required when provider is Google.

### Map component (`shared/components/MapView.tsx`)

- **Provider check:** Same logic as mapService (`getMapProvider()`; default Mapbox).
- **Token for Mapbox:** Before the first Mapbox render, the component calls `Mapbox.setAccessToken(token)` where `token` comes from `Constants.expoConfig?.extra?.mapboxAccessToken` or `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- **Two branches in render:**
  - **Mapbox:** Renders `MapboxMapView` with `MapboxCamera`, `MapboxUserLocation` (booking mode), `MapboxShapeSource` + `MapboxLineLayer` for the route polyline, and `MapboxPointAnnotation` for pickup, dropoff, driver, custom markers, and temporary selection. Map press is handled by `handleMapboxMapPress`, which reads coordinates from the GeoJSON feature and calls `mapService.reverseGeocode` then `onLocationSelect`.
  - **Google:** Renders `RNMapView` (react-native-maps) with `PROVIDER_GOOGLE`, `Marker`, `Polyline`, and the same callbacks. Map press uses `handleMapPress` and the same `mapService.reverseGeocode` + `onLocationSelect` flow.
- **Route and region:** Route calculation and “fit to route” / “center on region” logic are shared; only the ref and native calls differ (e.g. `mapboxCameraRef.current.fitBounds` vs `mapRef.current.fitToCoordinates`).

### Config and env

- **`app.config.js`**  
  - Resolves both Google API key and Mapbox token (e.g. via `getEnvVar`).  
  - Exposes Mapbox token in `extra.mapboxAccessToken` for runtime use.  
  - Includes the `react-native-maps` plugin (Google) and the `@rnmapbox/maps` plugin so both can be used depending on provider.
- **`.env` / `.env.example`**  
  - `EXPO_PUBLIC_MAP_PROVIDER` – optional; when unset, Mapbox is used.  
  - `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` – required when using Mapbox.  
  - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` – required when using Google.

---

## Default: Mapbox

The app is configured so that **Mapbox is the default**:

- If `EXPO_PUBLIC_MAP_PROVIDER` is **not set** (or is set to anything other than `google`), the app uses **Mapbox** for:
  - Map display
  - Directions
  - Reverse geocoding
  - Place search and place details

To use **Google** instead, you must explicitly set:

```env
EXPO_PUBLIC_MAP_PROVIDER=google
```

and provide a valid `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

---

## How to Switch Providers

### Use Mapbox (default)

- **Option A:** Do not set `EXPO_PUBLIC_MAP_PROVIDER`, or set it to `mapbox`.
- **Option B:** Omit `EXPO_PUBLIC_MAP_PROVIDER` from `.env` and set only:
  ```env
  EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
  ```
- Restart the app (and use a development build or EAS Build; Mapbox does not run in Expo Go).

### Use Google

1. Set in `.env`:
   ```env
   EXPO_PUBLIC_MAP_PROVIDER=google
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_api_key
   ```
2. Restart the app.

No code changes are needed in the app or in feature code; only environment configuration.

---

## Environment Variables Summary

| Variable | Required when | Purpose |
|----------|----------------|---------|
| `EXPO_PUBLIC_MAP_PROVIDER` | Optional | `google` = use Google; unset or `mapbox` = use Mapbox (default). |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Provider is Mapbox | Mapbox public token for map, directions, geocoding. |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Provider is Google | Google API key for map and Google APIs. |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL` | Optional (Google) | Override Google API base URL. |

See `docs/ENVIRONMENT_VARIABLES.md` for full env documentation and CI/CD usage.

---

## Android build: “Could not find com.mapbox.maps:android-ndk27” / “mapbox-sdk-turf”

If the Android build fails with “Could not find com.mapbox.maps:…” or “Could not find com.mapbox.mapboxsdk:mapbox-sdk-turf:…”, Gradle is not seeing the Mapbox Maven repository. That usually means the `android/` project was generated **before** the `@rnmapbox/maps` plugin was added (or the native projects were never regenerated after adding it).

**Fix:** Regenerate the native projects so the Mapbox config plugin can add the Mapbox Maven repo:

```bash
npx expo prebuild --clean
```

Then build again:

```bash
npx expo run:android
```

**Note:** `prebuild --clean` deletes and recreates the `android/` and `ios/` folders. Any manual edits in those folders will be lost. Use Expo config plugins or `app.config.js` for native configuration.

---

## Related Docs

- **`docs/map-integration-current.md`** – Current map integration summary (both providers).
- **`docs/plans/mapbox-migration-plan.md`** – Migration plan and phase checklist.
- **`docs/ENVIRONMENT_VARIABLES.md`** – All environment variables and setup.
