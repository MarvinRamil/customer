/**
 * Saved Payment Method types
 */

export type PaymentMethodType = 'CreditCard' | 'DebitCard' | 'EWallet';

export interface SavedPaymentMethod {
  id: string;
  customerId: string;
  type: PaymentMethodType;
  last4Digits: string;
  cardBrand?: string | null;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  cardholderName?: string | null;
  isDefault: boolean;
  isActive: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedPaymentMethodRequest {
  xenditPaymentMethodId: string;
  type: PaymentMethodType;
  cardholderName?: string | null;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  isDefault?: boolean;
}

export interface UpdateSavedPaymentMethodRequest {
  cardholderName?: string | null;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  isDefault?: boolean;
}
