import { useCallback, useEffect, useState } from 'react';
import { savedPaymentMethodsService } from '../services/savedPaymentMethodsService';
import type {
  SavedPaymentMethod,
  CreateSavedPaymentMethodRequest,
  UpdateSavedPaymentMethodRequest,
} from '../types';

interface UseSavedPaymentMethodsReturn {
  methods: SavedPaymentMethod[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (request: CreateSavedPaymentMethodRequest) => Promise<SavedPaymentMethod>;
  update: (id: string, request: UpdateSavedPaymentMethodRequest) => Promise<SavedPaymentMethod>;
  delete: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<SavedPaymentMethod>;
}

/**
 * Hook for managing saved payment methods
 * Provides CRUD operations and state management
 */
export function useSavedPaymentMethods(): UseSavedPaymentMethodsReturn {
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await savedPaymentMethodsService.getAll();
      setMethods(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch saved payment methods';
      setError(errorMessage);
      console.error('[useSavedPaymentMethods] Error fetching methods:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(async (request: CreateSavedPaymentMethodRequest): Promise<SavedPaymentMethod> => {
    try {
      const newMethod = await savedPaymentMethodsService.create(request);
      await fetchMethods(); // Refresh list
      return newMethod;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create saved payment method';
      console.error('[useSavedPaymentMethods] Error creating method:', err);
      throw new Error(errorMessage);
    }
  }, [fetchMethods]);

  const update = useCallback(async (
    id: string,
    request: UpdateSavedPaymentMethodRequest
  ): Promise<SavedPaymentMethod> => {
    try {
      const updatedMethod = await savedPaymentMethodsService.update(id, request);
      await fetchMethods(); // Refresh list
      return updatedMethod;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update saved payment method';
      console.error('[useSavedPaymentMethods] Error updating method:', err);
      throw new Error(errorMessage);
    }
  }, [fetchMethods]);

  const deleteMethod = useCallback(async (id: string): Promise<void> => {
    try {
      await savedPaymentMethodsService.delete(id);
      await fetchMethods(); // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete saved payment method';
      console.error('[useSavedPaymentMethods] Error deleting method:', err);
      throw new Error(errorMessage);
    }
  }, [fetchMethods]);

  const setDefault = useCallback(async (id: string): Promise<SavedPaymentMethod> => {
    try {
      const updatedMethod = await savedPaymentMethodsService.setDefault(id);
      await fetchMethods(); // Refresh list
      return updatedMethod;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default payment method';
      console.error('[useSavedPaymentMethods] Error setting default:', err);
      throw new Error(errorMessage);
    }
  }, [fetchMethods]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  return {
    methods,
    isLoading,
    error,
    refresh: fetchMethods,
    create,
    update,
    delete: deleteMethod,
    setDefault,
  };
}
