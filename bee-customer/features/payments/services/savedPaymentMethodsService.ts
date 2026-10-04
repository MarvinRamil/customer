import { apiClient } from '@/shared/services/apiClient';
import type {
  SavedPaymentMethod,
  CreateSavedPaymentMethodRequest,
  UpdateSavedPaymentMethodRequest,
} from '../types';

/**
 * Service for managing saved payment methods
 */
class SavedPaymentMethodsService {
  private extractPayload<T>(response: any): T | null {
    if (!response?.success) return null;
    const raw = response.data;
    if (raw && typeof raw === 'object' && 'data' in raw) {
      return (raw as any).data as T;
    }
    return (raw as T) ?? null;
  }

  /**
   * Get all saved payment methods for the current customer
   * GET /api/payment-methods
   * @returns Promise resolving to array of saved payment methods
   */
  async getAll(): Promise<SavedPaymentMethod[]> {
    try {
      const response = await apiClient.get<SavedPaymentMethod[]>(
        '/api/payment-methods',
        { requiresAuth: true }
      );
      const methods = this.extractPayload<SavedPaymentMethod[]>(response);
      return methods || [];
    } catch (error) {
      throw new Error(
        `Failed to fetch saved payment methods: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a specific saved payment method by ID
   * GET /api/payment-methods/{id}
   * @param id - Payment method ID
   * @returns Promise resolving to saved payment method or null
   */
  async getById(id: string): Promise<SavedPaymentMethod | null> {
    try {
      const response = await apiClient.get<SavedPaymentMethod>(
        `/api/payment-methods/${id}`,
        { requiresAuth: true }
      );
      return this.extractPayload<SavedPaymentMethod>(response);
    } catch (error) {
      throw new Error(
        `Failed to fetch saved payment method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a new saved payment method
   * POST /api/payment-methods
   * @param request - Payment method creation data
   * @returns Promise resolving to created saved payment method
   */
  async create(request: CreateSavedPaymentMethodRequest): Promise<SavedPaymentMethod> {
    try {
      const response = await apiClient.post<SavedPaymentMethod>(
        '/api/payment-methods',
        {
          body: request,
          requiresAuth: true,
        }
      );
      const method = this.extractPayload<SavedPaymentMethod>(response);
      if (!method) {
        const payload: any = response.data;
        throw new Error(payload?.message || response.message || 'Failed to create saved payment method');
      }
      return method;
    } catch (error) {
      throw new Error(
        `Failed to create saved payment method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update a saved payment method
   * PATCH /api/payment-methods/{id}
   * @param id - Payment method ID
   * @param request - Payment method update data
   * @returns Promise resolving to updated saved payment method
   */
  async update(id: string, request: UpdateSavedPaymentMethodRequest): Promise<SavedPaymentMethod> {
    try {
      const response = await apiClient.patch<SavedPaymentMethod>(
        `/api/payment-methods/${id}`,
        {
          body: request,
          requiresAuth: true,
        }
      );
      const method = this.extractPayload<SavedPaymentMethod>(response);
      if (!method) {
        const payload: any = response.data;
        throw new Error(payload?.message || response.message || 'Failed to update saved payment method');
      }
      return method;
    } catch (error) {
      throw new Error(
        `Failed to update saved payment method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a saved payment method
   * DELETE /api/payment-methods/{id}
   * @param id - Payment method ID
   * @returns Promise resolving when deletion is complete
   */
  async delete(id: string): Promise<void> {
    try {
      const response = await apiClient.delete(
        `/api/payment-methods/${id}`,
        { requiresAuth: true }
      );
      const payload: any = response.data;
      if (!response.success || (payload && payload.success === false)) {
        throw new Error(payload?.message || response.message || 'Failed to delete saved payment method');
      }
    } catch (error) {
      throw new Error(
        `Failed to delete saved payment method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set a saved payment method as default
   * POST /api/payment-methods/{id}/set-default
   * @param id - Payment method ID
   * @returns Promise resolving to updated saved payment method
   */
  async setDefault(id: string): Promise<SavedPaymentMethod> {
    try {
      const response = await apiClient.post<SavedPaymentMethod>(
        `/api/payment-methods/${id}/set-default`,
        {
          requiresAuth: true,
        }
      );
      const method = this.extractPayload<SavedPaymentMethod>(response);
      if (!method) {
        const payload: any = response.data;
        throw new Error(payload?.message || response.message || 'Failed to set default payment method');
      }
      return method;
    } catch (error) {
      throw new Error(
        `Failed to set default payment method: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const savedPaymentMethodsService = new SavedPaymentMethodsService();
