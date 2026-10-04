import * as SecureStore from 'expo-secure-store';

const DRIVER_LOCATIONS_KEY = 'driver_locations';

/** Max age for stored entries: 48 hours (ms) */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** Max number of entries to keep; oldest are dropped */
const MAX_ENTRIES = 50;

/**
 * Stored driver location entry (per booking).
 * timestamp is ISO 8601 for purge by age.
 */
export interface StoredDriverLocationEntry {
  latitude: number;
  longitude: number;
  timestamp: string;
  driverId?: string;
}

/**
 * Map of bookingId -> last known driver location.
 * Single key in SecureStore holds this entire object.
 */
export type DriverLocationsMap = Record<string, StoredDriverLocationEntry>;

/**
 * Runs global purge: drop entries older than MAX_AGE_MS and/or keep only the most recent MAX_ENTRIES.
 * Returns a new map; does not mutate the input.
 */
function purgeMap(map: DriverLocationsMap): DriverLocationsMap {
  const now = Date.now();
  const cutoff = now - MAX_AGE_MS;

  let entries = Object.entries(map)
    .filter(([, entry]) => new Date(entry.timestamp).getTime() > cutoff)
    .sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(0, MAX_ENTRIES);
  }

  return Object.fromEntries(entries);
}

async function readMap(): Promise<DriverLocationsMap> {
  try {
    const raw = await SecureStore.getItemAsync(DRIVER_LOCATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DriverLocationsMap;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMap(map: DriverLocationsMap): Promise<void> {
  try {
    await SecureStore.setItemAsync(DRIVER_LOCATIONS_KEY, JSON.stringify(map));
  } catch (error) {
    throw new Error(
      `Failed to write driver locations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Driver location storage: last known driver location per booking.
 * Single key in SecureStore; value is a JSON map keyed by bookingId.
 * Global purge (by age 48h and size 50) runs on get, set, and via purgeDriverLocationsIfNeeded().
 */
class DriverLocationStorage {
  /**
   * Get last known driver location for a booking.
   * Runs global purge before returning; saves if map changed.
   */
  async getLastDriverLocation(
    bookingId: string
  ): Promise<{ latitude: number; longitude: number; timestamp?: string } | null> {
    let map = await readMap();
    const purged = purgeMap(map);
    if (Object.keys(purged).length !== Object.keys(map).length) {
      map = purged;
      await writeMap(map);
    }
    const entry = map[bookingId] ?? null;
    if (!entry) return null;
    return {
      latitude: entry.latitude,
      longitude: entry.longitude,
      timestamp: entry.timestamp,
    };
  }

  /**
   * Set last known driver location for a booking (e.g. on SignalR update).
   * Runs global purge before saving.
   */
  async setLastDriverLocation(
    bookingId: string,
    location: { latitude: number; longitude: number },
    driverId?: string
  ): Promise<void> {
    let map = await readMap();
    map[bookingId] = {
      ...location,
      timestamp: new Date().toISOString(),
      ...(driverId != null ? { driverId } : {}),
    };
    map = purgeMap(map);
    await writeMap(map);
  }

  /**
   * Remove driver location for a booking (per-booking purge when Completed/Cancelled).
   */
  async removeDriverLocation(bookingId: string): Promise<void> {
    const map = await readMap();
    if (!(bookingId in map)) return;
    const next = { ...map };
    delete next[bookingId];
    await writeMap(next);
  }

  /**
   * Run global purge only (read map, purge by age/size, save if changed).
   * Call from app root on launch/foreground so storage is cleaned even if user never opens tracking.
   */
  async purgeDriverLocationsIfNeeded(): Promise<void> {
    const map = await readMap();
    const purged = purgeMap(map);
    if (Object.keys(purged).length !== Object.keys(map).length) {
      await writeMap(purged);
    }
  }
}

export const driverLocationStorage = new DriverLocationStorage();
