# Current Map Integration (Google + Mapbox)

This document describes how maps are integrated in the Bee Customer App. Use it as the single source of truth when planning changes.

**Default provider:** **Mapbox** (when `EXPO_PUBLIC_MAP_PROVIDER` is unset). Set `EXPO_PUBLIC_MAP_PROVIDER=google` to use Google. When provider is **mapbox**, map **display** uses `@rnmapbox/maps` (Mapbox map view); when **google**, display uses `react-native-maps`. Directions, geocoding, and place search use the same provider via `mapService`.

- **How Mapbox is implemented and how to switch:** **`docs/MAPBOX-IMPLEMENTATION.md`**
- **Migration plan:** **`docs/plans/mapbox-migration-plan.md`**

---

## Summary

| Layer | Technology | Purpose |
|-------|------------|--------|
| **Map display** | `react-native-maps` + `PROVIDER_GOOGLE` | Renders the map, markers, polylines |
| **Directions** | Google Directions API (REST) | Route between pickup/dropoffs, polyline |
| **Geocoding** | Google Geocoding API (REST) | Reverse geocode: coordinates → address |
| **Places** | Google Places API (REST) | Autocomplete + Place Details (search → coordinates/address) |

All REST calls are in **`shared/services/mapService.ts`**. The shared UI component is **`shared/components/MapView.tsx`**.

---

## 1. Dependencies

| Package | Version | Role |
|---------|---------|------|
| `react-native-maps` | ^1.26.20 | Map view, markers, polylines; uses Google Maps on iOS/Android |
| `@rnmapbox/maps` | (see package.json) | Mapbox Maps SDK; used when provider is Mapbox (Phase 2–3) |
| (no separate Google SDK package) | — | Google Maps configured via Expo plugin and API key |

**Expo config** (`app.config.js`):

- **Google (current):** iOS `ios.config.googleMapsApiKey`, Android `android.config.googleMaps.apiKey`, plugin `react-native-maps` with API key.
- **Mapbox (Phase 1 added):** Plugin `@rnmapbox/maps`; token exposed in `extra.mapboxAccessToken` for runtime `Mapbox.setAccessToken()` when provider is Mapbox.

---

## 2. Environment Variables

| Variable | Required | Used in | Purpose |
|----------|----------|---------|--------|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | app.config.js, mapService, MapView | Native map tiles + all Google APIs below |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL` | No | mapService | Override base URL (default: `https://maps.googleapis.com/maps/api`) |

**Note:** `app.config.js` resolves the key via `getEnvVar('GOOGLE_MAPS_API_KEY', ...)` (so it can be `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` or env-specific variants). The app and mapService use `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` at runtime.

---

## 3. Files and Responsibilities

### 3.1 Map display

| File | Responsibility |
|------|-----------------|
| **`shared/components/MapView.tsx`** | Renders `<MapView>` (react-native-maps) with `provider={PROVIDER_GOOGLE}`. Handles: initial region, markers (pickup/dropoff/driver), polyline from `mapService.getRoute`, map press → reverse geocode via `mapService.reverseGeocode`, expand/collapse, controls. Uses `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` for route logic (skips route if key missing). |

**Key imports in MapView.tsx:**

- `MapView, Marker, Polyline, PROVIDER_GOOGLE, Region` from `react-native-maps`
- `mapService` from `@/shared/services/mapService`
- Types from `@/shared/types/map` and `@/shared/types/booking`

### 3.2 Map services (REST APIs)

| File | Responsibility |
|------|-----------------|
| **`shared/services/mapService.ts`** | All Google Maps REST usage: **Directions**, **Geocoding**, **Places Autocomplete**, **Place Details**. Exposes: `getRoute`, `reverseGeocode`, `searchPlaces`, `getPlaceDetails`. Uses `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and optional `EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL`. Contains Google-specific polyline decoding. |

**API usage in mapService:**

| Function | Google API | Endpoint (concept) | Used for |
|----------|------------|--------------------|----------|
| `getRoute(origin, destination, waypoints?)` | Directions API | `/directions/json` | Route geometry (polyline) + distance/duration |
| `reverseGeocode(coordinates)` | Geocoding API | `/geocode/json?latlng=...` | Address from lat/lng (e.g. after map tap) |
| `searchPlaces(query, location?)` | Places API | `/place/autocomplete/json` | Location search suggestions |
| `getPlaceDetails(placeId)` | Places API | `/place/details/json` | Coordinates + address for selected suggestion |

### 3.3 Types (provider-agnostic)

| File | Responsibility |
|------|-----------------|
| **`shared/types/map.ts`** | `MapMarker`, `Route`, `RouteLeg`, `LocationWithAddress`, `PlacePrediction`, `PlaceDetails`, `MapRegion`. No Google-specific types; safe to keep when switching provider. |
| **`shared/types/booking.ts`** | `LocationCoordinates` (lat/lng). Used by map and booking. |

### 3.4 Consumers

| File | How it uses maps |
|------|------------------|
| **`app/booking.tsx`** | Renders `MapViewComponent` (booking mode); uses `mapService.reverseGeocode` in “use my location”; uses `useLocationSearch` for pickup/dropoff search. |
| **`app/tracking.tsx`** | Renders `MapViewComponent` (tracking mode); passes booking status, driver location, pickup/dropoff for route. |
| **`shared/hooks/useLocationSearch.ts`** | Calls `mapService.searchPlaces` and `mapService.getPlaceDetails` only; no direct map UI. |

---

## 4. Data flow (current)

- **Display:** `MapView.tsx` → `react-native-maps` (Google) → tiles, markers, polyline.
- **Route:** MapView (or booking/tracking) has pickup/dropoff → `mapService.getRoute(...)` → Google Directions → polyline decoded in mapService → MapView draws `Polyline`.
- **Map tap:** MapView `onPress` → `mapService.reverseGeocode(coordinates)` → address → `onLocationSelect({ coordinates, address })`.
- **Search:** User types → `useLocationSearch` → `mapService.searchPlaces` → user selects → `mapService.getPlaceDetails(placeId)` → `{ coordinates, address }`.

---

## 5. What must change when switching provider

1. **Map display:** Replace `react-native-maps` + `PROVIDER_GOOGLE` with a Mapbox-based map component (e.g. `@rnmapbox/maps` or Mapbox’s React Native SDK), and update `app.config.js` (remove Google keys, add Mapbox token).
2. **Directions:** Replace Google Directions with Mapbox Directions API in `mapService.getRoute` (and adapt polyline format if different).
3. **Geocoding:** Replace Google Geocoding with Mapbox Geocoding (reverse) in `mapService.reverseGeocode`.
4. **Places / Search:** Replace Google Places Autocomplete + Place Details with Mapbox Geocoding (forward search) and optional Mapbox Search API in `mapService.searchPlaces` and `mapService.getPlaceDetails`.
5. **Env:** Replace `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (and optional base URL) with Mapbox token/URL as needed; update `app.config.js` and docs (e.g. `ENVIRONMENT_VARIABLES.md`).

Types in `shared/types/map.ts` and `LocationCoordinates` can stay as-is; only the implementation behind `mapService` and the map component change.

---

## Related docs

- **Env and keys:** `docs/ENVIRONMENT_VARIABLES.md`
- **Original Google plan:** `docs/plans/google-maps-integration-plan.md`
- **Mapbox migration:** `docs/plans/mapbox-migration-plan.md` (plan for switching provider)
