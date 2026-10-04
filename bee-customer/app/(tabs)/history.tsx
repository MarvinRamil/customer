import { BeeColors } from "@/constants/theme";
import { useBookings } from "@/features/bookings";
import { useHistoryBookings, useHistoryStats } from "@/features/history";
import type { HistoryFilter } from "@/features/history/types";
import { useTheme } from "@/shared/hooks/use-theme";
import type { Booking } from "@/shared/types/booking";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * History colors matching HTML design
 */
const HistoryColors = {
  primary: "#FFCD36", // primary brand yellow
  primaryDark: "#eab308", // yellow-500
};

/**
 * Format booking number for display
 */
const formatBookingNumber = (bookingNumber: string): string => {
  return bookingNumber.startsWith("#") ? bookingNumber : `#${bookingNumber}`;
};

/**
 * Format date and time for display
 */
const formatDateTime = (date: Date): string => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${month} ${day}, ${displayHours}:${displayMinutes} ${ampm}`;
};

/**
 * Get icon name based on truck type
 */
const getTruckIcon = (truckType: string): string => {
  if (truckType.toLowerCase().includes("motorcycle") || truckType.toLowerCase().includes("bike")) {
    return "bicycle";
  }
  return "car";
};


/**
 * History screen component
 * Displays booking history with stats and recent deliveries
 */
export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { allBookings, isLoading, error, refresh } = useBookings("All");
  const [filter, setFilter] = useState<HistoryFilter>('All');
  const [refreshing, setRefreshing] = useState(false);

  // Use history feature hooks
  const historyBookings = useHistoryBookings(allBookings, filter);
  const stats = useHistoryStats(allBookings);

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
   * Handle rebook action
   */
  const handleRebook = (booking: Booking) => {
    router.push({
      pathname: "/booking",
      params: { rebookId: booking.id },
    });
  };

  /**
   * Handle view details
   */
  const handleViewDetails = (booking: Booking) => {
    router.push({ pathname: "/tracking", params: { id: booking.id } });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeft}>
          <View style={styles.beeIconContainer}>
            <Image
              source={require("@/assets/images/bee_logo.jpg")}
              style={styles.beeIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>History</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScrollContent}
        >
          {(['All', 'Pending', 'Completed', 'Cancelled'] as HistoryFilter[]).map((filterOption) => {
            const isActive = filter === filterOption;
            const label = filterOption === 'Pending' ? 'Scheduled' : filterOption;
            return (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  {
                    backgroundColor: isActive ? HistoryColors.primary : theme.surface,
                    borderColor: isActive ? HistoryColors.primary : theme.border,
                  },
                ]}
                onPress={() => setFilter(filterOption)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isActive ? '#000000' : theme.textSecondary,
                      fontWeight: isActive ? '600' : '500',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
            tintColor={HistoryColors.primary}
            colors={[HistoryColors.primary]}
          />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            {/* Total */}
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, styles.statIconYellow]}>
                  <Ionicons name="cube" size={20} color="#92400e" />
                </View>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.total}</Text>
            </View>

            {/* Avg. Time */}
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, styles.statIconBlue]}>
                  <Ionicons name="time" size={20} color={BeeColors.blue[600]} />
                </View>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg. Time</Text>
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {stats.avgTime}{" "}
                <Text style={[styles.statUnit, { color: theme.textSecondary }]}>min</Text>
              </Text>
            </View>

            {/* Rating */}
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, styles.statIconYellow]}>
                  <Ionicons name="star" size={20} color="#92400e" />
                </View>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Rating</Text>
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.rating}</Text>
            </View>

            {/* Spent */}
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, styles.statIconGreen]}>
                  <Ionicons name="cash" size={20} color={BeeColors.green[600]} />
                </View>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Spent</Text>
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>₱{stats.spent.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Recent Deliveries Section */}
        <View style={styles.deliveriesSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Deliveries</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={HistoryColors.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={32}
                color={BeeColors.red[500]}
              />
              <Text style={[styles.errorText, { color: theme.error }]}>Failed to load history</Text>
            </View>
          ) : historyBookings.length > 0 ? (
            <View style={styles.deliveriesList}>
              {historyBookings.map((booking) => {
                // Check if booking should be treated as cancelled
                const isCancelled = booking.status === "Cancelled" ||
                  (booking.status === "Pending" && booking.assignmentStatus === "RejectedByAllDrivers");
                const isCompleted = booking.status === "Completed";
                const isInProgress = booking.status === "InProgress";
                const isPending = booking.status === "Pending";

                return (
                  <View
                    key={booking.id}
                    style={[
                      styles.deliveryCard,
                      isCancelled && styles.deliveryCardCancelled,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View
                          style={[
                            styles.cardIcon,
                            isCancelled && styles.cardIconGray,
                          ]}
                        >
                          <Ionicons
                            name={getTruckIcon(booking.truckType)}
                            size={20}
                            color={
                              isCancelled
                                ? BeeColors.gray[500]
                                : "#92400e"
                            }
                          />
                        </View>
                        <View style={styles.cardHeaderText}>
                          <Text style={[styles.bookingNumber, { color: theme.text }]}>
                            {formatBookingNumber(booking.bookingNumber)}
                          </Text>
                          <Text style={[styles.bookingDate, { color: theme.textSecondary }]}>
                            {formatDateTime(booking.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.cardHeaderRight}>
                        <View
                          style={[
                            styles.statusBadge,
                            isCompleted && styles.statusBadgeCompleted,
                            isCancelled && styles.statusBadgeCancelled,
                            isPending && styles.statusBadgePending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isCompleted && styles.statusBadgeTextCompleted,
                              isCancelled && styles.statusBadgeTextCancelled,
                              isPending && styles.statusBadgeTextPending,
                            ]}
                          >
                            {isCancelled
                              ? "Cancelled"
                              : booking.status === "Completed"
                                ? "Completed"
                                : booking.status === "Pending"
                                  ? "Scheduled"
                                  : "In Progress"}
                          </Text>
                        </View>
                        {booking.deliveryMode && booking.deliveryMode !== "Regular" && (
                          <View style={styles.modeBadge}>
                            <Text style={styles.modeBadgeText}>
                              {booking.deliveryMode === "OnDemand" ? "On-Demand" : "Pooling"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {/* Price on its own line */}
                    <View style={styles.cardPriceRow}>
                      <Text style={[styles.bookingPrice, { color: theme.text }]}>
                        {isCancelled ? "₱0.00" : `₱${(booking.finalFare ?? booking.estimatedFare ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </Text>
                    </View>
                    {isCancelled && booking.cancellationReason && (
                      <Text style={[styles.cancellationReason, { color: theme.textSecondary }]}>
                        {booking.cancellationReason}
                      </Text>
                    )}

                    {/* Locations */}
                    <View style={styles.locationsContainer}>
                      {(() => {
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
                          <>
                            <View style={styles.locationLine}>
                              {stops.map((stop, index) => (
                                <React.Fragment key={stop.id}>
                                  <View
                                    style={[
                                      styles.locationDot,
                                      index === stops.length - 1 && styles.locationDotActive,
                                      isCancelled && styles.locationDotGray,
                                    ]}
                                  />
                                  {index < stops.length - 1 && <View style={styles.locationLineConnector} />}
                                </React.Fragment>
                              ))}
                            </View>
                            <View style={styles.locationsText}>
                              {stops.map((stop, index) => {
                                const isPickup = stop.type === 'Pickup';
                                const isLast = index === stops.length - 1;
                                return (
                                  <View key={stop.id} style={styles.locationTextRow}>
                                    <Ionicons
                                      name="location"
                                      size={14}
                                      color={isPickup ? BeeColors.green[600] : BeeColors.red[600]}
                                      style={styles.locationIcon}
                                    />
                                    <Text
                                      style={[
                                        isLast ? styles.dropoffLocation : styles.pickupLocation,
                                        { color: isLast ? theme.text : theme.textSecondary },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {stop.address}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </>
                        );
                      })()}
                    </View>

                    {/* Action Button */}
                    {isCancelled ? (
                      <TouchableOpacity
                        style={styles.detailsButton}
                        onPress={() => handleViewDetails(booking)}
                      >
                        <Text style={styles.detailsButtonText}>Details</Text>
                      </TouchableOpacity>
                    ) : isPending ? (
                      <TouchableOpacity
                        style={styles.detailsButton}
                        onPress={() => handleViewDetails(booking)}
                      >
                        <Text style={styles.detailsButtonText}>View Details</Text>
                      </TouchableOpacity>
                    ) : isCompleted ? (
                      <View style={styles.completedActions}>
                        <TouchableOpacity
                          style={styles.detailsButtonSmall}
                          onPress={() => handleViewDetails(booking)}
                        >
                          <Text style={styles.detailsButtonText}>Details</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rebookButton, { flex: 1 }]}
                          onPress={() => handleRebook(booking)}
                        >
                          <Text style={styles.rebookButtonText}>Rebook</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.detailsButton}
                        onPress={() => handleViewDetails(booking)}
                      >
                        <Text style={styles.detailsButtonText}>View Details</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="time-outline"
                size={64}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No history yet</Text>
              <Text style={[styles.emptySubText, { color: theme.textMuted }]}>
                Your booking history will appear here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  beeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: HistoryColors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  beeIcon: {
    width: 24,
    height: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: BeeColors.gray[900],
    letterSpacing: -0.5,
  },
  filterButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  filtersContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BeeColors.gray[200],
  },
  filtersScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterChipText: {
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  statsSection: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "47%",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  statIconYellow: {
    backgroundColor: "#fef3c7", // yellow-100
  },
  statIconBlue: {
    backgroundColor: "#dbeafe", // blue-100
  },
  statIconGreen: {
    backgroundColor: "#d1fae5", // emerald-100
  },
  statLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statUnit: {
    fontSize: 14,
    fontWeight: "500",
  },
  deliveriesSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  deliveriesList: {
    gap: 12,
  },
  deliveryCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
  deliveryCardCancelled: {
    opacity: 0.75,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#fef3c7", // yellow-100
    justifyContent: "center",
    alignItems: "center",
  },
  cardIconGray: {
    backgroundColor: BeeColors.gray[100],
  },
  bookingNumber: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  bookingDate: {
    fontSize: 12,
  },
  cardPriceRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  bookingPrice: {
    fontSize: 16,
    fontWeight: "700",
  },
  cancellationReason: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  cardHeaderRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  modeBadge: {
    backgroundColor: BeeColors.yellow[100],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: BeeColors.yellow[600],
  },
  statusBadgeCompleted: {
    backgroundColor: "#d1fae5", // emerald-100
  },
  statusBadgeCancelled: {
    backgroundColor: "#fee2e2", // red-100
  },
  statusBadgePending: {
    backgroundColor: "#fef3c7", // yellow-100
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  statusBadgeTextCompleted: {
    color: "#15803d", // emerald-700
  },
  statusBadgeTextCancelled: {
    color: "#991b1b", // red-800
  },
  statusBadgeTextPending: {
    color: "#92400e", // yellow-800
  },
  locationsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 16,
    paddingLeft: 4,
  },
  locationLine: {
    alignItems: "center",
    width: 6,
  },
  locationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BeeColors.gray[300],
  },
  locationDotActive: {
    backgroundColor: HistoryColors.primary,
  },
  locationDotGray: {
    backgroundColor: BeeColors.gray[400],
  },
  locationLineConnector: {
    width: 2,
    height: 24,
    backgroundColor: BeeColors.gray[200],
    marginVertical: 2,
  },
  locationsText: {
    flex: 1,
    gap: 8,
  },
  locationTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationIcon: {
    marginTop: 1,
  },
  pickupLocation: {
    fontSize: 14,
    flex: 1,
  },
  dropoffLocation: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  rebookButton: {
    width: "100%",
    height: 36,
    backgroundColor: HistoryColors.primary,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  rebookButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
  },
  detailsButton: {
    width: "100%",
    height: 36,
    backgroundColor: BeeColors.gray[100],
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  completedActions: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  detailsButtonSmall: {
    flex: 1,
    height: 36,
    backgroundColor: BeeColors.gray[100],
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: BeeColors.gray[700],
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
