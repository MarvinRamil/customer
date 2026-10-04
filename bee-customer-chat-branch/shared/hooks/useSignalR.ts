import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getAuthToken } from '../services/authToken';

export interface LocationUpdate {
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

// Shared connection instance to prevent multiple connections
let sharedConnection: HubConnection | null = null;
let connectionSubscribers = 0;
const updateHandlers = new Set<(update: LocationUpdate) => void>();

/**
 * Driver groups this connection is supposed to belong to.
 *
 * SignalR group membership is per-connection: a reconnect issues a new connection id and
 * silently drops every group. Tracking them here is what lets `onreconnected` restore them.
 */
const joinedDriverGroups = new Set<string>();

/**
 * Create SignalR connection for location updates
 */
function createLocationConnection(): HubConnection | null {
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.mybeeapp.com';
  const hubUrl = `${API_URL}/hubs/location`;

  console.log('[SignalR] Creating connection to:', hubUrl);
  console.log('[SignalR] API_URL:', API_URL);

  return new HubConnectionBuilder()
    .withUrl(hubUrl, {
      // Called on every (re)connect, so it must fetch a fresh token rather than
      // close over one - Clerk refreshes expired session tokens inside getToken().
      accessTokenFactory: async () => {
        const token = await getAuthToken();
        if (!token) {
          // Throwing (rather than returning '') stops SignalR from opening a
          // guaranteed-401 connection and lets withAutomaticReconnect retry once
          // the session is available.
          console.error('[SignalR] No auth token available for location hub');
          throw new Error('No auth token available');
        }
        return token;
      },
    })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (retryContext) => {
        // Exponential backoff: 0s, 2s, 10s, 30s, then 30s
        if (retryContext.previousRetryCount === 0) return 0;
        if (retryContext.previousRetryCount === 1) return 2000;
        if (retryContext.previousRetryCount === 2) return 10000;
        return 30000;
      }
    })
    .configureLogging(LogLevel.Information)
    .build();
}

/**
 * Start shared SignalR connection
 */
async function startSharedConnection(): Promise<void> {
  if (sharedConnection?.state === HubConnectionState.Connected) {
    return;
  }

  if (sharedConnection?.state === HubConnectionState.Connecting) {
    // Wait for connection to complete
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000 * 60);

      const checkConnection = () => {
        if (sharedConnection?.state === HubConnectionState.Connected) {
          clearTimeout(timeout);
          resolve();
        } else if (sharedConnection?.state === HubConnectionState.Disconnected) {
          clearTimeout(timeout);
          startSharedConnection().then(resolve).catch(reject);
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  // Stop existing connection if in wrong state
  if (sharedConnection) {
    try {
      await sharedConnection.stop();
    } catch {
      // Ignore errors during cleanup
    }
    sharedConnection = null;
  }

  const newConnection = createLocationConnection();
  if (!newConnection) {
    console.warn('[SignalR] Cannot create connection: no token available');
    return;
  }

  sharedConnection = newConnection;
  console.log('[SignalR] Connecting to location hub...');

  // Set up event handler once
  newConnection.on('ReceiveLocationUpdate', (update: any) => {
    console.log('[SignalR] ✅ ReceiveLocationUpdate received', update?.driverId ?? update?.DriverId ?? 'no-id');

    // Normalize payload: backend may send camelCase or PascalCase (C# JSON)
    const raw = update || {};
    let driverIdValue = raw.driverId ?? raw.DriverId ?? raw.update?.driverId ?? raw.update?.DriverId ?? '';
    if (typeof driverIdValue === 'object' && driverIdValue !== null) {
      driverIdValue = (driverIdValue as any).value ?? (driverIdValue as any).toString?.() ?? '';
    }
    const driverIdStr = String(driverIdValue).trim().toLowerCase();

    const normalizedUpdate: LocationUpdate = {
      driverId: driverIdStr,
      latitude: Number(raw.latitude ?? raw.Latitude ?? raw.update?.latitude ?? raw.update?.Latitude ?? 0),
      longitude: Number(raw.longitude ?? raw.Longitude ?? raw.update?.longitude ?? raw.update?.Longitude ?? 0),
      speed: raw.speed !== undefined ? Number(raw.speed) : raw.Speed !== undefined ? Number(raw.Speed) : undefined,
      heading: raw.heading !== undefined ? Number(raw.heading) : raw.Heading !== undefined ? Number(raw.Heading) : undefined,
      timestamp: raw.timestamp ?? raw.Timestamp ?? raw.update?.timestamp ?? raw.update?.Timestamp ?? new Date().toISOString(),
    };

    if (normalizedUpdate.latitude === 0 && normalizedUpdate.longitude === 0) {
      console.warn('[SignalR] Ignoring update with zero coordinates for driver', driverIdStr);
      return;
    }

    console.log('[SignalR] Normalized update:', normalizedUpdate.driverId, normalizedUpdate.latitude, normalizedUpdate.longitude);

    updateHandlers.forEach((handler) => {
      try {
        handler(normalizedUpdate);
      } catch (error) {
        console.error('[SignalR] Handler error:', error);
      }
    });
  });

  // Handle connection events
  newConnection.onclose((error) => {
    console.warn('[SignalR] Connection closed', error);
    sharedConnection = null;
    // A closed connection holds no groups; the next setup re-joins from scratch.
    joinedDriverGroups.clear();
  });

  newConnection.onreconnecting((error) => {
    console.log('[SignalR] Reconnecting...', error);
  });

  newConnection.onreconnected(async (connectionId) => {
    console.log('[SignalR] Reconnected. Connection ID:', connectionId);
    // Group membership does not survive a reconnect — the server sees a brand new
    // connection. Without re-joining, location updates stop for good after the first
    // network blip and only resume if the tracking screen happens to remount.
    for (const groupDriverId of joinedDriverGroups) {
      try {
        await newConnection.invoke('JoinDriverGroup', groupDriverId);
        console.log('[SignalR] Re-joined driver group after reconnect:', groupDriverId);
      } catch (error) {
        console.error('[SignalR] Failed to re-join driver group after reconnect:', groupDriverId, error);
      }
    }
  });

  try {
    await newConnection.start();
    console.log('[SignalR] ✅ Connected to location hub. ConnectionId:', newConnection.connectionId);
  } catch (error) {
    console.error('[SignalR] Error starting connection:', error);
    sharedConnection = null;
    throw error;
  }
}

/**
 * Wait for the shared connection to actually reach Connected.
 *
 * `startSharedConnection()` can resolve while the socket is still negotiating — and it also
 * returns quietly when no auth token is available yet. Callers that invoked a hub method
 * behind a bare `state === Connected` check therefore skipped it silently and never retried,
 * which is why location only started flowing after the screen was remounted.
 */
async function waitForConnected(timeoutMs = 10000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (sharedConnection?.state === HubConnectionState.Connected) return true;
    if (!sharedConnection) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return sharedConnection?.state === HubConnectionState.Connected;
}

/** Join a driver's location group, waiting for the connection instead of skipping. */
async function joinDriverGroup(driverId: string): Promise<void> {
  const normalized = String(driverId).trim();
  if (!(await waitForConnected())) {
    throw new Error('Location hub is not connected.');
  }
  await sharedConnection!.invoke('JoinDriverGroup', normalized);
  joinedDriverGroups.add(normalized);
}

/**
 * Stop shared SignalR connection
 */
async function stopSharedConnection(): Promise<void> {
  if (sharedConnection) {
    try {
      await sharedConnection.stop();
    } catch {
      // Ignore errors
    }
    sharedConnection = null;
  }
}

/**
 * Hook for receiving real-time driver location updates via SignalR
 * @param driverId - Optional driver ID to filter updates for a specific driver
 * @param retryKey - Change this to re-attempt the subscription without changing driverId
 *                   (e.g. pass the booking status, so tracking self-heals once the booking
 *                   becomes trackable server-side).
 * @returns Location updates, connection status, and any subscription error
 */
export function useSignalRLocationUpdates(driverId?: string, retryKey?: string | number) {
  const [updates, setUpdates] = useState<LocationUpdate[]>([]);
  // Set when the hub refuses the subscription. The hub throws a HubException for every
  // rejection, so a silent "joined" is no longer possible.
  const [joinError, setJoinError] = useState<string | null>(null);
  const handlerRef = useRef<((update: LocationUpdate) => void) | undefined>(undefined);
  const mountedRef = useRef(true);
  const updateCountRef = useRef(0);
  const previousDriverIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;

    // Create handler for this component instance
    handlerRef.current = (update: LocationUpdate) => {
      updateCountRef.current++;
      console.log(`[useSignalR] 🎯 Handler called #${updateCountRef.current} with update:`, update);

      // Only update if component is still mounted
      if (!mountedRef.current) {
        console.log('[useSignalR] Component unmounted, ignoring update');
        return;
      }

      const updateDriverId = String(update.driverId).trim().toLowerCase();
      const filterDriverId = driverId ? String(driverId).trim().toLowerCase() : '';
      if (filterDriverId && updateDriverId !== filterDriverId) {
        return;
      }

      setUpdates((prev) => {
        const existing = prev.find((u) => u.driverId === update.driverId);
        // Drop out-of-order fixes. The driver app buffers to disk whenever a publish fails
        // and replays the backlog on its retry timer, so an older position can legitimately
        // arrive after a newer one — and last-write-wins made the marker teleport back to
        // where the driver used to be, then jump forward again on the next live fix.
        if (existing) {
          const incomingAt = Date.parse(update.timestamp);
          const currentAt = Date.parse(existing.timestamp);
          if (Number.isFinite(incomingAt) && Number.isFinite(currentAt) && incomingAt < currentAt) {
            console.log('[SignalR] Ignoring stale location fix for', update.driverId, update.timestamp);
            return prev;
          }
        }
        const filtered = prev.filter((u) => u.driverId !== update.driverId);
        return [...filtered, update];
      });
    };

    // Add handler to set
    updateHandlers.add(handlerRef.current);
    connectionSubscribers++;

    // Start connection and join driver group ONLY if driverId is provided
    const setupConnection = async () => {
      // Don't connect if no driverId is provided
      if (!driverId) {
        console.log('[useSignalR] No driverId provided, skipping SignalR connection');
        previousDriverIdRef.current = undefined;
        setJoinError(null);
        return;
      }

      try {
        await startSharedConnection();

        // Leave previous driver group if driverId changed
        if (previousDriverIdRef.current && previousDriverIdRef.current !== driverId && sharedConnection?.state === HubConnectionState.Connected) {
          try {
            await sharedConnection.invoke('LeaveDriverGroup', previousDriverIdRef.current);
            joinedDriverGroups.delete(previousDriverIdRef.current);
            console.log(`[useSignalR] Left previous driver group: ${previousDriverIdRef.current}`);
          } catch (error) {
            // Ignore errors if connection is closed/closing (expected during cleanup)
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('connection being closed') || errorMessage.includes('Invocation canceled')) {
              console.log('[useSignalR] Connection closed, skipping leave driver group (expected)');
            } else {
              console.error('[useSignalR] Failed to leave previous driver group:', error);
            }
          }
        }

        // Join driver-specific group (driverId is guaranteed to exist here).
        // joinDriverGroup waits for the connection rather than skipping when it is still
        // negotiating — the previous `if (state === Connected)` had no else branch, so a
        // slow handshake meant the group was never joined and nothing ever retried.
        try {
          const normalizedDriverId = String(driverId).trim();
          await joinDriverGroup(normalizedDriverId);
          console.log(`[useSignalR] ✅ Joined driver group for driver: ${normalizedDriverId} (original: ${driverId})`);
          previousDriverIdRef.current = normalizedDriverId;
          if (mountedRef.current) setJoinError(null);
        } catch (error) {
          // The hub's HubException message arrives intact in error.message. It is
          // deliberately generic ("Not authorized to track this driver.") — don't show it raw.
          const message = error instanceof Error ? error.message : String(error);
          console.error('[useSignalR] Failed to join driver group:', message);
          if (mountedRef.current) setJoinError(message);
        }
      } catch (error) {
        console.error('[useSignalR] Failed to start connection:', error);
      }
    };

    setupConnection();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;

      // Leave driver group if joined
      if (driverId && sharedConnection?.state === HubConnectionState.Connected) {
        joinedDriverGroups.delete(String(driverId).trim());
        sharedConnection.invoke('LeaveDriverGroup', driverId).catch((error) => {
          // Ignore errors if connection is closed/closing (expected during cleanup)
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('connection being closed') || errorMessage.includes('Invocation canceled')) {
            console.log('[useSignalR] Connection closed, skipping leave driver group (expected)');
          } else {
            console.error('[useSignalR] Error leaving driver group:', error);
          }
        });
      }

      // Remove handler
      if (handlerRef.current) {
        updateHandlers.delete(handlerRef.current);
      }

      connectionSubscribers--;

      // Stop connection if no more subscribers
      if (connectionSubscribers <= 0) {
        stopSharedConnection().catch((error) => {
          console.error('[useSignalR] Error stopping connection:', error);
        });
      }
    };
  }, [driverId, retryKey]);

  const driverIdLower = driverId ? String(driverId).trim().toLowerCase() : '';
  const latestUpdate = driverIdLower
    ? updates.find((u) => u.driverId === driverIdLower) ?? null
    : null;

  return {
    updates,
    latestUpdate,
    isConnected: sharedConnection?.state === HubConnectionState.Connected,
    joinError,
  };
}

