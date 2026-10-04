import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useTheme } from '@/shared/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useSavedPaymentMethods } from '../hooks/useSavedPaymentMethods';
import type { SavedPaymentMethod } from '../types';

interface PaymentMethodSelectorProps {
  selectedMethodId?: string | null;
  onSelect: (method: SavedPaymentMethod | null) => void;
  showAddNew?: boolean;
  onAddNew?: () => void;
}

/**
 * Component for selecting a saved payment method
 * Used in booking/payment flow
 */
export function PaymentMethodSelector({
  selectedMethodId,
  onSelect,
  showAddNew = true,
  onAddNew,
}: PaymentMethodSelectorProps) {
  const theme = useTheme();
  const { methods, isLoading } = useSavedPaymentMethods();

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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={theme.primary} />
        <ThemedText style={{ color: theme.textSecondary, marginTop: 8, fontSize: 12 }}>
          Loading payment methods...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>
        Select Payment Method
      </ThemedText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {/* Manual Entry Option */}
        <TouchableOpacity
          onPress={() => onSelect(null)}
          style={[
            styles.methodCard,
            {
              backgroundColor: selectedMethodId === null ? theme.primary + '20' : theme.surface,
              borderColor: selectedMethodId === null ? theme.primary : theme.border,
              marginRight: 12,
            },
          ]}
        >
          <Ionicons
            name="add-circle-outline"
            size={32}
            color={selectedMethodId === null ? theme.primary : theme.text}
          />
          <ThemedText
            style={{
              color: selectedMethodId === null ? theme.primary : theme.text,
              fontSize: 12,
              fontWeight: '600',
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            New Card
          </ThemedText>
        </TouchableOpacity>

        {/* Saved Methods */}
        {methods.map((method) => (
          <TouchableOpacity
            key={method.id}
            onPress={() => onSelect(method)}
            style={[
              styles.methodCard,
              {
                backgroundColor: selectedMethodId === method.id ? theme.primary + '20' : theme.surface,
                borderColor: selectedMethodId === method.id ? theme.primary : theme.border,
                marginRight: 12,
              },
            ]}
          >
            <View style={styles.methodCardContent}>
              <View style={styles.methodCardHeader}>
                <Ionicons
                  name={getCardIcon(method.type, method.cardBrand)}
                  size={24}
                  color={selectedMethodId === method.id ? theme.primary : theme.text}
                />
                {method.isDefault && (
                  <Ionicons name="star" size={14} color={theme.primary} />
                )}
              </View>
              <ThemedText
                style={{
                  color: selectedMethodId === method.id ? theme.primary : theme.text,
                  fontSize: 12,
                  fontWeight: '600',
                  marginTop: 8,
                }}
              >
                {method.cardBrand || method.type}
              </ThemedText>
              <ThemedText
                style={{
                  color: selectedMethodId === method.id ? theme.primary : theme.textSecondary,
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                •••• {method.last4Digits}
              </ThemedText>
              {method.expiryMonth && method.expiryYear && (
                <ThemedText
                  style={{
                    color: selectedMethodId === method.id ? theme.primary : theme.textMuted,
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  {formatExpiry(method.expiryMonth, method.expiryYear)}
                </ThemedText>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showAddNew && onAddNew && methods.length > 0 && (
        <TouchableOpacity
          onPress={onAddNew}
          style={[styles.addButton, { borderColor: theme.border }]}
        >
          <Ionicons name="add" size={18} color={theme.primary} />
          <ThemedText style={{ color: theme.primary, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
            Add New Payment Method
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  scrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  methodCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCardContent: {
    alignItems: 'center',
    width: '100%',
  },
  methodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
});
