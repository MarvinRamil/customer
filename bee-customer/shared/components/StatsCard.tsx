import { BeeColors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

/**
 * Props for the StatsCard component
 */
interface StatsCardProps {
  /** Card title text */
  title: string;
  /** Numeric value to display */
  value: number;
  /** Card type that determines styling */
  type: "total" | "pending" | "in-transit" | "completed";
}

/**
 * Reusable statistics card component
 * Displays a value with an icon and title, styled based on type
 * Automatically calculates width for 2-column grid layout
 * @param props - StatsCard component props
 */
export function StatsCard({ title, value, type }: StatsCardProps) {
  /**
   * Get styling configuration based on card type
   * @returns Object containing icon background, icon color, value color, and icon name
   */
  const getStyle = () => {
    switch (type) {
      case "total":
        return {
          iconBg: BeeColors.gray[100],
          iconColor: BeeColors.gray[600],
          valueColor: BeeColors.gray[900],
          iconName: "cube-outline" as const,
        };
      case "pending":
        return {
          iconBg: BeeColors.amber[100],
          iconColor: BeeColors.amber[600],
          valueColor: BeeColors.amber[600],
          iconName: "time-outline" as const,
        };
      case "in-transit":
        return {
          iconBg: BeeColors.blue[100],
          iconColor: BeeColors.blue[600],
          valueColor: BeeColors.blue[600],
          iconName: "bus-outline" as const,
        };
      case "completed":
        return {
          iconBg: BeeColors.green[100],
          iconColor: BeeColors.green[600],
          valueColor: BeeColors.green[600],
          iconName: "checkmark-circle-outline" as const,
        };
    }
  };

  const style = getStyle();
  // Calculate width for 2-column grid with some margin
  const screenWidth = Dimensions.get("window").width;
  const cardWidth = (screenWidth - 48) / 2; // 16 padding left, 16 padding right, 16 gap

  return (
    <View style={[styles.container, { width: cardWidth }]}>
      <View style={[styles.iconContainer, { backgroundColor: style.iconBg }]}>
        <Ionicons name={style.iconName} size={24} color={style.iconColor} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.value, { color: style.valueColor }]}>{value}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BeeColors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
  },
  title: {
    fontSize: 12,
    color: BeeColors.gray[500],
    fontWeight: "500",
  },
});
