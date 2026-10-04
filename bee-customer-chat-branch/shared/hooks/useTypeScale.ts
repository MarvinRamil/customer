import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Screen-responsive type scale.
 *
 * Fixed font sizes tuned on a 6.1" phone overflow on small devices — a long driver name
 * either clipped or wrapped where the design expected one line. This scales the whole
 * scale to the device width so text keeps its intended proportion of the screen.
 *
 * Uses useWindowDimensions rather than a one-shot Dimensions.get() so the sizes stay
 * correct after rotation or a window resize.
 *
 * @example
 * const type = useTypeScale();
 * <Text style={{ fontSize: type.lg }}>Driver name</Text>
 */

/** iPhone 11/12/13/14 logical width — the width the current designs were drawn against. */
const BASE_WIDTH = 375;

/**
 * Damping factor. At 1 the text scales linearly with the screen, which makes small
 * phones cramped and tablets cartoonish; 0.5 moves it half as fast as the viewport.
 */
const DAMPING = 0.5;

/** Keep the result sane on very small phones and on tablets. */
const MIN_FACTOR = 0.85;
const MAX_FACTOR = 1.15;

/** Modular scale — matches the sizes already used across the app. */
const BASE_SCALE = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export type TypeScale = { [K in keyof typeof BASE_SCALE]: number } & {
  /** Scale an arbitrary size with the same curve, for one-off values. */
  scale: (size: number) => number;
  /** The raw multiplier, for spacing or icon sizes that should track the text. */
  factor: number;
};

export function useTypeScale(): TypeScale {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const raw = 1 + (width / BASE_WIDTH - 1) * DAMPING;
    const factor = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, raw));
    const scale = (size: number) => Math.round(size * factor);

    return {
      xs: scale(BASE_SCALE.xs),
      sm: scale(BASE_SCALE.sm),
      base: scale(BASE_SCALE.base),
      md: scale(BASE_SCALE.md),
      lg: scale(BASE_SCALE.lg),
      xl: scale(BASE_SCALE.xl),
      xxl: scale(BASE_SCALE.xxl),
      scale,
      factor,
    };
  }, [width]);
}
