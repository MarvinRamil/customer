/**
 * Map service – Directions, Geocoding, and Place Search
 * Supports Google and Mapbox via EXPO_PUBLIC_MAP_PROVIDER (default: mapbox)
 */

import { configService } from '@/shared/services/configService';
import type { LocationCoordinates } from '@/shared/types/booking';
import type {
  PlaceDetails,
  PlacePrediction,
  Route,
  RouteLeg,
} from '@/shared/types/map';

/** Supported map providers */
const MAP_PROVIDER_GOOGLE = 'google';
const MAP_PROVIDER_MAPBOX = 'mapbox';

/**
 * Returns the active map provider from env (default: mapbox).
 * When mapbox: Mapbox Directions, Geocoding, and Search are used.
 * When google: Google Maps APIs are used.
 * Set EXPO_PUBLIC_MAP_PROVIDER=google to use Google; omit or set mapbox for Mapbox.
 */
function getMapProvider(): 'google' | 'mapbox' {
  const p = process.env.EXPO_PUBLIC_MAP_PROVIDER?.toLowerCase().trim();
  return p === MAP_PROVIDER_GOOGLE ? 'google' : 'mapbox';
}

/**
 * Returns Mapbox public access token or null if not set.
 * Used when provider is mapbox for Directions, Geocoding, and map display.
 */
function getMapboxToken(): string | null {
  // Sourced from Vault via configService (falls back to EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN).
  const token = configService.getMapboxAccessToken()?.trim();
  if (!token || token === 'your_mapbox_public_token_here') return null;
  return token;
}

/**
 * Get Google Maps API base URL from environment variables
 * Defaults to standard Google Maps API endpoint if not configured
 * @returns API base URL string
 */
function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL ||
    'https://maps.googleapis.com/maps/api'
  );
}

/**
 * Get Google Maps API key from environment variables
 * @returns API key string or null if not configured
 */
function getApiKey(): string | null {
  // Sourced from Vault via configService (falls back to EXPO_PUBLIC_GOOGLE_MAPS_API_KEY).
  const apiKey = configService.getGoogleMapsApiKey();
  if (!apiKey || apiKey === 'your_api_key_here' || apiKey.trim() === '') {
    return null;
  }
  return apiKey;
}

/**
 * Decode Google Maps polyline string to coordinates array
 * 
 * **How Google Maps Polyline Encoding Works**:
 * - Google Maps uses a lossy compression algorithm to encode coordinate sequences
 * - Each coordinate is encoded as a variable-length integer (varint)
 * - The algorithm stores differences (deltas) between consecutive coordinates, not absolute values
 * - This makes the encoded string much shorter than storing full lat/lng values
 * 
 * **Encoding Format**:
 * - Each coordinate delta is encoded as a base64-like string
 * - Characters are offset by 63 (ASCII 63 = '?')
 * - The last 5 bits of each byte contain the data
 * - If the continuation bit (bit 5) is set, more bytes follow
 * - The result is zigzag-encoded (negative numbers are encoded as positive numbers)
 * 
 * **Decoding Process**:
 * 1. Read variable-length integer for latitude delta
 * 2. Decode zigzag encoding to get signed delta
 * 3. Add delta to previous latitude (accumulator)
 * 4. Repeat for longitude delta
 * 5. Convert accumulated values to actual coordinates (multiply by 1e-5)
 * 
 * @param encoded - Encoded polyline string from Google Maps API
 * @returns Array of coordinates `{ latitude: number, longitude: number }`
 * 
 * **Example**:
 * ```typescript
 * const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
 * const coords = decodePolyline(encoded);
 * // Returns: [{ latitude: 38.5, longitude: -120.2 }, ...]
 * ```
 */
function decodePolyline(encoded: string): LocationCoordinates[] {
  const coordinates: LocationCoordinates[] = [];
  let index = 0; // Current position in the encoded string
  const len = encoded.length; // Total length of encoded string
  let lat = 0; // Accumulated latitude (starts at 0, accumulates deltas)
  let lng = 0; // Accumulated longitude (starts at 0, accumulates deltas)

  // Process the entire encoded string
  while (index < len) {
    // ============================================
    // DECODE LATITUDE DELTA
    // ============================================
    // Read variable-length integer for latitude delta
    let b; // Current byte value
    let shift = 0; // Bit shift position (0, 5, 10, 15, ...)
    let result = 0; // Accumulated result value

    // Read bytes until continuation bit is clear (bit 5 = 0)
    // Each byte contributes 5 bits of data, shifted by 5 bits per byte
    do {
      // Get character code and subtract 63 (Google's offset)
      // This converts the base64-like encoding to a 0-63 range
      b = encoded.charCodeAt(index++) - 63;
      
      // Extract the 5 data bits (mask with 0x1f = 00011111)
      // Shift left by current shift amount and OR into result
      // This builds up the value bit by bit: bits 0-4, then 5-9, then 10-14, etc.
      result |= (b & 0x1f) << shift;
      
      // Move to next 5-bit position for next byte
      shift += 5;
      
      // Continue if bit 5 is set (0x20 = 00100000)
      // This indicates more bytes follow for this value
    } while (b >= 0x20);

    // Decode zigzag encoding to get signed delta
    // Zigzag encoding: negative numbers are stored as positive numbers
    // If least significant bit is 1, the number is negative
    // Formula: (result & 1) ? ~(result >> 1) : (result >> 1)
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    
    // Add delta to accumulated latitude
    // This gives us the absolute latitude value (in 1e-5 degrees)
    lat += dlat;

    // ============================================
    // DECODE LONGITUDE DELTA
    // ============================================
    // Reset for longitude decoding
    shift = 0;
    result = 0;

    // Read variable-length integer for longitude delta (same process as latitude)
    do {
      // Get next character code, subtract 63 offset
      b = encoded.charCodeAt(index++) - 63;
      
      // Extract 5 data bits and shift into result
      result |= (b & 0x1f) << shift;
      
      // Move to next 5-bit position
      shift += 5;
      
      // Continue if more bytes follow (bit 5 set)
    } while (b >= 0x20);

    // Decode zigzag encoding to get signed longitude delta
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    
    // Add delta to accumulated longitude
    // This gives us the absolute longitude value (in 1e-5 degrees)
    lng += dlng;

    // ============================================
    // CONVERT TO ACTUAL COORDINATES
    // ============================================
    // Convert from 1e-5 degrees to decimal degrees
    // Google stores coordinates as integers multiplied by 1e5 (100,000)
    // So we divide by 1e5 to get the actual decimal degree value
    coordinates.push({
      latitude: lat * 1e-5,  // Convert from 1e-5 degrees to decimal degrees
      longitude: lng * 1e-5, // Convert from 1e-5 degrees to decimal degrees
    });
  }

  return coordinates;
}

// ---------------------------------------------------------------------------
// Mapbox implementations (used when EXPO_PUBLIC_MAP_PROVIDER=mapbox)
// ---------------------------------------------------------------------------

const MAPBOX_DIRECTIONS_BASE = 'https://api.mapbox.com/directions/v5/mapbox/driving';
const MAPBOX_GEOCODING_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const MAPBOX_SEARCH_BOX_BASE = 'https://api.mapbox.com/search/searchbox/v1';

/**
 * Generate a UUID v4 for session tokens
 * Used for Mapbox Search Box API session-based billing
 */
function generateSessionToken(): string {
  // Simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Mapbox Directions API: build coordinates string (lon,lat;lon,lat;...)
 */
function mapboxCoordsString(
  origin: LocationCoordinates,
  destination: LocationCoordinates,
  waypoints?: LocationCoordinates[]
): string {
  const points: LocationCoordinates[] = [origin, ...(waypoints ?? []), destination];
  return points.map((p) => `${p.longitude},${p.latitude}`).join(';');
}

/**
 * Mapbox route geometry is GeoJSON LineString: coordinates are [lng, lat][].
 * Convert to LocationCoordinates[].
 */
function mapboxGeometryToCoordinates(geometry: { coordinates: [number, number][] }): LocationCoordinates[] {
  if (!geometry?.coordinates?.length) return [];
  return geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

/**
 * Mapbox Directions API – get route (internal, used when provider is mapbox).
 */
async function getRouteMapbox(
  origin: LocationCoordinates,
  destination: LocationCoordinates,
  waypoints?: LocationCoordinates[]
): Promise<Route> {
  const token = getMapboxToken();
  if (!token) {
    throw new Error(
      'Mapbox access token is not configured. Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN when using mapbox provider.'
    );
  }
  const coords = mapboxCoordsString(origin, destination, waypoints);
  const url = `${MAPBOX_DIRECTIONS_BASE}/${encodeURIComponent(coords)}?geometries=geojson&overview=full&access_token=${token}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mapbox Directions request failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    const msg = data.message ?? 'No route found';
    throw new Error(`Mapbox Directions: ${msg}`);
  }

  const route = data.routes[0];
  const coordinates = mapboxGeometryToCoordinates(route.geometry);

  const totalDistance = route.distance ?? 0;
  const totalDuration = route.duration ?? 0;
  const legs: RouteLeg[] = (route.legs ?? []).map((leg: { distance: number; duration: number; summary?: string }) => ({
    distance: leg.distance,
    duration: leg.duration,
    distanceText: leg.distance >= 1000 ? `${(leg.distance / 1000).toFixed(1)} km` : `${leg.distance} m`,
    durationText: `${Math.round(leg.duration / 60)} min`,
    startAddress: undefined,
    endAddress: undefined,
  }));

  const distanceText =
    totalDistance >= 1000 ? `${(totalDistance / 1000).toFixed(1)} km` : `${totalDistance} m`;
  const totalMinutes = Math.round(totalDuration / 60);
  const durationText =
    totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)} hr ${totalMinutes % 60} min` : `${totalMinutes} min`;

  return {
    coordinates,
    distance: totalDistance,
    duration: totalDuration,
    distanceText,
    durationText,
    legs: legs.length > 1 ? legs : undefined,
  };
}

/**
 * Mapbox Geocoding API – reverse geocode (internal).
 */
async function reverseGeocodeMapbox(coordinates: LocationCoordinates): Promise<string> {
  console.log('[mapService] reverseGeocodeMapbox called with:', coordinates);
  
  const token = getMapboxToken();
  console.log('[mapService] Mapbox token present:', !!token);
  
  if (!token) {
    throw new Error(
      'Mapbox access token is not configured. Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN when using mapbox provider.'
    );
  }
  const { longitude, latitude } = coordinates;
  const url = `${MAPBOX_GEOCODING_BASE}/${longitude},${latitude}.json?access_token=${token}`;
  console.log('[mapService] Mapbox geocode URL:', url.replace(token, 'TOKEN_HIDDEN'));

  const response = await fetch(url);
  console.log('[mapService] Mapbox response status:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[mapService] Mapbox error response:', errorText);
    throw new Error(`Mapbox Geocoding request failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[mapService] Mapbox response data:', JSON.stringify(data, null, 2));
  
  const features = data.features;
  if (!features?.length) {
    throw new Error('No address found for the specified coordinates');
  }
  return features[0].place_name ?? String(coordinates.latitude + ', ' + coordinates.longitude);
}

/** 
 * Cache for Mapbox Search Box API: maps placeId (used in UI) to mapbox_id (used in /retrieve endpoint)
 * Also stores session tokens for session-based billing
 */
const mapboxIdCache = new Map<string, { mapboxId: string; sessionToken: string }>();

/**
 * Mapbox Search Box API – suggest endpoint (internal).
 * Uses Search Box API /suggest endpoint for autocomplete with session-based billing.
 * Maps Search Box API suggestions to PlacePrediction format.
 */
async function searchPlacesMapbox(
  query: string,
  location?: LocationCoordinates,
  countryCode: string = 'ph'
): Promise<PlacePrediction[]> {
  console.log('[mapService] searchPlacesMapbox (Search Box API) called with query:', query, 'country:', countryCode);
  
  const token = getMapboxToken();
  console.log('[mapService] Mapbox token present:', !!token);
  
  if (!token) {
    throw new Error(
      'Mapbox access token is not configured. Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN when using mapbox provider.'
    );
  }

  // Generate session token for this search session
  const sessionToken = generateSessionToken();
  
  // Build URL for /suggest endpoint
  let url = `${MAPBOX_SEARCH_BOX_BASE}/suggest?q=${encodeURIComponent(query)}&access_token=${token}&session_token=${sessionToken}&limit=10&country=${countryCode}`;
  
  // Add proximity bias if location provided
  if (location) {
    url += `&proximity=${location.longitude},${location.latitude}`;
  }
  
  console.log('[mapService] Mapbox Search Box API suggest URL:', url.replace(token, 'TOKEN_HIDDEN').replace(sessionToken, 'SESSION_HIDDEN'));

  const response = await fetch(url);
  console.log('[mapService] Mapbox Search Box API response status:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[mapService] Mapbox Search Box API error:', errorText);
    throw new Error(`Mapbox Search Box API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[mapService] Mapbox Search Box API suggestions count:', data.suggestions?.length ?? 0);
  
  const suggestions = data.suggestions ?? [];
  
  // Map suggestions to PlacePrediction and cache mapbox_id for /retrieve endpoint
  return suggestions.map((suggestion: {
    mapbox_id: string;
    feature_type: string;
    full_address?: string;
    name?: string;
    name_preferred?: string;
    place_formatted?: string;
    context?: {
      country?: { name: string };
      region?: { name: string };
      postcode?: { name: string };
      place?: { name: string };
      locality?: { name: string };
      neighborhood?: { name: string };
      street?: { name: string };
    };
  }) => {
    // Store mapping: placeId (for UI) -> mapbox_id + sessionToken (for /retrieve)
    // Use mapbox_id as placeId since it's what we'll use for retrieval
    const placeId = suggestion.mapbox_id;
    mapboxIdCache.set(placeId, { mapboxId: suggestion.mapbox_id, sessionToken });
    
    // Extract main text (preferred name or name or place_formatted)
    const mainText = suggestion.name_preferred || suggestion.name || suggestion.place_formatted || suggestion.full_address || '';
    
    // Extract secondary text from context
    const contextParts: string[] = [];
    if (suggestion.context) {
      if (suggestion.context.locality?.name) contextParts.push(suggestion.context.locality.name);
      if (suggestion.context.place?.name) contextParts.push(suggestion.context.place.name);
      if (suggestion.context.region?.name) contextParts.push(suggestion.context.region.name);
      if (suggestion.context.country?.name) contextParts.push(suggestion.context.country.name);
    }
    const secondaryText = contextParts.join(', ');
    
    // Description is full address or place formatted
    const description = suggestion.full_address || suggestion.place_formatted || mainText;
    
    return {
      placeId,
      mainText,
      secondaryText,
      description,
    };
  });
}

/**
 * Mapbox Search Box API – retrieve endpoint (internal).
 * Uses /retrieve endpoint to get full place details using mapbox_id and session_token.
 */
async function getPlaceDetailsMapbox(placeId: string): Promise<PlaceDetails> {
  console.log('[mapService] getPlaceDetailsMapbox (Search Box API) called with placeId:', placeId);
  
  const token = getMapboxToken();
  if (!token) {
    throw new Error(
      'Mapbox access token is not configured. Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN when using mapbox provider.'
    );
  }

  // Get mapbox_id and session_token from cache
  const cached = mapboxIdCache.get(placeId);
  if (!cached) {
    throw new Error(
      'Place details not found. Select a place from search results (Mapbox Search Box API requires session token).'
    );
  }

  const { mapboxId, sessionToken } = cached;
  
  // Build URL for /retrieve endpoint
  const url = `${MAPBOX_SEARCH_BOX_BASE}/retrieve/${encodeURIComponent(mapboxId)}?access_token=${token}&session_token=${sessionToken}`;
  
  console.log('[mapService] Mapbox Search Box API retrieve URL:', url.replace(token, 'TOKEN_HIDDEN').replace(sessionToken, 'SESSION_HIDDEN'));

  const response = await fetch(url);
  console.log('[mapService] Mapbox Search Box API retrieve response status:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[mapService] Mapbox Search Box API retrieve error:', errorText);
    throw new Error(`Mapbox Search Box API retrieve request failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[mapService] Mapbox Search Box API retrieve data:', JSON.stringify(data, null, 2));
  
  const feature = data.features?.[0];
  if (!feature) {
    throw new Error('No feature found in retrieve response');
  }

  // Extract coordinates from feature
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    throw new Error('Invalid coordinates in retrieve response');
  }

  // Extract formatted address
  const formattedAddress = feature.properties?.full_address || 
                          feature.properties?.place_formatted || 
                          feature.properties?.name || 
                          '';

  return {
    placeId: feature.id || placeId,
    formattedAddress,
    coordinates: {
      latitude: coordinates[1],
      longitude: coordinates[0],
    },
    name: feature.properties?.name_preferred || feature.properties?.name,
  };
}

// ---------------------------------------------------------------------------
// Google implementations (internal)
// ---------------------------------------------------------------------------

/**
 * Calculate route between two or more points using Google Maps Directions API (internal).
 * 
 * **API Endpoint**: `https://maps.googleapis.com/maps/api/directions/json`
 * 
 * **How it works**:
 * - Makes HTTP GET request to Google Maps Directions API
 * - Supports multi-stop routes via optional waypoints parameter
 * - Returns the route with total distance/duration across all stops
 * - Decodes the polyline to get coordinate array for drawing on map
 * 
 * **Security Note**:
 * ⚠️ **API Key in URL**: The API key is sent in the URL query parameter (`?key=YOUR_API_KEY`).
 * - **This is the official Google Maps API authentication method** per Google's documentation
 * - Reference: https://developers.google.com/maps/api-security-best-practices
 * - **Security comes from API key restrictions** (required by Google):
 *   - Restrict API key to specific APIs (Directions, Geocoding, Places only)
 *   - Add application restrictions (iOS bundle ID, Android package name)
 * 
 * **Input Parameters**:
 * - `origin`: Starting location coordinates
 * - `destination`: Final destination coordinates
 * - `waypoints`: Optional array of intermediate stop coordinates
 * 
 * **API Request Format**:
 * ```
 * GET https://maps.googleapis.com/maps/api/directions/json?
 *   origin={lat},{lng}&
 *   destination={lat},{lng}&
 *   waypoints={lat1},{lng1}|{lat2},{lng2}&
 *   key={API_KEY}
 * ```
 * 
 * **Output**:
 * - `coordinates`: Array of coordinates forming the route polyline (entire route)
 * - `distance`: Total distance in meters (sum of all legs)
 * - `duration`: Total duration in seconds (sum of all legs)
 * - `distanceText`: Formatted total distance string
 * - `durationText`: Formatted total duration string
 * - `legs`: Individual leg details for multi-stop routes
 * 
 * @param origin - Starting location coordinates
 * @param destination - Final destination location coordinates
 * @param waypoints - Optional array of intermediate stop coordinates
 * @returns Route data with coordinates, distance, and duration
 * @throws Error if API call fails or route cannot be calculated
 */
export async function getRoute(
  origin: LocationCoordinates,
  destination: LocationCoordinates,
  waypoints?: LocationCoordinates[]
): Promise<Route> {
  if (getMapProvider() === 'mapbox') {
    return getRouteMapbox(origin, destination, waypoints);
  }
  return getRouteGoogle(origin, destination, waypoints);
}

/**
 * Google Directions API implementation (internal).
 */
async function getRouteGoogle(
  origin: LocationCoordinates,
  destination: LocationCoordinates,
  waypoints?: LocationCoordinates[]
): Promise<Route> {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      const error = new Error(
        'Google Maps API key is not configured. Please set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your .env file.'
      );
      console.error('[mapService] getRoute error:', error);
      throw error;
    }
    const apiBaseUrl = getApiBaseUrl();
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;

    // Build URL with optional waypoints for multi-stop routes
    let url = `${apiBaseUrl}/directions/json?origin=${originStr}&destination=${destStr}&key=${apiKey}`;
    
    if (waypoints && waypoints.length > 0) {
      const waypointsStr = waypoints
        .map(wp => `${wp.latitude},${wp.longitude}`)
        .join('|');
      url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
    }

    console.log('[mapService] Requesting route:', { 
      origin: originStr, 
      destination: destStr,
      waypointsCount: waypoints?.length || 0,
    });
    
    const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Directions API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Directions API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      if (data.status === 'ZERO_RESULTS' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found between the specified locations');
      }

      // Get the first route (shortest by default)
      const route = data.routes[0];

    // Decode polyline to get coordinates (covers the entire route including waypoints)
      const coordinates = decodePolyline(route.overview_polyline.points);

    // Calculate total distance and duration from all legs
    let totalDistance = 0;
    let totalDuration = 0;
    const legs: RouteLeg[] = [];

    for (const leg of route.legs) {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
      legs.push({
        distance: leg.distance.value,
        duration: leg.duration.value,
        distanceText: leg.distance.text,
        durationText: leg.duration.text,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
      });
    }

    // Format total distance and duration
    const distanceText = totalDistance >= 1000
      ? `${(totalDistance / 1000).toFixed(1)} km`
      : `${totalDistance} m`;
    
    const totalMinutes = Math.round(totalDuration / 60);
    const durationText = totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)} hr ${totalMinutes % 60} min`
      : `${totalMinutes} min`;

    return {
      coordinates,
      distance: totalDistance,
      duration: totalDuration,
      distanceText,
      durationText,
      legs: legs.length > 1 ? legs : undefined, // Only include legs for multi-stop routes
      };
    } catch (error) {
      console.error('[mapService] Error calculating route:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to calculate route');
    }
}

/**
 * Reverse geocode coordinates to get address
 * Uses Google Maps Geocoding API
 * 
 * **API Endpoint**: `https://maps.googleapis.com/maps/api/geocode/json`
 * 
 * **How it works**:
 * - Makes HTTP GET request to Google Maps Geocoding API
 * - Converts latitude/longitude coordinates to a human-readable address
 * - Returns the most relevant address result
 * 
 * **Input Parameters**:
 * - `coordinates`: Location coordinates `{ latitude: number, longitude: number }`
 * 
 * **API Request Format**:
 * ```
 * GET https://maps.googleapis.com/maps/api/geocode/json?
 *   latlng={lat},{lng}&
 *   key={API_KEY}
 * ```
 * 
 * **API Response Format**:
 * ```json
 * {
 *   "status": "OK",
 *   "results": [{
 *     "formatted_address": "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA",
 *     "geometry": {
 *       "location": { "lat": 37.4224764, "lng": -122.0842499 }
 *     }
 *   }]
 * }
 * ```
 * 
 * **Output**:
 * - Formatted address string (e.g., "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA")
 * 
 * **Example**:
 * ```typescript
 * const address = await reverseGeocode(
 *   { latitude: 37.4224764, longitude: -122.0842499 }
 * );
 * // Returns: "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA"
 * ```
 * 
 * @param coordinates - Location coordinates
 * @returns Formatted address string
 * @throws Error if geocoding fails
 */
export async function reverseGeocode(coordinates: LocationCoordinates): Promise<string> {
  const provider = getMapProvider();
  console.log('[mapService] reverseGeocode using provider:', provider);
  
  if (provider === 'mapbox') {
    return reverseGeocodeMapbox(coordinates);
  }
  return reverseGeocodeGoogle(coordinates);
}

/**
 * Google Geocoding API – reverse geocode (internal).
 */
async function reverseGeocodeGoogle(coordinates: LocationCoordinates): Promise<string> {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error(
          'Google Maps API key is not configured. Please set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your .env file.'
        );
      }
      const apiBaseUrl = getApiBaseUrl();
      const latlng = `${coordinates.latitude},${coordinates.longitude}`;

      const url = `${apiBaseUrl}/geocode/json?latlng=${latlng}&key=${apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Geocoding API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Geocoding API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      if (!data.results || data.results.length === 0) {
        throw new Error('No address found for the specified coordinates');
      }

      // Return the formatted address from the first result
      return data.results[0].formatted_address;
    } catch (error) {
      console.error('[mapService] Error reverse geocoding:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to get address from coordinates');
    }
}

/**
 * Search for places using Google Places API Autocomplete
 * 
 * **API Endpoint**: `https://maps.googleapis.com/maps/api/place/autocomplete/json`
 * 
 * **How it works**:
 * - Makes HTTP GET request to Google Places API Autocomplete
 * - Returns place predictions based on user's search query
 * - Can be biased to a specific location for better local results
 * - Used for location search/autocomplete in pickup/dropoff fields
 * 
 * **Input Parameters**:
 * - `query`: Search query string (e.g., "coffee shop", "123 Main St")
 * - `location`: Optional location bias coordinates `{ latitude: number, longitude: number }`
 *   - If provided, results are biased towards this location (50km radius)
 *   - Improves relevance of results for local searches
 * - `countryCode`: Optional country code to restrict search results (default: 'ph' for Philippines)
 *   - Uses ISO 3166-1 alpha-2 country codes (e.g., 'ph', 'us', 'sg')
 *   - Restricts search results to the specified country only
 * 
 * **API Request Format**:
 * ```
 * GET https://maps.googleapis.com/maps/api/place/autocomplete/json?
 *   input={encoded_query}&
 *   location={lat},{lng}&
 *   radius=50000&
 *   key={API_KEY}
 * ```
 * 
 * **API Response Format**:
 * ```json
 * {
 *   "status": "OK",
 *   "predictions": [{
 *     "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
 *     "description": "Sydney NSW, Australia",
 *     "structured_formatting": {
 *       "main_text": "Sydney",
 *       "secondary_text": "NSW, Australia"
 *     }
 *   }]
 * }
 * ```
 * 
 * **Output**:
 * - Array of `PlacePrediction` objects:
 *   - `placeId`: Unique place identifier (used to get full details)
 *   - `mainText`: Primary text (place name)
 *   - `secondaryText`: Secondary text (address/area)
 *   - `description`: Full description string
 * 
 * **Example**:
 * ```typescript
 * const predictions = await searchPlaces(
 *   "coffee shop",
 *   { latitude: 37.7749, longitude: -122.4194 } // San Francisco
 * );
 * // Returns: [{ placeId: "...", mainText: "Blue Bottle Coffee", ... }, ...]
 * ```
 * 
 * @param query - Search query string
 * @param location - Optional location bias (improves results)
 * @param countryCode - Country code to restrict search results (default: 'ph' for Philippines)
 * @returns Array of place predictions
 * @throws Error if search fails
 */
export async function searchPlaces(
  query: string,
  location?: LocationCoordinates,
  countryCode: string = 'ph' // Default to Philippines
): Promise<PlacePrediction[]> {
  // Always use Google Places API for location search, regardless of map provider
  // Map rendering uses Mapbox, but search uses Google Places API
  console.log('[mapService] searchPlaces using Google Places API (map rendering uses Mapbox), query:', query, 'country:', countryCode);
  
  return searchPlacesGoogle(query, location, countryCode);
}

/**
 * Google Places Autocomplete implementation (internal).
 */
async function searchPlacesGoogle(
  query: string,
  location?: LocationCoordinates,
  countryCode: string = 'ph'
): Promise<PlacePrediction[]> {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error(
          'Google Maps API key is not configured. Please set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your .env file.'
        );
      }
      const apiBaseUrl = getApiBaseUrl();
      let url = `${apiBaseUrl}/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&components=country:${countryCode}`;

      // Add location bias if provided
      if (location) {
        const locationStr = `${location.latitude},${location.longitude}`;
        url += `&location=${locationStr}&radius=50000`; // 50km radius
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Places API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      if (data.status === 'ZERO_RESULTS' || !data.predictions) {
        return [];
      }

      // Map predictions to our interface
      return data.predictions.map((prediction: any) => ({
        placeId: prediction.place_id,
        mainText: prediction.structured_formatting?.main_text || prediction.description,
        secondaryText: prediction.structured_formatting?.secondary_text || '',
        description: prediction.description,
      }));
    } catch (error) {
      console.error('[mapService] Error searching places:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to search places');
    }
}

/**
 * Get place details using Google Places API Place Details
 * 
 * **API Endpoint**: `https://maps.googleapis.com/maps/api/place/details/json`
 * 
 * **How it works**:
 * - Makes HTTP GET request to Google Places API Place Details
 * - Takes a place ID (from autocomplete result) and returns full place information
 * - Used after user selects a location from autocomplete to get coordinates
 * 
 * **Input Parameters**:
 * - `placeId`: Place ID string from autocomplete prediction
 *   - Obtained from `searchPlaces()` function result
 *   - Example: "ChIJN1t_tDeuEmsRUsoyG83frY4"
 * 
 * **API Request Format**:
 * ```
 * GET https://maps.googleapis.com/maps/api/place/details/json?
 *   place_id={place_id}&
 *   fields=place_id,formatted_address,geometry,name&
 *   key={API_KEY}
 * ```
 * 
 * **Note**: We only request specific fields to reduce API costs and response size:
 * - `place_id`: Place identifier
 * - `formatted_address`: Full formatted address
 * - `geometry`: Location coordinates
 * - `name`: Place name
 * 
 * **API Response Format**:
 * ```json
 * {
 *   "status": "OK",
 *   "result": {
 *     "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
 *     "name": "Sydney Opera House",
 *     "formatted_address": "Bennelong Point, Sydney NSW 2000, Australia",
 *     "geometry": {
 *       "location": {
 *         "lat": -33.8567844,
 *         "lng": 151.213108
 *       }
 *     }
 *   }
 * }
 * ```
 * 
 * **Output**:
 * - `PlaceDetails` object:
 *   - `placeId`: Place identifier
 *   - `formattedAddress`: Full formatted address string
 *   - `coordinates`: Location coordinates `{ latitude: number, longitude: number }`
 *   - `name`: Place name (optional)
 * 
 * **Example**:
 * ```typescript
 * // First, search for places
 * const predictions = await searchPlaces("Sydney Opera");
 * // Returns: [{ placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4", ... }]
 * 
 * // Then, get full details
 * const details = await getPlaceDetails(predictions[0].placeId);
 * // Returns: {
 * //   placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
 * //   formattedAddress: "Bennelong Point, Sydney NSW 2000, Australia",
 * //   coordinates: { latitude: -33.8567844, longitude: 151.213108 },
 * //   name: "Sydney Opera House"
 * // }
 * ```
 * 
 * @param placeId - Place ID from autocomplete result
 * @returns Place details with coordinates and address
 * @throws Error if place details cannot be retrieved
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  // Always use Google Places API for place details, since search uses Google Places API
  // Place IDs from Google Places search must be resolved using Google Places API
  return getPlaceDetailsGoogle(placeId);
}

/**
 * Google Place Details implementation (internal).
 */
async function getPlaceDetailsGoogle(placeId: string): Promise<PlaceDetails> {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error(
          'Google Maps API key is not configured. Please set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your .env file.'
        );
      }
      const apiBaseUrl = getApiBaseUrl();
      const url = `${apiBaseUrl}/place/details/json?place_id=${placeId}&fields=place_id,formatted_address,geometry,name&key=${apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Places API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      if (!data.result) {
        throw new Error('Place details not found');
      }

      const result = data.result;
      const location = result.geometry?.location;

      if (!location) {
        throw new Error('Place location not found');
      }

      return {
        placeId: result.place_id,
        formattedAddress: result.formatted_address,
        coordinates: {
          latitude: location.lat,
          longitude: location.lng,
        },
        name: result.name,
      };
    } catch (error) {
      console.error('[mapService] Error getting place details:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to get place details');
    }
}

/**
 * Map service object for convenience
 * Provides all map service functions in a single object
 */
export const mapService = {
  getRoute,
  reverseGeocode,
  searchPlaces,
  getPlaceDetails,
};

