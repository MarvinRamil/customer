import { BeeColors } from "@/constants/theme";
import type { AssignmentStatus } from "@/shared/types/booking";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * Props for AssignmentStatusBadge component
 */
interface AssignmentStatusBadgeProps {
  /** Assignment status to display */
  status: AssignmentStatus;
}

/**
 * Assignment status badge component that displays assignment status with color-coded styling
 * Shows whether a booking is Unassigned, Assigned, or Broadcasting
 * @param props - AssignmentStatusBadge component props
 */
export function AssignmentStatusBadge({ status }: AssignmentStatusBadgeProps) {
  /**
   * Get color styling based on assignment status
   * @returns Object containing background, text, and border colors
   */
  const getStyle = () => {
    switch (status) {
      case "Unassigned":
        return {
          bg: BeeColors.gray[100],
          text: BeeColors.gray[600],
          border: BeeColors.gray[200],
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
      default:
        return {
          bg: BeeColors.gray[100],
          text: BeeColors.gray[600],
          border: BeeColors.gray[200],
        };
    }
  };

  const colors = getStyle();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
