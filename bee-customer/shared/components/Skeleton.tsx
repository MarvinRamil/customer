import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, StyleSheet, ViewStyle } from "react-native";

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Pulsing placeholder block used to build skeleton-loading layouts.
 * Animates opacity in a loop; unmounts cleanly (stops the loop) so it never
 * leaks an animation once the real content replaces it.
 */
export function SkeletonBlock({ width = "100%", height = 16, borderRadius = 6, style }: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { width, height, borderRadius, opacity }, style]} />;
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: "#e2e8f0",
  },
});
