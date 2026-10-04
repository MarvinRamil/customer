import { useEffect, useRef, useState } from 'react';

/**
 * Hook for gliding a map marker between location updates.
 *
 * Driver positions arrive every few seconds. Rendered directly, each one teleports the
 * marker. This interpolates between the previous and incoming position over the expected
 * gap so the movement reads as motion.
 *
 * Keep this inside a small component that renders only the marker — it updates state on a
 * timer, and anything re-rendered alongside it pays that cost repeatedly.
 *
 * @example
 * const animated = useInterpolatedCoordinate(driverLocation, 4000);
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
  /** Bearing in degrees, 0-360. Interpolated along the shortest arc. */
  heading?: number;
}

/** Beyond this, glide would look wrong — snap instead. Covers first fix and real teleports. */
const SNAP_DISTANCE_METERS = 500;

/** Marker motion reads as smooth well below display refresh rate; more just costs renders. */
const DEFAULT_FPS = 12;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Equirectangular approximation — accurate enough over the distances between two fixes. */
function distanceMeters(a: Coordinate, b: Coordinate): number {
  const earthRadius = 6371000;
  const x = toRadians(b.longitude - a.longitude) * Math.cos(toRadians((a.latitude + b.latitude) / 2));
  const y = toRadians(b.latitude - a.latitude);
  return Math.sqrt(x * x + y * y) * earthRadius;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Interpolate a bearing the short way round, so 350° → 10° turns 20° rather than 340°. */
function lerpHeading(from: number, to: number, t: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/**
 * Hook for consumers that should react to *meaningful* movement rather than every fix.
 *
 * Returns a coordinate that only changes once the target has moved beyond `minDistanceMeters`
 * or `minIntervalMs` has passed. Use it for expensive work — route/Directions requests —
 * which would otherwise fire on every location update.
 *
 * @example
 * const routeAnchor = useThrottledCoordinate(driverLocation, 100, 30000);
 */
export function useThrottledCoordinate(
  target: Coordinate | null | undefined,
  minDistanceMeters: number,
  minIntervalMs: number
): Coordinate | null {
  const [anchor, setAnchor] = useState<Coordinate | null>(target ?? null);
  const anchorRef = useRef<Coordinate | null>(target ?? null);
  const updatedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!target) {
      if (anchorRef.current !== null) {
        anchorRef.current = null;
        setAnchor(null);
      }
      return;
    }

    const previous = anchorRef.current;
    const movedFarEnough = !previous || distanceMeters(previous, target) >= minDistanceMeters;
    const waitedLongEnough = Date.now() - updatedAtRef.current >= minIntervalMs;

    if (movedFarEnough || waitedLongEnough) {
      anchorRef.current = target;
      updatedAtRef.current = Date.now();
      setAnchor(target);
    }
  }, [target?.latitude, target?.longitude, minDistanceMeters, minIntervalMs]);

  return anchor;
}

export function useInterpolatedCoordinate(
  target: Coordinate | null | undefined,
  durationMs: number = 4000,
  fps: number = DEFAULT_FPS
): Coordinate | null {
  const [current, setCurrent] = useState<Coordinate | null>(target ?? null);

  // Held in refs so the animation loop reads live values without re-subscribing.
  const fromRef = useRef<Coordinate | null>(target ?? null);
  const currentRef = useRef<Coordinate | null>(target ?? null);
  const startedAtRef = useRef<number>(0);
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!target) {
      return;
    }

    const previous = currentRef.current;

    // First fix, or a jump too large to be real movement — place it directly.
    if (!previous || distanceMeters(previous, target) > SNAP_DISTANCE_METERS) {
      fromRef.current = target;
      currentRef.current = target;
      setCurrent(target);
      return;
    }

    fromRef.current = previous;
    startedAtRef.current = Date.now();

    const frameInterval = Math.max(1000 / fps, 16);

    const step = () => {
      const from = fromRef.current;
      if (!from) return;

      const elapsed = Date.now() - startedAtRef.current;
      const t = durationMs <= 0 ? 1 : Math.min(elapsed / durationMs, 1);

      const next: Coordinate = {
        latitude: lerp(from.latitude, target.latitude, t),
        longitude: lerp(from.longitude, target.longitude, t),
        heading:
          from.heading != null && target.heading != null
            ? lerpHeading(from.heading, target.heading, t)
            : (target.heading ?? from.heading),
      };

      currentRef.current = next;
      setCurrent(next);

      if (t < 1) {
        frameRef.current = setTimeout(step, frameInterval);
      }
    };

    frameRef.current = setTimeout(step, frameInterval);

    return () => {
      if (frameRef.current) {
        clearTimeout(frameRef.current);
        frameRef.current = null;
      }
    };
    // Compare by value: the caller usually hands us a fresh object each update.
  }, [target?.latitude, target?.longitude, target?.heading, durationMs, fps]);

  return current;
}
