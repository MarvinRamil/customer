import { apiClient } from './apiClient';

export type PaymentMethod = 'Cash' | 'BankTransfer' | 'EWallet';

export interface CreatePaymentRequest {
  bookingId?: string | null;  // Optional: null for PayOnline flow where payment is created before booking
  customerId: string;
  amount: number;
  payerEmail: string;
  description: string;
  method?: PaymentMethod;
  currency?: string;
}

export interface PaymentDto {
  id: string;
  paymentNumber: string;
  bookingId: string | null;  // Nullable: payment may be created before booking
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  xenditInvoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

/**
 * Create a payment (Xendit invoice for cashless).
 * POST /api/payments
 * Returns payment with xenditInvoiceUrl to open for customer to pay.
 */
export async function createPayment(request: CreatePaymentRequest): Promise<PaymentDto> {
  const response = await apiClient.post<PaymentDto | { data: PaymentDto }>(
    '/api/payments',
    {
      body: {
        bookingId: request.bookingId,
        customerId: request.customerId,
        amount: request.amount,
        payerEmail: request.payerEmail,
        description: request.description,
        method: request.method ?? 'BankTransfer',
        currency: request.currency ?? 'PHP',
      },
      requiresAuth: true,
    }
  );

  if (!response.success || !response.data) {
    throw new Error(
      (response as { message?: string }).message ?? 'Failed to create payment'
    );
  }

  const data = response.data;
  const payment =
    data && typeof data === 'object' && 'data' in data
      ? (data as { data: PaymentDto }).data
      : (data as PaymentDto);

  return payment;
}

/**
 * Get payment by ID (used for polling payment status).
 * GET /api/payments/{paymentId}
 */
export async function getPaymentById(paymentId: string): Promise<PaymentDto | null> {
  const response = await apiClient.get<PaymentDto | { data: PaymentDto }>(
    `/api/payments/${paymentId}`,
    { requiresAuth: true }
  );

  if (!response.success || !response.data) {
    return null;
  }

  const data = response.data;
  const payment =
    data && typeof data === 'object' && 'data' in data
      ? (data as { data: PaymentDto }).data
      : (data as PaymentDto);

  return payment;
}

/**
 * Get payment by booking ID.
 * GET /api/payments/booking/{bookingId}
 */
export async function getPaymentByBooking(bookingId: string): Promise<PaymentDto | null> {
  const response = await apiClient.get<PaymentDto | { data: PaymentDto }>(
    `/api/payments/booking/${bookingId}`,
    { requiresAuth: true }
  );

  if (!response.success || !response.data) {
    return null;
  }

  const data = response.data;
  const payment =
    data && typeof data === 'object' && 'data' in data
      ? (data as { data: PaymentDto }).data
      : (data as PaymentDto);

  return payment;
}

/**
 * Link a payment to a booking (for PayOnline flow where payment is created before booking).
 * POST /api/payments/{paymentId}/link-booking/{bookingId}
 */
export async function linkPaymentToBooking(paymentId: string, bookingId: string): Promise<void> {
  const response = await apiClient.post(
    `/api/payments/${paymentId}/link-booking/${bookingId}`,
    {
      requiresAuth: true,
    }
  );

  if (!response.success) {
    throw new Error(
      (response as { message?: string }).message ?? 'Failed to link payment to booking'
    );
  }
}
