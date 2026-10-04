import { apiClient } from '@/shared/services/apiClient';
import type {
    SupportTicket,
    CreateTicketRequest,
} from '../types';

/**
 * Service for managing support tickets.
 * Communicates with the backend CRM module which syncs tickets to Zammad.
 */
class SupportService {
    /**
     * Parse date string to Date object safely.
     */
    private parseDate(dateString: string | null | undefined): Date | null {
        if (!dateString) {
            return null;
        }

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return null;
            }
            return date;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the current user's support tickets.
     * GET /api/tickets/my
     */
    async getMyTickets(): Promise<SupportTicket[]> {
        try {
            const response = await apiClient.get<{ data: { items: any[] } }>('/api/tickets/my', {
                requiresAuth: true,
            });

            if (!response.success || !response.data) {
                return [];
            }

            // Handle both { data: { items: [] } } and { data: [] } formats
            const data = response.data.data || response.data;
            const items = Array.isArray((data as any).items)
                ? (data as any).items
                : Array.isArray(data)
                    ? data
                    : [];

            return items.map((ticket: any) => ({
                id: ticket.id,
                ticketNumber: ticket.ticketNumber || `TKT-${ticket.id.slice(0, 8)}`,
                subject: ticket.subject || '',
                description: ticket.description || '',
                category: ticket.category || 'General',
                priority: ticket.priority || 'Normal',
                status: ticket.status || 'Open',
                createdAt: this.parseDate(ticket.createdAt) || new Date(),
                updatedAt: this.parseDate(ticket.updatedAt),
                resolvedAt: this.parseDate(ticket.resolvedAt),
                resolution: ticket.resolution ?? null,
                zammadTicketId: ticket.zammadTicketId ?? null,
                userType: ticket.userType || 'customer',
            }));
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
            throw new Error(
                `Failed to fetch tickets: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Create a new support ticket.
     * POST /api/tickets
     *
     * The backend will save it locally AND forward it to Zammad.
     */
    async createTicket(data: CreateTicketRequest): Promise<SupportTicket> {
        try {
            const response = await apiClient.post<SupportTicket>('/api/tickets', {
                requiresAuth: true,
                body: {
                    ...data,
                    userType: 'customer', // Always 'customer' from this app
                },
            });

            if (!response.success || !response.data) {
                throw new Error('Failed to create ticket');
            }

            const ticket = response.data;
            return {
                ...ticket,
                createdAt: this.parseDate(ticket.createdAt as any) || new Date(),
                updatedAt: this.parseDate(ticket.updatedAt as any),
                resolvedAt: this.parseDate(ticket.resolvedAt as any),
            };
        } catch (error) {
            console.error('Failed to create ticket:', error);
            throw new Error(
                `Failed to create ticket: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Get a specific ticket by ID.
     * GET /api/tickets/{id}
     */
    async getTicket(ticketId: string): Promise<SupportTicket | null> {
        try {
            const response = await apiClient.get<SupportTicket>(`/api/tickets/${ticketId}`, {
                requiresAuth: true,
            });

            if (!response.success || !response.data) {
                return null;
            }

            const ticket = response.data;
            return {
                ...ticket,
                createdAt: this.parseDate(ticket.createdAt as any) || new Date(),
                updatedAt: this.parseDate(ticket.updatedAt as any),
                resolvedAt: this.parseDate(ticket.resolvedAt as any),
            };
        } catch (error) {
            console.error('Failed to fetch ticket:', error);
            return null;
        }
    }
}

export const supportService = new SupportService();
