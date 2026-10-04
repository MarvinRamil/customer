import * as SecureStore from 'expo-secure-store';

function welcomeSeenKey(userId: string): string {
  return `welcome_seen_${userId}`;
}

/**
 * Welcome storage service
 * Tracks whether a given account has already seen the one-time post-KYC
 * welcome screen, so it never shows again once acknowledged.
 */
class WelcomeStorage {
  /**
   * Check if this account has already seen the welcome screen.
   */
  async hasSeenWelcome(userId: string): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(welcomeSeenKey(userId));
      return value === 'true';
    } catch (error) {
      console.error('Error checking welcome-seen status:', error);
      return false;
    }
  }

  /**
   * Mark the welcome screen as seen for this account.
   */
  async setWelcomeSeen(userId: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(welcomeSeenKey(userId), 'true');
    } catch (error) {
      console.error('Error saving welcome-seen status:', error);
    }
  }

  /**
   * Reset welcome-seen status for this account (for testing).
   */
  async resetWelcomeSeen(userId: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(welcomeSeenKey(userId));
    } catch (error) {
      console.error('Error resetting welcome-seen status:', error);
    }
  }
}

/**
 * Singleton instance of welcome storage service
 */
export const welcomeStorage = new WelcomeStorage();
