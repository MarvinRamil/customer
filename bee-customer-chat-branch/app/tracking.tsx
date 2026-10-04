import { BeeColors } from "@/constants/theme";
import { bookingService, getEffectiveBookingStatus, getStatusDisplayLabel, StatusBadge } from "@/features/bookings";
import { BookingDetailSkeleton } from "@/features/bookings/components/BookingDetailSkeleton";
import { CancelBookingModal } from "@/features/bookings/components/CancelBookingModal";
import { useTracking } from "@/features/tracking";
import { MapViewComponent } from "@/shared/components/MapView";
import { useTheme } from "@/shared/hooks/use-theme";
import { useSignalRLocationUpdates } from "@/shared/hooks/useSignalR";
import { useSignalRNotifications } from "@/shared/hooks/useSignalRNotifications";
import { driverLocationStorage } from "@/shared/services/driverLocationStorage";
import type { Booking, BookingStatus, CancellationReason, LocationCoordinates } from "@/shared/types/booking";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Image,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTypeScale } from "@/shared/hooks/useTypeScale";

/**
 * Tracking colors matching live-tracking design
 */
const TrackingColors = {
  primary: "#FFCD36",
  primaryContent: "#1d180c",
  accentBlue: "#3b82f6",
  drawerBg: "rgba(255,255,255,0.95)",
  driverCardBg: "#f8fafc",
};

// ▼▼▼ TEMP-SKELETON-TEST-DELAY: remove this constant and every block tagged with the same
// marker below once the skeleton-loading state has been verified. It artificially stretches
// the first booking fetch so the skeleton is easy to see while testing.
const TEMP_SKELETON_TEST_DELAY_MS = 3000;
// ▲▲▲ TEMP-SKELETON-TEST-DELAY

/**
 * Tracking screen component displaying real-time delivery tracking
 * Uses tracking feature hooks and components
 * Uses safe area insets to prevent content from overlapping system UI
 */
export default function TrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  /** Screen-responsive type sizes so the driver details fit without clipping on small phones. */
  const type = useTypeScale();
  const theme = useTheme();
  const { trackingData, isLoading, error, refresh: refreshTracking } = useTracking(id);

  // Fetch booking details from API
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [routeETA, setRouteETA] = useState<{ distance: string; duration: string } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showProofOfDeliveriesModal, setShowProofOfDeliveriesModal] = useState(false);
  const [persistedDriverLocation, setPersistedDriverLocation] = useState<LocationCoordinates | null>(null);
  /**
   * Last position actually observed this session, kept so the marker survives a dropped
   * SignalR connection. `persistedDriverLocation` is only read from storage on focus and is
   * never refreshed from live fixes, so a session that opened with an empty store left the
   * fallback null — and the driver disappeared off the map the moment the feed blinked.
   */
  const [lastKnownDriverLocation, setLastKnownDriverLocation] = useState<
    (LocationCoordinates & { heading?: number }) | null
  >(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // TEMP-SKELETON-TEST-DELAY: tracks whether the first booking fetch has completed, so the
  // artificial delay below only stretches the initial load, not every refresh. Remove together
  // with TEMP_SKELETON_TEST_DELAY_MS and the delay block inside fetchBooking.
  const hasFetchedBookingOnceRef = useRef(false);

  /** Map fills the area above the drawer; the drawer's own height is what resizes it. */
  const [isMapExpanded] = useState(true);

  /** Pulsating animation for status dot when broadcasting */
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /** SignalR Notifications for immediate status updates */
  const { onNotification, isConnected: isNotificationsHubConnected } = useSignalRNotifications();

  useEffect(() => {
    console.log('[TrackingScreen] Notifications hub connected:', isNotificationsHubConnected, '— status updates will push in real time when connected');
  }, [isNotificationsHubConnected]);

  useEffect(() => {
    const unsubscribe = onNotification((eventName, payload) => {
      const isStatusOrStopUpdate =
        (eventName === 'BookingStatusChanged' || eventName === 'BookingStopStatusChanged') &&
        (payload?.bookingId != null || payload?.BookingId != null) &&
        (String(payload?.bookingId ?? payload?.BookingId) === String(id));
      if (isStatusOrStopUpdate) {
        console.log(`[TrackingScreen] Notification received for booking ${id}: ${eventName}`, payload);
        // Force refresh data immediately
        fetchBooking();
        refreshTracking();
      }
    });

    return () => unsubscribe();
  }, [id, onNotification]);

  /** Use same effective status as delivery card (first stop completed → InProgress) */
  const effectiveBookingStatus = useMemo(() => {
    const effective = getEffectiveBookingStatus(booking);
    console.log('[TrackingScreen] Effective booking status:', {
      bookingStatus: booking?.status,
      effectiveStatus: effective,
      hasStops: !!booking?.stops,
      stopsLength: booking?.stops?.length ?? 0,
      firstStopStatus: booking?.stops?.[0]?.status,
    });
    return effective;
  }, [booking]);

  const isBroadcasting = effectiveBookingStatus === "Pending" && booking?.assignmentStatus === "BroadcastingToDrivers";

  useEffect(() => {
    if (isBroadcasting) {
      console.log('[TrackingScreen] Starting pulsating animation for broadcasting status');
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => {
        console.log('[TrackingScreen] Stopping pulsating animation');
        pulse.stop();
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [isBroadcasting, pulseAnim]);

  /** Drawer: draggable down to fully hide; starts open to match design */
  const DRAWER_HIDDEN_HEIGHT = 0;
  /**
   * Read live rather than once at mount: a one-shot Dimensions.get() kept a stale height
   * after rotation or a window resize, leaving the drawer the wrong size until remount.
   *
   * The bottom inset is added on top of the 60%, because the content inside already pads
   * itself by insets.bottom — without this the usable area shrank by the size of the
   * gesture bar, so the panel fitted on some devices and was cramped on others.
   */
  const { height: windowHeight } = useWindowDimensions();
  const drawerMaxHeight = useMemo(
    () => Math.round(windowHeight * 0.6) + insets.bottom,
    [windowHeight, insets.bottom]
  );
  const drawerHeight = useRef(new Animated.Value(drawerMaxHeight)).current;
  const drawerStartHeight = useRef(drawerMaxHeight);
  const [isDrawerHidden, setIsDrawerHidden] = useState(false);

  /**
   * Keep an open drawer matched to the max height when the window actually changes size.
   * Guarded on the previous value rather than just re-running: without that, opening the
   * drawer flips isDrawerHidden, the effect re-runs and setValue jumps the panel straight
   * to full height, cancelling out the spring in openDrawer.
   */
  const prevDrawerMaxRef = useRef(drawerMaxHeight);
  useEffect(() => {
    if (prevDrawerMaxRef.current === drawerMaxHeight) return;
    prevDrawerMaxRef.current = drawerMaxHeight;
    if (isDrawerHidden) return;
    drawerHeight.setValue(drawerMaxHeight);
    drawerStartHeight.current = drawerMaxHeight;
  }, [drawerMaxHeight, isDrawerHidden, drawerHeight]);

  const openDrawer = useCallback(() => {
    setIsDrawerHidden(false);
    Animated.spring(drawerHeight, {
      toValue: drawerMaxHeight,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }, [drawerMaxHeight, drawerHeight]);

  /**
   * Pan responder for the draggable bottom drawer.
   * User can drag the drawer down to hide it or up to expand; release snaps to either fully hidden or fully open.
   */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Don't claim on touch-down: these handlers are also attached to the collapsed
        // strip, which is a TouchableOpacity. Claiming the start would swallow its tap.
        onStartShouldSetPanResponder: () => false,
        // Only activate on meaningful vertical movement (avoids stealing taps)
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
        // On drag start: record current drawer height so we can compute delta during drag.
        // Also un-hide, so a drag begun from the collapsed strip makes the panel live and
        // visible immediately instead of dragging an invisible, non-interactive view.
        onPanResponderGrant: () => {
          setIsDrawerHidden(false);
          drawerHeight.stopAnimation((value) => {
            drawerStartHeight.current = value;
          });
        },
        // During drag: clamp drawer height between hidden (0) and max; dy is gesture delta (down = positive)
        onPanResponderMove: (_, g) => {
          const next = Math.max(DRAWER_HIDDEN_HEIGHT, Math.min(drawerMaxHeight, drawerStartHeight.current - g.dy));
          drawerHeight.setValue(next);
        },
        // On release: snap to fully hidden if drawer is past 40% closed or swipe was fast downward
        onPanResponderRelease: (_, g) => {
          const current = drawerStartHeight.current - g.dy;
          const velocity = g.vy;
          // A quick upward flick opens regardless of distance travelled — without this,
          // flicking up from the collapsed strip fell back to hidden because `current`
          // was still under the 40% threshold.
          const flickedUp = velocity < -0.3;
          const snapToHidden = !flickedUp && (current < drawerMaxHeight * 0.4 || velocity > 0.3);
          if (snapToHidden) {
            setIsDrawerHidden(true);
            Animated.timing(drawerHeight, {
              toValue: DRAWER_HIDDEN_HEIGHT,
              useNativeDriver: false,
              duration: 200,
            }).start();
          } else {
            Animated.spring(drawerHeight, {
              toValue: drawerMaxHeight,
              useNativeDriver: false,
              tension: 65,
              friction: 11,
            }).start();
          }
        },
      }),
    [drawerHeight, drawerMaxHeight]
  );

  // Driver ID for SignalR – from booking DTO (GET /api/bookings/:id)
  // Only connect to SignalR after booking is loaded and has a driver ID
  const driverId = booking && !isLoadingBooking ? (booking.selectedDriverId ?? undefined) : undefined;
  // Use SignalR for real-time driver location updates (only when driverId exists)
  // booking.status is passed as the retry key so the subscription is re-attempted when the
  // booking becomes trackable (the hub only allows in-progress bookings).
  const {
    latestUpdate: realTimeDriverLocation,
    isConnected: isSignalRConnected,
    joinError: liveTrackingError,
  } = useSignalRLocationUpdates(driverId, booking?.status);

  // Console log when booking details are opened and hub connection status (for debugging)
  useEffect(() => {
    if (id) {
      console.log('[TrackingScreen] Booking details opened — bookingId:', id, 'driverId:', driverId ?? 'none', 'connecting to location hub...');
    }
  }, [id]);
  useEffect(() => {
    console.log('[TrackingScreen] Hub connection status — isConnected:', isSignalRConnected, 'driverId:', driverId ?? 'none');
  }, [isSignalRConnected, driverId]);
  useEffect(() => {
    if (liveTrackingError) {
      console.warn('[TrackingScreen] Live tracking unavailable — hub refused subscription:', liveTrackingError);
    }
  }, [liveTrackingError]);

  // Log every driver location received over SignalR
  useEffect(() => {
    if (!realTimeDriverLocation) return;
    console.log(
      '[TrackingScreen] 📍 SignalR driver location —',
      'driverId:', realTimeDriverLocation.driverId,
      'lat:', realTimeDriverLocation.latitude,
      'lng:', realTimeDriverLocation.longitude,
      'speed:', realTimeDriverLocation.speed ?? 'n/a',
      'heading:', realTimeDriverLocation.heading ?? 'n/a',
      'at:', realTimeDriverLocation.timestamp
    );
  }, [realTimeDriverLocation]);

  /**
   * Persist driver location when we receive a SignalR update so it can be shown as fallback
   * when the user navigates away and returns (Phase 4).
   */
  useEffect(() => {
    if (!id || !realTimeDriverLocation) return;
    driverLocationStorage
      .setLastDriverLocation(
        id,
        { latitude: realTimeDriverLocation.latitude, longitude: realTimeDriverLocation.longitude },
        driverId
      )
      .catch((err) => console.warn('[TrackingScreen] Failed to persist driver location:', err));
  }, [id, realTimeDriverLocation, driverId]);

  /**
   * Fetch booking details from API
   */
  const fetchBooking = useCallback(async () => {
    if (!id) return;

    setIsLoadingBooking(true);
    setBookingError(null);
    try {
      // ▼▼▼ TEMP-SKELETON-TEST-DELAY: remove this if-block when done testing the skeleton
      if (!hasFetchedBookingOnceRef.current) {
        await new Promise((resolve) => setTimeout(resolve, TEMP_SKELETON_TEST_DELAY_MS));
      }
      // ▲▲▲ TEMP-SKELETON-TEST-DELAY
      const bookingData = await bookingService.getBookingById(id);
      console.log('[TrackingScreen] Booking API data:', JSON.stringify(bookingData, null, 2));
      console.log('[TrackingScreen] Booking selectedDriverId:', bookingData?.selectedDriverId ?? 'none');
      console.log('[TrackingScreen] Booking status:', bookingData?.status);
      console.log('[TrackingScreen] Booking stops:', bookingData?.stops ? JSON.stringify(bookingData.stops, null, 2) : 'none');
      if (bookingData?.stops && bookingData.stops.length > 0) {
        console.log('[TrackingScreen] First stop status:', bookingData.stops[0].status);
      }
      setBooking(bookingData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch booking details';
      setBookingError(errorMessage);
      console.error('[TrackingScreen] Failed to fetch booking:', err);
    } finally {
      hasFetchedBookingOnceRef.current = true; // TEMP-SKELETON-TEST-DELAY: remove with the block above
      setIsLoadingBooking(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  /**
   * Refresh tracking and booking data when screen comes into focus
   * This ensures driver information is updated when a driver is assigned
   */
  useFocusEffect(
    useCallback(() => {
      // Refresh when screen comes into focus
      if (id) {
        refreshTracking();
        fetchBooking();
        // Load persisted driver location for fallback when returning to tracking
        driverLocationStorage.getLastDriverLocation(id).then((entry) => {
          if (entry) {
            setPersistedDriverLocation({ latitude: entry.latitude, longitude: entry.longitude });
          } else {
            setPersistedDriverLocation(null);
          }
        }).catch(() => setPersistedDriverLocation(null));
      }
    }, [id, refreshTracking, fetchBooking])
  );

  /**
   * Auto-refresh tracking data every 60 seconds as a fallback
   */
  useEffect(() => {
    if (!id) return;

    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Set up auto-refresh every 60 seconds
    refreshIntervalRef.current = setInterval(() => {
      console.log('[TrackingScreen] Auto-refreshing tracking data (60s fallback)...');
      refreshTracking();
      fetchBooking();
    }, 60000); // 60 seconds

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [id, refreshTracking, fetchBooking]);

  /**
   * When app comes to foreground (e.g. user returns from another app), refresh tracking and booking
   * so status and driver info are up to date. Subscription is removed on unmount.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && id) {
        console.log('[TrackingScreen] App came to foreground, refreshing data...');
        refreshTracking();
        fetchBooking();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [id, refreshTracking, fetchBooking]);

  /**
   * Open location in Google Maps
   * Uses coordinates from stops array (preferred) or booking fields (fallback)
   */
  const openInGoogleMaps = useCallback(async (locationType: 'pickup' | 'dropoff') => {
    if (!booking) return;

    let address: string | undefined;
    let coordinates: LocationCoordinates | null = null;

    // Try to get from stops array first
    if (booking.stops && Array.isArray(booking.stops)) {
      const stop = locationType === 'pickup'
        ? booking.stops.find((s) => s.type === 'Pickup')
        : booking.stops.find((s) => s.type === 'Dropoff');

      if (stop) {
        address = stop.address;
        if (stop.latitude && stop.longitude) {
          coordinates = {
            latitude: stop.latitude,
            longitude: stop.longitude,
          };
        }
      }
    }

    // Fallback to legacy fields if stops array didn't provide data
    if (!address && !coordinates) {
      address = locationType === 'pickup' ? booking.pickupLocation : booking.dropoffLocation;
      coordinates = locationType === 'pickup'
        ? (booking.pickupLatitude && booking.pickupLongitude
          ? { latitude: booking.pickupLatitude, longitude: booking.pickupLongitude }
          : null)
        : (booking.dropoffLatitude && booking.dropoffLongitude
          ? { latitude: booking.dropoffLatitude, longitude: booking.dropoffLongitude }
          : null);
    }

    if (!address && !coordinates) {
      Alert.alert("Error", "No location available to open in Google Maps");
      return;
    }

    try {
      let url: string;

      if (coordinates) {
        // Use coordinates for more accurate location
        if (Platform.OS === 'ios') {
          url = `https://maps.apple.com/?q=${coordinates.latitude},${coordinates.longitude}`;
        } else {
          url = `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`;
        }
      } else if (address) {
        // Fallback to address search
        const encodedAddress = encodeURIComponent(address);
        if (Platform.OS === 'ios') {
          url = `https://maps.apple.com/?q=${encodedAddress}`;
        } else {
          url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        }
      } else {
        // This should not happen due to the check above, but handle it gracefully
        //Alert.alert("Error", "No location available to open in Google Maps");
        return;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Unable to open Google Maps. Please install Google Maps app.");
      }
    } catch (error) {
      console.error('[TrackingScreen] Error opening Google Maps:', error);
      Alert.alert("Error", "Failed to open Google Maps. Please try again.");
    }
  }, [booking]);

  /**
   * Handle cancel booking
   */
  const handleCancelBooking = async (reason: CancellationReason, customReason?: string) => {
    if (!booking || !id) return;

    try {
      const updated = await bookingService.cancelBooking(id, reason, customReason);
      setBooking(updated);
      Alert.alert('Success', 'Booking cancelled successfully.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      throw error; // Re-throw to let modal handle the error
    }
  };

  /**
   * Check if booking should be treated as cancelled
   * Returns true if status is Cancelled or Pending with RejectedByAllDrivers assignment status
   * Uses effective status to check for cancellation state
   */
  const isBookingCancelled = (booking: Booking | null): boolean => {
    if (!booking) return false;
    const status = getEffectiveBookingStatus(booking) || booking.status;
    return status === "Cancelled" ||
      (status === "Pending" && booking.assignmentStatus === "RejectedByAllDrivers");
  };


  /**
   * Auto-update booking status when pickup stop is completed
   */
  useEffect(() => {
    if (!booking?.id || !effectiveBookingStatus) return;

    // If effective status differs from current status, update it
    if (effectiveBookingStatus !== booking.status && effectiveBookingStatus === "InProgress") {
      bookingService.updateBookingStatus(booking.id, "InProgress")
        .then((updatedBooking) => {
          setBooking(updatedBooking);
          console.log('[TrackingScreen] Auto-updated booking status to InProgress (pickup completed)');
        })
        .catch((error) => {
          console.error('[TrackingScreen] Failed to auto-update booking status:', error);
          // Don't show error to user - this is automatic validation
        });
    }
  }, [booking?.id, booking?.status, effectiveBookingStatus]);

  /**
   * Per-booking purge: remove persisted driver location when booking is Completed or Cancelled
   * so we don't show a stale driver pin next time the user opens this booking (Phase 5).
   */
  useEffect(() => {
    if (!id || !effectiveBookingStatus) return;
    if (effectiveBookingStatus === 'Completed' || effectiveBookingStatus === 'Cancelled') {
      driverLocationStorage.removeDriverLocation(id).catch((err) =>
        console.warn('[TrackingScreen] Failed to remove driver location for completed/cancelled booking:', err)
      );
    }
  }, [id, effectiveBookingStatus]);

  /**
   * Get booking status from booking data or tracking data
   * Maps API booking status to MapView booking status format
   * For Pending/Scheduled bookings, returns 'pending' to show shortest path route
   */
  const getBookingStatus = (): 'pending' | 'assigned' | 'on_the_way_to_pickup' | 'pickup_completed' | 'on_the_way_to_dropoff' | 'delivered' | 'cancelled' => {
    // Use effective booking status (validated against stops)
    const effectiveStatus = effectiveBookingStatus;

    // Use booking status if available (from API)
    if (booking) {
      // Check if booking should be treated as cancelled
      if (isBookingCancelled(booking)) return 'cancelled';

      const status = effectiveStatus || booking.status;
      // Pending status - show shortest path from pickup to dropoff (or driver to dropoff if driver available)
      if (status === "Pending") return 'pending';
      // DriverAssigned/Assigned/Dispatched (Picking up) - show driver and pickup only, not destination
      if (status === "DriverAssigned" || status === "Assigned" || status === "Dispatched") {
        return currentDriverLocation ? 'on_the_way_to_pickup' : 'assigned';
      }
      if (status === "PickedUp") return 'pickup_completed';
      if (status === "InProgress") return 'on_the_way_to_dropoff';
      if (status === "Completed") return 'delivered';
      if (status === "Cancelled") return 'cancelled';
      // Default to pending for unknown statuses to show route
      return 'pending';
    }

    // Fallback to tracking data status
    if (!trackingData) return 'pending';

    const status = trackingData.status;
    if (status === "Booking Confirmed") return 'pending';
    if (status === "Driver Assigned") {
      // If driver location is available, treat as on_the_way_to_pickup
      return currentDriverLocation ? 'on_the_way_to_pickup' : 'assigned';
    }
    if (status === "Pickup Completed") return 'pickup_completed';
    if (status === "Out for Delivery") return 'on_the_way_to_dropoff';
    if (status === "Delivered") return 'delivered';
    if (status === "Cancelled") return 'cancelled';

    // Default: assume on the way to pickup if driver is assigned and location available
    return (trackingData?.driver && currentDriverLocation) ? 'on_the_way_to_pickup' : 'assigned';
  };

  /**
   * Helper to validate coordinates
   */
  const isValidCoordinate = (coord: { latitude: number; longitude: number } | null | undefined): boolean => {
    if (!coord) return false;
    return (
      coord.latitude !== 0 &&
      coord.longitude !== 0 &&
      coord.latitude >= -90 &&
      coord.latitude <= 90 &&
      coord.longitude >= -180 &&
      coord.longitude <= 180
    );
  };

  /**
   * Get pickup location coordinates from stops array (preferred) or booking/tracking data (fallback)
   */
  const pickupLocation = useMemo(() => {
    // First, try to get from stops array
    if (booking?.stops && Array.isArray(booking.stops)) {
      const pickupStop = booking.stops.find((stop) => stop.type === 'Pickup');
      if (pickupStop && pickupStop.latitude && pickupStop.longitude) {
        const coord = {
          latitude: pickupStop.latitude,
          longitude: pickupStop.longitude,
        };
        if (isValidCoordinate(coord)) {
          return coord;
        }
      }
    }

    // Fallback to legacy fields
    if (booking?.pickupLatitude && booking?.pickupLongitude) {
      const coord = {
        latitude: booking.pickupLatitude,
        longitude: booking.pickupLongitude,
      };
      return isValidCoordinate(coord) ? coord : null;
    }
    const trackingLoc = trackingData?.pickupLocation;
    return trackingLoc && isValidCoordinate(trackingLoc) ? trackingLoc : null;
  }, [booking, trackingData]);

  /**
   * Get dropoff location from stops array (preferred) or booking/tracking data (fallback).
   * A booking is exactly one pickup and one dropoff.
   */
  const dropoffLocation = useMemo(() => {
    // First, try to get from stops array
    if (booking?.stops && Array.isArray(booking.stops)) {
      const dropoffStop = booking.stops.find((stop) => stop.type === 'Dropoff');
      if (dropoffStop && dropoffStop.latitude && dropoffStop.longitude) {
        const coord = {
          latitude: dropoffStop.latitude,
          longitude: dropoffStop.longitude,
        };
        if (isValidCoordinate(coord)) {
          return coord;
        }
      }
    }

    // Fallback to legacy fields
    if (booking?.dropoffLatitude && booking?.dropoffLongitude) {
      const coord = {
        latitude: booking.dropoffLatitude,
        longitude: booking.dropoffLongitude,
      };
      return isValidCoordinate(coord) ? coord : null;
    }
    const trackingLoc = trackingData?.dropoffLocation;
    return trackingLoc && isValidCoordinate(trackingLoc) ? trackingLoc : null;
  }, [booking, trackingData]);

  /**
   * Dropoff location for the route: when in transit (PickedUp/InProgress) and the dropoff stop is
   * already completed, exclude it from the route so we don't draw a route to a finished stop.
   */
  const dropoffLocationForMap = useMemo(() => {
    const inTransit =
      effectiveBookingStatus === "PickedUp" || effectiveBookingStatus === "InProgress";
    if (!inTransit || !booking?.stops?.length) return dropoffLocation;
    const dropoffStop = booking.stops.find((s) => s.type === "Dropoff");
    if (!dropoffStop || dropoffStop.status === "Completed") return null;
    if (dropoffStop.latitude == null || dropoffStop.longitude == null) return null;
    const coord = { latitude: dropoffStop.latitude, longitude: dropoffStop.longitude };
    return isValidCoordinate(coord) ? coord : null;
  }, [booking?.stops, effectiveBookingStatus, dropoffLocation]);

  /**
   * Active stop = the dropoff whose status is NOT Pending, Completed, or Cancelled (i.e. status === InProgress only).
   * A booking has exactly one dropoff, so this is just that stop's status.
   */
  const activeInTransitStop = useMemo(() => {
    const inTransit =
      effectiveBookingStatus === "PickedUp" || effectiveBookingStatus === "InProgress";
    if (!inTransit || !booking?.stops?.length) return null;
    const dropoffStop = booking.stops.find((s) => s.type === "Dropoff");
    if (!dropoffStop) return null;
    const isActive =
      dropoffStop.status !== "Pending" && dropoffStop.status !== "Completed" && dropoffStop.status !== "Cancelled";
    return isActive ? dropoffStop : null;
  }, [booking?.stops, effectiveBookingStatus]);

  /** Active stop coordinates for map route: rider/driver → this point only when set */
  const activeDropoffForRoute = useMemo((): LocationCoordinates | undefined => {
    if (!activeInTransitStop) return undefined;
    const lat = activeInTransitStop.latitude;
    const lng = activeInTransitStop.longitude;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return undefined;
    if (lat === 0 && lng === 0) return undefined;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
    return { latitude: lat, longitude: lng };
  }, [activeInTransitStop]);

  useEffect(() => {
    if (!realTimeDriverLocation) return;
    setLastKnownDriverLocation({
      latitude: realTimeDriverLocation.latitude,
      longitude: realTimeDriverLocation.longitude,
      heading: realTimeDriverLocation.heading,
    });
  }, [realTimeDriverLocation]);

  useEffect(() => {
    // A different booking must not inherit the previous driver's last position.
    setLastKnownDriverLocation(null);
  }, [id]);

  /**
   * Get driver location - prefer real-time SignalR, then persisted storage, then trackingData
   */
  const currentDriverLocation = useMemo(() => {
    if (realTimeDriverLocation) {
      return {
        latitude: realTimeDriverLocation.latitude,
        longitude: realTimeDriverLocation.longitude,
        // Carried through so the map marker can point where the driver is actually going.
        // Only the live feed has it; the persisted and REST fallbacks store coordinates only.
        heading: realTimeDriverLocation.heading,
      };
    }
    // Anything we saw this session beats the focus-time snapshot, which may be older or absent.
    if (lastKnownDriverLocation) {
      return lastKnownDriverLocation;
    }
    if (persistedDriverLocation) {
      return persistedDriverLocation;
    }
    return trackingData?.driverLocation ?? null;
  }, [
    realTimeDriverLocation,
    lastKnownDriverLocation,
    persistedDriverLocation,
    trackingData?.driverLocation,
  ]);

  /**
   * Get status display name (user-friendly labels, e.g. DriverAssigned → "Picking up", PickedUp → "In Transit")
   * Uses effective status (validated against stops)
   */
  const getStatusDisplayName = (): string => {
    const effectiveStatus = effectiveBookingStatus;
    if (effectiveStatus) {
      return getStatusDisplayLabel(effectiveStatus);
    }
    if (booking?.status) {
      return getStatusDisplayLabel(booking.status as BookingStatus);
    }
    const trackingStatus = trackingData?.status;
    if (trackingStatus) {
      const map: Record<string, string> = {
        "Driver Assigned": "Picking up",
        "Pickup Completed": "In Transit",
        "Out for Delivery": "In Transit",
        "Delivered": "Completed",
        "Booking Confirmed": "Pending",
      };
      return map[trackingStatus] ?? trackingStatus;
    }
    return "Pending";
  };

  /**
   * Format estimated arrival time
   * Prefers route-based ETA from Google Maps, falls back to trackingData estimate
   */
  const formatEstimatedArrival = (): string => {
    // Use route-based ETA if available (more accurate)
    if (routeETA?.duration) {
      return routeETA.duration;
    }

    // Fallback to trackingData estimate
    if (trackingData?.estimatedArrival) {
      const now = new Date();
      const arrival = new Date(trackingData.estimatedArrival);
      const diffMs = arrival.getTime() - now.getTime();
      const diffMins = Math.max(0, Math.round(diffMs / 60000));
      return diffMins > 0 ? `${diffMins} mins` : "Arriving now";
    }

    return "Calculating...";
  };

  /**
   * Handle route calculation callback from MapView
   */
  const handleRouteCalculated = useCallback((distance: string, duration: string) => {
    setRouteETA({ distance, duration });
  }, []);

  /** When status is DriverAssigned/Dispatched (Picking up) AND we have driver location: show only driver + pickup; hide destination */
  const isPickingUpPhase = useMemo(
    () => ["DriverAssigned", "Dispatched"].includes(effectiveBookingStatus ?? ""),
    [effectiveBookingStatus]
  );
  /** Hide dropoff only when in Picking up phase AND driver location is available; otherwise show pickup + dropoff (fallback) */
  const hideDropoffForMap = isPickingUpPhase && !!currentDriverLocation;

  /**
   * Once the job is over the driver is no longer part of the picture: the map should settle
   * on pickup + dropoff only, with no marker and no route. The persisted location is purged
   * for this booking, but a live fix received earlier in the session is still in memory —
   * so the marker has to be gated explicitly rather than relying on the location going away.
   */
  const isDeliveryFinished = useMemo(
    () => ["Completed", "Cancelled"].includes(effectiveBookingStatus ?? ""),
    [effectiveBookingStatus]
  );

  // Log driver-location availability outside the marker memo — referencing the live update
  // in there re-ran it (and rebuilt every marker) on every incoming fix.
  useEffect(() => {
    if (!currentDriverLocation) {
      console.log('[TrackingScreen] No driver location available:', {
        driverId,
        isSignalRConnected,
      });
    }
  }, [!currentDriverLocation, driverId, isSignalRConnected]);

  /**
   * Map markers for tracking
   * When Picking up + driver location: only pickup + driver (no dropoff). Otherwise: pickup + dropoff + driver.
   */
  const mapMarkers = useMemo(() => {
    const markers = [];

    // Pickup marker (from booking or tracking data)
    if (pickupLocation) {
      markers.push({
        id: 'pickup',
        coordinates: pickupLocation,
        title: 'Pickup Location',
        type: 'pickup' as const,
      });
    }

    // Dropoff marker (shown even when completed)
    if (!hideDropoffForMap && dropoffLocation) {
      markers.push({
        id: 'dropoff',
        coordinates: dropoffLocation,
        title: 'Dropoff Location',
        type: 'dropoff' as const,
      });
    }

    // The driver is deliberately NOT pushed here. MapView renders it from the
    // `driverLocation` prop as an animated marker; adding it to this list as well drew a
    // second, snapping copy on the same coordinate. Keeping it out also stops this array
    // from being rebuilt on every location update, which re-rendered every other marker.
    return markers;
  }, [pickupLocation, dropoffLocation, hideDropoffForMap]);

  /**
   * Initial map region (center on pickup or driver location)
   */
  const initialMapRegion = useMemo(() => {
    // Prefer real-time driver location, then static driver location, then pickup location
    const centerLocation = currentDriverLocation || trackingData?.driverLocation || pickupLocation;

    if (!centerLocation) {
      // Default to Manila, Philippines if no location available
      return {
        latitude: 14.5995,
        longitude: 120.9842,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    return {
      latitude: centerLocation.latitude,
      longitude: centerLocation.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [pickupLocation, trackingData, currentDriverLocation]);

  /**
   * Progress from booking status: Placed (0) → Pickup (1) → On the Way (2) → Delivered (3)
   * Uses effective status (validated against stops)
   */
  const getCurrentStepIndex = (): number => {
    if (isBookingCancelled(booking)) return 0;
    const status = effectiveBookingStatus || booking?.status;
    if (!status) return 0;
    if (["Pending", "Assigned", "Broadcasting", "Confirmed", "Cancelled"].includes(status)) return 0;
    if (["DriverAssigned", "Dispatched"].includes(status)) return 1;
    if (["PickedUp", "InProgress"].includes(status)) return 2;
    if (status === "Completed") return 3;
    return 0;
  };

  /**
   * Progress percentage (0–100) from current step index
   */
  const getProgress = (): number => {
    const stepIndex = getCurrentStepIndex();
    return stepIndex >= 3 ? 100 : (stepIndex / 3) * 100;
  };

  if ((error || bookingError) && !booking && !trackingData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error || bookingError || "Failed to load tracking data"}
          </Text>
        </View>
      </View>
    );
  }

  const progress = getProgress();
  const currentStepIndex = getCurrentStepIndex();
  /** True only while the very first booking fetch is in flight (no booking loaded yet). */
  const isInitialBookingLoading = isLoadingBooking && !booking;

  /** Status label for top pill (e.g. "Picking up", "En route") */
  const headerStatusLabel = useMemo((): string => {
    if (isBookingCancelled(booking)) return "Cancelled";
    // Always prefer effective status first, which handles first stop completion
    // effectiveBookingStatus will be null only if booking is null, so we can safely use it
    const status = effectiveBookingStatus ?? booking?.status ?? trackingData?.status;
    if (!status) return getStatusDisplayName();
    // Use getStatusDisplayLabel for consistent status display
    // This ensures "InProgress" displays as "In Transit" (not "En route")
    console.log('[TrackingScreen] headerStatusLabel:', {
      effectiveBookingStatus,
      bookingStatus: booking?.status,
      finalStatus: status,
      hasStops: !!booking?.stops,
      firstStopStatus: booking?.stops?.[0]?.status
    });
    return getStatusDisplayLabel(status as BookingStatus);
  }, [effectiveBookingStatus, booking, trackingData]);

  return (
    <View style={styles.container}>
      {/* Top overlay: back, status pill, share (design: white/90 backdrop) */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerPill}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerPillCenter}>
          <Animated.View
            style={[
              styles.headerStatusDot,
              isBroadcasting && {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.5],
                  outputRange: [1, 0.4],
                }),
              },
            ]}
          />
          <Text style={styles.headerStatusText}>{headerStatusLabel.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.headerPill}>
          <Ionicons name="share-outline" size={22} color="#1e293b" />
        </TouchableOpacity>
      </View>

      {/* The location hub refused the subscription (e.g. booking not trackable yet). The map
          still renders with the last known position, so this is informational, not an error. */}
      {liveTrackingError && driverId ? (
        <View style={[styles.liveTrackingBanner, { top: insets.top + 60 }]}>
          <Ionicons name="cloud-offline-outline" size={16} color="#92400e" />
          <Text style={styles.liveTrackingBannerText}>Live driver location unavailable</Text>
        </View>
      ) : null}

      {/* Map Section - always fills space; drawer overlays from bottom so no gap. When drawer hidden, button toggles map size. */}
      <View
        style={[
          styles.mapContainer,
          styles.mapContainerFill,
          !isDrawerHidden && (isMapExpanded ? styles.mapContainerExpanded : styles.mapContainerMinimized),
        ]}
      >
        <MapViewComponent
          mode="tracking"
          initialRegion={initialMapRegion}
          markers={mapMarkers}
          pickupLocation={pickupLocation || undefined}
          dropoffLocation={hideDropoffForMap ? undefined : (dropoffLocation || undefined)}
          dropoffLocationsForRoute={hideDropoffForMap ? undefined : (dropoffLocationForMap ? [dropoffLocationForMap] : undefined)}
          driverLocation={isDeliveryFinished ? undefined : (currentDriverLocation || undefined)}
          driverLabel={`${trackingData?.driver?.name || 'Driver'} - ${formatEstimatedArrival()} away`}
          bookingStatus={getBookingStatus()}
          activeDropoffForRoute={activeDropoffForRoute}
          isExpanded={isMapExpanded}
          showControls={true}
          scrollEnabled={true}
          style={styles.mapView}
          onRouteCalculated={handleRouteCalculated}
        />
        {/* Floating button only when drawer is fully minimized (hidden) */}
      </View>

      {/* Drawer: drag down to hide completely; handle at top for pan */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: TrackingColors.drawerBg,
            height: drawerHeight,
            borderTopColor: "#e2e8f0",
          },
          // At height 0 the panel is empty but its border and shadow still paint, leaving a
          // hairline and a grey band along the bottom edge — the "not completely hidden"
          // look. Drop the chrome once it is closed so nothing of it remains on screen.
          isDrawerHidden && styles.drawerHiddenChrome,
        ]}
        pointerEvents={isDrawerHidden ? "none" : "auto"}
      >
        <View style={styles.drawerHandle} {...panResponder.panHandlers}>
          <View style={styles.drawerHandleBar} />
        </View>
        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={[styles.contentPanelContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {isInitialBookingLoading ? (
            <BookingDetailSkeleton />
          ) : (
          <>
          {/* Trip summary: En Route / 12 mins | Distance – hide "En route" when delivered */}
          {(() => {
            const effectiveStatus = effectiveBookingStatus ?? booking?.status;
            const isDelivered = effectiveStatus === "Completed";
            if (isDelivered) return null;
            return (
              <View style={styles.tripSummaryRow}>
                <View>
                  {isBroadcasting ? (
                    <Animated.Text
                      style={[
                        styles.tripSummaryLabel,
                        {
                          color: TrackingColors.primary,
                          opacity: pulseAnim.interpolate({
                            inputRange: [1, 1.5],
                            outputRange: [1, 0.7],
                          }),
                        },
                      ]}
                    >
                      SEARCHING FOR RIDERS
                    </Animated.Text>
                  ) : (
                    <Text style={styles.tripSummaryLabel}>EN ROUTE</Text>
                  )}
                  {!isBroadcasting && (() => {
                    const eta = formatEstimatedArrival();
                    const num = eta.match(/^(\d+)/)?.[1];
                    if (num) {
                      return (
                        <Text style={styles.tripSummaryTime}>
                          <Text style={styles.tripSummaryTimeNum}>{num}</Text>
                          <Text style={styles.tripSummaryTimeUnit}> mins</Text>
                        </Text>
                      );
                    }
                    return <Text style={styles.tripSummaryTimeNum}>{eta || "—"}</Text>;
                  })()}
                </View>
                <View style={styles.tripSummaryRight}>
                  <Text style={styles.tripSummaryDistanceLabel}>DISTANCE</Text>
                  <Text style={styles.tripSummaryDistance}>
                    {routeETA?.distance ?? "—"}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Booking number – reference data, deliberately not inside the driver card */}
          {booking?.bookingNumber ? (
            <View style={styles.statusBadgeContainer}>
              <Text style={styles.statusBadgeLabel}>BOOKING NO.</Text>
              <Text style={styles.bookingNumberValue} selectable>
                {booking.bookingNumber.replace("#", "")}
              </Text>
            </View>
          ) : null}

          {/* Final Fare – always from the persisted Booking's server-confirmed fare, never the
              client's last calculate-fare quote, since the server is authoritative on price */}
          {booking && (booking.finalFare ?? booking.estimatedFare) != null ? (
            <View style={styles.statusBadgeContainer}>
              <Text style={styles.statusBadgeLabel}>FINAL FARE</Text>
              <Text style={styles.bookingNumberValue}>
                {`₱${Number(booking.finalFare ?? booking.estimatedFare).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            </View>
          ) : null}

          {/* Booking Status Badge */}
          {(() => {
            const effectiveStatus = effectiveBookingStatus || booking?.status;
            if (!effectiveStatus) return null;
            return (
              <View style={styles.statusBadgeContainer}>
                <Text style={styles.statusBadgeLabel}>STATUS</Text>
                <StatusBadge status={effectiveStatus as BookingStatus} />
              </View>
            );
          })()}

          {/* View Proof of Deliveries – only when there are proof of deliveries */}
          {booking?.proofOfDeliveries != null && booking.proofOfDeliveries.length > 0 && (
            <TouchableOpacity
              style={[styles.proofOfDeliveriesButton, { backgroundColor: BeeColors.yellow[400] + "22", borderColor: BeeColors.yellow[400] + "66" }]}
              onPress={() => setShowProofOfDeliveriesModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="images" size={20} color={BeeColors.yellow[600]} />
              <Text style={[styles.proofOfDeliveriesButtonText, { color: theme.text }]}>View Proof of Deliveries</Text>
            </TouchableOpacity>
          )}

          {/* Pickup Point - Display when status is "Picking up" (DriverAssigned/Dispatched) */}
          {(() => {
            const isPickingUp = effectiveBookingStatus === "DriverAssigned" || effectiveBookingStatus === "Dispatched";
            if (!isPickingUp) return null;

            // Get pickup location from stops array (preferred) or legacy pickupLocation field
            const pickupAddress = booking?.stops?.find((stop) => stop.type === "Pickup")?.address
              || booking?.pickupLocation
              || "Pickup location not available";

            return (
              <View style={styles.pickupPointContainer}>
                <View style={styles.pickupPointHeader}>
                  <Ionicons name="location" size={18} color={BeeColors.green[600]} />
                  <Text style={styles.pickupPointLabel}>PICKUP POINT</Text>
                </View>
                <Text style={[styles.pickupPointAddress, { color: theme.text }]} numberOfLines={2}>
                  {pickupAddress}
                </Text>
              </View>
            );
          })()}

          {/* Active stop card: only the dropoff with status InProgress (not Pending, Completed, or Cancelled) */}
          {activeInTransitStop && (
            <View style={styles.pickupPointContainer}>
              <View style={styles.pickupPointHeader}>
                <Ionicons name="car" size={18} color={BeeColors.amber[600]} />
                <Text style={styles.pickupPointLabel}>ACTIVELY BEING DELIVERED</Text>
              </View>
              <Text style={[styles.inTransitDropoffSubtitle, { color: theme.textMuted }]}>
                Current dropoff • Driver going to this location
              </Text>
              <Text style={[styles.pickupPointAddress, { color: theme.text }]} numberOfLines={3}>
                {activeInTransitStop.address?.trim() || "Dropoff address not available"}
              </Text>
              {currentDriverLocation ? (
                <View style={styles.inTransitDriverRow}>
                  <Ionicons name="navigate" size={14} color={theme.textMuted} />
                  <Text style={[styles.inTransitDriverText, { color: theme.textMuted }]}>
                    Driver en route to this stop • ETA {formatEstimatedArrival()}
                  </Text>
                </View>
              ) : (
                <View style={styles.inTransitDriverRow}>
                  <Ionicons name="car-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.inTransitDriverText, { color: theme.textMuted }]}>
                    Driver heading to this location
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Progress bar with steps */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%` }]} />
            </View>
            <View style={styles.progressSteps}>
              <View style={styles.progressStep}>
                <View style={[
                  styles.progressStepDot,
                  currentStepIndex >= 0 && styles.progressStepDotActive,
                  currentStepIndex === 0 && styles.progressStepDotCurrent,
                ]} />
                <Text style={[
                  styles.progressStepLabel,
                  currentStepIndex >= 0 && styles.progressStepLabelActive,
                ]}>Placed</Text>
              </View>
              <View style={styles.progressStep}>
                <View style={[
                  styles.progressStepDot,
                  currentStepIndex >= 1 && styles.progressStepDotActive,
                  currentStepIndex === 1 && styles.progressStepDotCurrent,
                ]} />
                <Text style={[
                  styles.progressStepLabel,
                  currentStepIndex >= 1 && styles.progressStepLabelActive,
                ]}>Pickup</Text>
              </View>
              <View style={styles.progressStep}>
                <View style={[
                  styles.progressStepDot,
                  currentStepIndex >= 2 && styles.progressStepDotActive,
                  currentStepIndex === 2 && styles.progressStepDotCurrent,
                ]} />
                <Text style={[
                  styles.progressStepLabel,
                  currentStepIndex >= 2 && styles.progressStepLabelActive,
                ]}>On the Way</Text>
              </View>
              <View style={styles.progressStep}>
                <View style={[
                  styles.progressStepDot,
                  currentStepIndex >= 3 && styles.progressStepDotActive,
                  currentStepIndex === 3 && styles.progressStepDotCurrent,
                ]} />
                <Text style={[
                  styles.progressStepLabel,
                  currentStepIndex >= 3 && styles.progressStepLabelActive,
                ]}>Delivered</Text>
              </View>
            </View>
          </View>

          {/* Driver card: avatar + rating | name + vehicle | BEE-1234 pill */}
          {(booking?.selectedDriverId ?? booking?.driverName ?? booking?.driverVehicle ?? trackingData?.driver) ? (
            <View style={styles.driverCardNew}>
              <View style={styles.driverCardNewLeft}>
                <View style={styles.driverAvatarContainer}>
                  {booking?.driverImageUrl ? (
                    <Image source={{ uri: booking.driverImageUrl }} style={[styles.driverAvatarImageNew, { width: type.scale(52), height: type.scale(52) }]} />
                  ) : (
                    <View style={[styles.driverAvatarNew, { width: type.scale(52), height: type.scale(52) }]}>
                      <Ionicons name="person" size={28} color="#64748b" />
                    </View>
                  )}
                  {isBroadcasting && (
                    <Animated.View
                      style={[
                        styles.broadcastingIndicator,
                        {
                          transform: [{ scale: pulseAnim }],
                          opacity: pulseAnim.interpolate({
                            inputRange: [1, 1.5],
                            outputRange: [1, 0.4],
                          }),
                        },
                      ]}
                    >
                      <View style={styles.broadcastingDot} />
                    </Animated.View>
                  )}
                  <View style={styles.ratingBadgeNew}>
                    <Text style={styles.ratingTextNew}>4.9</Text>
                    <Ionicons name="star" size={10} color={TrackingColors.primaryContent} />
                  </View>
                </View>
                <View style={styles.driverInfoNew}>
                  <Text style={[styles.driverNameNew, { fontSize: type.lg }]}>
                    {booking?.driverName ?? trackingData?.driver?.name ?? "Driver"}
                  </Text>
                  {/* Vehicle Type */}
                  <View style={styles.driverVehicleRow}>
                    <Ionicons name="car" size={14} color="#64748b" />
                    <Text style={[styles.driverVehicleNew, { fontSize: type.base }]}>
                      {booking?.driverVehicle ?? trackingData?.driver?.vehicle ?? "Vehicle"}
                    </Text>
                  </View>
                  {/* Vehicle model (Color) */}
                  {(booking?.driverVehicleModel ?? booking?.driverVehicleColor) ? (
                    <Text style={[styles.driverVehicleModelNew, { fontSize: type.sm }]}>
                      {booking?.driverVehicleModel && booking?.driverVehicleColor
                        ? `${booking.driverVehicleModel} (${booking.driverVehicleColor})`
                        : (booking?.driverVehicleModel ?? booking?.driverVehicleColor ?? "—")}
                    </Text>
                  ) : null}
                  {/* Plate number in green pill */}
                  {(booking?.driverPlate ?? trackingData?.driver?.licensePlate) ? (
                    <View style={styles.driverPlatePill}>
                      <Text style={[styles.driverPlatePillText, { fontSize: type.sm }]}>
                        {booking?.driverPlate ?? trackingData?.driver?.licensePlate ?? ""}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {booking?.selectedDriverId ? (
                <TouchableOpacity
                  style={styles.chatWithDriverButton}
                  onPress={() =>
                    router.push({
                      pathname: '/chat',
                      params: { bookingId: booking.id, counterpartName: booking?.driverName ?? 'Driver' },
                    })
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color={TrackingColors.accentBlue} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.noDriverCard}>
              {isBroadcasting ? (
                <>
                  <Animated.Text
                    style={[
                      styles.searchingForRidersText,
                      {
                        color: TrackingColors.primary,
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.5],
                          outputRange: [1, 0.6],
                        }),
                        transform: [{
                          scale: pulseAnim.interpolate({
                            inputRange: [1, 1.5],
                            outputRange: [1, 1.05],
                          })
                        }],
                      },
                    ]}
                  >
                    🔍 Searching for riders...
                  </Animated.Text>
                  <Text style={[styles.searchingForRidersSubtext, { color: theme.textMuted }]}>
                    We're finding the best driver for your delivery
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="person-outline" size={32} color={theme.textMuted} />
                  <Text style={[styles.noDriverText, { color: theme.textSecondary }]}>Driver not yet assigned</Text>
                  <Text style={[styles.noDriverSubtext, { color: theme.textMuted }]}>A driver will be assigned soon</Text>
                </>
              )}
            </View>
          )}

          {/* Action footer: Safety Tool, Cancel Trip (white, black text) */}
          <View style={styles.actionFooterRow}>
            <TouchableOpacity style={styles.actionFooterButton}>
              <Ionicons name="shield-outline" size={20} color="#1e293b" />
              <Text style={styles.actionFooterButtonText}>Safety Tool</Text>
            </TouchableOpacity>
            {/* Only show Cancel Trip button when effective status is Pending */}
            {effectiveBookingStatus === "Pending" && (
              <TouchableOpacity
                style={styles.actionFooterButton}
                onPress={() => {
                  if (booking) {
                    setShowCancelModal(true);
                  }
                }}
                disabled={!booking}>
                <Ionicons name="close-circle-outline" size={20} color="#1e293b" />
                <Text style={styles.actionFooterButtonText}>Cancel Trip</Text>
              </TouchableOpacity>
            )}
          </View>
          </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Cancel Booking Modal */}
      <CancelBookingModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelBooking}
        bookingNumber={booking?.bookingNumber}
      />

      {/* Proof of Deliveries Modal – images and signatures */}
      <Modal
        visible={showProofOfDeliveriesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProofOfDeliveriesModal(false)}
      >
        <View style={[styles.podModalContainer, { backgroundColor: theme.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.podModalHeader}>
            <Text style={[styles.podModalTitle, { color: theme.text }]}>Proof of Deliveries</Text>
            <TouchableOpacity onPress={() => setShowProofOfDeliveriesModal(false)} style={styles.podModalCloseButton} hitSlop={12}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.podModalScroll}
            contentContainerStyle={styles.podModalContent}
            showsVerticalScrollIndicator={true}
          >
            {booking?.proofOfDeliveries?.map((pod, index) => (
              <View key={pod.id || index} style={[styles.podCard, { backgroundColor: theme.surface ?? "#fff", borderColor: theme.border }]}>
                <Text style={[styles.podCardTitle, { color: theme.text }]}>Delivery {index + 1}</Text>
                {pod.deliveredAt ? (
                  <Text style={[styles.podCardMeta, { color: theme.textSecondary }]}>
                    Delivered {new Date(pod.deliveredAt).toLocaleString()}
                  </Text>
                ) : null}
                {pod.recipientName ? (
                  <Text style={[styles.podCardMeta, { color: theme.textSecondary }]}>Recipient: {pod.recipientName}</Text>
                ) : null}
                {pod.imagePath ? (
                  <View style={styles.podImageWrap}>
                    <Text style={[styles.podImageLabel, { color: theme.textSecondary }]}>Photo</Text>
                    <Image source={{ uri: pod.imagePath }} style={styles.podImage} resizeMode="cover" />
                  </View>
                ) : null}
                {pod.signaturePath ? (
                  <View style={styles.podImageWrap}>
                    <Text style={[styles.podImageLabel, { color: theme.textSecondary }]}>Signature</Text>
                    <Image source={{ uri: pod.signaturePath }} style={[styles.podImage, styles.podSignatureImage]} resizeMode="contain" />
                  </View>
                ) : null}
                {pod.notes ? (
                  <Text style={[styles.podNotes, { color: theme.textSecondary }]}>{pod.notes}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Driver card at bottom when drawer hidden – tap to open order details */}
      {isDrawerHidden && (
        <TouchableOpacity
          style={[styles.drawerOpenStrip, { paddingBottom: insets.bottom + 16, paddingHorizontal: 24, backgroundColor: theme.background }]}
          onPress={openDrawer}
          activeOpacity={0.9}
          // The drawer's own handle sits inside a pointerEvents="none" view once hidden, so
          // it cannot be grabbed. Mirroring the pan handlers here is what makes "pull up to
          // reopen" work; the tap still falls through to onPress.
          {...panResponder.panHandlers}
        >
          <View style={[styles.drawerOpenStripHandle, { backgroundColor: theme.border }]} />
          <View style={styles.stripInfoRow}>
            <View style={styles.stripTextCol}>
              <Text style={[styles.stripPrimary, { color: theme.text, fontSize: type.base }]} numberOfLines={1} ellipsizeMode="tail">
                {isDeliveryFinished
                  ? (effectiveBookingStatus === "Cancelled" ? "Cancelled" : "Completed")
                  : effectiveBookingStatus === "Pending"
                    ? "Scheduled Delivery"
                    : `Arriving in ${formatEstimatedArrival()}`}
              </Text>
              {/* No ETA or status line once the job is over — the word above says it all. */}
              {!isDeliveryFinished && (
                <Text style={[styles.stripSecondary, { color: theme.textSecondary, fontSize: type.xs }]} numberOfLines={1}>
                  {getStatusDisplayName()?.toUpperCase()?.replace(/\s+/g, " ") || "PENDING"}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-up" size={18} color={theme.textMuted} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BeeColors.gray[900],
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  liveTrackingBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 29,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(254,243,199,0.95)",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  liveTrackingBannerText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#92400e",
  },
  headerPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerPillCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: TrackingColors.primary,
    marginRight: 8,
  },
  headerStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1e293b",
    letterSpacing: 1,
  },
  mapContainer: {
    backgroundColor: BeeColors.gray[900],
    position: "relative",
  },
  mapContainerFill: {
    flex: 1,
  },
  mapContainerExpanded: {},
  mapContainerMinimized: {},
  mapView: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  drawer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  drawerHiddenChrome: {
    borderTopWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  drawerHandle: {
    alignItems: "center",
    // ~44pt tall so the grab area clears the Apple HIG / Material minimum touch target.
    // At the previous 12/14 padding the drag strip was about 31pt and easy to miss.
    paddingVertical: 20,
    paddingTop: 20,
  },
  drawerHandleBar: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#cbd5e1",
  },
  drawerScroll: {
    flex: 1,
  },
  drawerOpenStrip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    paddingHorizontal: 20,
    minHeight: 52,
    zIndex: 25,
    elevation: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  drawerOpenStripHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
  },
  /**
   * Collapsed bar. Carries the ETA/status that used to live in a separate floating pill
   * above it — two stacked bars read as a rendering glitch, and that pill toggled map size,
   * a style only applied while the drawer is OPEN, so it did nothing while it was visible.
   */
  stripInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 12,
  },
  stripTextCol: {
    flex: 1,
    minWidth: 0,
  },
  stripPrimary: {
    fontWeight: "700",
  },
  stripSecondary: {
    fontWeight: "600",
    marginTop: 1,
    letterSpacing: 0.4,
  },
  contentPanelContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  bookingNumberValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: 1,
  },
  tripSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  tripSummaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TrackingColors.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  tripSummaryTime: {},
  tripSummaryTimeNum: {
    fontSize: 36,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  tripSummaryTimeUnit: {
    fontSize: 18,
    fontWeight: "500",
    color: "#64748b",
  },
  tripSummaryRight: {
    alignItems: "flex-end",
  },
  tripSummaryDistanceLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tripSummaryDistance: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  statusBadgeContainer: {
    marginBottom: 20,
    gap: 8,
  },
  statusBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  proofOfDeliveriesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  proofOfDeliveriesButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  pickupPointContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pickupPointHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  pickupPointLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pickupPointAddress: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  inTransitDropoffSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  inTransitDriverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  inTransitDriverText: {
    fontSize: 12,
    fontWeight: "500",
  },
  progressSection: {
    marginBottom: 24,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: TrackingColors.primary,
    borderRadius: 999,
  },
  progressSteps: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  progressStep: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  progressStepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    borderWidth: 2,
    borderColor: "#f1f5f9",
  },
  progressStepDotActive: {
    backgroundColor: TrackingColors.primary,
    borderColor: TrackingColors.primary,
  },
  progressStepDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    shadowColor: TrackingColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  progressStepLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94a3b8",
    textAlign: "center",
  },
  progressStepLabelActive: {
    color: "#0f172a",
    fontWeight: "600",
  },
  driverCardNew: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TrackingColors.driverCardBg,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 16,
  },
  chatWithDriverButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  driverCardNewLeft: {
    flexDirection: "row",
    // Top-aligned: the details column now wraps to as many lines as the name and vehicle
    // need, and centring against a fixed-height avatar left it drifting off-centre.
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: 12,
  },
  driverAvatarNew: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  driverAvatarImageNew: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  ratingBadgeNew: {
    position: "absolute",
    bottom: -4,
    right: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: TrackingColors.primary,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#f8fafc",
  },
  ratingTextNew: {
    fontSize: 10,
    fontWeight: "700",
    color: TrackingColors.primaryContent,
  },
  driverInfoNew: {
    flex: 1,
    // flexBasis 0 with grow makes the column claim the leftover row space rather than
    // sizing to its content, so the name gets the room the pill no longer takes.
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  driverNameNew: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  driverVehicleRow: {
    flexDirection: "row",
    // flex-start so a wrapped vehicle name keeps the icon aligned to its first line.
    alignItems: "flex-start",
    gap: 6,
  },
  driverVehicleNew: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
    // Claim the row's remaining width so a long vehicle name wraps instead of overflowing
    // past the icon.
    flex: 1,
  },
  driverVehicleModelNew: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  driverPlatePill: {
    alignSelf: "flex-start",
    // Plate is legally identifying information — it must never be clipped, so the pill
    // sizes to the text rather than the text being cut to the pill.
    flexShrink: 0,
    backgroundColor: "#166534",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  driverPlatePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  actionFooterRow: {
    flexDirection: "row",
    gap: 16,
  },
  actionFooterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  actionFooterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  arrivalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  arrivalLeft: {
    flex: 1,
  },
  arrivalTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  arrivalSubtitle: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
    letterSpacing: 0.5,
  },
  progressContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  progressLine: {
    position: "absolute",
    top: 6,
    left: 8,
    right: 8,
    height: 2,
  },
  progressLineActive: {
    position: "absolute",
    top: 6,
    left: 8,
    height: 2,
    shadowColor: TrackingColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 4,
    borderColor: BeeColors.gray[50],
  },
  progressDotActive: {
    shadowColor: TrackingColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  progressDotCurrent: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 4,
    borderColor: BeeColors.gray[50],
    shadowColor: TrackingColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  progressLabel: {
    fontSize: 10,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  driverCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  driverAvatarContainer: {
    position: "relative",
    // Fixed-size avatar: the details column absorbs any narrowing, not the photo.
    flexShrink: 0,
  },
  broadcastingIndicator: {
    position: "absolute",
    top: -4,
    right: -4,
    zIndex: 10,
  },
  broadcastingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TrackingColors.primary,
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: TrackingColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: BeeColors.gray[100],
  },
  driverAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: BeeColors.gray[100],
  },
  ratingBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: BeeColors.white,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BeeColors.gray[100],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: "700",
    color: BeeColors.gray[900],
  },
  driverInfo: {
    flex: 1,
    minWidth: 0,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  driverVehicle: {
    fontSize: 14,
  },
  driverActions: {
    flexDirection: "row",
    gap: 8,
  },
  driverActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButton: {},
  shareButton: {
    shadowColor: TrackingColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 16,
    textAlign: "center",
  },
  locationDetailsSection: {
    marginBottom: 24,
    gap: 16,
  },
  locationDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  locationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  locationDetailText: {
    flex: 1,
  },
  locationDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  openMapsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  openMapsText: {
    fontSize: 11,
    fontWeight: "600",
  },
  locationDetailLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  locationDetailAddress: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  noDriverCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  noDriverText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  noDriverSubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  searchingForRidersText: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  searchingForRidersSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  podModalContainer: {
    flex: 1,
  },
  podModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  podModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  podModalCloseButton: {
    padding: 4,
  },
  podModalScroll: {
    flex: 1,
  },
  podModalContent: {
    padding: 20,
    paddingBottom: 32,
  },
  podCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  podCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  podCardMeta: {
    fontSize: 13,
    marginBottom: 4,
  },
  podImageWrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  podImageLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  podImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  podSignatureImage: {
    aspectRatio: 2,
    backgroundColor: "#fff",
  },
  podNotes: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
    fontStyle: "italic",
  },
});
