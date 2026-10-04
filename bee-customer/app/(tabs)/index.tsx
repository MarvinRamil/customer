import { BeeColors } from "@/constants/theme";
import { useAuth } from "@/features/auth";
import { getStatusDisplayLabel, StatusBadge, useBookings, useBookingStats } from "@/features/bookings";
import { useTheme } from "@/shared/hooks/use-theme";
import type { Booking } from "@/shared/types/booking";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Format time (e.g., "2:30 PM")
 */
const formatTime = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHours}:${displayMinutes} ${ampm}`;
};

/**
 * Progress percentage (0–100) from booking status for active delivery
 */
const getProgressFromStatus = (status: string): number => {
  if (["DriverAssigned", "Dispatched"].includes(status)) return 33;
  if (["PickedUp", "InProgress"].includes(status)) return 66;
  if (status === "Completed") return 100;
  return 0;
};

/**
 * Home screen – welcome, active delivery, stats, scheduled bookings
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { allBookings, isLoading, error, refresh } = useBookings("All");
  const { stats } = useBookingStats();
  const [refreshing, setRefreshing] = useState(false);

  /** All active deliveries: InProgress, DriverAssigned, Dispatched, PickedUp, or bookings with Pending status and first stop completed */
  const activeDeliveries = useMemo(() => {
    return allBookings.filter((b) => {
      // Exclude completed bookings
      if (b.status === "Completed") {
        return false;
      }
      // Check if booking status is active
      if (["InProgress", "DriverAssigned", "Dispatched", "PickedUp","Confirmed"].includes(b.status)) {
        return true;
      }
      // Also include bookings where status is Pending and first stop is completed
      if (b.status === "Pending" && b.stops && b.stops.length > 0 && b.stops[0].status === "Completed") {
        return true;
      }
      return false;
    });
  }, [allBookings]);

  /** Scheduled (upcoming) bookings – All Pending bookings only (excluding cancelled and bookings with first stop completed) */
  const scheduledBookings = useMemo(() => {
    // Case-insensitive filter for Pending status, excluding RejectedByAllDrivers and bookings with first stop completed
    const pending = allBookings.filter((b) => {
      const status = b.status?.toString().trim() || '';
      const isPending = status.toLowerCase() === 'pending';
      const isRejected = b.assignmentStatus === 'RejectedByAllDrivers';
      
      // Exclude bookings where first stop is completed (they should be in active deliveries)
      if (isPending && b.stops && b.stops.length > 0 && b.stops[0].status === "Completed") {
        return false;
      }
      
      return isPending && !isRejected;
    });
    
    console.log('[HomeScreen] ===== SCHEDULED BOOKINGS FILTER =====');
    console.log('[HomeScreen] All bookings count:', allBookings.length);
    console.log('[HomeScreen] Pending bookings count:', pending.length);
    console.log('[HomeScreen] All bookings with details:', allBookings.map(b => ({ 
      id: b.id, 
      status: b.status, 
      statusType: typeof b.status,
      bookingNumber: b.bookingNumber,
      serviceType: b.serviceType,
      createdAt: b.createdAt
    })));
    console.log('[HomeScreen] Filtered pending bookings:', pending.map(b => ({ 
      id: b.id, 
      status: b.status, 
      bookingNumber: b.bookingNumber 
    })));
    console.log('[HomeScreen] =====================================');
    
    // Sort by schedule date (most recent/upcoming first)
    return pending
      .sort((a, b) => {
        const dateA = a.scheduleDate?.getTime() ?? 0;
        const dateB = b.scheduleDate?.getTime() ?? 0;
        // Descending order: most recent/upcoming first
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [allBookings]);

  const handleTrack = (bookingId: string) => {
    router.push({ pathname: "/tracking", params: { id: bookingId } });
  };

  const handleSeeAllScheduled = () => {
    router.push("/history");
  };

  const handleBookNow = () => {
    router.push("/booking");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // Error handled by hook
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Refresh bookings when screen comes into focus (only if user is logged in and auth is not loading)
   * This ensures newly created bookings appear when navigating back from booking screen
   */
  useFocusEffect(
    useCallback(() => {
      // Wait for auth to finish loading and ensure user is authenticated before refreshing
      if (!isAuthLoading && user) {
        console.log('[HomeScreen] Screen focused, refreshing bookings...');
        refresh();
      }
    }, [refresh, user, isAuthLoading])
  );

  const displayName = user?.fullName?.trim() || "Guest";
  // Count only completed deliveries
  const deliveriesCount = stats?.completed ?? allBookings.filter((b) => b.status === "Completed").length;
  const totalSpend = "$0"; // Placeholder – no totalSpent in API yet

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      {/* Header: profile, welcome + name, notifications */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerIconCircle, { backgroundColor: BeeColors.yellow[400] }]}
          onPress={() => router.push("/profile")}
          activeOpacity={0.8}
        >
          <Ionicons name="person" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.welcomeLabel, { color: theme.textSecondary }]}>
            Welcome back,
          </Text>
          <Text style={[styles.welcomeName, { color: theme.text }]} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerIconCircle, { backgroundColor: BeeColors.yellow[400] }]}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications" size={22} color="#111827" />
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BeeColors.yellow[400]}
            colors={[BeeColors.yellow[400]]}
          />
        }
      >
        {/* Active Deliveries – show all in-progress / driver-assigned bookings */}
        {activeDeliveries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Active Deliveries
              </Text>
              <View style={[styles.pill, { backgroundColor: `${BeeColors.yellow[400]}33` }]}>
                <Text style={[styles.pillText, { color: theme.text }]}>IN PROGRESS</Text>
              </View>
            </View>
            <View style={styles.activeCarouselWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={Dimensions.get("window").width - 20}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={styles.activeCarouselContent}
              >
                {activeDeliveries.map((booking) => (
                  <View
                    key={booking.id}
                    style={[styles.activeCarouselCard, { width: Dimensions.get("window").width - 32 }]}
                  >
                    <ActiveDeliveryCard
                      booking={booking}
                      onTrack={handleTrack}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Book now CTA – design emphasizes BOOK NOW in nav; we only have 3 tabs so offer it here */}
        <TouchableOpacity
          style={[styles.bookNowCta, { backgroundColor: BeeColors.yellow[400] }]}
          onPress={handleBookNow}
          activeOpacity={0.9}
        >
          <Ionicons name="add-circle" size={22} color="#111827" />
          <Text style={styles.bookNowCtaText}>Book now</Text>
        </TouchableOpacity>

        {/* Stat cards: Deliveries, Total Spend */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIconWrap, { backgroundColor: `${BeeColors.blue[500]}18` }]}>
                <Ionicons name="cube-outline" size={26} color={BeeColors.blue[600]} />
              </View>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Deliveries</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{deliveriesCount}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIconWrap, { backgroundColor: `${BeeColors.green[500]}18` }]}>
                <Ionicons name="cash-outline" size={26} color={BeeColors.green[600]} />
              </View>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Spend</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{totalSpend}</Text>
            </View>
          </View>
        </View>

        {/* Scheduled Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Scheduled Bookings
            </Text>
            <TouchableOpacity onPress={handleSeeAllScheduled}>
              <Text style={[styles.seeAllLink, { color: theme.textSecondary }]}>See all</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={BeeColors.yellow[400]} />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : scheduledBookings.length > 0 ? (
            <View style={styles.scheduledList}>
              {scheduledBookings.map((booking) => (
                <ScheduledBookingCard
                  key={booking.id}
                  booking={booking}
                  onPress={() => router.push({ pathname: "/tracking", params: { id: booking.id } })}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="calendar-outline" size={32} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No scheduled bookings
              </Text>
            </View>
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

/**
 * Check if booking should be treated as cancelled
 */
const isBookingCancelled = (booking: Booking): boolean => {
  return booking.status === "Cancelled" || 
         (booking.status === "Pending" && booking.assignmentStatus === "RejectedByAllDrivers");
};

/**
 * Check if first stop is completed
 * Returns true if booking has stops and the first stop (stops[0]) has status "Completed"
 */
const isFirstStopCompleted = (booking: Booking): boolean => {
  if (!booking.stops || booking.stops.length === 0) return false;
  return booking.stops[0].status === "Completed";
};

/**
 * Get effective booking status considering stop completion
 * If booking status is "Pending" and first stop is completed, returns "InProgress" (displays as "In Transit")
 * Only exception: if booking status is already "Completed", keep it as "Completed"
 */
const getEffectiveStatus = (booking: Booking): Booking["status"] => {
  // If booking is Pending and first stop is completed, show as InProgress (In Transit)
  if (booking.status === "Pending" && isFirstStopCompleted(booking)) {
    return "InProgress";
  }
  // If booking is already Completed, keep it as Completed
  if (booking.status === "Completed") {
    return "Completed";
  }
  return booking.status;
};

/**
 * Active delivery card: truck icon, status, ETA, Track button, progress bar, driver info
 */
function ActiveDeliveryCard({
  booking,
  onTrack,
}: {
  booking: Booking;
  onTrack: (id: string) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const isCancelled = isBookingCancelled(booking);
  const effectiveStatus = getEffectiveStatus(booking);
  const displayStatus = isCancelled ? "Cancelled" : effectiveStatus;
  const statusLabel = getStatusDisplayLabel(displayStatus as import("@/shared/types/booking").BookingStatus);
  const progress = getProgressFromStatus(displayStatus);
  const driverName = booking.driverName?.trim() || "Driver";
  const hasVehicleInfo = !!(booking.driverVehicle ?? booking.driverVehicleModel ?? booking.driverVehicleColor ?? booking.driverPlate);
  const vehicleType = booking.driverVehicle?.trim() || null;
  const vehicleModelColor =
    booking.driverVehicleModel && booking.driverVehicleColor
      ? `${booking.driverVehicleModel} (${booking.driverVehicleColor})`
      : (booking.driverVehicleModel ?? booking.driverVehicleColor ?? null);
  const plate = booking.driverPlate?.trim() || null;
  const etaText = "12 mins"; // Placeholder – could come from tracking API later

  return (
    <View style={[styles.activeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.activeTopRow}>
        <View style={[styles.truckIconWrap, { backgroundColor: `${BeeColors.yellow[400]}33` }]}>
          <Ionicons name="car" size={22} color={BeeColors.yellow[600]} />
        </View>
        <View style={styles.activeTitleBlock}>
          <Text style={[styles.activeTitle, { color: theme.text }]}>Driver is {statusLabel.toLowerCase()}</Text>
          <Text style={[styles.activeSubtitle, { color: theme.textSecondary }]}>
            Estimated arrival: {etaText}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.trackButton, { backgroundColor: BeeColors.yellow[400] }]}
          onPress={() => onTrack(booking.id)}
          activeOpacity={0.9}
        >
          <Text style={styles.trackButtonText}>Track</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressWrap}>
        <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: BeeColors.yellow[400], width: `${progress}%` },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressPct, { color: theme.text }]}>{progress}% Complete</Text>
          <Text style={[styles.progressRight, { color: theme.textSecondary }]}>
            {progress < 50 ? "Pickup Location" : progress < 100 ? "On the way" : "Delivered"}
          </Text>
        </View>
      </View>

      <View style={styles.driverSection}>
        <Text style={[styles.driverHeading, { color: BeeColors.yellow[600] }]}>YOUR DRIVER</Text>
        <View style={styles.driverRow}>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: theme.text }]}>{driverName}</Text>
            {hasVehicleInfo ? (
              <View style={styles.driverVehicleBlock}>
                {vehicleType ? (
                  <Text style={[styles.driverVehicleType, { color: theme.textSecondary }]}>{vehicleType}</Text>
                ) : null}
                {vehicleModelColor ? (
                  <Text style={[styles.driverVehicleModelColor, { color: theme.textSecondary }]} numberOfLines={1}>
                    {vehicleModelColor}
                  </Text>
                ) : null}
                {plate ? (
                  <View style={styles.driverPlatePill}>
                    <Text style={styles.driverPlatePillText}>{plate}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={styles.driverActions}>
            <TouchableOpacity style={styles.driverActionBtn}>
              <Ionicons name="call" size={20} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.driverActionBtn}
              onPress={() =>
                router.push({
                  pathname: '/chat',
                  params: { bookingId: booking.id, counterpartName: driverName },
                })
              }
            >
              <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Scheduled booking row: date box, title, time • details, pickup/dropoff, arrow
 */
function ScheduledBookingCard({
  booking,
  onPress,
}: {
  booking: Booking;
  onPress: () => void;
}) {
  const theme = useTheme();
  const d = booking.scheduleDate;
  const month = d ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()] : "—";
  const day = d ? d.getDate() : "—";
  const timeStr = d ? formatTime(d) : "—";
  const title = booking.cargoDescription?.trim() || booking.bookingNumber || "Booking";
  const subtitle = `${timeStr} • ${booking.truckType || "Delivery"}`;
  
  // Use effective status to determine if booking should show as "In Transit"
  const effectiveStatus = getEffectiveStatus(booking);
  const isCancelled = isBookingCancelled(booking);
  const displayStatus = isCancelled ? "Cancelled" : effectiveStatus;
  const statusLabel = getStatusDisplayLabel(displayStatus as import("@/shared/types/booking").BookingStatus);
  
  // Pulsating animation for broadcasting indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isBroadcasting = booking.status === "Pending" && booking.assignmentStatus === "BroadcastingToDrivers";
  
  useEffect(() => {
    if (isBroadcasting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isBroadcasting, pulseAnim]);
  
  // Get stops from booking, or fallback to legacy fields
  const getStops = () => {
    if (booking.stops && booking.stops.length > 0) {
      return [...booking.stops].sort((a, b) => a.sequence - b.sequence);
    }
    // Fallback to legacy fields
    const stops = [];
    if (booking.pickupLocation) {
      stops.push({
        id: 'pickup-legacy',
        sequence: 0,
        address: booking.pickupLocation,
        type: 'Pickup' as const,
        status: 'Pending' as const,
        arrivedAt: null,
        completedAt: null,
        latitude: booking.pickupLatitude || 0,
        longitude: booking.pickupLongitude || 0,
        contactName: null,
        contactPhone: null,
        notes: null,
      });
    }
    if (booking.dropoffLocation) {
      stops.push({
        id: 'dropoff-legacy',
        sequence: 1,
        address: booking.dropoffLocation,
        type: 'Dropoff' as const,
        status: 'Pending' as const,
        arrivedAt: null,
        completedAt: null,
        latitude: booking.dropoffLatitude || 0,
        longitude: booking.dropoffLongitude || 0,
        contactName: null,
        contactPhone: null,
        notes: null,
      });
    }
    return stops;
  };

  const stops = getStops();

  return (
    <TouchableOpacity
      style={[styles.scheduledCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.scheduledDateBox, { backgroundColor: `${BeeColors.yellow[400]}22` }]}>
        <Text style={[styles.scheduledMonth, { color: theme.textSecondary }]}>{month}</Text>
        <Text style={[styles.scheduledDay, { color: theme.text }]}>{day}</Text>
        {isBroadcasting && (
          <Animated.View
            style={[
              styles.broadcastingIndicator,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [1, 0.6],
                }),
              },
            ]}
          >
            <View style={styles.broadcastingDot} />
          </Animated.View>
        )}
      </View>
      <View style={styles.scheduledContent}>
        <View style={styles.scheduledTitleRow}>
          <Text style={[styles.scheduledTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {/* Show status badge if booking has completed dropoffs (should show as "In Transit") */}
          {effectiveStatus === "InProgress" && (
            <StatusBadge status={displayStatus as import("@/shared/types/booking").BookingStatus} />
          )}
        </View>
        <Text style={[styles.scheduledSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {stops.length > 0 ? (
          <View style={styles.scheduledLocations}>
            {stops.map((stop) => {
              const isPickup = stop.type === 'Pickup';
              const prefix = isPickup ? 'From ' : 'To ';

              return (
                <View key={stop.id} style={styles.scheduledLocationRow}>
                  <Ionicons
                    name="location"
                    size={12}
                    color={isPickup ? BeeColors.green[600] : BeeColors.red[600]}
                    style={styles.scheduledLocationIcon}
                  />
                  <Text style={[styles.scheduledLocationLabel, { color: theme.textMuted }]}>
                    {prefix}
                  </Text>
                  <Text style={[styles.scheduledLocationText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {stop.address}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={styles.scheduledChevronWrap}>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },
  welcomeLabel: {
    fontSize: 13,
    marginBottom: 0,
  },
  welcomeName: {
    fontSize: 18,
    fontWeight: "700",
  },
  notificationDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BeeColors.red[600],
    borderWidth: 1.5,
    borderColor: BeeColors.yellow[400],
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  activeCarouselWrapper: {
    marginHorizontal: -16,
    width: Dimensions.get("window").width,
  },
  activeCarouselContent: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  activeCarouselCard: {
    paddingRight: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  seeAllLink: {
    fontSize: 14,
    fontWeight: "500",
  },
  activeCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  activeTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  truckIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activeTitleBlock: {
    flex: 1,
  },
  activeTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  activeSubtitle: {
    fontSize: 13,
  },
  trackButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: "center",
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  progressWrap: {
    marginBottom: 16,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressPct: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressRight: {
    fontSize: 12,
  },
  driverSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  driverHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  driverVehicleBlock: {
    gap: 4,
    marginTop: 2,
  },
  driverVehicleType: {
    fontSize: 13,
    fontWeight: "600",
  },
  driverVehicleModelColor: {
    fontSize: 13,
  },
  driverPlatePill: {
    alignSelf: "flex-start",
    backgroundColor: "#166534",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  driverPlatePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  driverActions: {
    flexDirection: "row",
    gap: 8,
  },
  driverActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  bookNowCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  bookNowCtaText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  statsSection: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    minHeight: 120,
    justifyContent: "flex-start",
  },
  statIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  scheduledList: {
    gap: 10,
  },
  scheduledCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  scheduledLocations: {
    marginTop: 8,
    gap: 4,
  },
  scheduledLocationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scheduledLocationIcon: {
    marginRight: 4,
  },
  scheduledLocationLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 2,
  },
  scheduledLocationText: {
    flex: 1,
    fontSize: 12,
  },
  scheduledChevronWrap: {
    alignSelf: "center",
    marginLeft: 4,
  },
  scheduledDateBox: {
    width: 48,
    height: 52,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginRight: 14,
  },
  broadcastingIndicator: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  broadcastingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BeeColors.yellow[400],
  },
  scheduledMonth: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  scheduledDay: {
    fontSize: 18,
    fontWeight: "700",
  },
  scheduledContent: {
    flex: 1,
  },
  scheduledTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  scheduledTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  scheduledSubtitle: {
    fontSize: 13,
  },
  loadingContainer: {
    padding: 24,
    alignItems: "center",
  },
  errorContainer: {
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  spacer: {
    height: 24,
  },
});
