/**
 * Map-related types for Google Maps integration
 */

import type { LocationCoordinates } from './booking';

/**
 * Map marker interface
 * Represents a marker on the map
 */
export interface MapMarker {
  /** Unique identifier for the marker */
  id: string;
  /** Marker coordinates */
  coordinates: LocationCoordinates;
  /** Marker title */
  title?: string;
  /** Marker description */
  description?: string;
  /** Marker type (for styling) */
  type?: 'pickup' | 'dropoff' | 'driver' | 'default';
  /** Custom icon (optional) */
  icon?: string;
}

/**
 * Individual leg of a route (between two consecutive stops)
 */
export interface RouteLeg {
  /** Distance in meters for this leg */
  distance: number;
  /** Duration in seconds for this leg */
  duration: number;
  /** Formatted distance string (e.g., "5.2 km") */
  distanceText?: string;
  /** Formatted duration string (e.g., "18 mins") */
  durationText?: string;
  /** Start address of this leg */
  startAddress?: string;
  /** End address of this leg */
  endAddress?: string;
}

/**
 * Route data structure
 * Represents a calculated route between two or more points
 * Supports multi-stop routes with waypoints
 */
export interface Route {
  /** Array of coordinates forming the route polyline */
  coordinates: LocationCoordinates[];
  /** Total distance in meters (sum of all legs) */
  distance: number;
  /** Total duration in seconds (sum of all legs) */
  duration: number;
  /** Formatted total distance string (e.g., "15.2 km") */
  distanceText?: string;
  /** Formatted total duration string (e.g., "45 mins") */
  durationText?: string;
  /** Individual legs of the route (for multi-stop routes) */
  legs?: RouteLeg[];
}

/**
 * Location with address
 * Used when location is selected (from pin or search)
 */
export interface LocationWithAddress {
  /** Location coordinates */
  coordinates: LocationCoordinates;
  /** Formatted address string */
  address: string;
}

/**
 * Place prediction from Google Places API Autocomplete
 */
export interface PlacePrediction {
  /** Place ID (used to get place details) */
  placeId: string;
  /** Main text (name of the place) */
  mainText: string;
  /** Secondary text (address) */
  secondaryText: string;
  /** Full description */
  description: string;
}

/**
 * Place details from Google Places API
 */
export interface PlaceDetails {
  /** Place ID */
  placeId: string;
  /** Formatted address */
  formattedAddress: string;
  /** Location coordinates */
  coordinates: LocationCoordinates;
  /** Place name */
  name?: string;
}

/**
 * Map region interface
 * Used to define the visible area of the map
 */
export interface MapRegion {
  /** Center latitude */
  latitude: number;
  /** Center longitude */
  longitude: number;
  /** Latitude delta (zoom level) */
  latitudeDelta: number;
  /** Longitude delta (zoom level) */
  longitudeDelta: number;
}

