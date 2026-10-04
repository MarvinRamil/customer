import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

/**
 * Notification service for handling push notifications via Firebase Cloud Messaging (FCM)
 * Uses native FCM tokens for Android and APNs tokens for iOS
 * Backend should send notifications via Firebase Admin SDK
 */

// Configure notification behavior
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (error) {
  console.error('Error setting notification handler:', error);
}

export type PushTokenType = 'fcm' | 'apns' | 'expo';

export interface RegisterDeviceTokenRequest {
  deviceToken: string;
  platform: 'ios' | 'android';
  appType: 'customer';
  /** Token type the backend uses to route delivery (fcm/apns -> Firebase, expo -> Expo). */
  tokenType?: PushTokenType;
}

export interface RegisterDeviceTokenResponse {
  success: boolean;
  message?: string;
  /** The token type the backend currently expects for this platform (vendor-sync hint). */
  expectedTokenType?: PushTokenType;
}

/** GET /api/notifications/push-config response. */
export interface PushConfigResponse {
  provider: string;
  expected: { ios: PushTokenType; android: PushTokenType };
}

class NotificationService {
  private deviceToken: string | null = null;
  /** Token type resolved for the most recently acquired token. */
  private resolvedTokenType: PushTokenType | null = null;
  /** Guards against re-sync recursion when the backend reports a mismatch. */
  private resyncing = false;
  /**
   * In-flight registrations keyed by token. Coalesces concurrent identical
   * register calls (e.g. the login callback and the user-effect firing together,
   * or rapid repeat logins) into a single POST so we never double-write the same
   * device row. A later login with a new token/session still registers normally.
   */
  private inFlight: Map<string, Promise<boolean>> = new Map();
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Ask the backend which token type it currently expects for this platform, so the
   * client stays in sync if the backend changes push vendor. Falls back to the native
   * default (FCM/APNs) when the config call fails.
   */
  async getExpectedTokenType(): Promise<PushTokenType> {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    try {
      const response = await apiClient.get<PushConfigResponse>(
        '/api/notifications/push-config',
        { requiresAuth: true }
      );
      const expected = response?.data?.expected?.[platform];
      if (expected === 'fcm' || expected === 'apns' || expected === 'expo') {
        return expected;
      }
    } catch (error) {
      console.warn('Could not fetch push-config; using default token type.', error);
    }
    return platform === 'ios' ? 'apns' : 'fcm';
  }

  /**
   * Request notification permissions
   * @returns true if permissions granted, false otherwise
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push notification permissions');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Acquire the push token matching the type the backend currently expects.
   * - 'fcm' / 'apns' -> native token via getDevicePushTokenAsync (Firebase Admin SDK delivery)
   * - 'expo'         -> Expo push token via getExpoPushTokenAsync
   * Sets resolvedTokenType so registerDeviceToken sends the correct flag.
   * @returns push token or null if unavailable
   */
  async getDeviceToken(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        // Emulators/simulators cannot mint a native FCM/APNs token — this returns
        // null silently otherwise, which looks like "registration never happens".
        console.warn('[push] getDeviceToken: SKIP — not a physical device (emulator/simulator). Test push on a real device or dev build.');
        return null;
      }

      const expected = await this.getExpectedTokenType();
      console.log('[push] getDeviceToken: expected token type =', expected);

      if (expected === 'expo') {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
        });
        this.resolvedTokenType = 'expo';
        console.log('[push] getDeviceToken: acquired expo token', tokenData.data?.slice(0, 16), '…');
        return tokenData.data;
      }

      const tokenData = await this.getDevicePushTokenWithRetry();
      this.resolvedTokenType = Platform.OS === 'ios' ? 'apns' : 'fcm';
      console.log('[push] getDeviceToken: acquired native token (type', this.resolvedTokenType, ')', String(tokenData.data).slice(0, 16), '…');
      return tokenData.data;
    } catch (error) {
      // Handle Firebase not initialized error gracefully (Android)
      // FCM credentials must be uploaded to EAS and app built via EAS Build
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('FirebaseApp') || errorMessage.includes('Firebase')) {
        // Native Firebase failed to initialize — almost always means google-services.json
        // wasn't embedded in THIS build (build predates the googleServicesFile config),
        // or its package_name doesn't match. Rebuild the dev client after adding it.
        console.warn('[push] getDeviceToken: Firebase NOT initialized. google-services.json missing from this build or package mismatch. Rebuild the dev client. Raw error:', errorMessage);
      } else {
        console.error('[push] getDeviceToken: error getting device push token:', errorMessage);
      }
      this.resolvedTokenType = null;
      return null;
    }
  }

  /**
   * Fetch the native FCM/APNs token, retrying transient failures with exponential
   * backoff. FCM registration commonly returns SERVICE_NOT_AVAILABLE right after a
   * fresh install or on a flaky/proxied network — it's not a config error, and a
   * short retry usually succeeds. Non-transient errors are rethrown immediately.
   */
  private async getDevicePushTokenWithRetry(
    maxAttempts = 4
  ): Promise<Notifications.DevicePushToken> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await Notifications.getDevicePushTokenAsync();
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        const transient =
          msg.includes('SERVICE_NOT_AVAILABLE') || msg.includes('TIMEOUT');
        if (!transient || attempt === maxAttempts) throw error;
        const delayMs = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
        console.warn(
          `[push] getDeviceToken: transient FCM failure (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms… (${msg})`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  /**
   * Register the device token ONLY if notification permission is already granted.
   * Does NOT prompt the user. Intended to be called on login so an already-enabled
   * device re-registers its token immediately instead of waiting for the next app start.
   * @returns true if a token was registered, false if not permitted / unavailable.
   */
  async registerIfPermitted(): Promise<boolean> {
    try {
      console.log('[push] registerIfPermitted: called');
      if (!Device.isDevice) {
        console.log('[push] registerIfPermitted: SKIP — not a physical device');
        return false;
      }
      const { status } = await Notifications.getPermissionsAsync();
      console.log('[push] registerIfPermitted: permission status =', status);
      if (status !== 'granted') {
        // Notifications not enabled — nothing to register (no prompt here by design).
        console.log('[push] registerIfPermitted: SKIP — permission not granted');
        return false;
      }
      const token = await this.getDeviceToken();
      console.log('[push] registerIfPermitted: token =', token ? `${token.slice(0, 12)}… (type ${this.resolvedTokenType})` : 'null');
      if (!token) {
        console.log('[push] registerIfPermitted: SKIP — no device token (FCM creds / dev build?)');
        return false;
      }
      const ok = await this.registerDeviceToken(token);
      console.log('[push] registerIfPermitted: registerDeviceToken result =', ok);
      return ok;
    } catch (error) {
      console.warn('[push] registerIfPermitted failed:', error);
      return false;
    }
  }

  /**
   * Register device token with backend
   * @param token - Device push token
   * @returns true if registration successful
   */
  async registerDeviceToken(token: string): Promise<boolean> {
    // Coalesce concurrent identical registrations so multiple triggers (or repeat
    // logins) collapse to one POST. Backend upsert is keyed by token, so a distinct
    // later login re-registers idempotently (and rebinds the row to the new user).
    const existing = this.inFlight.get(token);
    if (existing) return existing;

    const pending = this._registerDeviceToken(token).finally(() => {
      this.inFlight.delete(token);
    });
    this.inFlight.set(token, pending);
    return pending;
  }

  private async _registerDeviceToken(token: string): Promise<boolean> {
    try {
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        console.error('Invalid device token provided');
        return false;
      }

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const tokenType: PushTokenType =
        this.resolvedTokenType ?? (Platform.OS === 'ios' ? 'apns' : 'fcm');

      console.log('[push] register: POST /api/notifications/register-device', { platform, appType: 'customer', tokenType });
      const response = await apiClient.post<RegisterDeviceTokenResponse>(
        '/api/notifications/register-device',
        {
          body: {
            deviceToken: token,
            platform,
            appType: 'customer',
            tokenType,
          },
          requiresAuth: true,
        }
      );
      console.log('[push] register: response success =', response?.success, 'expected =', response?.data?.expectedTokenType);

      if (response.success && response.data) {
        this.deviceToken = token;

        // Vendor-sync: if the backend expects a different token type than we just sent,
        // re-acquire the correct token and re-register once.
        const expected = response.data.expectedTokenType;
        if (expected && expected !== tokenType && !this.resyncing) {
          this.resyncing = true;
          try {
            const newToken = await this.getDeviceToken();
            if (newToken && this.resolvedTokenType === expected) {
              await this.registerDeviceToken(newToken);
            }
          } finally {
            this.resyncing = false;
          }
        }

        return true;
      }

      console.warn('Device token registration returned unsuccessful response:', response);
      return false;
    } catch (error) {
      console.error('Error registering device token:', error);
      // Don't throw - return false to allow app to continue functioning
      return false;
    }
  }

  /**
   * Unregister device token from backend
   * @returns true if unregistration successful
   */
  async unregisterDeviceToken(): Promise<boolean> {
    try {
      if (!this.deviceToken) {
        return true; // Nothing to unregister
      }

      await apiClient.delete('/api/notifications/unregister-device', {
        requiresAuth: true,
      });

      this.deviceToken = null;
      return true;
    } catch (error) {
      console.error('Error unregistering device token:', error);
      // Clear token locally even if API call fails to prevent stale state
      this.deviceToken = null;
      return false;
    }
  }

  /**
   * Initialize notification service
   * Requests permissions, gets token, and registers with backend
   * @returns true if initialization successful
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[push] initialize: start');
      // Request permissions
      const hasPermission = await this.requestPermissions();
      console.log('[push] initialize: hasPermission =', hasPermission);
      if (!hasPermission) {
        console.warn('[push] initialize: STOP — notification permission not granted');
        return false;
      }

      // Get device token
      const token = await this.getDeviceToken();
      if (!token) {
        console.warn('[push] initialize: STOP — no device token (see getDeviceToken log above)');
        return false;
      }
      console.log('[push] initialize: got token, registering with backend…');

      // Register with backend. The apiClient attaches auth (Clerk-issued token when
      // Clerk is enabled, else legacy storage), so we don't gate on the legacy token
      // store here — under Clerk it's always empty, which used to silently skip
      // registration. Callers only invoke initialize() for an authenticated user.
      await this.registerDeviceToken(token);

      return true;
    } catch (error) {
      console.error('Error initializing notification service:', error);
      // Return false but don't throw to prevent app crash
      return false;
    }
  }

  /**
   * Setup notification listeners
   * @param onNotificationReceived - Callback when notification is received
   * @param onNotificationTapped - Callback when notification is tapped
   */
  setupListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationTapped?: (response: Notifications.NotificationResponse) => void
  ): void {
    try {
      // Remove existing listeners if any
      this.removeListeners();

      // Listen for notifications received while app is foregrounded
      this.notificationListener = Notifications.addNotificationReceivedListener(
        (notification) => {
          try {
            onNotificationReceived?.(notification);
          } catch (error) {
            console.error('Error in onNotificationReceived callback:', error);
          }
        }
      );

      // Listen for user tapping on notification
      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          try {
            onNotificationTapped?.(response);
          } catch (error) {
            console.error('Error in onNotificationTapped callback:', error);
          }
        }
      );
    } catch (error) {
      console.error('Error setting up notification listeners:', error);
      // Clean up partial listeners if setup fails
      this.removeListeners();
    }
  }

  /**
   * Remove notification listeners
   */
  removeListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Get the current device token
   */
  getCurrentToken(): string | null {
    return this.deviceToken;
  }
}

export const notificationService = new NotificationService();

