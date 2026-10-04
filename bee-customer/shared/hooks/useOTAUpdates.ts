import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';

/**
 * Hook for managing OTA (Over-The-Air) updates
 * Checks for updates and applies them automatically
 */
export function useOTAUpdates() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  useEffect(() => {
    // OTA debug block - use to verify channel, runtimeVersion, and launch type
    console.log("========== OTA DEBUG ==========");
    console.log("channel:", Updates.channel);
    console.log("runtimeVersion:", Updates.runtimeVersion);
    console.log("updateId:", Updates.updateId);
    console.log("isEmbeddedLaunch:", Updates.isEmbeddedLaunch);
    console.log("================================");

    // Log OTA update status for debugging
    console.log('[OTA Updates] Checking status:', {
      isDev: __DEV__,
      isEnabled: Updates.isEnabled,
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    });

    // Check if updates are enabled (works in both development and production builds)
    // Note: Updates.isEnabled is false when running with expo start (dev mode)
    // but true when running a build from EAS (development, preview, or production profile)
    if (!Updates.isEnabled) {
      if (__DEV__) {
        console.log('[OTA Updates] Skipping - running in development mode (expo start). OTA updates only work in EAS builds.');
      } else {
        console.warn('[OTA Updates] Updates are not enabled. Make sure the app was built with EAS Build.');
      }
      return;
    }

    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      console.log('[OTA Updates] Checking for updates...');
      console.log('[OTA Updates] Current app state:', {
        channel: Updates.channel,
        runtimeVersion: Updates.runtimeVersion,
        updateId: Updates.updateId,
        isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      });

      // Log update URL if available (for debugging network issues)
      try {
        const updateUrl = Constants.expoConfig?.updates?.url || 'Not configured in app.config.js';
        console.log('[OTA Updates] Update URL:', updateUrl);
        if (!updateUrl || updateUrl === 'Not configured in app.config.js') {
          console.warn('[OTA Updates] WARNING: Update URL is not configured! Check app.config.js');
        }
      } catch (e) {
        console.warn('[OTA Updates] Could not read update URL from Constants:', e);
      }

      const update = await Updates.checkForUpdateAsync();

      console.log('[OTA Updates] Update check result:', {
        isAvailable: update.isAvailable,
        manifest: update.manifest ? {
          id: update.manifest.id,
          // Note: createdAt and runtimeVersion may not be available on all manifest types
        } : null,
      });

      if (update.isAvailable) {
        console.log('[OTA Updates] Update available!');
        console.log('[OTA Updates] Update manifest:', {
          id: update.manifest?.id,
          // Note: createdAt and runtimeVersion may not be available on all manifest types
          // Accessing via optional chaining to avoid TypeScript errors
          createdAt: (update.manifest as any)?.createdAt,
          runtimeVersion: (update.manifest as any)?.runtimeVersion,
        });
        console.log('[OTA Updates] Starting download and apply process...');
        setIsUpdateAvailable(true);
        await downloadAndApplyUpdate();
      } else {
        console.log('[OTA Updates] No update available');
        console.log('[OTA Updates] Troubleshooting:');
        console.log('  - Verify update was published to channel:', Updates.channel);
        console.log('  - Verify update runtimeVersion matches:', Updates.runtimeVersion);
        console.log('  - Check EAS dashboard for published updates');
        console.log('  - Run: eas update:list --branch', Updates.channel);
      }
    } catch (error) {
      console.error('[OTA Updates] Error checking for updates:', error);
      
      // Extract detailed error information
      const errorDetails: Record<string, unknown> = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined,
      };

      // Check if it's a network-related error
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
          errorDetails.networkIssue = true;
          errorDetails.troubleshooting = [
            '1. Check device internet connection',
            '2. Verify device can access https://u.expo.dev',
            '3. Check for firewall/proxy blocking the connection',
            '4. Verify device time is correct (SSL certificates require valid time)',
          ];
        }
      }

      console.error('[OTA Updates] Error details:', errorDetails);
      console.error('[OTA Updates] Troubleshooting ERR_UPDATES_CHECK:');
      console.error('  - This error usually indicates a network connectivity issue');
      console.error('  - Verify device has internet access');
      console.error('  - Check if device can reach: https://u.expo.dev');
      console.error('  - Ensure device time is correct (SSL certificates require valid time)');
      console.error('  - Check for corporate firewall/proxy blocking the connection');
      console.error('  - Verify app.config.js has correct updates.url');
      
      setUpdateError(error instanceof Error ? error : new Error('Unknown error'));
    }
  };

  const downloadAndApplyUpdate = async () => {
    try {
      setIsUpdating(true);
      console.log('[OTA Updates] Fetching update...');
      
      const result = await Updates.fetchUpdateAsync();
      
      console.log('[OTA Updates] Update fetched:', {
        isNew: result.isNew,
        manifest: result.manifest ? {
          id: result.manifest.id,
        } : null,
      });

      if (!result.isNew) {
        console.log('[OTA Updates] Update was not new - already have this version');
        setIsUpdating(false);
        return;
      }

      // Verify update was downloaded
      if (!result.manifest) {
        console.warn('[OTA Updates] Update fetched but no manifest available');
        setIsUpdating(false);
        return;
      }

      console.log('[OTA Updates] Update downloaded successfully, reloading app to apply...');
      console.log('[OTA Updates] New update ID:', result.manifest.id);
      
      // reloadAsync will reload the app with the new update
      // This is an async operation but the app will reload before it completes
      await Updates.reloadAsync();
      
      // Note: Code after reloadAsync may not execute if reload is successful
      // If we reach here, the reload might have failed
      console.warn('[OTA Updates] reloadAsync completed but app did not reload - this may indicate an issue');
      setIsUpdating(false);
    } catch (error) {
      console.error('[OTA Updates] Error downloading/applying update:', error);
      console.error('[OTA Updates] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      setUpdateError(error instanceof Error ? error : new Error('Unknown error'));
      setIsUpdating(false);
    }
  };

  /**
   * Get current update information
   * Useful for verifying if an update was applied
   */
  const getCurrentUpdateInfo = () => {
    return {
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      isEnabled: Updates.isEnabled,
    };
  };

  return {
    isUpdateAvailable,
    isUpdating,
    updateError,
    checkForUpdates,
    getCurrentUpdateInfo,
  };
}

