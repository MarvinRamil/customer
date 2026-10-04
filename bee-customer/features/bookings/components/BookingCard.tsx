import { BeeColors } from "@/constants/theme";
import { BeeButton } from "@/shared/components/BeeButton";
import type { Booking } from "@/shared/types/booking";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AssignmentStatusBadge } from "./AssignmentStatusBadge";
import { StatusBadge } from "./StatusBadge";

/**
 * Props for BookingCard component
 */
interface BookingCardProps {
  /** Booking data to display */
  booking: Booking;
}

/**
 * Booking card component that displays booking information
 * Shows pickup/dropoff locations, status, truck type, and tracking button
 * @param props - BookingCard component props
 */
/**
 * Check if booking should be treated as cancelled
 */
const isBookingCancelled = (booking: Booking): boolean => {
  return booking.status === "Cancelled" || 
         (booking.status === "Pending" && booking.assignmentStatus === "RejectedByAllDrivers");
};

export function BookingCard({ booking }: BookingCardProps) {
  const router = useRouter();
  const isCancelled = isBookingCancelled(booking);
  const displayStatus = isCancelled ? "Cancelled" : booking.status;

  /**
   * Handle track button press
   * Navigates to tracking screen with booking ID
   */
  const handleTrack = () => {
    router.push({ pathname: "/tracking", params: { id: booking.id } });
  };

  /**
   * Format booking number for display
   * Uses bookingNumber if available, otherwise falls back to ID
   */
  const displayBookingNumber =
    booking.bookingNumber || `#${booking.id.slice(0, 8)}`;

  /**
   * Format date for display
   */
  const formattedDate = booking.scheduleDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  /**
   * Format scheduled time if available
   */
  const formattedTime = booking.scheduleDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.bookingNumber}>{displayBookingNumber}</Text>
          <View style={styles.dateRow}>
            <Text style={styles.date}>{formattedDate}</Text>
            <Text style={styles.time}> • {formattedTime}</Text>
          </View>
          {/* Show assignment status if not unassigned */}
          {booking.assignmentStatus !== "Unassigned" && (
            <View style={styles.assignmentBadgeContainer}>
              <AssignmentStatusBadge status={booking.assignmentStatus} />
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <StatusBadge status={displayStatus} />
          {booking.deliveryMode && booking.deliveryMode !== "Regular" && (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>
                {booking.deliveryMode === "OnDemand" ? "On-Demand" : "Pooling"}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.locations}>
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

          return stops.map((stop) => {
            const isPickup = stop.type === 'Pickup';

            return (
              <View key={stop.id} style={styles.locationRow}>
                <Ionicons
                  name="location"
                  size={16}
                  color={isPickup ? BeeColors.green[600] : BeeColors.red[600]}
                  style={styles.icon}
                />
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabel}>{stop.type}</Text>
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {stop.address}
                  </Text>
                </View>
              </View>
            );
          });
        })()}
      </View>

      {/* Additional booking details */}
      {(booking.cargoDescription ||
        booking.weightKg ||
        booking.size ||
        booking.notes) && (
        <View style={styles.detailsSection}>
          {booking.cargoDescription && (
            <View style={styles.detailRow}>
              <Ionicons
                name="cube-outline"
                size={14}
                color={BeeColors.gray[500]}
              />
              <Text style={styles.detailText} numberOfLines={2}>
                {booking.cargoDescription}
              </Text>
            </View>
          )}
          {(booking.weightKg || booking.size) && (
            <View style={styles.detailRow}>
              {booking.weightKg && (
                <Text style={styles.detailText}>{booking.weightKg} kg</Text>
              )}
              {booking.weightKg && booking.size && (
                <Text style={styles.detailText}> • </Text>
              )}
              {booking.size && (
                <Text style={styles.detailText}>{booking.size}</Text>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.truckInfo}>
            <Ionicons
              name="bus-outline"
              size={16}
              color={BeeColors.gray[500]}
            />
            <Text style={styles.truckText}>{booking.truckType}</Text>
          </View>
          {/* Show GPS coordinates if available */}
          {booking.pickupLatitude && booking.pickupLongitude && (
            <View style={styles.gpsInfo}>
              <Ionicons
                name="location-outline"
                size={12}
                color={BeeColors.gray[400]}
              />
              <Text style={styles.gpsText}>
                {booking.pickupLatitude.toFixed(4)},{" "}
                {booking.pickupLongitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        {!isCancelled && (booking.status === "Confirmed" ||
          booking.status === "InProgress") && (
          <BeeButton
            title="Track"
            onPress={handleTrack}
            variant="secondary"
            style={styles.trackButton}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BeeColors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BeeColors.gray[200],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  bookingNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: BeeColors.gray[900],
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: BeeColors.gray[500],
  },
  time: {
    fontSize: 12,
    color: BeeColors.gray[400],
  },
  assignmentBadgeContainer: {
    marginTop: 4,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 4,
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
  divider: {
    height: 1,
    backgroundColor: BeeColors.gray[100],
    marginBottom: 12,
  },
  locations: {
    gap: 12,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  icon: {
    marginTop: 2,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    color: BeeColors.gray[500],
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  locationAddress: {
    fontSize: 14,
    color: BeeColors.gray[900],
  },
  detailsSection: {
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: BeeColors.gray[600],
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  truckInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: BeeColors.gray[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  truckText: {
    fontSize: 12,
    color: BeeColors.gray[600],
    fontWeight: "500",
  },
  gpsInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gpsText: {
    fontSize: 10,
    color: BeeColors.gray[400],
  },
  trackButton: {
    height: 32,
    paddingHorizontal: 16,
  },
});
