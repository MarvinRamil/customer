import { BeeColors } from "@/constants/theme";
import type { BookingStatus } from "@/shared/types/booking";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * User-friendly display label for each booking status
 * Used in StatusBadge and anywhere status is shown (e.g. tracking screen)
 */
export function getStatusDisplayLabel(status: BookingStatus): string {
  const labels: Record<BookingStatus, string> = {
    Pending: "Pending",
    Assigned: "Assigned",
    Broadcasting: "Broadcasting",
    Confirmed: "Confirmed",
    DriverAssigned: "Picking up",
    Dispatched: "Dispatched",
    PickedUp: "In Transit",
    InProgress: "In Transit",
    Completed: "Completed",
    Cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

/**
 * Props for StatusBadge component
 */
interface StatusBadgeProps {
  /** Booking status to display */
  status: BookingStatus;
}

/**
 * Status badge component that displays booking status with color-coded styling
 * Used within BookingCard to show the current status of a booking
 * @param props - StatusBadge component props
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  /**
   * Get color styling based on booking status
   * Supports all booking statuses from the API
   * @returns Object containing background, text, and border colors
   */
  const getStyle = () => {
    switch (status) {
      case "Pending":
        return {
          bg: BeeColors.amber[100],
          text: BeeColors.amber[800],
          border: BeeColors.amber[100],
        };
      case "Assigned":
        return {
          bg: BeeColors.blue[100],
          text: BeeColors.blue[800],
          border: BeeColors.blue[100],
        };
      case "Broadcasting":
        return {
          bg: BeeColors.yellow[100],
          text: BeeColors.yellow[600],
          border: BeeColors.yellow[100],
        };
      case "Confirmed":
        return {
          bg: BeeColors.green[100],
          text: BeeColors.green[800],
          border: BeeColors.green[100],
        };
      case "DriverAssigned":
        return {
          bg: BeeColors.blue[100],
          text: BeeColors.blue[800],
          border: BeeColors.blue[100],
        };
      case "Dispatched":
        return {
          bg: BeeColors.gray[100],
          text: BeeColors.gray[800],
          border: BeeColors.gray[200],
        };
      case "PickedUp":
        return {
          bg: BeeColors.green[100],
          text: BeeColors.green[800],
          border: BeeColors.green[100],
        };
      case "InProgress":
        return {
          bg: BeeColors.amber[100],
          text: BeeColors.amber[800],
          border: BeeColors.amber[100],
        };
      case "Completed":
        return {
          bg: BeeColors.green[100],
          text: BeeColors.green[800],
          border: BeeColors.green[100],
        };
      case "Cancelled":
        return {
          bg: BeeColors.red[100],
          text: BeeColors.red[800],
          border: BeeColors.red[100],
        };
      default:
        return {
          bg: BeeColors.gray[100],
          text: BeeColors.gray[800],
          border: BeeColors.gray[200],
        };
    }
  };

  const colors = getStyle();
  const displayLabel = getStatusDisplayLabel(status);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
