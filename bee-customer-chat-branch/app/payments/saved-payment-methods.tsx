import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { useSavedPaymentMethods } from '@/features/payments/hooks/useSavedPaymentMethods';
import type { SavedPaymentMethod } from '@/features/payments/types';

export default function SavedPaymentMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const {
    methods,
    isLoading,
    error,
    refresh,
    delete: deleteMethod,
    setDefault,
  } = useSavedPaymentMethods();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const handleDelete = async (method: SavedPaymentMethod) => {
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete ${method.cardBrand || 'Card'} ending in ${method.last4Digits}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(method.id);
            try {
              await deleteMethod(method.id);
              Alert.alert('Success', 'Payment method deleted successfully.');
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to delete payment method'
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (method: SavedPaymentMethod) => {
    if (method.isDefault) return;
    
    setSettingDefaultId(method.id);
    try {
      await setDefault(method.id);
      Alert.alert('Success', 'Default payment method updated.');
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to set default payment method'
      );
    } finally {
      setSettingDefaultId(null);
    }
  };

  const getCardIcon = (type: string, brand?: string | null) => {
    if (type === 'EWallet') return 'wallet-outline';
    if (brand?.toLowerCase().includes('visa')) return 'card-outline';
    if (brand?.toLowerCase().includes('mastercard')) return 'card-outline';
    return 'card-outline';
  };

  const formatExpiry = (month?: number | null, year?: number | null) => {
    if (!month || !year) return '';
    return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
  };

  if (isLoading && methods.length === 0) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={{ color: theme.text }}>
            Saved Payment Methods
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={{ color: theme.text }}>
          Saved Payment Methods
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
          <ThemedText style={{ color: theme.error, fontSize: 14 }}>
            {error}
          </ThemedText>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        {methods.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={64} color={theme.textMuted} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: 16, textAlign: 'center' }}>
              No saved payment methods yet
            </ThemedText>
            <ThemedText style={{ color: theme.textMuted, marginTop: 8, textAlign: 'center', fontSize: 14 }}>
              Add a payment method during checkout to save it for future use
            </ThemedText>
          </View>
        ) : (
          methods.map((method) => (
            <View
              key={method.id}
              style={[
                styles.methodCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: method.isDefault ? theme.primary : theme.border,
                },
              ]}
            >
              <View style={styles.methodCardHeader}>
                <View style={styles.methodCardLeft}>
                  <View style={styles.methodCardIconRow}>
                    <Ionicons
                      name={getCardIcon(method.type, method.cardBrand)}
                      size={24}
                      color={method.isDefault ? theme.primary : theme.text}
                    />
                    {method.isDefault && (
                      <View style={[styles.defaultBadge, { backgroundColor: theme.primary }]}>
                        <Ionicons name="star" size={12} color="#fff" />
                        <ThemedText style={{ color: '#fff', fontSize: 10, marginLeft: 4 }}>
                          DEFAULT
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 8 }}>
                    {method.cardBrand || method.type} •••• {method.last4Digits}
                  </ThemedText>
                  {method.cardholderName && (
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 14, marginTop: 4 }}>
                      {method.cardholderName}
                    </ThemedText>
                  )}
                  {method.expiryMonth && method.expiryYear && (
                    <ThemedText style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
                      Expires {formatExpiry(method.expiryMonth, method.expiryYear)}
                    </ThemedText>
                  )}
                </View>
                <View style={styles.methodCardActions}>
                  {!method.isDefault && (
                    <TouchableOpacity
                      onPress={() => handleSetDefault(method)}
                      disabled={settingDefaultId === method.id}
                      style={[
                        styles.actionButton,
                        { borderColor: theme.border },
                        settingDefaultId === method.id && { opacity: 0.5 },
                      ]}
                    >
                      {settingDefaultId === method.id ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <Ionicons name="star-outline" size={18} color={theme.text} />
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDelete(method)}
                    disabled={deletingId === method.id}
                    style={[
                      styles.actionButton,
                      { borderColor: theme.error },
                      deletingId === method.id && { opacity: 0.5 },
                    ]}
                  >
                    {deletingId === method.id ? (
                      <ActivityIndicator size="small" color={theme.error} />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    margin: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  methodCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  methodCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  methodCardLeft: {
    flex: 1,
  },
  methodCardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  methodCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
