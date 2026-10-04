import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { BeeButton } from './BeeButton';
import { notificationService } from '@/shared/services/notificationService';
import { permissionStorage } from '@/shared/services/permissionStorage';
import { BeeColors } from '@/constants/theme';

interface NotificationPermissionModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when user enables notifications */
  onEnable: () => void;
  /** Callback when user skips */
  onSkip: () => void;
}

/**
 * Modal component for requesting notification permissions
 * Shows on first app launch to ask users if they want to enable push notifications
 */
export function NotificationPermissionModal({
  visible,
  onEnable,
  onSkip,
}: NotificationPermissionModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleEnable = async () => {
    try {
      setIsLoading(true);

      // Request permission only - registration is handled by useNotifications when user is logged in
      const granted = await notificationService.requestPermissions();

      if (granted) {
        console.log('Notification permission granted');
      }

      // Mark as asked regardless of result
      await permissionStorage.setNotificationPermissionAsked();

      onEnable();
    } catch (error) {
      console.error('Error enabling notifications:', error);
      // Still mark as asked even if there was an error
      await permissionStorage.setNotificationPermissionAsked();
      onEnable();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    // Mark as asked so we don't show again
    await permissionStorage.setNotificationPermissionAsked();
    onSkip();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <ThemedView style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <ThemedText style={styles.icon}>🔔</ThemedText>
          </View>
          
          <ThemedText type="title" style={styles.title}>
            Stay Updated
          </ThemedText>
          
          <ThemedText style={styles.description}>
            Get instant notifications about your booking status, delivery updates, and special offers.
          </ThemedText>
          
          <ThemedText style={styles.benefitsTitle}>
            You'll receive:
          </ThemedText>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <ThemedText style={styles.benefitIcon}>✓</ThemedText>
              <ThemedText style={styles.benefitText}>
                Real-time booking confirmations
              </ThemedText>
            </View>
            <View style={styles.benefitItem}>
              <ThemedText style={styles.benefitIcon}>✓</ThemedText>
              <ThemedText style={styles.benefitText}>
                Delivery status updates
              </ThemedText>
            </View>
            <View style={styles.benefitItem}>
              <ThemedText style={styles.benefitIcon}>✓</ThemedText>
              <ThemedText style={styles.benefitText}>
                Special offers and promotions
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <BeeButton
              title="Enable Notifications"
              onPress={handleEnable}
              loading={isLoading}
              variant="primary"
              style={styles.primaryButton}
            />
            <BeeButton
              title="Maybe Later"
              onPress={handleSkip}
              disabled={isLoading}
              variant="outline"
              style={styles.secondaryButton}
            />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BeeColors.yellow[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.8,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    alignSelf: 'flex-start',
    width: '100%',
  },
  benefitsList: {
    width: '100%',
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitIcon: {
    fontSize: 18,
    color: BeeColors.green[600],
    marginRight: 12,
    fontWeight: 'bold',
  },
  benefitText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
  },
});

