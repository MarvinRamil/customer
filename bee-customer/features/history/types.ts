/**
 * History feature-specific types
 */

/**
 * History statistics
 */
export interface HistoryStats {
  /** Total number of bookings */
  total: number;
  /** Average delivery time in minutes */
  avgTime: number;
  /** Average rating */
  rating: number;
  /** Total amount spent */
  spent: number;
}

/**
 * History filter options
 */
export type HistoryFilter = 'All' | 'Pending' | 'Completed' | 'Cancelled' | 'InProgress';

