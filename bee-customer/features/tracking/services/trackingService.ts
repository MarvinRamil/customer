import { apiClient } from '@/shared/services/apiClient';
import type { TrackingData } from '../types';

/**
 * Tracking service
 * Handles API calls for tracking booking deliveries
 */
class TrackingService {
  /**
   * Get tracking data for a booking
   * @param bookingId - Booking ID to track
   * @returns Promise resolving to TrackingData
   * @throws Error if tracking data cannot be fetched
   */
  async getTrackingData(bookingId: string): Promise<TrackingData> {
    try {
      // Get booking details with coordinates
      const bookingResponse = await apiClient.get<any>(`/api/bookings/${bookingId}`, {
        requiresAuth: true,
      });

      if (!bookingResponse.success || !bookingResponse.data) {
        throw new Error('Failed to fetch booking details');
      }

      const booking = bookingResponse.data;

      // Driver from booking only (dispatch obsolete — use selectedDriverId)
      const driverId = booking?.selectedDriverId ?? booking?.SelectedDriverId ?? null;
      const vehicleType = booking?.vehicleType ?? booking?.truckType ?? booking?.TruckType ?? 'Vehicle';
      const driver: TrackingData['driver'] = driverId
        ? { name: 'Driver', vehicle: vehicleType, licensePlate: 'N/A' }
        : null;
      const driverLocation = null; // Real-time location comes via SignalR

      // Map booking status to tracking status
      const statusMap: Record<string, string> = {
        'Pending': 'Booking Confirmed',
        'Assigned': 'Driver Assigned',
        'Dispatched': 'Driver Assigned',
        'InProgress': 'Out for Delivery',
        'Completed': 'Delivered',
        'Cancelled': 'Cancelled',
      };

      const trackingStatus = statusMap[booking.status] || booking.status;

      // Build tracking steps based on booking status
      const steps = [
        { 
          label: "Booking Confirmed", 
          completed: true, 
          time: new Date(booking.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) 
        },
      ];

      const driverAssignedAt = booking?.driverAssignedAt ?? booking?.DriverAssignedAt;

      if (booking.status !== 'Pending') {
        steps.push({ 
          label: "Driver Assigned", 
          completed: true, 
          time: driverAssignedAt ? new Date(driverAssignedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-' 
        });
      }

      if (booking.status === 'InProgress' || booking.status === 'Completed') {
        steps.push({ 
          label: "Pickup Completed", 
          completed: true, 
          time: booking?.updatedAt ? new Date(booking.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-' 
        });
        steps.push({ 
          label: "Out for Delivery", 
          completed: true, 
          time: booking?.updatedAt ? new Date(booking.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-' 
        });
      }

      if (booking.status === 'Completed') {
        steps.push({ 
          label: "Delivered", 
          completed: true, 
          time: booking?.updatedAt ? new Date(booking.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-' 
        });
      } else {
        steps.push({ 
          label: "Delivered", 
          completed: false, 
          time: "-" 
        });
      }

      // Use booking coordinates
      const pickupLocation = booking.pickupLatitude && booking.pickupLongitude
        ? {
            latitude: Number(booking.pickupLatitude),
            longitude: Number(booking.pickupLongitude),
          }
        : null;

      const dropoffLocation = booking.dropoffLatitude && booking.dropoffLongitude
        ? {
            latitude: Number(booking.dropoffLatitude),
            longitude: Number(booking.dropoffLongitude),
          }
        : null;

      // Calculate estimated arrival (rough estimate: 30 minutes if in progress)
      const estimatedArrival = booking.status === 'InProgress' && dropoffLocation && driverLocation
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
        : booking.scheduleDate
        ? new Date(booking.scheduleDate).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();

      return {
        bookingId,
        status: trackingStatus,
        isLive: !!driverId && (booking.status === 'InProgress' || booking.status === 'Assigned' || booking.status === 'Dispatched'),
        pickupLocation: pickupLocation || null,
        dropoffLocation: dropoffLocation || null,
        driverLocation: driverLocation || null,
        driver: driver || null,
        estimatedArrival,
        steps,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tracking data';
      throw new Error(errorMessage);
    }
  }

  /**
   * Subscribe to real-time tracking updates
   * @param bookingId - Booking ID to track
   * @param onUpdate - Callback function called when tracking data updates
   * @returns Function to unsubscribe
   */
  subscribeToTracking(
    bookingId: string,
    onUpdate: (data: TrackingData) => void
  ): () => void {
    // TODO: Implement WebSocket or polling for real-time updates
    // For now, return a no-op unsubscribe function
    return () => {
      // Unsubscribe logic here
    };
  }
}

export const trackingService = new TrackingService();

