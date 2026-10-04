import type { LocationCoordinates } from '@/shared/types/booking';

/**
 * Snap a driver position onto the drawn route so the marker travels along the road.
 *
 * GPS fixes land wherever the device thinks it is — a few metres into a building, on the
 * wrong side of a divider, or drifting across a junction. Rendered raw, the marker slides
 * diagonally between them instead of following the street. The route polyline is already
 * fetched for the line on the map, so projecting onto it costs nothing extra and needs no
 * Roads API call.
 *
 * Only snaps when the fix is genuinely near the route. Past `maxDistanceMeters` the driver
 * has really left it — a detour, a wrong turn, the wrong road entirely — and pinning them to
 * a road they are not on would be a lie the customer can see out of the window.
 */

/** Metres per degree of latitude. Close enough for the sub-kilometre spans involved. */
const METERS_PER_DEGREE_LAT = 111_320;

interface Projected {
  point: LocationCoordinates;
  distanceMeters: number;
}

/**
 * Project a point onto a segment in a locally-flat plane.
 *
 * Longitude degrees shrink with latitude, so they are scaled by cos(lat) before the maths
 * and unscaled afterwards — without it the projection skews badly away from the equator.
 */
function projectOntoSegment(
  point: LocationCoordinates,
  start: LocationCoordinates,
  end: LocationCoordinates,
  lonScale: number
): Projected {
  const px = point.longitude * lonScale;
  const py = point.latitude;
  const ax = start.longitude * lonScale;
  const ay = start.latitude;
  const bx = end.longitude * lonScale;
  const by = end.latitude;

  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;

  // Degenerate segment (duplicate points): treat as the start point.
  let t = lengthSquared === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const snappedX = ax + abx * t;
  const snappedY = ay + aby * t;

  const dx = (px - snappedX) / lonScale;
  const dy = py - snappedY;
  const distanceMeters =
    Math.sqrt(dx * dx * lonScale * lonScale + dy * dy) * METERS_PER_DEGREE_LAT;

  return {
    point: { latitude: snappedY, longitude: snappedX / lonScale },
    distanceMeters,
  };
}

/**
 * @param point   Raw driver coordinate.
 * @param route   Route polyline, as returned for the map line.
 * @param maxDistanceMeters How far off-route before we stop snapping and show the truth.
 * @returns The snapped coordinate, or the original when there is no usable route or the
 *          driver is too far from it. Any `heading` on the input is preserved.
 */
export function snapToRoute<T extends LocationCoordinates & { heading?: number }>(
  point: T | null | undefined,
  route: LocationCoordinates[] | null | undefined,
  maxDistanceMeters = 40
): T | null | undefined {
  if (!point || !route || route.length < 2) {
    return point;
  }

  const lonScale = Math.cos((point.latitude * Math.PI) / 180) || 1;

  let best: Projected | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const candidate = projectOntoSegment(point, route[i], route[i + 1], lonScale);
    if (!best || candidate.distanceMeters < best.distanceMeters) {
      best = candidate;
    }
  }

  if (!best || best.distanceMeters > maxDistanceMeters) {
    return point;
  }

  return { ...point, latitude: best.point.latitude, longitude: best.point.longitude };
}
