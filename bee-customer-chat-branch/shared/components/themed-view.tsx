import { View, type ViewProps } from "react-native";

import { useThemeColor } from "@/shared/hooks/use-theme-color";

/**
 * Props for ThemedView component
 * Extends ViewProps with theme color overrides
 */
export type ThemedViewProps = ViewProps & {
  /** Background color override (light mode only - dark mode disabled) */
  lightColor?: string;
  /** @deprecated Dark mode is disabled - use lightColor instead */
  darkColor?: string;
};

/**
 * Themed view component with light mode background color
 * Dark mode is disabled - always uses light mode
 * @param props - ThemedView component props
 */
export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor },
    "background"
  );

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
