import type { TokenCache } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";

/**
 * Token cache for Clerk, backed by expo-secure-store.
 * Clerk uses this to persist the session across app restarts so users stay
 * signed in. Keys are namespaced by Clerk internally.
 */
export const clerkTokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      if (__DEV__) {
        console.warn("[ClerkTokenCache] getToken failed:", err);
      }
      // If the stored value is corrupt, remove it so Clerk can recover.
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // best effort
      }
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      if (__DEV__) {
        console.warn("[ClerkTokenCache] saveToken failed:", err);
      }
    }
  },
  async clearToken(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      if (__DEV__) {
        console.warn("[ClerkTokenCache] clearToken failed:", err);
      }
    }
  },
};
