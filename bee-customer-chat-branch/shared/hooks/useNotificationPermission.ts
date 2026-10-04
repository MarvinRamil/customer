import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { permissionStorage } from '@/shared/services/permissionStorage';

/**
 * Hook for managing notification permission prompt
 * Checks if permission was already requested and if it's currently granted
 */
export function useNotificationPermission() {
  const [showModal, setShowModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    try {
      setIsChecking(true);

      // Check current permission status
      const { status } = await Notifications.getPermissionsAsync();

      // If already granted, don't show modal
      if (status === 'granted') {
        setShowModal(false);
        setIsChecking(false);
        return;
      }

      // Check if we've already asked
      const hasAsked = await permissionStorage.hasAskedForNotificationPermission();

      // Only show modal if we haven't asked before
      setShowModal(!hasAsked);
    } catch (error) {
      console.error('Error checking notification permission:', error);
      setShowModal(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleEnable = () => {
    setShowModal(false);
  };

  const handleSkip = () => {
    setShowModal(false);
  };

  return {
    showModal,
    isChecking,
    handleEnable,
    handleSkip,
  };
}

