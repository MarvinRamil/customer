import { BeeColors } from "@/constants/theme";
import { StatusBadge } from "@/features/bookings";
import { useTheme } from "@/shared/hooks/use-theme";
import type { Booking } from "@/shared/types/booking";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * Props for DeliveryCard component
 */
interface DeliveryCardProps {
  /** Booking data to display */
  booking: Booking;
  /** Callback when track button is pressed (for active deliveries) */
  onTrack?: (bookingId: string) => void;
  /** Callback when view details button is pressed (for scheduled bookings) */
  onViewDetails?: (bookingId: string) => void;
}

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
 * Format date for scheduled display (e.g., "Tomorrow, 10:00 AM")
 */
const formatScheduledDateTime = (date: Date): { day: string; time: string } => {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let day: string;
  if (diffDays === 0) {
    day = "Today";
  } else if (diffDays === 1) {
    day = "Tomorrow";
  } else {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    day = `${months[date.getMonth()]} ${date.getDate()}`;
  }

  return { day, time: formatTime(date) };
};

/**
 * Calculate estimated arrival time (15 mins from scheduleDate for active deliveries)
 */
const getEstimatedArrival = (scheduleDate: Date): string => {
  const arrival = new Date(scheduleDate.getTime() + 15 * 60 * 1000);
  return formatTime(arrival);
};

/**
 * Get truck type display name (remove "Truck" suffix if present)
 */
const getTruckTypeDisplay = (truckType: string): string => {
  if (truckType.includes("Truck")) {
    return truckType.replace(" Truck", "");
  }
  return truckType;
};

/**
 * Get icon name based on truck type
 */
const getTruckIcon = (truckType: string): keyof typeof Ionicons.glyphMap => {
  if (truckType.toLowerCase().includes("motor") || truckType.toLowerCase().includes("bike")) {
    return "bicycle";
  }
  return "car";
};

/**
 * Delivery card component that displays booking information
 * Supports three card types: Active Delivery (In Transit), Scheduled, and Completed
 * Uses existing theme colors and matches the HTML design structure
 * @param props - DeliveryCard component props
 */
/**
 * Check if booking should be treated as cancelled
 * Returns true if status is Pending and assignmentStatus is RejectedByAllDrivers
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

export function DeliveryCard({ booking, onTrack, onViewDetails }: DeliveryCardProps) {
  const theme = useTheme();
  const effectiveStatus = getEffectiveStatus(booking);
  const isActive = effectiveStatus === "InProgress";
  const isCompleted = effectiveStatus === "Completed";
  const isCancelled = isBookingCancelled(booking);
  const isScheduled = !isCancelled && ["Pending", "Assigned", "Broadcasting", "Confirmed"].includes(effectiveStatus);

  /**
   * Format booking number for display
   */
  const displayBookingNumber = booking.bookingNumber.replace("#", "");

  /**
   * Get vehicle details text
   */
  const getVehicleDetails = (): string => {
    const truckType = getTruckTypeDisplay(booking.truckType);
    if (booking.weightKg) {
      return `${truckType} • ${booking.weightKg}kg`;
    }
    if (booking.cargoDescription) {
      return `${truckType} • ${booking.cargoDescription}`;
    }
    return truckType;
  };

  /**
   * Get driver info line when booking has assigned driver (from Booking DTO)
   */
  const getDriverDetails = (): string | null => {
    const name = booking.driverName?.trim();
    const vehicle = booking.driverVehicle?.trim();
    const plate = booking.driverPlate?.trim();
    if (!name && !vehicle && !plate) return null;
    const parts = [];
    if (name) parts.push(name);
    if (vehicle) parts.push(plate ? `${vehicle} (${plate})` : vehicle);
    else if (plate) parts.push(plate);
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  /**
   * Get sorted stops from booking, or fallback to legacy pickup/dropoff
   */
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

  /**
   * Render Active Delivery Card (In Transit)
   */
  const renderActiveCard = () => {
    const stops = getStops();
    const isLastStop = (index: number) => index === stops.length - 1;

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: `${BeeColors.yellow[400]}33` }]}>
              <Ionicons name="car" size={20} color={BeeColors.yellow[500]} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.bookingNumber, { color: theme.text }]}>#{displayBookingNumber}</Text>
              <Text style={[styles.vehicleDetails, { color: theme.textSecondary }]}>{getVehicleDetails()}</Text>
              {getDriverDetails() != null && (
                <Text style={[styles.driverDetails, { color: theme.textMuted }]} numberOfLines={1}>
                  Driver: {getDriverDetails()}
                </Text>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: BeeColors.yellow[400] }]}>
            <Text style={styles.statusBadgeText}>In Transit</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineWrapper}>
          <View style={[styles.timelineLine, { borderLeftColor: theme.border }]} />
          {stops.map((stop, index) => {
            const isPickup = stop.type === 'Pickup';
            const isActive = isLastStop(index) && !isPickup;
            const stopNumber = stops.length > 2 ? `${index + 1}. ` : '';
            
            return (
              <View key={stop.id} style={[styles.timelineItem, isLastStop(index) && { marginBottom: 0 }]}>
                <View
                  style={[
                    isActive
                      ? styles.timelineIconContainerActive
                      : styles.timelineIconContainer,
                    {
                      backgroundColor: isPickup
                        ? `${BeeColors.green[600]}20`
                        : `${BeeColors.red[600]}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name="location"
                    size={14}
                    color={isPickup ? BeeColors.green[600] : BeeColors.red[600]}
                  />
                </View>
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      isActive ? styles.timelineLabelActive : styles.timelineLabel,
                      { color: isActive ? BeeColors.yellow[400] : theme.textSecondary },
                    ]}
                  >
                    {stopNumber}{stop.type}
                    {stops.length > 2 && !isPickup ? ` ${index}` : ''}
                  </Text>
                  <Text style={[styles.timelineAddress, { color: theme.text }]} numberOfLines={2}>
                    {stop.address}
                  </Text>
                  <Text style={[styles.timelineTime, { color: theme.textMuted }]}>
                    {isLastStop(index) && !isPickup
                      ? `Est. ${getEstimatedArrival(booking.scheduleDate)}`
                      : formatTime(booking.scheduleDate)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Track Live Button */}
        {onTrack && (
          <TouchableOpacity
            style={[styles.trackButton, { backgroundColor: BeeColors.gray[900] }]}
            onPress={() => onTrack(booking.id)}
            activeOpacity={0.9}
          >
            <Ionicons name="location" size={18} color={BeeColors.white} />
            <Text style={styles.trackButtonText}>Track Live</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  /**
   * Render Scheduled Card
   */
  const renderScheduledCard = () => {
    const scheduledDateTime = formatScheduledDateTime(booking.scheduleDate);
    const truckIcon = getTruckIcon(booking.truckType);

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name={truckIcon} size={20} color={theme.textSecondary} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.bookingNumber, { color: theme.text }]}>#{displayBookingNumber}</Text>
              <Text style={[styles.vehicleDetails, { color: theme.textSecondary }]}>{getVehicleDetails()}</Text>
              {getDriverDetails() != null && (
                <Text style={[styles.driverDetails, { color: theme.textMuted }]} numberOfLines={1}>
                  Driver: {getDriverDetails()}
                </Text>
              )}
            </View>
          </View>
          <StatusBadge status={isCancelled ? "Cancelled" : effectiveStatus} />
        </View>

        {/* Calendar Box */}
        <View style={[styles.calendarBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Ionicons name="calendar" size={20} color={BeeColors.yellow[400]} />
          <View style={styles.calendarContent}>
            <Text style={[styles.calendarText, { color: theme.text }]}>
              {scheduledDateTime.day}, <Text style={styles.calendarTime}>{scheduledDateTime.time}</Text>
            </Text>
            {booking.status === "Pending" && booking.assignmentStatus === "BroadcastingToDrivers" && (
              <Text style={[styles.broadcastingTime, { color: theme.textMuted }]}>
                Broadcasting to drivers...
              </Text>
            )}
          </View>
        </View>

        {/* Location Section - All stops */}
        <View style={styles.locationSection}>
          {getStops().map((stop, index) => {
            const isPickup = stop.type === 'Pickup';
            const stopNumber = getStops().length > 2 ? `${index + 1}. ` : '';
            
            return (
              <View key={stop.id} style={styles.locationLine}>
                <View
                  style={[
                    styles.locationIconContainer,
                    {
                      backgroundColor: isPickup
                        ? `${BeeColors.green[600]}20`
                        : `${BeeColors.red[600]}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name="location"
                    size={16}
                    color={isPickup ? BeeColors.green[600] : BeeColors.red[600]}
                  />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text style={[styles.locationLabel, { color: theme.textSecondary }]}>
                    {stopNumber}{stop.type}
                    {getStops().length > 2 && !isPickup ? ` ${index}` : ''}
                  </Text>
                  <Text style={[styles.locationAddress, { color: theme.text }]} numberOfLines={2}>
                    {stop.address}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* View Details or Track Button */}
        {isActive && onTrack ? (
          <TouchableOpacity
            style={[styles.trackButton, { backgroundColor: BeeColors.gray[900] }]}
            onPress={() => onTrack(booking.id)}
            activeOpacity={0.9}
          >
            <Ionicons name="location" size={18} color={BeeColors.white} />
            <Text style={styles.trackButtonText}>Track Live</Text>
          </TouchableOpacity>
        ) : onViewDetails ? (
          <TouchableOpacity
            style={[styles.viewDetailsButton, { borderColor: theme.border }]}
            onPress={() => onViewDetails(booking.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewDetailsText, { color: theme.text }]}>View Details</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  /**
   * Render Completed Card
   */
  const renderCompletedCard = () => {
    return (
      <View
        style={[
          styles.card,
          styles.completedCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="cube" size={20} color={theme.textMuted} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.bookingNumber, { color: theme.text }]}>#{displayBookingNumber}</Text>
              <Text style={[styles.vehicleDetails, { color: theme.textSecondary }]}>Delivered Yesterday</Text>
              {getDriverDetails() != null && (
                <Text style={[styles.driverDetails, { color: theme.textMuted }]} numberOfLines={1}>
                  Driver: {getDriverDetails()}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={BeeColors.green[600]} />
            <Text style={[styles.completedBadgeText, { color: BeeColors.green[600] }]}>Done</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render appropriate card based on status
  if (isActive) {
    return renderActiveCard();
  } else if (isCompleted) {
    return renderCompletedCard();
  } else if (isScheduled) {
    return renderScheduledCard();
  } else {
    // Fallback for cancelled or other statuses
    return renderScheduledCard();
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  completedCard: {
    opacity: 0.8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  bookingNumber: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 12,
  },
  driverDetails: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timelineWrapper: {
    position: "relative",
    paddingLeft: 8,
    marginBottom: 16,
  },
  timelineLine: {
    position: "absolute",
    left: 19,
    top: 8,
    bottom: 8,
    width: 2,
    borderLeftWidth: 2,
    borderStyle: "dashed",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 24,
  },
  timelineIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: `${BeeColors.green[600]}20`,
  },
  timelineIconContainerActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: `${BeeColors.red[600]}20`,
    shadowColor: BeeColors.red[600],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timelineLabelActive: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timelineAddress: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
    lineHeight: 20,
  },
  timelineTime: {
    fontSize: 12,
  },
  trackButton: {
    width: "100%",
    height: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: BeeColors.white,
  },
  calendarBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  calendarContent: {
    flex: 1,
  },
  calendarText: {
    fontSize: 14,
  },
  calendarTime: {
    fontWeight: "700",
  },
  broadcastingTime: {
    fontSize: 11,
    marginTop: 2,
    fontStyle: "italic",
  },
  locationSection: {
    marginBottom: 16,
    gap: 12,
  },
  locationLine: {
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
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  viewDetailsButton: {
    width: "100%",
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: "600",
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

