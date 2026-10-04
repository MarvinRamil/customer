/**
 * Shared MapView component – supports Google and Mapbox via EXPO_PUBLIC_MAP_PROVIDER
 * Supports both booking and tracking modes with slide functionality
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

// Lazy-load react-native-maps only when provider is Google, so builds without the
// react-native-maps native module (e.g. Mapbox-only or Expo Go) don't crash.
let RNMapView: any;
let MapPressEvent: any;
let Marker: any;
let Polyline: any;
let PROVIDER_GOOGLE: any;
let Region: any;

if (Platform.OS !== 'web') {
  const p = process.env.EXPO_PUBLIC_MAP_PROVIDER?.toLowerCase().trim();
  if (p === 'google') {
    try {
      const RNMaps = require('react-native-maps');
      RNMapView = RNMaps.default;
      MapPressEvent = RNMaps.MapPressEvent;
      Marker = RNMaps.Marker;
      Polyline = RNMaps.Polyline;
      PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
      Region = RNMaps.Region;
    } catch {
      // Native module not in binary (e.g. dev build without react-native-maps plugin)
      // RNMapView stays undefined; MapView will fallback to Mapbox below.
    }
  }
}

// Conditionally import Mapbox components only on native platforms (not web)
let Mapbox: any;
let MapboxCamera: any;
let MapboxLineLayer: any;
let MapboxMapView: any;
let MapboxPointAnnotation: any;
let MapboxShapeSource: any;
let MapboxUserLocation: any;
let StyleURL: any;

if (Platform.OS !== 'web') {
  const MapboxModule = require('@rnmapbox/maps');
  Mapbox = MapboxModule.default;
  MapboxCamera = MapboxModule.Camera;
  MapboxLineLayer = MapboxModule.LineLayer;
  MapboxMapView = MapboxModule.MapView;
  MapboxPointAnnotation = MapboxModule.PointAnnotation;
  MapboxShapeSource = MapboxModule.ShapeSource;
  MapboxUserLocation = MapboxModule.UserLocation;
  StyleURL = MapboxModule.StyleURL;
}

import { useTheme } from '@/shared/hooks/use-theme';
import {
  useInterpolatedCoordinate,
  useThrottledCoordinate,
} from '@/shared/hooks/useInterpolatedCoordinate';
import { configService } from '@/shared/services/configService';
import { snapToRoute } from '@/shared/utils/snapToRoute';

/**
 * How long the driver marker takes to glide to a new position. Matched to the driver app's
 * publish cadence (LOCATION_UPDATE_INTERVAL_MS) so one glide ends about as the next fix
 * lands — longer stutters, shorter leaves the marker parked between updates.
 */
const DRIVER_MARKER_ANIMATION_MS = 4000;

/**
 * Camera zoom held while following the driver.
 *
 * Street-level: close enough to read which road the truck is on, wide enough that one hop
 * between fixes never leaves the frame.
 */
const DRIVER_FOLLOW_ZOOM = 15.5;

/**
 * How far off the drawn route a fix may be and still be snapped onto it. Wide enough to
 * absorb ordinary GPS error and multi-lane roads, tight enough that a real detour shows.
 */
const DRIVER_SNAP_MAX_DISTANCE_M = 40;

/** Route is only recalculated once the driver moves this far, or this long has passed. */
const ROUTE_RECALC_DISTANCE_M = 100;
const ROUTE_RECALC_INTERVAL_MS = 30000;
import { mapService } from '@/shared/services/mapService';
import type { LocationCoordinates } from '@/shared/types/booking';
import type {
  LocationWithAddress,
  MapMarker,
  MapRegion,
  Route,
} from '@/shared/types/map';

/** Map provider: same logic as mapService (default mapbox when unset) */
function getMapProvider(): 'google' | 'mapbox' {
  const p = process.env.EXPO_PUBLIC_MAP_PROVIDER?.toLowerCase().trim();
  return p === 'google' ? 'google' : 'mapbox';
}

/**
 * MapView component props
 */
/** Imperative handle exposed via ref, for recentering the camera from outside the component. */
export interface MapViewHandle {
  /** Moves the camera to the given coordinates. Animated unless `animated` is false. */
  centerOnLocation: (coordinates: LocationCoordinates, options?: { zoom?: number; animated?: boolean }) => void;
}

export interface MapViewProps {
  /** Map mode: 'booking' for location selection, 'tracking' for route display */
  mode: 'booking' | 'tracking';
  /** Initial map region */
  initialRegion?: MapRegion | Region;
  /** Array of markers to display */
  markers?: MapMarker[];
  /** Pickup location coordinates */
  pickupLocation?: LocationCoordinates;
  /** Dropoff location coordinates (single dropoff - for backwards compatibility) */
  dropoffLocation?: LocationCoordinates;
  /** Multiple dropoff locations (for multi-stop routes - takes precedence over dropoffLocation) */
  dropoffLocations?: LocationCoordinates[];
  /** Driver location coordinates (for tracking mode). `heading` rotates the marker. */
  driverLocation?: LocationCoordinates & { heading?: number };
  /** Callout text for the driver marker, e.g. "Juan - 5 mins away" */
  driverLabel?: string;
  /** Booking status (affects route drawing) */
  bookingStatus?: 'pending' | 'assigned' | 'on_the_way_to_pickup' | 'pickup_completed' | 'on_the_way_to_dropoff' | 'delivered' | 'cancelled';
  /** When set, route is drawn from driver to this location only (active stop – rider to active stop) */
  activeDropoffForRoute?: LocationCoordinates;
  /** When set, route uses this list only (e.g. exclude completed stops); points still use dropoffLocations */
  dropoffLocationsForRoute?: LocationCoordinates[];
  /** Whether map is expanded */
  isExpanded?: boolean;
  /** Callback when location is selected (returns coordinates and address) */
  onLocationSelect?: (location: LocationWithAddress) => void;
  /** Callback when location is confirmed (full-screen mode) */
  onLocationConfirm?: (location: LocationWithAddress) => void;
  /** Callback when map should expand */
  onExpand?: () => void;
  /** Callback when map should collapse */
  onCollapse?: () => void;
  /** Callback when marker is pressed */
  onMarkerPress?: (marker: MapMarker) => void;
  /** Callback when map region changes */
  onRegionChange?: (region: Region) => void;
  /** Callback when route is calculated (returns distance and duration) */
  onRouteCalculated?: (distance: string, duration: string) => void;
  /** Whether to show map controls */
  showControls?: boolean;
  /** Whether map pan/scroll is enabled (e.g. false when bottom sheet is minimized to prevent map scroll) */
  scrollEnabled?: boolean;
  /** Custom style */
  style?: ViewStyle;
}

/**
 * Driver marker that glides between location updates instead of jumping.
 *
 * Deliberately a module-scope component: the interpolation updates state several times a
 * second, and defining it inside MapViewComponent would both re-render the whole map on
 * every frame and remount the marker on every parent render.
 */
function MapboxDriverMarker({
  driverLocation,
  durationMs,
  title,
}: {
  driverLocation: LocationCoordinates & { heading?: number };
  durationMs: number;
  title?: string;
}) {
  const animated = useInterpolatedCoordinate(driverLocation, durationMs);
  const position = animated ?? driverLocation;

  return (
    <MapboxPointAnnotation
      id="driver"
      coordinate={[position.longitude, position.latitude]}
      title={title}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.truckMarkerContainer}>
        <View style={styles.truckMarker}>
          {position.heading != null ? (
            // Ionicons' "navigate" arrow is drawn pointing north-east, so back it off 45°
            // for the rotation to land on the true bearing.
            <Ionicons
              name="navigate"
              size={20}
              color="white"
              style={{ transform: [{ rotate: `${position.heading - 45}deg` }] }}
            />
          ) : (
            <Ionicons name="car" size={22} color="white" />
          )}
        </View>
      </View>
    </MapboxPointAnnotation>
  );
}

/**
 * Google-provider twin of MapboxDriverMarker. Rendering `driverLocation` straight onto a
 * <Marker> teleported the driver on every fix; this glides it the same way Mapbox already did.
 *
 * Module-scope for the same reason as above. `tracksViewChanges` is dropped after the first
 * paint because react-native-maps re-rasterises a custom marker view on every render while
 * it is true — at the interpolation's frame rate that is enough to stutter the whole map.
 */
function GoogleDriverMarker({
  driverLocation,
  durationMs,
  title,
}: {
  driverLocation: LocationCoordinates & { heading?: number };
  durationMs: number;
  title?: string;
}) {
  const animated = useInterpolatedCoordinate(driverLocation, durationMs);
  const position = animated ?? driverLocation;

  // Starts true so the icon is captured once, then off to keep the glide cheap.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timeoutId = setTimeout(() => setTracksViewChanges(false), 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: position.latitude, longitude: position.longitude }}
      title={title}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.truckMarkerContainer}>
        <View style={styles.truckMarker}>
          <Ionicons name="car" size={22} color="white" />
        </View>
      </View>
    </Marker>
  );
}

/**
 * MapView component
 * Displays Google Maps with support for booking and tracking modes
 */
function MapViewComponentImpl(
  {
    mode,
    initialRegion,
    markers = [],
    pickupLocation,
    dropoffLocation,
    dropoffLocations,
    driverLocation,
    driverLabel,
    bookingStatus,
    activeDropoffForRoute,
    dropoffLocationsForRoute,
    isExpanded = false,
    onLocationSelect,
    onLocationConfirm,
    onExpand,
    onCollapse,
    onMarkerPress,
    onRegionChange,
    onRouteCalculated,
    showControls = true,
    scrollEnabled = true,
    style,
  }: MapViewProps,
  ref: React.Ref<MapViewHandle>
) {
  const theme = useTheme();
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationCoordinates | null>(null);
  const mapRef = useRef<RNMapView>(null);
  const mapboxCameraRef = useRef<React.ComponentRef<typeof MapboxCamera>>(null);
  const slideAnimation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  const mapProvider = useMemo(() => getMapProvider(), []);

  useImperativeHandle(
    ref,
    () => ({
      centerOnLocation: (coordinates, options) => {
        if (!coordinates) return;
        const { latitude, longitude } = coordinates;
        if (
          typeof latitude !== 'number' ||
          typeof longitude !== 'number' ||
          Number.isNaN(latitude) ||
          Number.isNaN(longitude) ||
          (latitude === 0 && longitude === 0)
        ) {
          return;
        }
        const zoom = options?.zoom ?? DRIVER_FOLLOW_ZOOM;
        const durationMs = options?.animated === false ? 0 : 500;

        if (getMapProvider() === 'mapbox' && mapboxCameraRef.current) {
          mapboxCameraRef.current.setCamera({
            centerCoordinate: [longitude, latitude],
            zoomLevel: zoom,
            animationDuration: durationMs,
            animationMode: 'easeTo',
          });
        } else if (mapRef.current) {
          mapRef.current.animateCamera({ center: { latitude, longitude }, zoom }, { duration: durationMs });
        }
      },
    }),
    []
  );

  /**
   * Whether the dedicated driver marker is on screen. Callers also push the driver into
   * `markers`, so both render paths have to agree on who owns it or it gets drawn twice.
   */
  const isDriverMarkerRendered = Boolean(driverLocation) && mode === 'tracking';

  /**
   * Same condition, in a ref, for the route callback below.
   *
   * That callback is asynchronous and its effect does not depend on `driverLocation`, so
   * reading the value directly there would close over whatever it was when the request was
   * issued — and get it wrong exactly when the first fix arrives mid-flight.
   */
  const isFollowingDriverRef = useRef(isDriverMarkerRendered);
  isFollowingDriverRef.current = isDriverMarkerRendered;

  /**
   * Anchor for route calculation. Every change here costs a Directions request, so it only
   * moves once the driver has actually gone somewhere — otherwise the faster location
   * cadence would multiply that billed traffic for a route that barely changes.
   */
  /**
   * Driver position pinned to the drawn route, so the marker travels along the road instead
   * of cutting between raw GPS fixes. Falls back to the raw fix when the driver is genuinely
   * off-route — see snapToRoute.
   */
  const snappedDriverLocation = useMemo(
    () => snapToRoute(driverLocation, route?.coordinates, DRIVER_SNAP_MAX_DISTANCE_M),
    [driverLocation, route?.coordinates]
  );

  const routeDriverLocation = useThrottledCoordinate(
    driverLocation,
    ROUTE_RECALC_DISTANCE_M,
    ROUTE_RECALC_INTERVAL_MS
  );

  /**
   * Which leg the camera was last framed for. The route is recalculated whenever the driver
   * moves past ROUTE_RECALC_DISTANCE_M (or the interval elapses), and re-fitting on every one
   * of those yanked the view out to span pickup + every dropoff + the driver — which reads as
   * the driver marker vanishing and coming back. Re-frame only when the leg itself changes.
   */
  const lastRouteFitKeyRef = useRef<string | null>(null);

  /**
   * Set Mapbox access token before first Mapbox map render (required by SDK)
   */
  useEffect(() => {
    if (mapProvider !== 'mapbox') return;
    // Vault value (configService, with env fallback) takes precedence. Use `||` so an
    // empty extra.mapboxAccessToken ("" when the env var is commented out) falls through.
    const token =
      configService.getMapboxAccessToken()?.trim() ||
      (Constants.expoConfig?.extra?.mapboxAccessToken as string | undefined);
    if (token && token !== 'your_mapbox_public_token_here') {
      Mapbox.setAccessToken(token);
      // Opt out of Mapbox's usage/location telemetry, which is on by default. Keeps
      // "App interactions" off the Play Data safety declaration. Must run after
      // setAccessToken — the Android implementation instantiates a MapView internally.
      Mapbox.setTelemetryEnabled(false);
    }
  }, [mapProvider]);


  /**
   * Handle map press to drop a pin and get address
   */
  const handleMapPress = useCallback(
    async (event: MapPressEvent) => {
      if (mode !== 'booking' || !onLocationSelect) {
        return;
      }

      const { latitude, longitude } = event.nativeEvent.coordinate;
      const coordinates: LocationCoordinates = { latitude, longitude };

      // Show temporary marker immediately for visual feedback
      setSelectedLocation(coordinates);

      try {
        // Call reverse geocoding to get address
        const address = await mapService.reverseGeocode(coordinates);
        const locationWithAddress: LocationWithAddress = {
          coordinates,
          address,
        };

        // Call callback with both coordinates and address
        onLocationSelect(locationWithAddress);
        
        // Clear temporary marker after selection is processed
        // The permanent marker will be shown via pickupLocation/dropoffLocation props
        setSelectedLocation(null);
      } catch (error) {
        // Handle errors gracefully - don't crash the component
        console.error('[MapView] Error reverse geocoding:', error);
        console.warn('[MapView] Reverse geocoding failed, using coordinates as address');
        // Still return coordinates even if geocoding fails
        onLocationSelect({
          coordinates,
          address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        });
        // Clear temporary marker
        setSelectedLocation(null);
        // Don't throw - let the map continue to function
      }
    },
    [mode, onLocationSelect]
  );

  /**
   * Handle Mapbox map press: extract coordinates from event and reverse geocode
   * Mapbox onPress event structure: { geometry: { coordinates: [lng, lat] }, properties: {...} }
   */
  const handleMapboxMapPress = useCallback(
    async (event: { geometry: { coordinates: [number, number] }; properties?: any }) => {
      try {
        console.log('[MapView] Mapbox map pressed, event:', JSON.stringify(event));
        console.log('[MapView] mode:', mode, 'onLocationSelect:', !!onLocationSelect);
        
        if (mode !== 'booking' || !onLocationSelect) {
          console.log('[MapView] Early return - mode or callback issue');
          return;
        }
        
        const geom = event?.geometry;
        console.log('[MapView] Geometry:', geom);
        
        if (!geom || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
          console.log('[MapView] Invalid geometry or coordinates');
          return;
        }
        
        const [longitude, latitude] = geom.coordinates;
        console.log('[MapView] Coordinates - lat:', latitude, 'lng:', longitude);
        
        // Validate coordinates
        if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
            isNaN(latitude) || isNaN(longitude) ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180) {
          console.error('[MapView] Invalid coordinates:', { latitude, longitude });
          return;
        }
        
        const coordinates: LocationCoordinates = { latitude, longitude };
        setSelectedLocation(coordinates);
        
        try {
          console.log('[MapView] Calling reverseGeocode...');
          const address = await mapService.reverseGeocode(coordinates);
          console.log('[MapView] Reverse geocode result:', address);
          onLocationSelect({ coordinates, address });
          setSelectedLocation(null);
        } catch (error) {
          console.error('[MapView] Mapbox reverse geocode error:', error);
          // Still call onLocationSelect with coordinates even if geocoding fails
          onLocationSelect({
            coordinates,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          });
          setSelectedLocation(null);
        }
      } catch (error) {
        // Catch any unexpected errors to prevent white screen
        console.error('[MapView] Unexpected error in handleMapboxMapPress:', error);
        setMapError('An error occurred while selecting location. Please try again.');
        // Clear error after a delay
        setTimeout(() => setMapError(null), 5000);
      }
    },
    [mode, onLocationSelect]
  );

  /**
   * Calculate and draw route when pickup and dropoff are available
   * 
   * **TODO - Backend Integration**: Once backend is completed, this logic will be updated to:
   * - Use actual booking status values from backend API
   * - Handle all booking status transitions (on_the_way_to_pickup, pickup_completed, on_the_way_to_dropoff, etc.)
   * - Draw routes based on real-time driver location updates
   * - Support dynamic route updates as driver moves
   */
  useEffect(() => {
    const provider = getMapProvider();
    if (provider === 'google') {
      const apiKey = configService.getGoogleMapsApiKey();
      if (!apiKey || apiKey === 'your_api_key_here' || apiKey.trim() === '') {
        console.warn('[MapView] API key not available, skipping route calculation');
        setRoute(null);
        return;
      }
    }
    // Mapbox token is set in separate effect when provider is mapbox

    // Helper function to validate coordinates
    const isValidCoordinate = (coord: LocationCoordinates | undefined | null): boolean => {
      if (!coord) return false;
      // Check if coordinates are valid (not 0,0 and within valid ranges)
      return (
        coord.latitude !== 0 &&
        coord.longitude !== 0 &&
        coord.latitude >= -90 &&
        coord.latitude <= 90 &&
        coord.longitude >= -180 &&
        coord.longitude <= 180
      );
    };

    // For booking mode: Support multi-stop routes
    // Use dropoffLocations array if provided, otherwise fall back to single dropoffLocation
    const allDropoffs = dropoffLocations?.filter(isValidCoordinate) || 
      (isValidCoordinate(dropoffLocation) ? [dropoffLocation] : []);

    // Booking mode requires pickup + at least one dropoff. Tracking mode can draw driver→pickup only (no dropoff).
    if (mode === 'booking' && (!isValidCoordinate(pickupLocation) || allDropoffs.length === 0)) {
      setRoute(null);
      return;
    }
    if (mode === 'tracking' && !isValidCoordinate(pickupLocation)) {
      setRoute(null);
      return;
    }

    // For booking mode: always draw route when pickup and at least one dropoff selected
    if (mode === 'booking') {
      setIsLoadingRoute(true);
      // Use setTimeout to defer route calculation and prevent blocking render
      const timeoutId = setTimeout(() => {
        // For multi-stop: destination is the last dropoff, waypoints are intermediate dropoffs
        // We know allDropoffs has at least 1 element because we return early if length === 0
        const finalDestination = allDropoffs[allDropoffs.length - 1] as LocationCoordinates;
        const waypoints = allDropoffs.length > 1 
          ? (allDropoffs.slice(0, -1) as LocationCoordinates[]) 
          : undefined;

        mapService
          .getRoute(pickupLocation as LocationCoordinates, finalDestination, waypoints)
          .then((calculatedRoute) => {
            try {
              setRoute(calculatedRoute);
              // Notify parent component of route calculation (total distance/duration)
              if (onRouteCalculated && calculatedRoute.distanceText && calculatedRoute.durationText) {
                onRouteCalculated(calculatedRoute.distanceText, calculatedRoute.durationText);
              }
              // Fit map to show entire route (only in booking mode, and only once)
              if (calculatedRoute.coordinates.length > 0 && mode === 'booking') {
                requestAnimationFrame(() => {
                  if (getMapProvider() === 'mapbox' && mapboxCameraRef.current) {
                    const coords = calculatedRoute.coordinates;
                    const lngs = coords.map((c) => c.longitude);
                    const lats = coords.map((c) => c.latitude);
                    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
                    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
                    mapboxCameraRef.current.fitBounds(ne, sw, 50, 500);
                  } else if (mapRef.current) {
                    mapRef.current.fitToCoordinates(calculatedRoute.coordinates, {
                      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                      animated: true,
                    });
                  }
                });
              }
            } catch (error) {
              console.error('[MapView] Error processing route result:', error);
            }
          })
          .catch((error) => {
            // Handle errors gracefully - don't crash the component
            console.error('[MapView] Error calculating route:', error);
            console.warn('[MapView] Route calculation failed, but map will continue to work');
            setRoute(null);
            // Don't throw - let the map continue to function
          })
          .finally(() => {
            setIsLoadingRoute(false);
          });
      }, 100); // Small delay to prevent blocking initial render

      return () => {
        clearTimeout(timeoutId);
      };
    }

    // For tracking mode: draw route based on booking status and driver location
    if (mode === 'tracking') {
      setIsLoadingRoute(true);
      
      // Use setTimeout to defer route calculation and prevent blocking render
      const timeoutId = setTimeout(() => {
        let routePromise: Promise<Route> | null = null;
        
        // Helper function to validate coordinates
        const isValidCoordinate = (coord: LocationCoordinates | undefined | null): boolean => {
          if (!coord) return false;
          // Check if coordinates are valid (not 0,0 and within valid ranges)
          return (
            coord.latitude !== 0 &&
            coord.longitude !== 0 &&
            coord.latitude >= -90 &&
            coord.latitude <= 90 &&
            coord.longitude >= -180 &&
            coord.longitude <= 180
          );
        };

        // For route only: use dropoffLocationsForRoute when provided (e.g. exclude completed); else dropoffLocations (points stay full)
        const allDropoffsForRoute = (dropoffLocationsForRoute?.length ? dropoffLocationsForRoute : dropoffLocations)?.filter(isValidCoordinate) ||
          (isValidCoordinate(dropoffLocation) ? [dropoffLocation] : []);
        const allDropoffs = allDropoffsForRoute;
        
        // Helper to get route with waypoints for multi-stop
        const getRouteWithWaypoints = (
          origin: LocationCoordinates,
          destination: LocationCoordinates,
          waypoints?: LocationCoordinates[]
        ) => {
          if (waypoints && waypoints.length > 0) {
            return mapService.getRoute(origin, destination, waypoints);
          }
          return mapService.getRoute(origin, destination);
        };

        // Determine route based on booking status
        // Priority: Use driver location as origin when available
        // Note: Type assertions used because isValidCoordinate() doesn't narrow types
        if (bookingStatus === 'pending' || bookingStatus === 'assigned') {
          // Pending/Assigned: Use driver location if available, otherwise pickup to dropoff(s)
          if (isValidCoordinate(routeDriverLocation) && allDropoffs.length > 0) {
            // Driver is assigned: Show route from driver to final dropoff (with waypoints if multi-stop)
            const finalDestination = allDropoffs[allDropoffs.length - 1] as LocationCoordinates;
            const waypoints = allDropoffs.length > 1 
              ? (allDropoffs.slice(0, -1) as LocationCoordinates[]) 
              : undefined;
            routePromise = getRouteWithWaypoints(routeDriverLocation as LocationCoordinates, finalDestination, waypoints);
          } else if (isValidCoordinate(pickupLocation) && allDropoffs.length > 0) {
            // No driver location yet: Show route from pickup to final dropoff (with waypoints if multi-stop)
            const finalDestination = allDropoffs[allDropoffs.length - 1] as LocationCoordinates;
            const waypoints = allDropoffs.length > 1 
              ? (allDropoffs.slice(0, -1) as LocationCoordinates[]) 
              : undefined;
            routePromise = getRouteWithWaypoints(pickupLocation as LocationCoordinates, finalDestination, waypoints);
          }
        } else if (bookingStatus === 'on_the_way_to_pickup' && isValidCoordinate(routeDriverLocation) && isValidCoordinate(pickupLocation)) {
          // Driver is on the way to pickup: Show route from driver to pickup
          routePromise = mapService.getRoute(routeDriverLocation as LocationCoordinates, pickupLocation as LocationCoordinates);
        } else if ((bookingStatus === 'pickup_completed' || bookingStatus === 'on_the_way_to_dropoff') && isValidCoordinate(routeDriverLocation)) {
          // When activeDropoffForRoute is set: draw route from rider/driver to active stop only
          if (activeDropoffForRoute && isValidCoordinate(activeDropoffForRoute)) {
            const toActiveStop: LocationCoordinates = {
              latitude: Number(activeDropoffForRoute.latitude),
              longitude: Number(activeDropoffForRoute.longitude),
            };
            routePromise = mapService.getRoute(routeDriverLocation as LocationCoordinates, toActiveStop);
          } else if (allDropoffs.length > 0) {
            const finalDestination = allDropoffs[allDropoffs.length - 1] as LocationCoordinates;
            const waypoints = allDropoffs.length > 1 ? (allDropoffs.slice(0, -1) as LocationCoordinates[]) : undefined;
            routePromise = getRouteWithWaypoints(routeDriverLocation as LocationCoordinates, finalDestination, waypoints);
          }
        } else if (bookingStatus === 'delivered' || bookingStatus === 'cancelled') {
          // Delivered or cancelled: Don't show route
          setRoute(null);
          setIsLoadingRoute(false);
          return;
        } else if (isValidCoordinate(routeDriverLocation) && allDropoffs.length > 0) {
          // Fallback: Use driver location if available, otherwise pickup to dropoff(s)
          const finalDestination = allDropoffs[allDropoffs.length - 1] as LocationCoordinates;
          const waypoints = allDropoffs.length > 1 
            ? (allDropoffs.slice(0, -1) as LocationCoordinates[]) 
            : undefined;
          routePromise = getRouteWithWaypoints(routeDriverLocation as LocationCoordinates, finalDestination, waypoints);
        } else if (isValidCoordinate(pickupLocation) && allDropoffs.length > 0) {
          // Final fallback: Show route from pickup to final dropoff (with waypoints if multi-stop)
          const finalDestination = allDropoffs[allDropoffs.length - 1] as LocationCoordinates;
          const waypoints = allDropoffs.length > 1 
            ? (allDropoffs.slice(0, -1) as LocationCoordinates[]) 
            : undefined;
          routePromise = getRouteWithWaypoints(pickupLocation as LocationCoordinates, finalDestination, waypoints);
        }
        
        if (routePromise) {
          routePromise
            .then((calculatedRoute) => {
              try {
                setRoute(calculatedRoute);
                // Notify parent component of route calculation (for ETA display)
                if (onRouteCalculated && calculatedRoute.distanceText && calculatedRoute.durationText) {
                  onRouteCalculated(calculatedRoute.distanceText, calculatedRoute.durationText);
                }
                // Fit map to show entire route with all relevant points
                // Only re-frame when the driver switches leg (heading to pickup vs to a
                // given dropoff). Position changes alone must not move the camera, or the
                // marker appears to jump away every time a fix lands.
                const routeFitKey = [
                  bookingStatus ?? '',
                  activeDropoffForRoute
                    ? `${activeDropoffForRoute.latitude},${activeDropoffForRoute.longitude}`
                    : '',
                ].join('|');

                // Skip entirely while following the driver. Fitting the whole trip would zoom
                // out to span pickup, every dropoff and the driver, and the follow effect
                // would haul it straight back on the next fix — a visible lurch each leg.
                if (
                  !isFollowingDriverRef.current &&
                  calculatedRoute.coordinates.length > 0 &&
                  lastRouteFitKeyRef.current !== routeFitKey
                ) {
                  lastRouteFitKeyRef.current = routeFitKey;
                  const coordinatesToFit = [calculatedRoute.coordinates[0], calculatedRoute.coordinates[calculatedRoute.coordinates.length - 1]];
                  if (routeDriverLocation) coordinatesToFit.push(routeDriverLocation);
                  if (pickupLocation) coordinatesToFit.push(pickupLocation);
                  // Add all dropoff locations (from stops array or single dropoff)
                  if (allDropoffs.length > 0) {
                    allDropoffs.forEach(dropoff => coordinatesToFit.push(dropoff));
                  }

                  requestAnimationFrame(() => {
                    if (getMapProvider() === 'mapbox' && mapboxCameraRef.current) {
                      const lngs = coordinatesToFit.map((c) => c.longitude);
                      const lats = coordinatesToFit.map((c) => c.latitude);
                      const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
                      const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
                      mapboxCameraRef.current.fitBounds(ne, sw, 50, 500);
                    } else if (mapRef.current) {
                      mapRef.current.fitToCoordinates(coordinatesToFit, {
                        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                        animated: true,
                      });
                    }
                  });
                }
              } catch (error) {
                console.error('[MapView] Error processing route:', error);
              }
            })
            .catch((error) => {
              // Handle errors gracefully - don't crash the component
              console.error('[MapView] Error calculating route:', error);
              console.warn('[MapView] Route calculation failed, but map will continue to work');
              setRoute(null);
              setMapError(null); // Clear any previous errors
              // Don't throw - let the map continue to function
            })
            .finally(() => {
              setIsLoadingRoute(false);
            });
        } else {
          setIsLoadingRoute(false);
        }
      }, 100); // Small delay to prevent blocking initial render

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [
    mode,
    pickupLocation,
    dropoffLocation,
    dropoffLocations,
    dropoffLocationsForRoute,
    routeDriverLocation,
    bookingStatus,
    activeDropoffForRoute,
  ]);

  /**
   * Animate map slide when isExpanded changes
   */
  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false, // Height animation doesn't support native driver
    }).start();
  }, [isExpanded, slideAnimation]);

  /**
   * Center map on user location when available (booking mode only)
   */
  useEffect(() => {
    if (mode !== 'booking' || !initialRegion) return;
    const region = initialRegion as Region;
    if (region.latitude === 0 && region.longitude === 0) return;

    if (getMapProvider() === 'mapbox' && mapboxCameraRef.current) {
      mapboxCameraRef.current.moveTo([region.longitude, region.latitude], 500);
    } else if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta || 0.05,
        longitudeDelta: region.longitudeDelta || 0.05,
      }, 500);
    }
  }, [mode, initialRegion]);

  // Track last location we animated to (to avoid re-animating to same location)
  /** Last driver position the camera was moved to, so an unchanged fix is not re-animated. */
  const lastFollowedDriverRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * Keep the camera centred on the driver whenever a driver position is available.
   *
   * This deliberately takes precedence over the route framing above. During a delivery the
   * customer's question is "where is my driver right now", not "what does the whole trip look
   * like", and the route fit answers the second at the cost of the first — it zooms out far
   * enough that the truck becomes a speck.
   *
   * Follows the same coordinate the marker draws (route-snapped when available) and animates
   * over the marker's own duration, so camera and truck glide together instead of the map
   * running ahead of it.
   */
  useEffect(() => {
    if (mode !== 'tracking') return;

    const target = snappedDriverLocation ?? driverLocation;
    if (!target) return;
    const { latitude, longitude } = target;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      (latitude === 0 && longitude === 0)
    ) {
      return;
    }

    const previous = lastFollowedDriverRef.current;
    if (previous && previous.lat === latitude && previous.lng === longitude) {
      return;
    }
    // Snap to the first fix — animating in from the default region reads as the map drifting
    // on open. Every later fix glides.
    const durationMs = previous === null ? 0 : DRIVER_MARKER_ANIMATION_MS;
    lastFollowedDriverRef.current = { lat: latitude, lng: longitude };

    if (getMapProvider() === 'mapbox' && mapboxCameraRef.current) {
      mapboxCameraRef.current.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: DRIVER_FOLLOW_ZOOM,
        animationDuration: durationMs,
        animationMode: 'easeTo',
      });
    } else if (mapRef.current) {
      mapRef.current.animateCamera(
        { center: { latitude, longitude }, zoom: DRIVER_FOLLOW_ZOOM },
        { duration: durationMs }
      );
    }
  }, [mode, driverLocation, snappedDriverLocation]);

  // Reset the follow anchor when the driver goes away (delivery finished, or tracking ends),
  // so a later session snaps to its first fix instead of gliding from a stale position.
  useEffect(() => {
    if (!isDriverMarkerRendered) {
      lastFollowedDriverRef.current = null;
    }
  }, [isDriverMarkerRendered]);

  const lastAnimatedLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * Reset animation ref when map expands (so we can animate to existing locations when map opens)
   */
  useEffect(() => {
    if (mode === 'booking' && isExpanded) {
      // Reset ref when map expands so we can animate to existing locations
      lastAnimatedLocationRef.current = null;
    }
  }, [mode, isExpanded]);

  /**
   * Animate camera to selected location when pickup or dropoff location changes (booking mode)
   * This handles when user selects a location from search dropdown or when map opens with existing locations
   */
  useEffect(() => {
    if (mode !== 'booking') return;
    
    // Priority: pickupLocation > first dropoffLocation > first dropoffLocations item
    const locationToCenter = pickupLocation || dropoffLocation || dropoffLocations?.[0];
    
    if (!locationToCenter || 
        locationToCenter.latitude === 0 || 
        locationToCenter.longitude === 0) return;

    // Check if this is a different location than last time
    const lastLoc = lastAnimatedLocationRef.current;
    if (lastLoc && 
        Math.abs(lastLoc.lat - locationToCenter.latitude) < 0.0001 &&
        Math.abs(lastLoc.lng - locationToCenter.longitude) < 0.0001) {
      // Same location, don't re-animate
      return;
    }

    // Update ref with new location
    lastAnimatedLocationRef.current = {
      lat: locationToCenter.latitude,
      lng: locationToCenter.longitude,
    };

    // Small delay to ensure map is ready and pin is rendered
    const timeoutId = setTimeout(() => {
      if (getMapProvider() === 'mapbox' && mapboxCameraRef.current) {
        mapboxCameraRef.current.moveTo(
          [locationToCenter.longitude, locationToCenter.latitude], 
          500
        );
      } else if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: locationToCenter.latitude,
          longitude: locationToCenter.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [mode, pickupLocation, dropoffLocation, dropoffLocations, isExpanded]);

  /**
   * Get marker color based on type
   */
  const getMarkerColor = (type?: string): string => {
    switch (type) {
      case 'pickup':
        return '#22c55e'; // Green
      case 'dropoff':
        return '#ef4444'; // Red
      case 'driver':
        return '#3b82f6'; // Blue
      default:
        return '#6b7280'; // Gray
    }
  };

  /**
   * Custom truck marker component for driver location
   */
  const TruckMarker = React.memo(() => (
    <View style={styles.truckMarkerContainer}>
      <Animated.View style={styles.truckMarker}>
        <Ionicons name="car" size={22} color="white" />
      </Animated.View>
    </View>
  ));

  /**
   * Handle locate button press (center on user location)
   */
  const handleLocatePress = useCallback(() => {
    // Future: Implement user location tracking
    console.log('[MapView] Locate button pressed');
  }, []);

  // Default region (Manila, Philippines if not provided)
  // This is a reasonable default for the region, will be overridden by user location or initialRegion prop
  const defaultRegion: Region = {
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  // Use initialRegion if provided and valid (not 0,0), otherwise use default
  const mapRegion = (initialRegion as Region) && 
    (initialRegion as Region).latitude !== 0 && 
    (initialRegion as Region).longitude !== 0
    ? (initialRegion as Region)
    : defaultRegion;

  /** GeoJSON LineString for Mapbox route polyline ([lng, lat][] per Mapbox convention) */
  const routeLineGeometry = useMemo(() => {
    if (!route?.coordinates?.length) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: route.coordinates.map((c) => [c.longitude, c.latitude]),
      },
    };
  }, [route]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          height: slideAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: mode === 'booking' ? ['75%', '100%'] : ['90%', '100%'],
          }),
        },
      ]}
    >
      {mapProvider === 'mapbox' || !RNMapView ? (
        <MapboxMapView
          style={styles.map}
          styleURL={StyleURL.Street}
          onPress={handleMapboxMapPress}
          onDidFailLoadingMap={(error: unknown) => {
            console.error('[MapView] Mapbox map failed to load:', error);
            setMapError('Failed to load map. Please check your internet connection.');
          }}
          scaleBarEnabled={false}
          compassEnabled={false}
          scrollEnabled={scrollEnabled}
        >
          <MapboxCamera
            ref={mapboxCameraRef}
            defaultSettings={{
              centerCoordinate: [mapRegion.longitude, mapRegion.latitude],
              zoomLevel: 14,
            }}
          />
          {mode === 'booking' && (
            <MapboxUserLocation visible={true} />
          )}
          {routeLineGeometry && (
            <MapboxShapeSource id="route-source" shape={routeLineGeometry}>
              <MapboxLineLayer id="route-line" style={{ lineColor: '#3b82f6', lineWidth: 4 }} />
            </MapboxShapeSource>
          )}
          {pickupLocation && (
            <MapboxPointAnnotation
              id="pickup"
              coordinate={[pickupLocation.longitude, pickupLocation.latitude]}
              title="Pickup"
            >
              <View style={[styles.mapboxMarker, { backgroundColor: '#22c55e' }]} />
            </MapboxPointAnnotation>
          )}
          {dropoffLocations?.filter((c) => c && c.latitude !== 0 && c.longitude !== 0).map((coord, index) => (
            <MapboxPointAnnotation
              key={`dropoff-${index}`}
              id={`dropoff-${index}`}
              coordinate={[coord.longitude, coord.latitude]}
              title={dropoffLocations.length > 1 ? `Dropoff ${index + 1}` : 'Dropoff'}
            >
              <View style={[styles.mapboxMarker, { backgroundColor: '#ef4444' }]} />
            </MapboxPointAnnotation>
          ))}
          {dropoffLocation && !dropoffLocations?.length && (
            <MapboxPointAnnotation
              id="dropoff"
              coordinate={[dropoffLocation.longitude, dropoffLocation.latitude]}
              title="Dropoff"
            >
              <View style={[styles.mapboxMarker, { backgroundColor: '#ef4444' }]} />
            </MapboxPointAnnotation>
          )}
          {driverLocation && mode === 'tracking' && (
            <MapboxDriverMarker
              driverLocation={snappedDriverLocation ?? driverLocation}
              durationMs={DRIVER_MARKER_ANIMATION_MS}
              title={driverLabel}
            />
          )}
          {markers
            // The driver already has a dedicated truck annotation above. Rendering it again
            // here put a second, plain blue dot on the map at the same spot — with the same
            // "driver" id — which snapped between updates and gave away the animation.
            .filter((marker) => !(marker.type === 'driver' && isDriverMarkerRendered))
            .map((marker) => (
              <MapboxPointAnnotation
                key={marker.id}
                id={marker.id}
                coordinate={[marker.coordinates.longitude, marker.coordinates.latitude]}
                title={marker.title}
                onSelected={() => onMarkerPress?.(marker)}
              >
                <View style={[styles.mapboxMarker, { backgroundColor: getMarkerColor(marker.type) }]} />
              </MapboxPointAnnotation>
            ))}
          {selectedLocation && (
            <MapboxPointAnnotation
              id="selected"
              coordinate={[selectedLocation.longitude, selectedLocation.latitude]}
            >
              <View style={[styles.mapboxMarker, { backgroundColor: '#FFCD36', opacity: 0.8 }]} />
            </MapboxPointAnnotation>
          )}
        </MapboxMapView>
      ) : (
      <RNMapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={mapRegion}
        onPress={handleMapPress}
        onRegionChangeComplete={onRegionChange}
        onMapReady={() => {
          console.log('[MapView] Map ready');
          setMapError(null);
        }}
        showsUserLocation={mode === 'booking'} // Show user location in booking mode
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        rotateEnabled={false}
        scrollEnabled={scrollEnabled}
        zoomEnabled={true}
        pitchEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        {/* Route polyline */}
        {route && route.coordinates.length > 0 && (
          <Polyline
            coordinates={route.coordinates}
            strokeColor="#3b82f6" // Blue route line
            strokeWidth={4}
          />
        )}

        {/* Pickup marker */}
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Pickup Location"
            pinColor="#22c55e" // Green
          />
        )}

        {/* Dropoff markers - support multiple stops */}
        {(() => {
          // Use dropoffLocations array if provided, otherwise single dropoffLocation
          const allDropoffs = dropoffLocations?.filter(coord => 
            coord && coord.latitude !== 0 && coord.longitude !== 0
          ) || (dropoffLocation ? [dropoffLocation] : []);
          
          return allDropoffs.map((coord, index) => (
            <Marker
              key={`dropoff-${index}`}
              coordinate={coord}
              title={allDropoffs.length > 1 ? `Dropoff ${index + 1}` : 'Dropoff Location'}
              pinColor="#ef4444" // Red
            />
          ));
        })()}

        {/* Driver marker - glides between fixes, see GoogleDriverMarker */}
        {driverLocation && mode === 'tracking' && (
          <GoogleDriverMarker
            driverLocation={snappedDriverLocation ?? driverLocation}
            durationMs={DRIVER_MARKER_ANIMATION_MS}
            title={driverLabel}
          />
        )}

        {/* Custom markers */}
        {markers.map((marker) => {
          // Skip the driver here when the dedicated driver marker above is already showing
          // it, otherwise two truck markers stack on the same coordinate.
          if (marker.type === 'driver' && isDriverMarkerRendered) {
            return null;
          }
          // Use custom truck icon for driver markers
          if (marker.type === 'driver') {
            return (
              <Marker
                key={marker.id}
                coordinate={marker.coordinates}
                title={marker.title}
                description={marker.description}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => onMarkerPress?.(marker)}
              >
                <TruckMarker />
              </Marker>
            );
          }
          // Use default pin for other markers
          return (
            <Marker
              key={marker.id}
              coordinate={marker.coordinates}
              title={marker.title}
              description={marker.description}
              pinColor={getMarkerColor(marker.type)}
              onPress={() => onMarkerPress?.(marker)}
            />
          );
        })}

        {/* Temporary selected location marker (shows immediately when map is tapped) */}
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            title="Selected Location"
            pinColor="#FFCD36" // Primary yellow to indicate selection
            opacity={0.8}
          />
        )}
      </RNMapView>
      )}

      {/* Map controls */}
      {showControls && (
        <View style={styles.controls}>
          {mode === 'booking' && (
            <>
              {!isExpanded && onExpand && (
                <TouchableOpacity
                  style={[styles.controlButton, { backgroundColor: theme.surface }]}
                  onPress={onExpand}
                >
                  <Ionicons name="expand" size={20} color={theme.text} />
                </TouchableOpacity>
              )}
              {isExpanded && onCollapse && (
                <TouchableOpacity
                  style={[styles.controlButton, { backgroundColor: theme.surface }]}
                  onPress={onCollapse}
                >
                  <Ionicons name="contract" size={20} color={theme.text} />
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: theme.surface }]}
            onPress={handleLocatePress}
          >
            <Ionicons name="locate" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  errorContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    maxWidth: '80%',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  truckMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fbbf24', // Yellow/amber color like fleet management
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  mapboxMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
});

// Export with a different name to avoid conflict with react-native-maps MapView
export const MapViewComponent = React.forwardRef(MapViewComponentImpl);

