import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import Constants from 'expo-constants';
import { tokenStorage } from '@/shared/services/tokenStorage';
import { getPaymentById } from '@/shared/services/paymentService';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5248';

interface PaymentStatusEvent {
  paymentId: string;
  bookingId: string | null;  // Nullable: payment may be created before booking (Empty Guid from backend becomes null)
  customerId: string;
  amount: number;
  status: string;
  paidAtUtc: string;
}

/**
 * Hook to listen for payment status updates via SSE + polling fallback.
 * 
 * Strategy:
 * 1. Attempt SSE connection (fast, real-time — works on some RN versions)
 * 2. Always start polling as fallback (every 3s) since SSE streaming
 *    is unreliable in React Native (fetch doesn't support ReadableStream well)
 * 3. Return the latest payment status event when payment is received.
 */
export function usePaymentStatus(paymentId: string | null) {
  const { user } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isConnectedRef = useRef(false);
  const hasReceivedPaymentRef = useRef(false); // Prevent duplicate processing

  // ─── SSE connection (optimistic, may not work in all RN versions) ───
  useEffect(() => {
    isConnectedRef.current = false;
    setIsConnected(false);
    hasReceivedPaymentRef.current = false;

    if (!paymentId || !user?.id) {
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const connectSSE = async () => {
      try {
        const token = await tokenStorage.getAccessToken();
        if (!token) {
          console.warn('[PaymentStatus] No auth token available for SSE');
          return;
        }

        const url = `${API_URL}/api/payments/customer/${user.id}/events${paymentId ? `?paymentId=${paymentId}` : ''}`;

        const connectTime = new Date().toISOString();
        console.log(`[PaymentStatus] [${connectTime}] Connecting to SSE:`, url);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${token}`,
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          console.error(`[PaymentStatus] SSE connection failed - Status: ${response.status}`);
          return;
        }

        if (!isMounted) return;

        setIsConnected(true);
        isConnectedRef.current = true;
        console.log(`[PaymentStatus] [${new Date().toISOString()}] ✓ SSE connection opened`);

        const reader = response.body?.getReader();
        if (!reader) {
          console.warn('[PaymentStatus] No response body reader available (RN limitation)');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          if (!isMounted) break;

          const { done, value } = await reader.read();

          if (done) {
            console.log('[PaymentStatus] SSE stream ended');
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            try {
              const jsonStr = line.replace(/^data: /, '').trim();
              const data = JSON.parse(jsonStr) as PaymentStatusEvent;

              if (data.paymentId === paymentId) {
                console.log(`[PaymentStatus] [${new Date().toISOString()}] Payment received via SSE:`, data);
                if (isMounted && !hasReceivedPaymentRef.current) {
                  hasReceivedPaymentRef.current = true;
                  setPaymentStatus(data);
                }
              } else {
                console.log(`[PaymentStatus] Received event for different payment - Expected: ${paymentId}, Got: ${data.paymentId}`);
              }
            } catch (error) {
              console.error('[PaymentStatus] Failed to parse SSE message:', error, line);
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[PaymentStatus] SSE connection aborted');
        } else {
          console.warn('[PaymentStatus] SSE error (polling fallback active):', error.message);
          if (isMounted) {
            setIsConnected(false);
            isConnectedRef.current = false;
          }
        }
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      abortController.abort();
      abortControllerRef.current = null;
      setIsConnected(false);
      isConnectedRef.current = false;
    };
  }, [paymentId, user?.id]);

  // ─── Polling fallback (always active, reliable across all RN versions) ───
  useEffect(() => {
    if (!paymentId || !user?.id) return;

    let isMounted = true;
    const POLL_INTERVAL = 3000; // Poll every 3 seconds

    console.log(`[PaymentStatus] [${new Date().toISOString()}] Starting polling fallback for PaymentId: ${paymentId}`);

    const pollPaymentStatus = async () => {
      while (isMounted && !hasReceivedPaymentRef.current) {
        try {
          const payment = await getPaymentById(paymentId);

          if (payment && payment.status === 'Paid' && isMounted && !hasReceivedPaymentRef.current) {
            const pollTime = new Date().toISOString();
            console.log(`[PaymentStatus] [${pollTime}] ✓ Payment confirmed via polling:`, {
              paymentId: payment.id,
              status: payment.status,
              amount: payment.amount,
              paidAt: payment.paidAt,
            });

            hasReceivedPaymentRef.current = true;

            // Convert API response to PaymentStatusEvent format
            const event: PaymentStatusEvent = {
              paymentId: payment.id,
              bookingId: payment.bookingId,
              customerId: payment.customerId,
              amount: payment.amount,
              status: payment.status,
              paidAtUtc: payment.paidAt || new Date().toISOString(),
            };

            setPaymentStatus(event);
            return; // Stop polling
          }
        } catch (error) {
          console.warn('[PaymentStatus] Polling error (will retry):', error);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
    };

    // Start polling after a short delay (give SSE a chance to connect first)
    const startTimeout = setTimeout(() => {
      if (isMounted && !hasReceivedPaymentRef.current) {
        pollPaymentStatus();
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(startTimeout);
    };
  }, [paymentId, user?.id]);

  return { paymentStatus, isConnected, isConnectedRef };
}
