# Mapbox Migration Plan – Change Map Provider from Google to Mapbox

## Overview

This plan describes how to **change the map provider** from **Google Maps** to **Mapbox** in the Bee Customer App. The goal is to swap the provider only: same features (map, markers, routes, reverse geocoding, location search), implemented with Mapbox APIs and SDK.

**Scope:** Map display, directions, geocoding, and place search. No change to booking/tracking business logic beyond what’s needed to use the new map service and component.

**Reference:** Current integration is documented in **`docs/map-integration-current.md`**.

---

## Token status

- **Mapbox token:** Configured in `.env` as `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`. Do not commit the real token; use `.env.example` (placeholder only) for docs/CI.

---

## What We Need From You (Before Implementation)

To implement the migration we need the following from you.

### 1. Mapbox account and access token ✅

- **Mapbox account:** Sign up at [Mapbox](https://www.mapbox.com/) if you don’t have one.
- **Access token:** Create a **public** access token (or a token with at least these scopes):
  - **Map tiles** (for the map component).
  - **Directions API** (for routes).
  - **Geocoding API** (reverse: coordinates → address; forward: search → suggestions/coordinates).
- **Optional:** Separate tokens for development vs production (you can use env-specific vars like today with Google).

**Where it will be used:** Same pattern as today’s Google key: an env var (e.g. `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`) read at runtime and, if required by the Mapbox native SDK, passed in `app.config.js` at build time.

### 2. Confirm Mapbox product choices (optional but helpful)

Mapbox offers:

- **Maps SDK for React Native** (e.g. `@rnmapbox/maps`) – for the map component.
- **Directions API** – for routes (replace Google Directions).
- **Geocoding API** – reverse and forward (replace Google Geocoding + Places).

If you have a preference (e.g. Mapbox Search API vs Geocoding for search), tell us; otherwise we’ll assume:

- Map: Mapbox React Native SDK.
- Routes: Mapbox Directions API.
- Geocoding: Mapbox Geocoding API (reverse + forward search).

### 3. Platform and Expo compatibility

- **Expo:** We will use a Mapbox solution that works with Expo (managed workflow or prebuild). If you use EAS Build, we’ll align the plan with that.
- **iOS / Android:** Both will be supported; any extra native config (e.g. permissions, keys in plist/gradle) will be listed in the implementation phases.

### 4. Environment and CI/CD

- **Env var name:** Do you want to keep a similar naming convention? Proposed:
  - `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (and optional `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_DEVELOPMENT` / `_STAGING` / `_PRODUCTION`).
- **CI/CD:** Same as today: you add the token(s) in GitLab CI/CD variables (and optionally in `.env` locally). We’ll document the exact variable names.

Once you confirm the above (or say “use defaults”), we can proceed with the phased implementation below.

---

## Current vs Mapbox (High Level)

| Capability        | Current (Google)              | Target (Mapbox)                          |
|------------------|------------------------------|------------------------------------------|
| Map display      | `react-native-maps` + Google  | Mapbox React Native SDK (e.g. `@rnmapbox/maps`) |
| Route (polyline) | Directions API + polyline decode | Mapbox Directions API + geometry        |
| Reverse geocode | Geocoding API                 | Mapbox Geocoding API (reverse)           |
| Search + details | Places Autocomplete + Details| Mapbox Geocoding (forward) / Search API  |
| Env / config     | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` + app.config.js | `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` + app.config.js |

---

## Implementation Phases

### Phase 1: Preparation and dependency setup ✅

**Objective:** Add Mapbox SDK and token configuration without removing Google yet.

**Tasks:**

- [x] Add Mapbox React Native dependency (e.g. `@rnmapbox/maps`) and ensure Expo/compatibility (config plugin if needed).
- [x] Add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (and optional env-specific variants) to:
  - `.env.example`
  - `docs/ENVIRONMENT_VARIABLES.md`
- [x] In `app.config.js`: read Mapbox token via same pattern as `GOOGLE_MAPS_API_KEY`; add any Mapbox-specific config (e.g. for native SDK).
- [x] Document in this plan or in `docs/map-integration-current.md` that a second provider is being added.

**Deliverables:** Mapbox dependency installed, token config documented and wired in app.config, no change to UI yet.

**What we need from you:** Mapbox public access token (or confirmation to use a placeholder until you add it).

---

### Phase 2: Map service – Mapbox APIs (Directions, Geocoding, Search) ✅

**Objective:** Implement Mapbox-backed implementations of the same four operations used today, behind the existing `mapService` API (or a clear adapter).

**Tasks:**

- [x] **Directions:** Implement route calculation using Mapbox Directions API. Output must match existing `Route` type (coordinates array, distance, duration, distanceText, durationText, legs if needed). Mapbox returns geometry (e.g. GeoJSON or encoded polyline); decode to `LocationCoordinates[]` in mapService.
- [x] **Reverse geocoding:** Implement reverse geocode (coordinates → address) with Mapbox Geocoding API. Keep signature `reverseGeocode(coordinates): Promise<string>`.
- [x] **Search (autocomplete):** Implement place/location search with Mapbox Geocoding (forward) or Mapbox Search API. Return array of results that match or can be mapped to `PlacePrediction` (e.g. placeId or id, mainText, secondaryText, description).
- [x] **Place details:** Implement “get details by ID” (or by coordinates) so that selecting a search result yields `PlaceDetails` (coordinates + formattedAddress). Mapbox may use different identifiers; mapService can accept current `placeId` and resolve via Mapbox.
- [x] **Provider switch:** Introduce a single switch (e.g. env `EXPO_PUBLIC_MAP_PROVIDER=mapbox` vs `google`) or feature flag so that:
  - When `mapbox`: mapService uses Mapbox implementations.
  - When `google`: mapService keeps using current Google implementations (default until migration is verified).
- [x] Keep `shared/types/map.ts` unchanged; Mapbox responses are adapted to these types inside mapService.

**Deliverables:** mapService can run on Mapbox for getRoute, reverseGeocode, searchPlaces, getPlaceDetails; existing types and consumer APIs unchanged.

**What we need from you:** Confirmation of which Mapbox APIs you have enabled (Directions, Geocoding, Search) and any rate/usage constraints.

---

### Phase 3: Map component – Mapbox map view ✅

**Objective:** Use Mapbox as the map renderer when the provider is Mapbox.

**Tasks:**

- [x] Create a Mapbox-based map component (or branch inside `MapView.tsx`) that:
  - Accepts the same props as today (mode, initialRegion, markers, pickup/dropoff/driver locations, callbacks like onLocationSelect, onRouteCalculated, etc.).
  - Renders Mapbox map, markers, and polyline (from mapService.getRoute).
  - On map press: call mapService.reverseGeocode (already Mapbox in Phase 2) and invoke onLocationSelect.
  - Supports booking vs tracking modes and expand/collapse behavior as today.
- [x] Use the same `Route` and `LocationCoordinates` types; polyline comes from mapService.getRoute (Mapbox Directions) in Phase 2.
- [x] In the app, when provider is Mapbox, render the Mapbox map component instead of `react-native-maps`; when Google, keep current MapView (or swap via one wrapper).
- [x] Ensure `app.config.js` and native config (iOS/Android) supply Mapbox token where the Mapbox SDK requires it (Phase 1); token set at runtime via Mapbox.setAccessToken in MapView.

**Deliverables:** Map UI works with Mapbox: display, markers, route, tap-to-select with reverse geocode, same UX as today.

**What we need from you:** None beyond token; we’ll use default Mapbox map style unless you specify one.

---

### Phase 4: Switch default provider (Google retained) ✅

**Objective:** Make Mapbox the default provider while keeping Google available via `EXPO_PUBLIC_MAP_PROVIDER=google`. Google API key, code, and config are **not** removed.

**Tasks:**

- [x] Set default provider to Mapbox when `EXPO_PUBLIC_MAP_PROVIDER` is unset (mapService defaults to mapbox).
- [x] **Skipped (per request):** Do not remove Google API key, Google code from mapService, or `react-native-maps` / Google config from app.config.js. Both providers remain available.
- [x] **Skipped:** Do not remove `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` from app.config.js, .env.example, or ENVIRONMENT_VARIABLES.md.
- [x] Update `docs/map-integration-current.md` to note Mapbox as default and both providers supported.

**Deliverables:** Mapbox is the default; setting `EXPO_PUBLIC_MAP_PROVIDER=google` continues to use Google. No removal of Google dependency or API key.

---

## File Change Summary

| File | Change |
|------|--------|
| `package.json` | Add Mapbox SDK (e.g. `@rnmapbox/maps`); later remove `react-native-maps` if no longer used. |
| `app.config.js` | Add Mapbox token resolution; add Mapbox config plugin / native config; remove Google Maps key/config when dropping Google. |
| `shared/services/mapService.ts` | Add Mapbox implementations for getRoute, reverseGeocode, searchPlaces, getPlaceDetails; provider switch or replace Google implementation. |
| `shared/components/MapView.tsx` | Use Mapbox map component when provider is Mapbox; keep same props and behavior; optionally keep Google branch until Phase 4. |
| `shared/types/map.ts` | No change (keep provider-agnostic types). |
| `shared/hooks/useLocationSearch.ts` | No change (still uses mapService.searchPlaces / getPlaceDetails). |
| `app/booking.tsx` | No change except possibly which component is rendered (MapView wrapper handles provider). |
| `app/tracking.tsx` | No change except possibly which component is rendered. |
| `.env.example` | Add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`; remove Google key when dropping Google. |
| `docs/ENVIRONMENT_VARIABLES.md` | Document Mapbox token; remove or update Google key docs. |
| `docs/map-integration-current.md` | After migration, describe Mapbox as current; reference this plan. |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Mapbox SDK and Expo compatibility | Use a well-supported Mapbox React Native library and Expo config plugin; verify on both iOS and Android. |
| Different polyline/geometry format | Decode Mapbox route geometry to `LocationCoordinates[]` inside mapService so MapView and types stay unchanged. |
| Search result shape differs from PlacePrediction | Map Mapbox search results to PlacePrediction and PlaceDetails in mapService. |
| Token required at build time | Follow Mapbox docs for React Native/Expo; supply token via app.config.js from env. |

---

## Success Criteria

- [ ] User can open Booking and Tracking screens and see a Mapbox map.
- [ ] User can tap the map to select a location and get an address (reverse geocode).
- [ ] User can search for a place and select it for pickup/dropoff (search + place details).
- [ ] Routes between pickup and dropoffs draw correctly (polyline) with distance/duration.
- [ ] Tracking screen shows driver location and route as today.
- [ ] No Google Maps API key required when using Mapbox-only (Phase 4).
- [ ] Env and docs clearly state Mapbox token and how to set it (local + CI/CD).

---

## What We Need From You – Checklist

Before starting implementation, please confirm:

1. **Mapbox access token:** You have (or will create) a Mapbox public access token with access to Maps, Directions, and Geocoding (and Search if we use it).
2. **Env var name:** Are you okay with `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (and optional `_DEVELOPMENT` / `_STAGING` / `_PRODUCTION`)?
3. **Default provider after migration:** Should we keep a switch (Google vs Mapbox) for a while, or go straight to Mapbox-only?
4. **Google removal:** Confirm that no other part of the app or backend depends on Google Maps (so we can remove it in Phase 4).

Once you confirm these, we can proceed phase by phase and update this plan with “Completed” sections and any extra implementation notes.

---

## Provider abstraction: switching between Google and Mapbox (and vice versa)

This section describes a **design so the app can use either Google or Mapbox** and switch via configuration (e.g. one env var) without code changes. You can flip from Mapbox to Google or Google to Mapbox by changing env and providing the right keys.

### Design goals

- **Single switch:** One env var (e.g. `EXPO_PUBLIC_MAP_PROVIDER`) chooses the active provider.
- **Same app surface:** `mapService` and `MapView` keep the same public API; only the implementation behind them changes.
- **No consumer changes:** `app/booking.tsx`, `app/tracking.tsx`, `useLocationSearch` keep importing `mapService` and `MapView` as today.
- **Easy to add another provider later:** New provider = new implementation of the same contract + one branch in the switch.

### 1. Environment-based provider switch

**Variable:** `EXPO_PUBLIC_MAP_PROVIDER`  
**Values:** `google` | `mapbox`  
**Default:** `google` (so current behavior is unchanged until you opt in to Mapbox).

**Required env per provider:**

| Provider | Required env |
|----------|--------------|
| `google` | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (optional: `EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL`) |
| `mapbox` | `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` |

**How to switch:**

- **Use Google:** `EXPO_PUBLIC_MAP_PROVIDER=google` and set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- **Use Mapbox:** `EXPO_PUBLIC_MAP_PROVIDER=mapbox` and set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.

If the chosen provider's key is missing, the app can show a clear error or fallback (e.g. map without routes/geocoding) as you prefer.

### 2. Map service: one facade, two implementations

Keep a **single `mapService` object** used everywhere, with the same four methods:

- `getRoute(origin, destination, waypoints?)`
- `reverseGeocode(coordinates)`
- `searchPlaces(query, location?)`
- `getPlaceDetails(placeId)`

**Internal design options:**

**Option A – Branch inside mapService (simplest):**  
In `shared/services/mapService.ts`, at the top of each function, read `EXPO_PUBLIC_MAP_PROVIDER` and call either the Google implementation or the Mapbox implementation. Shared types (`Route`, `PlacePrediction`, `PlaceDetails`, `LocationCoordinates`) stay in `shared/types/map.ts` and are used by both. No new files.

**Option B – Adapter interface + implementations:**  
Define a small interface (e.g. `IMapProvider`) with those four methods. Implement `GoogleMapProvider` and `MapboxMapProvider` in separate files (e.g. `mapService.google.ts`, `mapService.mapbox.ts`). In `mapService.ts`, resolve provider from env and export a single `mapService` that delegates to the right implementation. Same public API; easier to test and to add a third provider later.

**Recommendation:** Start with **Option A** for Phase 2; refactor to **Option B** later if you add more providers or want clearer tests.

**Contract (same for both providers):**

- **Inputs/outputs:** Use only types from `shared/types/map.ts` and `shared/types/booking.ts` (e.g. `LocationCoordinates`, `Route`, `RouteLeg`, `PlacePrediction`, `PlaceDetails`). No provider-specific types in the public API.
- **Errors:** Throw `Error` with a clear message; consumers don't need to know which provider failed.
- **Place IDs:** Google and Mapbox use different ID formats. `placeId` in our types is an opaque string: Google implementation uses Google place IDs; Mapbox implementation can use Mapbox feature IDs (and optionally a small cache so `getPlaceDetails(placeId)` can resolve Mapbox IDs to coordinates/address).

### 3. Map component: one wrapper, two renderers

**Single entry point:** Keep one component that the app uses (e.g. `MapView` from `shared/components/MapView.tsx`). Its props stay the same (mode, markers, pickup/dropoff/driver, callbacks, etc.).

**Internal design:**

- **Option A – Branch inside one file:** In `MapView.tsx`, read `EXPO_PUBLIC_MAP_PROVIDER`. If `mapbox`, render the Mapbox map component; if `google`, render the current `react-native-maps` MapView. Shared logic (e.g. building markers, calling `mapService.getRoute` / `mapService.reverseGeocode`) stays in the wrapper so both branches behave the same.
- **Option B – Two components + wrapper:** Implement `MapViewGoogle.tsx` and `MapViewMapbox.tsx` with the same props interface, then a thin `MapView.tsx` that picks one based on `EXPO_PUBLIC_MAP_PROVIDER` and renders it. Good if the two implementations are large and you want to keep them separate.

**Recommendation:** Start with **Option A**; split into **Option B** if the file gets too big.

**Important:** Map component always uses `mapService` for routes and reverse geocode (no direct provider APIs in the component). That way, when the user switches provider, the map automatically uses the correct backend.

### 4. App and native config (app.config.js)

- **Google:** When `EXPO_PUBLIC_MAP_PROVIDER=google` (or unset), app.config.js continues to pass `GOOGLE_MAPS_API_KEY` to the `react-native-maps` plugin and to iOS/Android as today.
- **Mapbox:** When using Mapbox, app.config.js must pass the Mapbox token wherever the Mapbox SDK requires it (e.g. plugin config). If the Mapbox SDK reads the token only at runtime from env, you may still need the token in app.config for native init; follow Mapbox's React Native/Expo docs.
- **Optional:** In app.config.js you can read `EXPO_PUBLIC_MAP_PROVIDER` and only apply the relevant plugin (e.g. only add Google Maps config when provider is google). That keeps one provider's keys out of the build when not used. For maximum flexibility (switching without rebuild), both keys can be present and the runtime switch above is enough; then app.config can include both for simplicity.

### 5. How to switch in practice

**From Google to Mapbox:**

1. Set `EXPO_PUBLIC_MAP_PROVIDER=mapbox` (or leave unset if you make Mapbox the default).
2. Set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to your Mapbox token.
3. Restart the app (and if needed, rebuild so native Mapbox SDK is included).
4. No code changes in booking, tracking, or useLocationSearch.

**From Mapbox to Google:**

1. Set `EXPO_PUBLIC_MAP_PROVIDER=google`.
2. Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to your Google key.
3. Restart the app (and if you removed Google from the build, rebuild with Google config re-enabled).
4. No code changes in booking, tracking, or useLocationSearch.

**CI/CD:** In GitLab (or your CI), set the desired provider and the corresponding token per environment (e.g. staging uses Mapbox, production uses Google, or vice versa) using the same variable names.

### 6. Summary: what lives where

| Piece | Role | Provider-specific? |
|-------|------|--------------------|
| `EXPO_PUBLIC_MAP_PROVIDER` | Chooses active provider | Switch only |
| `mapService` (public API) | getRoute, reverseGeocode, searchPlaces, getPlaceDetails | No – same for all |
| mapService internals | Google vs Mapbox implementations | Yes – behind the switch |
| `MapView` (props + behavior) | Same props, same callbacks | No – same for all |
| MapView internals | Google MapView vs Mapbox MapView | Yes – behind the switch |
| `shared/types/map.ts` | Route, PlacePrediction, etc. | No – shared types only |
| app/booking, app/tracking, useLocationSearch | Use mapService + MapView | No – no provider logic |

This design lets you **change from Mapbox to Google and vice versa** by configuration only, without touching feature code.
