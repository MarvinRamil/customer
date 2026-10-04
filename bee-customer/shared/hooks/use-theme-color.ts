import { Colors } from '@/constants/theme';

/**
 * Hook to get theme colors
 * Always returns light mode colors - dark mode is disabled
 * @param props - Object with optional light color override (dark is ignored)
 * @param colorName - Name of the color from the theme
 * @returns The color value for light mode
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light
) {
  // Always use light mode
  const colorFromProps = props.light;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors.light[colorName];
  }
}

