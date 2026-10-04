import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from './apiClient';

const CONFIG_KEYS = {
  GOOGLE_MAPS_API_KEY: 'bee_config_google_maps_api_key',
  MAPBOX_ACCESS_TOKEN: 'bee_config_mapbox_access_token',
} as const;

interface RemoteConfig {
  google_maps_api_key?: string;
  mapbox_access_token?: string;
}

// In-memory cache — populated from SecureStore on initialize(), then kept in sync
const cache: Partial<Record<string, string>> = {};

class ConfigService {
  /**
   * Load cached config from SecureStore into memory. Call once at app startup
   * before any service tries to read config values synchronously.
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all(
        Object.values(CONFIG_KEYS).map(async (key) => {
          const value = await SecureStore.getItemAsync(key);
          if (value !== null) {
            cache[key] = value;
          }
        }),
      );
    } catch (error) {
      console.warn('[ConfigService] Failed to hydrate config from SecureStore:', error);
    }
    this.applyMapboxToken();
  }

  /**
   * Re-apply the Mapbox access token to the native SDK. Called after config is
   * hydrated/loaded so the token (Vault value, or env fallback) is set before any
   * map renders — the @rnmapbox plugin bakes no token, so it MUST be set
   * programmatically. No-op on web or when the native module isn't present.
   */
  private applyMapboxToken(): void {
    if (Platform.OS === 'web') return;
    const token = this.getMapboxAccessToken();
    if (!token) return;
    try {
      const mapbox = require('@rnmapbox/maps');
      const Mapbox = mapbox?.default ?? mapbox;
      Mapbox?.setAccessToken?.(token);
    } catch {
      // Native module unavailable — ignore.
    }
  }

  /**
   * Fetch secrets from the backend /api/config endpoint (which proxies Vault)
   * and persist them to SecureStore + in-memory cache. Non-throwing — falls back
   * to whatever is already cached if the request fails.
   */
  async loadRemoteConfig(): Promise<void> {
    try {
      console.log('[ConfigService] → Fetching remote config from GET api/config …');
      const response = await apiClient.get<RemoteConfig>('api/config');
      console.log('[ConfigService] ← Raw response:', JSON.stringify(response));

      if (!response.success || !response.data) {
        console.warn('[ConfigService] No usable config in response (success/data missing). Keeping cached/env fallback.', {
          success: response.success,
          hasData: !!response.data,
        });
        return;
      }

      // apiClient does not unwrap, so response.data is the raw body. The endpoint may
      // return the fields flat OR wrapped in the shared { success, data } envelope —
      // tolerate both, the same way bookingService digs into a nested `data`.
      const body = response.data as RemoteConfig & { data?: RemoteConfig };
      const config: RemoteConfig = body.data ?? body;
      console.log('[ConfigService] Parsed config payload:', JSON.stringify(config));

      const entries: [string, string][] = ([
        [CONFIG_KEYS.GOOGLE_MAPS_API_KEY, config.google_maps_api_key],
        [CONFIG_KEYS.MAPBOX_ACCESS_TOKEN, config.mapbox_access_token],
      ] as [string, string | undefined][]).filter((entry): entry is [string, string] => !!entry[1]);

      console.log('[ConfigService] Keys received from backend:', {
        google_maps_api_key: config.google_maps_api_key ? `set (len ${config.google_maps_api_key.length})` : '(empty/missing)',
        mapbox_access_token: config.mapbox_access_token ? `set (len ${config.mapbox_access_token.length})` : '(empty/missing)',
        storing: entries.map(([k]) => k),
      });

      await Promise.all(
        entries.map(async ([key, value]) => {
          cache[key] = value;
          await SecureStore.setItemAsync(key, value);
        }),
      );

      this.applyMapboxToken();
      console.log(`[ConfigService] Remote config loaded successfully (${entries.length} value(s) stored).`);
    } catch (error) {
      console.warn('[ConfigService] Remote config fetch failed, using cached/env fallback:', error);
    }
  }

  /**
   * Wipe all config from SecureStore and memory. Call on logout.
   */
  async clearRemoteConfig(): Promise<void> {
    try {
      await Promise.all(
        Object.values(CONFIG_KEYS).map(async (key) => {
          delete cache[key];
          await SecureStore.deleteItemAsync(key);
        }),
      );
    } catch (error) {
      console.warn('[ConfigService] Failed to clear config:', error);
    }
  }

  private resolve(key: string, envFallback: string | undefined): string | undefined {
    return cache[key] ?? envFallback ?? undefined;
  }

  getGoogleMapsApiKey(): string | undefined {
    return this.resolve(CONFIG_KEYS.GOOGLE_MAPS_API_KEY, process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);
  }

  getMapboxAccessToken(): string | undefined {
    return this.resolve(CONFIG_KEYS.MAPBOX_ACCESS_TOKEN, process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);
  }
}

export const configService = new ConfigService();
