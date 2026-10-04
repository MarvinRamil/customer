import { BeeColors, Colors } from '@/constants/theme';
import { useMemo } from 'react';

/**
 * Theme colors interface
 * Provides semantic color names for light and dark modes
 */
export interface ThemeColors {
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Background colors
  background: string;
  surface: string;
  card: string;
  
  // Border colors
  border: string;
  borderDark: string;
  
  // Primary colors
  primary: string;
  primaryDark: string;
  primaryText: string;
  
  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;
  
  // Input colors
  inputBackground: string;
  inputBorder: string;
  inputFocusBorder: string;
  placeholder: string;
  
  // Card accent colors
  cardAccent: string;
  cardShadow: string;
}

/**
 * Custom hook that provides theme colors
 * Always returns light mode colors - dark mode is disabled
 * @returns ThemeColors object with light mode colors
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const colors = useTheme();
 *   
 *   return (
 *     <View style={{ backgroundColor: colors.background }}>
 *       <Text style={{ color: colors.text }}>Hello</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeColors {
  return useMemo(() => {
    // Always return light mode colors
    return {
      // Text colors
      text: Colors.light.text,
      textSecondary: '#9c8c49',
      textMuted: BeeColors.gray[400],
      
      // Background colors
      background: Colors.light.background,
      surface: BeeColors.white,
      card: Colors.light.card,
      
      // Border colors
      border: '#e8e3ce',
      borderDark: BeeColors.gray[300],
      
      // Primary colors
      primary: Colors.light.primary,
      primaryDark: BeeColors.yellow[500],
      primaryText: Colors.light.primaryText,
      
      // Status colors
      success: BeeColors.green[600],
      error: BeeColors.red[600],
      warning: BeeColors.amber[500],
      info: BeeColors.blue[500],
      
      // Input colors
      inputBackground: BeeColors.gray[50],
      inputBorder: '#e8e3ce',
      inputFocusBorder: BeeColors.yellow[400], // Primary yellow for focus state
      placeholder: '#9c8c49',
      
      // Card accent colors
      cardAccent: '#e8e3ce', // Subtle accent border
      cardShadow: '#00000010', // Light shadow for depth
    };
  }, []);
}

