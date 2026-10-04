import { apiClient } from '@/shared/services/apiClient';
import type { CreateKycSessionResult, KycStatusResult } from '../types';

/** Thrown when the backend reports KYC is unavailable (Didit disabled) so callers can fall back. */
export class KycUnavailableError extends Error {
  constructor(message = 'Identity verification is temporarily unavailable') {
    super(message);
    this.name = 'KycUnavailableError';
  }
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status?: number }).status;
  }
  return undefined;
}

/**
 * Didit KYC service for onboarding: the hosted flow scans the customer's ID,
 * takes a selfie with liveness, and face-matches it against the ID portrait.
 * Calls backend POST /api/customer/kyc/session and GET /api/customer/kyc/status
 * (customer-scoped; persisted server-side in the CustomerVerifications table).
 */
class KycService {
  /** Create a KYC session. Returns the hosted verification URL to open in a WebView. */
  async createSession(): Promise<CreateKycSessionResult> {
    try {
      const response = await apiClient.post<CreateKycSessionResult>('api/customer/kyc/session', {
        body: {},
        requiresAuth: true,
      });
      if (!response.data?.verificationUrl) {
        throw new Error(response.message || 'Failed to start verification');
      }
      return response.data;
    } catch (e) {
      if (statusOf(e) === 503) {
        throw new KycUnavailableError();
      }
      throw e instanceof Error || (e && typeof e === 'object' && 'message' in e)
        ? new Error((e as { message: string }).message)
        : new Error('Failed to start verification');
    }
  }

  /** Latest KYC status for the current user. */
  async getStatus(): Promise<KycStatusResult> {
    const response = await apiClient.get<KycStatusResult>('api/customer/kyc/status', {
      requiresAuth: true,
    });
    if (!response.data?.status) {
      throw new Error(response.message || 'Failed to get verification status');
    }
    return response.data;
  }
}

export const kycService = new KycService();
