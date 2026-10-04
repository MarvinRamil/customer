import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@/shared/services/notificationService';
import { useAuth } from '@/features/auth';

/**
 * Hook for managing push notifications
 * Handles initialization, token registration, and notification handling
 */
export function useNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Initialize notifications when user is authenticated
    if (user) {
      notificationService.initialize().catch((error) => {
        console.error('Failed to initialize notifications:', error);
      });
    }

    // Setup notification listeners
    notificationService.setupListeners(
      // Notification received (foreground)
      (notification) => {
        console.log('Notification received:', notification);
        // You can show an in-app notification here if needed
      },
      // Notification tapped
      (response) => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped:', data);

        // Handle deep linking based on notification data
        if (data?.type === 'booking') {
          if (data.bookingId) {
            router.push({
              pathname: '/tracking',
              params: { id: data.bookingId },
            });
          }
        } else if (data?.type === 'dispatch') {
          if (data.bookingId) {
            router.push({
              pathname: '/tracking',
              params: { id: data.bookingId },
            });
          }
        } else if (data?.type === 'booking_chat') {
          if (data.bookingId) {
            router.push({
              pathname: '/chat',
              params: { bookingId: data.bookingId as string, roomId: data.roomId as string | undefined },
            });
          }
        }
      }
    );

    return () => {
      notificationService.removeListeners();
    };
  }, [user, router]);

  // Detach the device on logout. Registration on login is owned by initialize()
  // in the effect above (which prompts once, then registers); doing a second raw
  // getDeviceToken()+register here raced that permission prompt and could fire
  // before permission resolved. registerDeviceToken() coalesces by token, so any
  // overlap with the login callback's registerIfPermitted() is a single POST.
  useEffect(() => {
    if (!user) {
      notificationService.unregisterDeviceToken().catch(() => {});
    }
  }, [user]);

  return {
    // Expose methods if needed
  };
}

