import { apiClient } from '@/shared/services/apiClient';
import { tokenStorage } from '@/shared/services/tokenStorage';
import type {
  AssignmentStatus,
  Booking,
  BookingStats,
  BookingStatus,
  CancellationReason,
  MyBookingsResponse,
  TruckType,
} from '@/shared/types/booking';
import type {
  CalculateFareRequest,
  CreateBookingRequest,
  CreateMultiStopBookingItemImage,
  CreateMultiStopBookingRequest,
  PricingResult,
  UpdateBookingRequest,
  VehiclePricing
} from '../types';

/**
 * Booking service for managing booking-related API calls
 * Handles all booking CRUD operations and statistics
 */
class BookingService {
  /**
   * Parse date string from API response to Date object
   * Handles ISO 8601 date strings and null values
   * Validates date and handles parsing errors gracefully
   * @param dateString - Date string from API or null
   * @param fallback - Fallback date if parsing fails (default: current date)
   * @returns Date object or null
   */
  private parseDate(
    dateString: string | null | undefined,
    fallback?: Date
  ): Date | null {
    if (!dateString) {
      return fallback || null;
    }

    try {
      const date = new Date(dateString);

      // Validate date is valid (not Invalid Date)
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string received:', dateString);
        return fallback || null;
      }

      return date;
    } catch (error) {
      console.error('Failed to parse date:', dateString, error);
      return fallback || null;
    }
  }

  /**
   * Validate and sanitize booking data from API
   * Ensures required fields are present and handles edge cases
   * @param apiBooking - Booking object from API response
   * @returns Booking object with proper types and validated data
   */
  private mapApiBookingToBooking(apiBooking: any): Booking {
    // Unwrap API envelope if present (e.g. { data: { id, ... }, success, message, errors })
    if (
      apiBooking &&
      typeof apiBooking === 'object' &&
      'data' in apiBooking &&
      apiBooking.data &&
      typeof apiBooking.data === 'object' &&
      apiBooking.data.id
    ) {
      apiBooking = apiBooking.data;
    }

    // Validate required fields
    if (!apiBooking || !apiBooking.id) {
      console.error('Invalid booking data received:', apiBooking);
      throw new Error('Invalid booking data: missing required fields');
    }

    // Validate and parse dates with fallbacks
    const scheduleDate = this.parseDate(apiBooking.scheduleDate, new Date());
    const createdAt = this.parseDate(apiBooking.createdAt, new Date());

    // Validate status: accept API value from status, Status, or bookingStatus; match case-insensitively
    const validStatuses: BookingStatus[] = [
      'Pending',
      'Assigned',
      'Broadcasting',
      'Confirmed',
      'DriverAssigned',
      'Dispatched',
      'PickedUp',
      'InProgress',
      'Arrived',
      'InTransit',
      'Completed',
      'Cancelled',
    ];
    const rawStatus =
      apiBooking.status ?? apiBooking.Status ?? apiBooking.bookingStatus;
    const statusStr =
      typeof rawStatus === 'string' ? rawStatus.trim() : '';
    const status = statusStr
      ? (validStatuses.find(
        (s) => s.toLowerCase() === statusStr.toLowerCase()
      ) ?? (() => {
        console.warn(
          '[BookingService] Unknown booking status from API, defaulting to Pending:',
          { raw: rawStatus, bookingId: apiBooking.id }
        );
        return 'Pending';
      })())
      : 'Pending';

    // Validate assignment status
    const validAssignmentStatuses = [
      'Unassigned',
      'PendingAssignment',
      'Assigned',
      'AssignedToOperator',
      'Broadcasting',
      'BroadcastingToDrivers',
      'AcceptedByDriver',
      'RejectedByAllDrivers',
    ];
    const assignmentStatus = validAssignmentStatuses.includes(
      apiBooking.assignmentStatus
    )
      ? apiBooking.assignmentStatus
      : 'Unassigned';

    // Validate truck type (handle both formats)
    const truckType = apiBooking.truckType || 'Medium';

    // Validate and sanitize numeric fields
    const weightKg =
      apiBooking.weightKg !== null && apiBooking.weightKg !== undefined
        ? Number(apiBooking.weightKg)
        : null;
    const pickupLatitude =
      apiBooking.pickupLatitude !== null &&
        apiBooking.pickupLatitude !== undefined
        ? Number(apiBooking.pickupLatitude)
        : null;
    const pickupLongitude =
      apiBooking.pickupLongitude !== null &&
        apiBooking.pickupLongitude !== undefined
        ? Number(apiBooking.pickupLongitude)
        : null;
    const dropoffLatitude =
      apiBooking.dropoffLatitude !== null &&
        apiBooking.dropoffLatitude !== undefined
        ? Number(apiBooking.dropoffLatitude)
        : null;
    const dropoffLongitude =
      apiBooking.dropoffLongitude !== null &&
        apiBooking.dropoffLongitude !== undefined
        ? Number(apiBooking.dropoffLongitude)
        : null;

    // Validate GPS coordinates are valid if both are present
    const isValidPickupCoords =
      pickupLatitude !== null &&
      pickupLongitude !== null &&
      !isNaN(pickupLatitude) &&
      !isNaN(pickupLongitude) &&
      pickupLatitude >= -90 &&
      pickupLatitude <= 90 &&
      pickupLongitude >= -180 &&
      pickupLongitude <= 180;

    const isValidDropoffCoords =
      dropoffLatitude !== null &&
      dropoffLongitude !== null &&
      !isNaN(dropoffLatitude) &&
      !isNaN(dropoffLongitude) &&
      dropoffLatitude >= -90 &&
      dropoffLatitude <= 90 &&
      dropoffLongitude >= -180 &&
      dropoffLongitude <= 180;

    // Warn if coordinates are invalid
    if (
      (pickupLatitude !== null || pickupLongitude !== null) &&
      !isValidPickupCoords
    ) {
      console.warn('Invalid pickup GPS coordinates:', {
        latitude: pickupLatitude,
        longitude: pickupLongitude,
      });
    }

    if (
      (dropoffLatitude !== null || dropoffLongitude !== null) &&
      !isValidDropoffCoords
    ) {
      console.warn('Invalid dropoff GPS coordinates:', {
        latitude: dropoffLatitude,
        longitude: dropoffLongitude,
      });
    }

    // Map driver fields from Booking DTO (PascalCase from API)
    const rawSelectedDriverId =
      apiBooking.selectedDriverId ?? apiBooking.SelectedDriverId ?? null;
    const selectedDriverId =
      rawSelectedDriverId == null
        ? null
        : typeof rawSelectedDriverId === 'string'
          ? rawSelectedDriverId.trim() || null
          : typeof rawSelectedDriverId === 'object' && rawSelectedDriverId !== null && 'value' in rawSelectedDriverId
            ? String((rawSelectedDriverId as { value?: string }).value ?? '').trim() || null
            : String(rawSelectedDriverId).trim() || null;

    const driverAssignedAt = this.parseDate(
      apiBooking.driverAssignedAt ?? apiBooking.DriverAssignedAt ?? null
    );

    return {
      id: apiBooking.id,
      bookingNumber: apiBooking.bookingNumber || `BK-${apiBooking.id.slice(0, 8)}`,
      customerId: apiBooking.customerId || '',
      pickupLocation: apiBooking.pickupLocation || '',
      dropoffLocation: apiBooking.dropoffLocation || '',
      truckType: truckType as TruckType,
      cargoDescription: apiBooking.cargoDescription || '',
      scheduleDate: scheduleDate!,
      status: status as BookingStatus,
      notes: apiBooking.notes ?? null,
      createdAt: createdAt!,
      updatedAt: this.parseDate(apiBooking.updatedAt),
      size: apiBooking.size ?? null,
      assignmentStatus: assignmentStatus as AssignmentStatus,
      assignedToTenantId: apiBooking.assignedToTenantId ?? null,
      assignedByUserId: apiBooking.assignedByUserId ?? null,
      assignedAt: this.parseDate(apiBooking.assignedAt),
      beeTenantId: apiBooking.beeTenantId ?? null,
      weightKg: weightKg !== null && !isNaN(weightKg) ? weightKg : null,
      pickupLatitude: isValidPickupCoords ? pickupLatitude : null,
      pickupLongitude: isValidPickupCoords ? pickupLongitude : null,
      dropoffLatitude: isValidDropoffCoords ? dropoffLatitude : null,
      dropoffLongitude: isValidDropoffCoords ? dropoffLongitude : null,
      selectedDriverId,
      driverName: (apiBooking.driverName ?? apiBooking.DriverName ?? null)?.trim() ?? null,
      driverPhone: (apiBooking.driverPhone ?? apiBooking.DriverPhone ?? null)?.trim() ?? null,
      driverAssignedAt,
      driverVehicle: (apiBooking.driverVehicle ?? apiBooking.DriverVehicle ?? null)?.trim() ?? null,
      driverPlate: (apiBooking.driverPlate ?? apiBooking.DriverPlate ?? null)?.trim() ?? null,
      driverVehicleColor: (apiBooking.driverVehicleColor ?? apiBooking.DriverVehicleColor ?? null)?.trim() ?? null,
      driverVehicleModel: (apiBooking.driverVehicleModel ?? apiBooking.DriverVehicleModel ?? null)?.trim() ?? null,
      driverImageUrl: (apiBooking.driverImageUrl ?? apiBooking.DriverImageUrl ?? null)?.trim() ?? null,
      // Map fare fields
      estimatedFare: apiBooking.estimatedFare != null ? Number(apiBooking.estimatedFare) : null,
      finalFare: apiBooking.finalFare != null ? Number(apiBooking.finalFare) : null,
      serviceType: apiBooking.serviceType ?? undefined,
      deliveryMode: apiBooking.deliveryMode ?? 'Regular',
      // Map stops array if present
      cancellationReason: apiBooking.cancellationReason ?? null,
      cancelledBy: apiBooking.cancelledBy ?? null,
      cancelledAt: this.parseDate(apiBooking.cancelledAt),
      stops: Array.isArray(apiBooking.stops)
        ? apiBooking.stops.map((stop: any) => ({
          id: stop.id || '',
          sequence: typeof stop.sequence === 'number' ? stop.sequence : 0,
          address: stop.address || '',
          type: (stop.type === 'Pickup' || stop.type === 'Dropoff') ? stop.type : 'Pickup',
          status: (['Pending', 'InProgress', 'Completed', 'Arrived', 'Cancelled', 'InTransit'].includes(stop.status))
            ? stop.status
            : 'Pending' as const,
          arrivedAt: this.parseDate(stop.arrivedAt),
          completedAt: this.parseDate(stop.completedAt),
          latitude: typeof stop.latitude === 'number' ? stop.latitude : 0,
          longitude: typeof stop.longitude === 'number' ? stop.longitude : 0,
          contactName: stop.contactName?.trim() ?? null,
          contactPhone: stop.contactPhone?.trim() ?? null,
          notes: stop.notes?.trim() ?? null,
        }))
        : undefined,
      proofOfDeliveries: (() => {
        const raw = apiBooking.proofOfDeliveries ?? apiBooking.ProofOfDeliveries ?? null;
        if (!Array.isArray(raw)) return raw ?? undefined;
        return raw.map((pod: any) => ({
          id: pod.id ?? '',
          bookingId: pod.bookingId ?? pod.BookingId ?? '',
          stopId: pod.stopId ?? pod.StopId ?? '',
          imagePath: pod.imagePath ?? pod.ImagePath ?? null,
          signaturePath: pod.signaturePath ?? pod.SignaturePath ?? null,
          deliveredAt: typeof pod.deliveredAt === 'string' ? pod.deliveredAt : (pod.DeliveredAt ?? ''),
          recipientName: pod.recipientName ?? pod.RecipientName ?? null,
          notes: pod.notes ?? pod.Notes ?? null,
        }));
      })(),
      // Legacy fields for backward compatibility
      description: apiBooking.cargoDescription || apiBooking.description,
      weight: weightKg ?? apiBooking.weight,
    };
  }

  /**
   * Get all bookings for the authenticated user with retry logic
   * Uses /api/bookings/my-bookings endpoint which automatically filters by user email from JWT token
   * @param retryCount - Number of retry attempts (default: 0, max: 2)
   * @returns Promise resolving to array of bookings for the current user
   */
  async getBookings(retryCount: number = 0): Promise<Booking[]> {
    const MAX_RETRIES = 2;

    try {
      // Call my-bookings endpoint (requires authentication)
      // API returns { success: boolean, data: Booking[] }
      const response = await apiClient.get<MyBookingsResponse>(
        '/api/bookings/my-bookings',
        {
          requiresAuth: true, // Ensure authentication is required
        }
      );

      // Check if request was successful
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch bookings');
      }

      // Extract bookings array from response data
      // API returns: { success: true, data: Booking[] }
      // apiClient wraps it as: { success: true, data: { success: true, data: Booking[] }, statusCode: 200 }
      const responseData = response.data;

      // Handle nested response structure from API
      let apiBookings: any[] = [];

      if (responseData && typeof responseData === 'object') {
        // Check if responseData has a 'data' property containing the array (API response structure)
        if ('data' in responseData && Array.isArray((responseData as any).data)) {
          apiBookings = (responseData as any).data;
        } else if (Array.isArray(responseData)) {
          // If responseData is directly an array (shouldn't happen but handle it)
          apiBookings = responseData;
        }
      }

      // Handle empty bookings list (not an error - user simply has no bookings)
      if (apiBookings.length === 0) {
        return [];
      }

      // Map API response bookings to Booking type with proper date conversion
      // Filter out any invalid bookings that fail mapping
      const validBookings: Booking[] = [];
      for (const booking of apiBookings) {
        try {
          const mappedBooking = this.mapApiBookingToBooking(booking);
          validBookings.push(mappedBooking);
        } catch (mappingError) {
          console.error('Failed to map booking:', booking, mappingError);
          // Continue with other bookings even if one fails
        }
      }

      return validBookings;
    } catch (error) {
      // Handle 401 Unauthorized errors
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 401
      ) {
        const errorMessage =
          typeof error === 'object' && 'message' in error
            ? String(error.message)
            : 'Unauthorized';

        // Check for specific error messages
        if (
          errorMessage.includes('User email not found in token') ||
          errorMessage === 'User email not found in token'
        ) {
          // Clear tokens and throw user-friendly error
          await tokenStorage.clearAllTokens();
          throw new Error('Authentication error. Please login again.');
        }

        // Generic 401 error - don't retry authentication errors
        await tokenStorage.clearAllTokens();
        throw new Error('Your session has expired. Please login again.');
      }

      // Handle network errors with retry logic
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError =
        errorMessage.includes('Network error') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('NetworkError');

      if (isNetworkError && retryCount < MAX_RETRIES) {
        // Retry after a short delay (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log(`Retrying booking fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        return this.getBookings(retryCount + 1);
      }

      // Handle other errors or max retries reached
      throw new Error(
        `Failed to fetch bookings: ${errorMessage}`
      );
    }
  }

  /**
   * Get a single booking by ID
   * @param id - Booking ID
   * @returns Promise resolving to booking data
   */
  async getBookingById(id: string): Promise<Booking> {
    try {
      const response = await apiClient.get<any>(`/api/bookings/${id}`, {
        requiresAuth: true,
      });
      if (response.success && response.data) {
        // Handle nested response structure (some APIs wrap data in another data property)
        let apiBooking = response.data;
        if (apiBooking && typeof apiBooking === 'object' && 'data' in apiBooking && apiBooking.data) {
          apiBooking = apiBooking.data;
        }

        // Debug logging to see what the API returns
        console.log('[BookingService] getBookingById API response:', {
          hasPickupLocation: !!apiBooking.pickupLocation,
          hasDropoffLocation: !!apiBooking.dropoffLocation,
          pickupLocation: apiBooking.pickupLocation,
          dropoffLocation: apiBooking.dropoffLocation,
          bookingId: apiBooking.id,
        });

        // Map API response to Booking type using the same mapping logic
        const mappedBooking = this.mapApiBookingToBooking(apiBooking);

        console.log('[BookingService] Mapped booking:', {
          hasPickupLocation: !!mappedBooking.pickupLocation,
          hasDropoffLocation: !!mappedBooking.dropoffLocation,
          pickupLocation: mappedBooking.pickupLocation,
          dropoffLocation: mappedBooking.dropoffLocation,
        });

        return mappedBooking;
      }
      throw new Error('Booking not found');
    } catch (error) {
      throw new Error(
        `Failed to fetch booking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a new booking
   * @param bookingData - Booking creation data
   * @returns Promise resolving to created booking
   */
  /**
   * Create a new booking
   * POST /api/bookings
   * Matches API documentation format
   * @param bookingData - Booking creation data matching API format
   * @param itemImage - Optional image file to upload
   * @returns Promise resolving to created booking
   * @throws Error with validation messages if validation fails
   */
  async createBooking(
    bookingData: CreateBookingRequest,
    itemImage?: { uri: string; type?: string; name?: string }
  ): Promise<Booking> {
    try {
      // If image is provided, use FormData; otherwise use JSON
      let body: FormData | CreateBookingRequest;
      let headers: Record<string, string> | undefined;

      if (itemImage) {
        // Create FormData for multipart/form-data upload
        const formData = new FormData();

        // Add all booking fields as form data
        formData.append('pickupLocation', bookingData.pickupLocation);
        formData.append('dropoffLocation', bookingData.dropoffLocation);
        formData.append('truckType', bookingData.truckType);
        formData.append('scheduleDate', bookingData.scheduleDate);

        if (bookingData.cargoDescription) {
          formData.append('cargoDescription', bookingData.cargoDescription);
        }
        if (bookingData.notes) {
          formData.append('notes', bookingData.notes);
        }
        if (bookingData.weightKg !== undefined) {
          formData.append('weightKg', bookingData.weightKg.toString());
        }
        if (bookingData.pickupLatitude !== undefined) {
          formData.append('pickupLatitude', bookingData.pickupLatitude.toString());
        }
        if (bookingData.pickupLongitude !== undefined) {
          formData.append('pickupLongitude', bookingData.pickupLongitude.toString());
        }
        if (bookingData.dropoffLatitude !== undefined) {
          formData.append('dropoffLatitude', bookingData.dropoffLatitude.toString());
        }
        if (bookingData.dropoffLongitude !== undefined) {
          formData.append('dropoffLongitude', bookingData.dropoffLongitude.toString());
        }
        if (bookingData.customerId) {
          formData.append('customerId', bookingData.customerId);
        }

        // Add image file
        // For React Native, we need to create a file object
        const imageFile = {
          uri: itemImage.uri,
          type: itemImage.type || 'image/jpeg',
          name: itemImage.name || 'item-image.jpg',
        } as any;
        formData.append('itemImage', imageFile);

        body = formData;
      } else {
        // No image, use JSON
        body = bookingData;
      }

      const response = await apiClient.post<Booking>('api/bookings', {
        body,
        headers,
      });

      if (response.success && response.data) {
        return response.data;
      }

      // Handle API error response format
      // API returns: { success: false, message: "...", errors: [...] }
      const errorMessage = response.message || 'Failed to create booking';
      throw new Error(errorMessage);
    } catch (error: unknown) {
      // Handle ApiError from apiClient which may contain validation errors
      if (error && typeof error === 'object' && 'details' in error) {
        const apiError = error as { message: string; details?: any; status?: number };

        // Check if details contains errors array (validation errors)
        if (apiError.details && typeof apiError.details === 'object') {
          const details = apiError.details as { errors?: string[]; message?: string };

          if (details.errors && Array.isArray(details.errors) && details.errors.length > 0) {
            // Combine validation errors into a readable message
            const validationErrors = details.errors.join('\n');
            throw new Error(`${apiError.message || 'Validation failed'}\n\n${validationErrors}`);
          }

          // Use message from details if available
          if (details.message) {
            throw new Error(details.message);
          }
        }
      }

      // Re-throw with improved error message
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        `Failed to create booking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get available vehicle types and pricing (for booking dropdown)
   * GET /api/vehicle-pricing
   * No auth required (AllowAnonymous). Call when booking page loads so vehicle selection reflects backend.
   * @returns Promise resolving to array of vehicle pricings (vehicleType, types, baseFare, etc.)
   */
  async getVehiclePricing(): Promise<VehiclePricing[]> {
    try {
      const response = await apiClient.get<VehiclePricing[] | { success: boolean; data: VehiclePricing[] }>(
        '/api/vehicle-pricing',
        { requiresAuth: false }
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch vehicle pricing');
      }

      // Unwrap nested API response if present (e.g. { success, data: VehiclePricing[] })
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: VehiclePricing[] }).data))
          ? (data as { data: VehiclePricing[] }).data
          : [];

      return list;
    } catch (error: unknown) {
      throw new Error(
        `Failed to fetch vehicle pricing: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate estimated fare for a route (multi-stop)
   * POST /api/bookings/calculate-fare
   * Call once with all stops (1 pickup + 0–19 dropoffs) to get total fare for the route
   * @param payload - Vehicle type, stops, optional weightKg, priorityFee, scheduledDateTime
   * @returns Promise resolving to pricing result (totalFare, distanceKm, breakdown, etc.)
   */
  async calculateFare(payload: CalculateFareRequest): Promise<PricingResult> {
    try {
      const response = await apiClient.post<PricingResult | { success: boolean; data: PricingResult }>(
        '/api/bookings/calculate-fare',
        {
          body: payload,
          requiresAuth: true,
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to calculate fare');
      }

      // Unwrap nested API response if present (e.g. { success, data: { totalFare, ... } })
      const data = response.data;
      const pricing =
        data && typeof data === 'object' && 'data' in data && (data as { data: PricingResult }).data
          ? (data as { data: PricingResult }).data
          : (data as PricingResult);

      if (typeof pricing.totalFare !== 'number') {
        throw new Error('Invalid calculate-fare response: missing totalFare');
      }

      return pricing;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'details' in error) {
        const apiError = error as { message: string; details?: { errors?: string[] } };
        if (apiError.details?.errors?.length) {
          throw new Error(apiError.details.errors.join('\n'));
        }
      }
      throw new Error(
        `Failed to calculate fare: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload item image for a booking.
   * POST /api/bookings/upload-item-image (multipart/form-data)
   * Backend should return the stored path/URL to send as itemImagePath when creating the booking.
   * @param itemImage - Image from picker/camera: { uri, type?, name? }
   * @returns Promise resolving to the stored item image path (for itemImagePath in create payload)
   * @throws Error if upload fails or endpoint is not available
   */
  async uploadBookingItemImage(itemImage: {
    uri: string;
    type?: string;
    name?: string;
  }): Promise<string> {
    const formData = new FormData();
    const file = {
      uri: itemImage.uri,
      type: itemImage.type || 'image/jpeg',
      name: itemImage.name || `item-image-${Date.now()}.jpg`,
    } as any;
    formData.append('itemImage', file);

    const response = await apiClient.post<{ itemImagePath?: string; data?: { itemImagePath?: string } }>(
      '/api/bookings/upload-item-image',
      {
        body: formData,
        requiresAuth: true,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to upload item image');
    }

    const data = response.data;
    const path =
      (data && typeof data === 'object' && 'data' in data && (data as { data?: { itemImagePath?: string } }).data?.itemImagePath) ||
      (data && typeof data === 'object' && 'itemImagePath' in data && (data as { itemImagePath?: string }).itemImagePath);

    if (typeof path !== 'string' || !path.trim()) {
      throw new Error('Upload response missing itemImagePath');
    }
    return path.trim();
  }

  /**
   * Build JSON body for POST /api/bookings.
   * Uses customerId from payload or "00000000-0000-0000-0000-000000000000" for logged-in user.
   * @param omitItemImagePath - When true (e.g. multipart with file), do not include itemImagePath
   */
  private buildLalamovePayload(payload: CreateMultiStopBookingRequest, omitItemImagePath?: boolean): Record<string, unknown> {
    const {
      vehicleType,
      cargoDescription,
      scheduleDate,
      serviceType,
      stops,
      estimatedFare,
      customerId,
      weightKg,
      priorityFee,
      scheduledDateTime,
      scheduledPickupWindow,
      favouriteDriverId,
      itemImagePath,
      itemLengthCm,
      itemWidthCm,
      itemHeightCm,
      notes,
      paymentMethod,
      deliveryMode,
    } = payload;

    const body: Record<string, unknown> = {
      customerId: customerId || '00000000-0000-0000-0000-000000000000',
      vehicleType,
      cargoDescription,
      scheduleDate,
      serviceType,
      stops,
      estimatedFare,
    };
    if (weightKg != null) body.weightKg = weightKg;
    if (priorityFee != null) body.priorityFee = priorityFee;
    if (scheduledDateTime != null) body.scheduledDateTime = scheduledDateTime;
    if (scheduledPickupWindow != null) body.scheduledPickupWindow = scheduledPickupWindow;
    if (favouriteDriverId != null) body.favouriteDriverId = favouriteDriverId;
    if (!omitItemImagePath && itemImagePath != null) body.itemImagePath = itemImagePath;
    if (itemLengthCm != null) body.itemLengthCm = itemLengthCm;
    if (itemWidthCm != null) body.itemWidthCm = itemWidthCm;
    if (itemHeightCm != null) body.itemHeightCm = itemHeightCm;
    if (notes != null) body.notes = notes;
    if (paymentMethod != null) body.paymentMethod = paymentMethod;
    if (deliveryMode != null) body.deliveryMode = deliveryMode;
    return body;
  }

  /**
   * Create a booking with multi-stop route
   * POST /api/bookings
   * Supports JSON only or multipart/form-data with item image.
   * Uses same stops and estimatedFare from calculate-fare; backend returns legacy BookingDto.
   * @param payload - Vehicle type, stops, estimatedFare, cargoDescription, scheduleDate, serviceType, etc.
   * @param options - Optional item image for multipart create (omit itemImagePath in payload when using)
   * @returns Promise resolving to created booking (mapped from legacy DTO)
   */
  async createMultiStopBooking(
    payload: CreateMultiStopBookingRequest,
    options?: { itemImage?: CreateMultiStopBookingItemImage }
  ): Promise<Booking> {
    try {
      const useMultipart = options?.itemImage?.uri != null && options.itemImage.uri.trim() !== '';
      const jsonBody = this.buildLalamovePayload(payload, useMultipart);

      if (__DEV__ || process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
        console.log('[Booking API] createMultiStopBooking', useMultipart ? 'multipart' : 'JSON', JSON.stringify(jsonBody, null, 2));
      }

      let response: { success: boolean; data?: any; message?: string };

      if (useMultipart) {
        const formData = new FormData();
        formData.append('payload', JSON.stringify(jsonBody));
        const file = {
          uri: options!.itemImage!.uri,
          type: options!.itemImage!.type || 'image/jpeg',
          name: options!.itemImage!.name || `item-image-${Date.now()}.jpg`,
        } as any;
        formData.append('itemImage', file);

        response = await apiClient.post<Booking | { success: boolean; data: Booking }>(
          '/api/bookings',
          {
            body: formData,
            requiresAuth: true,
          }
        );
      } else {
        response = await apiClient.post<Booking | { success: boolean; data: Booking }>(
          '/api/bookings',
          {
            body: jsonBody,
            requiresAuth: true,
          }
        );
      }

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to create booking');
      }

      const data = response.data;
      const apiBooking =
        data && typeof data === 'object' && 'data' in data && (data as { data: any }).data
          ? (data as { data: any }).data
          : data;

      return this.mapApiBookingToBooking(apiBooking);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'message' in error) {
        const apiError = error as { message: string; status?: number; details?: { errors?: string[] } };
        if (apiError.details?.errors?.length) {
          throw Object.assign(new Error(apiError.details.errors.join('\n')), { status: apiError.status });
        }
        if (typeof apiError.message === 'string' && apiError.message.trim()) {
          throw Object.assign(new Error(apiError.message), { status: apiError.status });
        }
      }
      if (error instanceof Error && error.message.trim()) {
        throw error;
      }
      throw new Error('Something went wrong');
    }
  }

  /**
   * Update an existing booking
   * @param id - Booking ID
   * @param bookingData - Booking update data
   * @returns Promise resolving to updated booking
   */
  async updateBooking(id: string, bookingData: UpdateBookingRequest): Promise<Booking> {
    try {
      const response = await apiClient.put<Booking>(`/api/bookings/${id}`, {
        body: bookingData,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to update booking');
    } catch (error) {
      throw new Error(
        `Failed to update booking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a booking
   * @param id - Booking ID
   * @returns Promise resolving when booking is deleted
   */
  async deleteBooking(id: string): Promise<void> {
    try {
      const response = await apiClient.delete(`/api/bookings/${id}`);
      if (!response.success) {
        throw new Error('Failed to delete booking');
      }
    } catch (error) {
      throw new Error(
        `Failed to delete booking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get booking statistics
   * @returns Promise resolving to booking statistics
   */
  async getBookingStats(): Promise<BookingStats> {
    try {
      const response = await apiClient.get<BookingStats>('/api/bookings/stats');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to fetch booking stats');
    } catch (error) {
      throw new Error(
        `Failed to fetch booking stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update booking status
   * @param id - Booking ID
   * @param status - New status
   * @returns Promise resolving to updated booking
   */
  async updateBookingStatus(id: string, status: string): Promise<Booking> {
    try {
      const response = await apiClient.patch<Booking>(`/api/bookings/${id}/status`, {
        body: { status },
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to update booking status');
    } catch (error) {
      throw new Error(
        `Failed to update booking status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cancel a booking with reason
   * POST /api/bookings/{id}/cancel
   */
  async cancelBooking(bookingId: string, reason: CancellationReason, customReason?: string): Promise<Booking> {
    try {
      // Backend expects CancelBookingDto: { reason: CancellationReason, customReason?: string }
      const response = await apiClient.post<Booking>(`/api/bookings/${bookingId}/cancel`, {
        body: {
          reason,
          customReason: customReason ?? null,
        },
      });

      if (response.success && response.data) {
        return this.mapApiBookingToBooking(response.data);
      }

      throw new Error(response.message ?? 'Failed to cancel booking');
    } catch (error) {
      throw new Error(
        `Failed to cancel booking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Singleton instance of booking service
 * Use this instance throughout the application for booking operations
 */
export const bookingService = new BookingService();

