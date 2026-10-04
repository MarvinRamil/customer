import type { CheckEmailResponse, RegistrationStatusResponse } from '../types';
import { authService } from './authService';

/**
 * Registration helpers for the signup flow.
 * Wraps auth endpoints used before/during account creation.
 */
class RegistrationService {
  /**
   * Check registration status for an email (verified, complete, can resume).
   * Calls GET /api/auth/registration-status
   */
  async checkRegistrationStatus(email: string): Promise<RegistrationStatusResponse> {
    return authService.getRegistrationStatus(email);
  }

  /**
   * Check if an email is available for registration.
   * Calls POST /api/auth/check-email
   */
  async checkEmail(email: string): Promise<CheckEmailResponse> {
    return authService.checkEmail(email);
  }
}

export const registrationService = new RegistrationService();
