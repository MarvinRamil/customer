import { useCallback, useEffect, useState } from 'react';
import { supportService } from '../services/supportService';
import type { SupportTicket, CreateTicketRequest } from '../types';

interface UseSupportReturn {
    /** Current user's support tickets */
    tickets: SupportTicket[];
    /** Loading state */
    isLoading: boolean;
    /** Error message */
    error: string | null;
    /** Create a new support ticket */
    createTicket: (data: CreateTicketRequest) => Promise<SupportTicket>;
    /** Refresh tickets list */
    refreshTickets: () => Promise<void>;
}

/**
 * Hook for managing support tickets in the customers app.
 * Fetches the user's tickets on mount and provides a create function.
 */
export function useSupport(): UseSupportReturn {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTickets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await supportService.getMyTickets();
            setTickets(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch tickets';
            setError(message);
            console.error('Error fetching tickets:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createTicket = useCallback(async (data: CreateTicketRequest): Promise<SupportTicket> => {
        try {
            const ticket = await supportService.createTicket(data);
            // Refresh tickets list after creation
            await fetchTickets();
            return ticket;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create ticket';
            setError(message);
            throw err;
        }
    }, [fetchTickets]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    return {
        tickets,
        isLoading,
        error,
        createTicket,
        refreshTickets: fetchTickets,
    };
}
