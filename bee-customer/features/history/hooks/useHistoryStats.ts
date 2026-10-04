import { useMemo } from 'react';
import type { Booking } from '@/shared/types/booking';
import type { HistoryStats } from '../types';

/**
 * Calculate average time from bookings (mock calculation)
 * TODO: Replace with actual API calculation when available
 */
const calculateAvgTime = (bookings: Booking[]): number => {
  // Mock calculation - in real app, this would come from API
  return 35;
};

/**
 * Calculate total spent from completed bookings using real finalFare
 */
const calculateTotalSpent = (bookings: Booking[]): number => {
  return bookings
    .filter((b) => b.status === 'Completed')
    .reduce((sum, b) => sum + (b.finalFare ?? 0), 0);
};

/**
 * Custom hook for calculating history statistics
 * @param bookings - Array of all bookings
 * @returns HistoryStats object with calculated statistics
 */
export function useHistoryStats(bookings: Booking[]): HistoryStats {
  return useMemo(() => {
    const total = bookings.length;
    const avgTime = calculateAvgTime(bookings);
    const rating = 4.9; // Mock rating - TODO: Get from API
    const spent = calculateTotalSpent(bookings);

    return { total, avgTime, rating, spent };
  }, [bookings]);
}

