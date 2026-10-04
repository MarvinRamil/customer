import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/shared/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  /** Background color override (light mode only - dark mode disabled) */
  lightColor?: string;
  /** @deprecated Dark mode is disabled - use lightColor instead */
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
