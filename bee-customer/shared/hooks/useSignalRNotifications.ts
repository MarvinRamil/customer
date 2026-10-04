import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '../services/authToken';

// Shared connection instance to prevent multiple connections
let sharedNotificationConnection: HubConnection | null = null;
let notificationSubscribers = 0;
const notificationHandlers = new Set<(eventName: string, payload: any) => void>();

// Create SignalR connection for notifications
const createNotificationConnection = () => {
    const url = `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000'}/hubs/notifications`;

    return new HubConnectionBuilder()
        .withUrl(url, {
            // Called on every (re)connect, so it must fetch a fresh token rather than
            // close over one - Clerk refreshes expired session tokens inside getToken().
            accessTokenFactory: async () => {
                const token = await getAuthToken();
                if (!token) {
                    // Throwing (rather than returning '') stops SignalR from opening a
                    // guaranteed-401 connection and lets withAutomaticReconnect retry
                    // once the session is available.
                    console.error('[SignalR] No auth token available for notifications hub');
                    throw new Error('No auth token available');
                }
                return token;
            }
        })
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: retryContext => {
                if (retryContext.previousRetryCount === 0) return 3000;
                if (retryContext.previousRetryCount === 1) return 5000;
                if (retryContext.previousRetryCount === 2) return 10000;
                return 20000; // max 20 seconds
            }
        })
        .configureLogging(LogLevel.Warning)
        .build();
};

export const useSignalRNotifications = () => {
    const [isConnected, setIsConnected] = useState(false);

    // Use a ref to store the latest handler to avoid stale closures
    const handlerRef = useRef<((eventName: string, payload: any) => void) | null>(null);

    useEffect(() => {
        // Determine if we need to start a new connection
        let isSubscribed = true;

        const setupConnection = async () => {
            try {
                if (!sharedNotificationConnection) {
                    sharedNotificationConnection = createNotificationConnection();

                    sharedNotificationConnection.on('ReceiveNotification', (message: string, payloadStr: string) => {
                        console.log(`[SignalR Notifications] Received ${message}:`, payloadStr);
                        try {
                            const payload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;

                            // Notify all subscribers
                            notificationHandlers.forEach(handler => {
                                handler(message, payload);
                            });
                        } catch (err) {
                            console.error('[SignalR Notifications] Failed to parse payload:', err);
                        }
                    });

                    // Backend sends status updates with these method names (not ReceiveNotification)
                    const forwardPayload = (eventName: string, data: unknown) => {
                        const payload = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return data; } })() : data;
                        notificationHandlers.forEach(handler => handler(eventName, payload));
                    };
                    sharedNotificationConnection.on('BookingStatusChanged', (data: unknown) => {
                        console.log('[SignalR Notifications] BookingStatusChanged:', data);
                        forwardPayload('BookingStatusChanged', data);
                    });
                    sharedNotificationConnection.on('BookingStopStatusChanged', (data: unknown) => {
                        console.log('[SignalR Notifications] BookingStopStatusChanged:', data);
                        forwardPayload('BookingStopStatusChanged', data);
                    });

                    sharedNotificationConnection.onreconnecting(() => {
                        console.log('[SignalR Notifications] Reconnecting...');
                        setIsConnected(false);
                    });

                    sharedNotificationConnection.onreconnected(() => {
                        console.log('[SignalR Notifications] Reconnected');
                        setIsConnected(true);
                    });

                    sharedNotificationConnection.onclose(() => {
                        console.log('[SignalR Notifications] Connection closed');
                        setIsConnected(false);
                    });
                }

                notificationSubscribers++;

                if (sharedNotificationConnection.state === HubConnectionState.Disconnected) {
                    console.log('[SignalR Notifications] Starting connection...');
                    await sharedNotificationConnection.start();
                    console.log('[SignalR Notifications] Connected successfully');
                }

                if (isSubscribed) {
                    setIsConnected(sharedNotificationConnection.state === HubConnectionState.Connected);
                }
            } catch (err) {
                console.error('[SignalR Notifications] Connection error:', err);
                if (isSubscribed) setIsConnected(false);
            }
        };

        setupConnection();

        return () => {
            isSubscribed = false;
            notificationSubscribers--;

            // Clean up connection if no more subscribers
            if (notificationSubscribers <= 0 && sharedNotificationConnection) {
                console.log('[SignalR Notifications] Stopping connection...');
                sharedNotificationConnection.stop().catch(err =>
                    console.error('[SignalR Notifications] Error stopping:', err)
                );
                sharedNotificationConnection = null;
                notificationSubscribers = 0;
            }
        };
    }, []);

    // Return a function to register an event handler
    return {
        isConnected,
        onNotification: (handler: (eventName: string, payload: any) => void) => {
            handlerRef.current = handler;

            const wrappedHandler = (eventName: string, payload: any) => {
                if (handlerRef.current) {
                    handlerRef.current(eventName, payload);
                }
            };

            notificationHandlers.add(wrappedHandler);

            return () => {
                notificationHandlers.delete(wrappedHandler);
            };
        }
    };
};
