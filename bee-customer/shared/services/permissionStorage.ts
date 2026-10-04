import * as SecureStore from 'expo-secure-store';

/**
 * Permission storage keys
 */
const PERMISSION_KEYS = {
  NOTIFICATION_PERMISSION_ASKED: 'notification_permission_asked',
} as const;

/**
 * Permission storage service
 * Tracks whether permission prompts have been shown to the user
 */
class PermissionStorage {
  /**
   * Check if notification permission was already requested
   * @returns Promise that resolves to true if already asked, false otherwise
   */
  async hasAskedForNotificationPermission(): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(PERMISSION_KEYS.NOTIFICATION_PERMISSION_ASKED);
      return value === 'true';
    } catch (error) {
      console.error('Error checking notification permission status:', error);
      return false;
    }
  }

  /**
   * Mark notification permission as asked
   * @returns Promise that resolves when status is saved
   */
  async setNotificationPermissionAsked(): Promise<void> {
    try {
      await SecureStore.setItemAsync(PERMISSION_KEYS.NOTIFICATION_PERMISSION_ASKED, 'true');
    } catch (error) {
      console.error('Error saving notification permission status:', error);
    }
  }

  /**
   * Reset notification permission asked status (for testing)
   * @returns Promise that resolves when status is cleared
   */
  async resetNotificationPermissionAsked(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(PERMISSION_KEYS.NOTIFICATION_PERMISSION_ASKED);
    } catch (error) {
      console.error('Error resetting notification permission status:', error);
    }
  }
}

/**
 * Singleton instance of permission storage service
 */
export const permissionStorage = new PermissionStorage();

