import { BeeColors } from "@/constants/theme";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

/**
 * Props for the BeeButton component
 */
interface BeeButtonProps {
  /** Button text label */
  title: string;
  /** Callback function called when button is pressed */
  onPress: () => void;
  /** Button style variant */
  variant?: "primary" | "secondary" | "danger" | "outline";
  /** Whether button is in loading state */
  loading?: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Additional style overrides */
  style?: ViewStyle;
}

/**
 * Reusable button component with multiple variants and states
 * Supports primary, secondary, danger, and outline styles
 * @param props - BeeButton component props
 */
export function BeeButton({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}: BeeButtonProps) {
  /**
   * Get background color based on variant and disabled state
   * @returns Background color string
   */
  const getBackgroundColor = () => {
    if (disabled) return BeeColors.gray[300];
    switch (variant) {
      case "primary":
        return BeeColors.yellow[400];
      case "secondary":
        return BeeColors.blue[500];
      case "danger":
        return BeeColors.red[600];
      case "outline":
        return "transparent";
      default:
        return BeeColors.yellow[400];
    }
  };

  /**
   * Get text color based on variant and disabled state
   * @returns Text color string
   */
  const getTextColor = () => {
    if (disabled) return BeeColors.gray[500];
    switch (variant) {
      case "primary":
        return BeeColors.gray[900];
      case "secondary":
        return "#fff";
      case "danger":
        return "#fff";
      case "outline":
        return BeeColors.gray[900];
      default:
        return BeeColors.gray[900];
    }
  };

  /**
   * Get border styles for outline variant
   * @returns Border style object
   */
  const getBorder = () => {
    if (variant === "outline") {
      return {
        borderWidth: 1,
        borderColor: disabled ? BeeColors.gray[300] : BeeColors.gray[900],
      };
    }
    return {};
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor() },
        getBorder(),
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
