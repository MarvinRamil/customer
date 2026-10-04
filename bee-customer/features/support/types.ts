/**
 * Support feature types for the Customers App.
 * Mirrors the backend CRM module's DTOs for type safety.
 */

/**
 * Support ticket returned from the API.
 */
export interface SupportTicket {
    id: string;
    ticketNumber: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    createdAt: Date;
    updatedAt: Date | null;
    resolvedAt: Date | null;
    resolution: string | null;
    zammadTicketId: number | null;
    userType: string;
}

/**
 * Ticket category — must match backend TicketCategory enum.
 */
export type TicketCategory = 'General' | 'Booking' | 'Payment' | 'Delivery' | 'Complaint' | 'Feedback';

/**
 * Ticket priority — must match backend TicketPriority enum.
 */
export type TicketPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

/**
 * Ticket status — must match backend TicketStatus enum.
 */
export type TicketStatus = 'Open' | 'InProgress' | 'WaitingCustomer' | 'Resolved' | 'Closed';

/**
 * Request payload for creating a new support ticket.
 */
export interface CreateTicketRequest {
    customerProfileId: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    bookingId?: string;
    userType?: string;
}
