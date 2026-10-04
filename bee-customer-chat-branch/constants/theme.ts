/**
 * Bee Logistics Color Palette
 */

import { Platform } from 'react-native';

export const BeeColors = {
  yellow: {
    50: '#fefce8',
    100: '#fef9c3',
    400: '#FFCD36', // Primary yellow from design
    500: '#eab308',
    600: '#ca8a04',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    800: '#92400e',
  },
  blue: {
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  white: '#ffffff',
  black: '#111827',
};

const tintColor = BeeColors.yellow[500];

// Brand yellow color for splash screen and branding
export const BRAND_YELLOW = '#ffcd36';

export const Colors = {
  light: {
    text: '#1c190d',
    background: '#f8f8f5', // background-light from design
    tint: tintColor,
    icon: BeeColors.gray[500],
    tabIconDefault: BeeColors.gray[400],
    tabIconSelected: BeeColors.yellow[400],
    
    // Semantic
    primary: BeeColors.yellow[400],
    primaryText: '#1c190d',
    border: '#e8e3ce',
    card: BeeColors.white,
    surface: BeeColors.white,
    textSecondary: '#9c8c49',
    textMuted: BeeColors.gray[400],
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
