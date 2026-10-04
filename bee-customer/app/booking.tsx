import { BeeColors } from "@/constants/theme";
import { useAuth } from "@/features/auth";
import type { BookingStop, DeliveryMode, VehiclePricing } from "@/features/bookings";
import {
  bookingService,
  isFareChangedError,
  useCalculateFare,
  useCreateMultiStopBooking,
  useVehiclePricing
} from "@/features/bookings";
import {
  bookingSchema,
  getDefaultScheduledDate,
  getDefaultScheduledTime,
  PH_PHONE_REGEX,
  PHONE_VALIDATION_MESSAGE,
  type BookingFormData,
} from "@/features/bookings/schemas/validationSchemas";
import type { SavedPaymentMethod } from "@/features/payments";
import { useSavedPaymentMethods } from "@/features/payments/hooks/useSavedPaymentMethods";
import { MapViewComponent } from "@/shared/components/MapView";
import { useTheme } from "@/shared/hooks/use-theme";
import { useLocation } from "@/shared/hooks/useLocation";
import { useLocationSearch } from "@/shared/hooks/useLocationSearch";
import { usePaymentStatus } from "@/shared/hooks/usePaymentStatus";
import { mapService } from "@/shared/services/mapService";
import {
  createPayment,
  linkPaymentToBooking,
} from "@/shared/services/paymentService";
import type { LocationCoordinates } from "@/shared/types/booking";
import type { LocationWithAddress, PlacePrediction } from "@/shared/types/map";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Fallback vehicle types when GET /api/vehicle-pricing fails or returns empty */
const FALLBACK_VEHICLE_OPTIONS: VehiclePricing[] = [
  { vehicleType: "Van", types: "7-seater SUV / Small Van", baseFare: 100, sizeLimit: "210×125×120 cm", weightLimitKg: 600 },
  { vehicleType: "L300", types: "L300 / Cargo Van", baseFare: 80, sizeLimit: "240×140×130 cm", weightLimitKg: 800 },
  { vehicleType: "Pickup", types: "Pickup", baseFare: 90, sizeLimit: "180×100×80 cm", weightLimitKg: 500 },
  { vehicleType: "Sedan", types: "Hatchback/Sedan", baseFare: 60, sizeLimit: "40×30×30 cm", weightLimitKg: 20 },
  { vehicleType: "SUV", types: "Subcompact SUV / Crossover", baseFare: 70, sizeLimit: "120×80×80 cm", weightLimitKg: 200 },
];

/**
 * Maps a vehicle type (and its optional display label) to a representative MaterialCommunityIcons
 * glyph so each vehicle in the picker shows its own silhouette instead of a generic car icon.
 * Matching is keyword-based (not an exact lookup table) so it keeps working for vehicle types/labels
 * returned live from the API, not just the hardcoded fallback list above.
 */
function getVehicleIconName(
  vehicleType: string,
  label?: string
): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  const text = `${vehicleType} ${label || ""}`.toLowerCase();
  if (text.includes("pickup")) return "car-pickup";
  if (text.includes("l300") || text.includes("cargo")) return "van-utility";
  if (text.includes("van")) return "van-passenger";
  if (text.includes("motor")) return "motorbike";
  if (text.includes("truck")) return "truck";
  if (text.includes("suv") || text.includes("crossover")) return "car-estate";
  if (text.includes("sedan") || text.includes("hatchback")) return "car-hatchback";
  return "car";
}

/**
 * Booking creation screen component
 * Allows users to create new bookings by filling out a form
 * Uses bookingService to submit booking data to the API
 * Uses safe area insets to prevent content from overlapping system UI
 */
export default function BookingScreen() {
  const router = useRouter();
  const { rebookId } = useLocalSearchParams<{ rebookId?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { user } = useAuth();

  // Form state using react-hook-form with Zod validation
  const {
    control,
    handleSubmit: handleFormSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema) as any,
    mode: "onChange",
    // Step 1's dropoff.contactName/contactPhone Controllers unmount once the wizard advances
    // past wizardStep 1 (they live inside `{wizardStep === 1 && (...)}`). Without this pinned
    // explicitly, that unmount was unregistering the nested `dropoff` fields, so the final
    // submit sent a Dropoff stop with no contactName/contactPhone at all (bee-backend#85) even
    // though the user had filled them in. Flat top-level fields like pickupContactName never
    // hit this because they aren't nested under an object path.
    shouldUnregister: false,
    defaultValues: {
      pickup: "",
      pickupContactName: "",
      pickupContactPhone: "",
      pickupNotes: "",
      dropoff: {
        address: "",
        coordinates: null,
        contactName: "",
        contactPhone: "",
        notes: "",
      },
      truckType: "",
      isScheduled: false,
      scheduledDate: getDefaultScheduledDate(),
      scheduledTime: getDefaultScheduledTime(),
      scheduledPickupWindow: "",
      description: "",
      lengthCm: "",
      widthCm: "",
      heightCm: "",
      notesForDriver: "",
      weight: "",
      tipAmount: "",
      tipMessage: "",
    } as BookingFormData,
  });

  /** Wizard step (1 = Route & vehicle, 2 = Cargo details, 3 = Payment & confirm) */
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Watch form values for conditional logic and calculations
  const pickup = watch("pickup");
  const dropoff = watch("dropoff");
  const truckType = watch("truckType");
  const isScheduled = watch("isScheduled");
  const scheduledDate = watch("scheduledDate");
  const scheduledTime = watch("scheduledTime");
  const scheduledPickupWindow = watch("scheduledPickupWindow");
  const description = watch("description");
  const notesForDriver = watch("notesForDriver");
  const weight = watch("weight");
  const tipAmount = watch("tipAmount");
  const tipMessage = watch("tipMessage");
  const lengthCm = watch("lengthCm");
  const widthCm = watch("widthCm");
  const heightCm = watch("heightCm");
  const pickupContactName = watch("pickupContactName");
  const pickupContactPhone = watch("pickupContactPhone");
  const pickupNotes = watch("pickupNotes");

  // Date and time picker visibility state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  /** Additional Services (Step 1) – UI only; collapsible */
  const [additionalServicesExpanded, setAdditionalServicesExpanded] = useState(false);
  const [additionalDocumentHandling, setAdditionalDocumentHandling] = useState(false);
  const [additionalTollFees, setAdditionalTollFees] = useState(false);
  const [additionalRoundTrip, setAdditionalRoundTrip] = useState(false);

  // Non-form state (not part of validation schema)
  const [itemImage, setItemImage] = useState<{
    uri: string;
    type?: string;
    name?: string;
  } | null>(null);
  /** Payment method: Cash (pay driver on delivery) or Pay online (Xendit invoice) */
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Pay online">(
    "Cash",
  );
  /** Delivery mode: what the customer bought beyond the delivery itself (orthogonal to serviceType) */
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("Regular");
  /** Selected saved payment method (optional - for future use) */
  const [selectedSavedPaymentMethod, setSelectedSavedPaymentMethod] = useState<SavedPaymentMethod | null>(null);
  /** Option to save payment method after successful payment */
  const [savePaymentMethodAfterPayment, setSavePaymentMethodAfterPayment] = useState(false);
  const { methods: savedPaymentMethods, create: createSavedPaymentMethod } = useSavedPaymentMethods();

  // Booking flow: calculate fare (auto when valid) + create booking
  const calculateFareMutation = useCalculateFare();
  const createBookingMutation = useCreateMultiStopBooking();

  // Fare-change handling: server is authoritative and may reject a stale quote at booking-creation
  // time (400 "fare has changed"); these track the refreshed quote pending customer re-confirmation
  const [fareChangeNotice, setFareChangeNotice] = useState<{ previousFare: number; newFare: number } | null>(null);
  const [hasConfirmedFare, setHasConfirmedFare] = useState(false);

  // Track payment ID to listen for payment status updates (for PayOnline flow)
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);
  const [showPaymentReceived, setShowPaymentReceived] = useState(false);
  const [isWaitingForPaymentConfirmation, setIsWaitingForPaymentConfirmation] =
    useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false); // Track payment creation in progress
  const isCreatingBookingAfterPaymentRef = useRef(false); // Ref guard to prevent duplicate booking creation from useEffect re-renders

  // Store booking data temporarily for PayOnline flow (booking created after payment)
  const [pendingBookingData, setPendingBookingData] = useState<{
    vehicleType: string;
    cargoDescription: string;
    scheduleDate: string;
    serviceType: "Immediate" | "Scheduled";
    stops: BookingStop[];
    estimatedFare: number;
    deliveryMode: DeliveryMode;
    weightKg?: number;
    notes?: string;
    scheduledPickupWindow?: string;
    itemLengthCm?: number;
    itemWidthCm?: number;
    itemHeightCm?: number;
  } | null>(null);

  // Listen for payment status updates for the created payment
  // Similar to driver topup: SignalR is always connected, SSE connects when paymentId is set
  const { paymentStatus, isConnected, isConnectedRef } =
    usePaymentStatus(createdPaymentId);

  // Log SSE connection status changes
  useEffect(() => {
    if (createdPaymentId) {
      const timestamp = new Date().toISOString();
      console.log(
        `[BookingScreen] [${timestamp}] SSE connection status changed - PaymentId: ${createdPaymentId}, isConnected: ${isConnected}`,
      );
    }
  }, [isConnected, createdPaymentId]);

  // Location coordinates state
  const [pickupCoordinates, setPickupCoordinates] =
    useState<LocationCoordinates | null>(null);

  // Map state
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const [activeLocationType, setActiveLocationType] = useState<
    "pickup" | "dropoff" | null
  >(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [userLocationRegion, setUserLocationRegion] =
    useState<LocationCoordinates | null>(null);
  const [pendingLocation, setPendingLocation] =
    useState<LocationWithAddress | null>(null);
  const [isPinningMyLocation, setIsPinningMyLocation] = useState(false);

  // Ref to prevent auto-focus on pickup after confirming dropoff location
  // When user confirms a dropoff, we don't want the pickup input to auto-focus and reopen the map
  const justConfirmedLocationRef = useRef(false);

  // Ref for which field we're editing when map is open (avoids stale closure when confirming)
  const activeLocationTypeRef = useRef<"pickup" | "dropoff" | null>(null);

  useEffect(() => {
    activeLocationTypeRef.current = activeLocationType;
  }, [activeLocationType]);

  // Vehicle types from API (loaded when booking page mounts)
  const {
    vehiclePricingList,
    isLoading: isVehiclePricingLoading,
    error: vehiclePricingError,
  } = useVehiclePricing();

  // Location search hooks
  const pickupSearch = useLocationSearch(300);
  const dropoffSearch = useLocationSearch(300);
  const mapSearch = useLocationSearch(300); // Search bar for map view

  // Location services hook
  const {
    getCurrentLocation,
    isLoading: isLocationLoading,
    error: locationError,
  } = useLocation();

  /**
   * Get user location on mount to center map
   */
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const coordinates = await getCurrentLocation();
        if (coordinates) {
          setUserLocationRegion(coordinates);
        }
      } catch (error) {
        // Silently fail - user can manually get location if needed
        console.log(
          "[BookingScreen] Could not get user location on mount:",
          error,
        );
      }
    };

    fetchUserLocation();
  }, [getCurrentLocation]);

  /** Whether the previous booking's details are still being fetched for a rebook (?rebookId=). */
  const [isRebookLoading, setIsRebookLoading] = useState(false);

  /**
   * Rebook flow: history.tsx navigates here with `rebookId` (the previous booking's id) instead
   * of raw address strings, since those went stale/incomplete (issue #25 — "Rebooking Button does
   * not fetch the previous booking details"). Fetch the full booking and prefill the form from it.
   */
  useEffect(() => {
    if (!rebookId) return;

    let cancelled = false;

    const prefillFromPreviousBooking = async () => {
      setIsRebookLoading(true);
      try {
        const previousBooking = await bookingService.getBookingById(rebookId);
        if (cancelled) return;

        const isValidCoordinate = (lat: number | null, lng: number | null) =>
          lat != null && lng != null && !(lat === 0 && lng === 0);

        // Contact name/phone live per-stop, not on the booking itself — only present for
        // bookings made through the multi-stop flow. Legacy bookings have no `stops`, so these
        // fall back to blank and the customer re-enters them.
        const pickupStop = previousBooking.stops?.find((stop) => stop.type === "Pickup");
        const dropoffStop = previousBooking.stops?.find((stop) => stop.type === "Dropoff");

        reset({
          pickup: previousBooking.pickupLocation || "",
          pickupContactName: pickupStop?.contactName || "",
          pickupContactPhone: pickupStop?.contactPhone || "",
          pickupNotes: pickupStop?.notes || "",
          dropoff: {
            address: previousBooking.dropoffLocation || "",
            coordinates: isValidCoordinate(previousBooking.dropoffLatitude, previousBooking.dropoffLongitude)
              ? { latitude: previousBooking.dropoffLatitude as number, longitude: previousBooking.dropoffLongitude as number }
              : null,
            contactName: dropoffStop?.contactName || "",
            contactPhone: dropoffStop?.contactPhone || "",
            notes: dropoffStop?.notes || "",
          },
          truckType: previousBooking.truckType || "",
          isScheduled: false,
          scheduledDate: getDefaultScheduledDate(),
          scheduledTime: getDefaultScheduledTime(),
          scheduledPickupWindow: "",
          description: previousBooking.cargoDescription || previousBooking.description || "",
          lengthCm: "",
          widthCm: "",
          heightCm: "",
          notesForDriver: previousBooking.notes || "",
          weight:
            previousBooking.weightKg != null
              ? String(previousBooking.weightKg)
              : previousBooking.weight != null
                ? String(previousBooking.weight)
                : "",
          tipAmount: "",
          tipMessage: "",
        });

        setPickupCoordinates(
          isValidCoordinate(previousBooking.pickupLatitude, previousBooking.pickupLongitude)
            ? { latitude: previousBooking.pickupLatitude as number, longitude: previousBooking.pickupLongitude as number }
            : null,
        );
      } catch (error) {
        console.error("[BookingScreen] Failed to fetch previous booking for rebook:", error);
        if (!cancelled) {
          Alert.alert(
            "Couldn't load previous booking",
            "We couldn't fetch your previous booking's details. Please fill in the booking manually.",
          );
        }
      } finally {
        if (!cancelled) setIsRebookLoading(false);
      }
    };

    prefillFromPreviousBooking();

    return () => {
      cancelled = true;
    };
  }, [rebookId, reset]);

  /**
   * Listen for payment status updates and create booking after payment is confirmed.
   * For PayOnline flow: payment is created first, then booking is created after payment confirmation.
   * SSE connection starts immediately when createdPaymentId is set (not waiting for browser to close).
   */
  useEffect(() => {
    const timestamp = new Date().toISOString();

    if (paymentStatus) {
      console.log(
        `[BookingScreen] [${timestamp}] Payment status received via SSE:`,
        {
          paymentId: paymentStatus.paymentId,
          bookingId: paymentStatus.bookingId,
          status: paymentStatus.status,
          amount: paymentStatus.amount,
          paidAtUtc: paymentStatus.paidAtUtc,
          hasPendingBookingData: !!pendingBookingData,
          isCreatingBooking: createBookingMutation.isPending,
          isWaitingForConfirmation: isWaitingForPaymentConfirmation,
        },
      );

      // If payment is confirmed and we're not already showing loading, set it now
      if (
        paymentStatus.status === "Paid" &&
        !isWaitingForPaymentConfirmation &&
        !showPaymentReceived
      ) {
        console.log(
          `[BookingScreen] [${timestamp}] Payment confirmed but loading state not set - Setting it now`,
        );
        setIsWaitingForPaymentConfirmation(true);
      }
    }

    // Check if payment is paid and booking needs to be created (bookingId is null/empty)
    const needsBookingCreation =
      paymentStatus &&
      paymentStatus.status === "Paid" &&
      pendingBookingData &&
      (!paymentStatus.bookingId ||
        paymentStatus.bookingId === "" ||
        paymentStatus.bookingId === "00000000-0000-0000-0000-000000000000");

    if (
      needsBookingCreation &&
      !createBookingMutation.isPending &&
      !isCreatingBookingAfterPaymentRef.current
    ) {
      isCreatingBookingAfterPaymentRef.current = true; // Set ref immediately to prevent re-entry on re-render
      const bookingCreateStartTime = new Date().toISOString();
      console.log(
        `[BookingScreen] [${bookingCreateStartTime}] Payment confirmed, creating booking now - PaymentId: ${paymentStatus.paymentId}, Amount: ${paymentStatus.amount}`,
      );

      // Payment confirmed but booking not created yet - create booking now
      const createBookingAfterPayment = async () => {
        try {
          setIsWaitingForPaymentConfirmation(true);

          const bookingCreateCallTime = new Date().toISOString();
          console.log(
            `[BookingScreen] [${bookingCreateCallTime}] Calling createBookingMutation.mutateAsync`,
          );

          const createdBooking = await createBookingMutation.mutateAsync({
            vehicleType: pendingBookingData.vehicleType,
            cargoDescription: pendingBookingData.cargoDescription,
            scheduleDate: pendingBookingData.scheduleDate,
            serviceType: pendingBookingData.serviceType,
            stops: pendingBookingData.stops,
            estimatedFare: pendingBookingData.estimatedFare,
            deliveryMode: pendingBookingData.deliveryMode,
            weightKg: pendingBookingData.weightKg,
            notes: pendingBookingData.notes,
            customerId: user?.id,
            scheduledPickupWindow: pendingBookingData.scheduledPickupWindow,
            paymentMethod: "PayOnline",
            ...(pendingBookingData.itemLengthCm != null && { itemLengthCm: pendingBookingData.itemLengthCm }),
            ...(pendingBookingData.itemWidthCm != null && { itemWidthCm: pendingBookingData.itemWidthCm }),
            ...(pendingBookingData.itemHeightCm != null && { itemHeightCm: pendingBookingData.itemHeightCm }),
            ...(itemImage?.uri && { itemImage: { uri: itemImage.uri, type: itemImage.type, name: itemImage.name } }),
          });

          const bookingCreatedTime = new Date().toISOString();
          console.log(
            `[BookingScreen] [${bookingCreatedTime}] Booking created successfully - BookingId: ${createdBooking.id}, BookingNumber: ${createdBooking.bookingNumber}`,
          );

          // Link payment to booking
          if (createdPaymentId) {
            try {
              const linkStartTime = new Date().toISOString();
              console.log(
                `[BookingScreen] [${linkStartTime}] Linking payment to booking - PaymentId: ${createdPaymentId}, BookingId: ${createdBooking.id}`,
              );

              await linkPaymentToBooking(createdPaymentId, createdBooking.id);

              const linkEndTime = new Date().toISOString();
              console.log(
                `[BookingScreen] [${linkEndTime}] Payment linked to booking successfully`,
              );
            } catch (linkErr) {
              const linkErrorTime = new Date().toISOString();
              console.error(
                `[BookingScreen] [${linkErrorTime}] Failed to link payment to booking:`,
                linkErr,
              );
              // Don't fail the flow - payment and booking are both created, linking is just for reference
            }
          }

          calculateFareMutation.reset();
          createBookingMutation.reset();

          const successTime = new Date().toISOString();
          console.log(
            `[BookingScreen] [${successTime}] Payment flow completed - Clearing loading state and showing success alert`,
          );

          // Hide loading state and show success
          setIsWaitingForPaymentConfirmation(false);
          setShowPaymentReceived(true);
          setPendingBookingData(null);
          isCreatingBookingAfterPaymentRef.current = false;

          // Attempt to save payment method if user opted to save it
          // Note: This requires payment method token from Xendit, which may not be available yet
          // This is prepared for future enhancement when backend/webhook provides payment method details
          if (savePaymentMethodAfterPayment && createdPaymentId) {
            // TODO: When backend/webhook provides payment method token, save it here
            // For now, this is a placeholder that doesn't break existing flow
            console.log('[BookingScreen] User opted to save payment method, but payment method token not yet available from Xendit');
          }

          reset({
            pickup: "",
            pickupContactName: "",
            pickupContactPhone: "",
            pickupNotes: "",
            dropoff: {
              address: "",
              coordinates: null,
              contactName: "",
              contactPhone: "",
              notes: "",
            },
            truckType: "",
            isScheduled: false,
            scheduledDate: getDefaultScheduledDate(),
            scheduledTime: getDefaultScheduledTime(),
            scheduledPickupWindow: "",
            description: "",
            lengthCm: "",
            widthCm: "",
            heightCm: "",
            notesForDriver: "",
            weight: "",
          });
          setPickupCoordinates(null);
          setItemImage(null);
          setCreatedPaymentId(null);
          setShowPaymentReceived(false);
          setSelectedSavedPaymentMethod(null);
          setSavePaymentMethodAfterPayment(false);
          router.replace({
            pathname: "/tracking",
            params: { id: createdBooking.id },
          });
        } catch (error) {
          const errorTime = new Date().toISOString();
          console.error(
            `[BookingScreen] [${errorTime}] Error creating booking after payment:`,
            error,
          );
          setIsWaitingForPaymentConfirmation(false);
          isCreatingBookingAfterPaymentRef.current = false;

          if (isFareChangedError(error)) {
            // Payment already went through via Xendit, so we refresh the quote for accuracy
            // but do not offer the cash-path's automatic "Confirm & Book" retry here - a second
            // booking-creation attempt after external payment needs care around idempotency.
            await handleFareChanged();
            Alert.alert(
              "Payment Received, Price Re-Checked",
              "Your payment was received, but the price changed before your booking could be created. We've refreshed the price - please contact support to complete your booking.",
              [{ text: "OK" }],
            );
            return;
          }

          Alert.alert(
            "Payment Received, Booking Failed",
            `Your payment was received, but there was an error creating your booking. Please contact support.\n\n${error instanceof Error ? error.message : "Unknown error"}`,
            [{ text: "OK" }],
          );
        }
      };

      createBookingAfterPayment();
    } else if (
      paymentStatus &&
      paymentStatus.status === "Paid" &&
      paymentStatus.bookingId &&
      !showPaymentReceived
    ) {
      // Payment confirmed and booking already exists (legacy flow or already linked)
      setIsWaitingForPaymentConfirmation(false);
      setShowPaymentReceived(true);
      const bookingId = paymentStatus.bookingId;

      reset({
        pickup: "",
        pickupContactName: "",
        pickupContactPhone: "",
        pickupNotes: "",
        dropoff: {
          address: "",
          coordinates: null,
          contactName: "",
          contactPhone: "",
          notes: "",
        },
        truckType: "",
        isScheduled: false,
        scheduledDate: getDefaultScheduledDate(),
        scheduledTime: getDefaultScheduledTime(),
        scheduledPickupWindow: "",
        description: "",
        lengthCm: "",
        widthCm: "",
        heightCm: "",
        notesForDriver: "",
        weight: "",
      });
      setPickupCoordinates(null);
      setItemImage(null);
      setCreatedPaymentId(null);
      setShowPaymentReceived(false);
      router.replace({
        pathname: "/tracking",
        params: { id: bookingId },
      });
    }
    // handleFareChanged intentionally omitted: it is declared later in this component (depends on
    // stops/validatedWeightKg below) and would throw a temporal-dead-zone error if referenced here.
    // It is still safe to call inside createBookingAfterPayment above, since that only runs after
    // the full component body (and handleFareChanged's initialization) has executed.
  }, [
    paymentStatus,
    pendingBookingData,
    createBookingMutation,
    user?.id,
    reset,
    router,
    calculateFareMutation,
    showPaymentReceived,
  ]);

  /**
   * Stops array: exactly one pickup, one dropoff. Backend rejects anything else.
   * Used for calculate-fare only — the actual booking submission rebuilds an equivalent array
   * from `onSubmit`'s validated `data` (see `finalStops`) rather than this watch()-derived memo,
   * since this one can lag a render behind at submit time (bee-backend#85).
   */
  const stops = useMemo((): BookingStop[] => {
    if (!pickup.trim() || !dropoff.address.trim()) return [];
    console.log('[BookingScreen][DEBUG] stops memo recompute, raw dropoff:', JSON.stringify(dropoff));
    return [
      {
        sequence: 0,
        address: pickup.trim(),
        type: "Pickup",
        latitude: pickupCoordinates?.latitude,
        longitude: pickupCoordinates?.longitude,
        contactName: pickupContactName?.trim() || undefined,
        contactPhone: pickupContactPhone?.trim() || undefined,
        notes: pickupNotes?.trim() || undefined,
      },
      {
        sequence: 1,
        address: dropoff.address.trim(),
        type: "Dropoff",
        latitude: dropoff.coordinates?.latitude,
        longitude: dropoff.coordinates?.longitude,
        contactName: dropoff.contactName?.trim() || undefined,
        contactPhone: dropoff.contactPhone?.trim() || undefined,
        notes: dropoff.notes?.trim() || undefined,
      },
    ];
  }, [
    pickup,
    pickupCoordinates,
    dropoff,
    pickupContactName,
    pickupContactPhone,
    pickupNotes,
  ]);

  /** Required for calculate-fare: vehicle type + pickup + at least one dropoff with address + valid weight */
  const validatedWeightKg = useMemo(() => {
    const weightStr = weight || "";
    const trimmed = weightStr.trim();
    if (!trimmed) return undefined;
    const num = parseFloat(trimmed);
    if (Number.isNaN(num) || num <= 0 || num > 10000) return undefined;
    return num;
  }, [weight]);

  const isFareInputValid =
    !!truckType &&
    !!pickup.trim() &&
    !!dropoff.address.trim() &&
    stops.length >= 2 &&
    validatedWeightKg != null;

  /**
   * Auto-trigger calculate-fare when required fields are valid (debounce 400 ms)
   * Only sends weightKg if weight is a valid positive number
   */
  useEffect(() => {
    if (!isFareInputValid) {
      calculateFareMutation.reset();
      return;
    }
    const timer = setTimeout(() => {
      calculateFareMutation.mutate({
        vehicleType: truckType,
        stops,
        weightKg: validatedWeightKg,
        deliveryMode,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [isFareInputValid, truckType, stops, validatedWeightKg, deliveryMode]);

  /**
   * Vehicle options: from API when available, otherwise fallback so options always show
   * Display label = types, value for API = vehicleType. Filter to active only when API provides isActive.
   */
  const vehicleOptionsSource =
    vehiclePricingList.length > 0
      ? vehiclePricingList.filter((v) => v.isActive !== false)
      : FALLBACK_VEHICLE_OPTIONS;
  const vehicleOptions = useMemo(() => {
    const sorted = [...vehicleOptionsSource].sort(
      (a, b) => (a.baseFare ?? Infinity) - (b.baseFare ?? Infinity)
    );
    return sorted.map((item) => {
      const raw = item as Record<string, unknown>;
      const sizeLimit = item.sizeLimit ?? raw.size_limit;
      const weightLimitKg = item.weightLimitKg != null ? Number(item.weightLimitKg) : (raw.weight_limit_kg != null ? Number(raw.weight_limit_kg) : undefined);
      return {
        id: item.vehicleType,
        name: item.types || item.vehicleType,
        vehicleType: item.vehicleType,
        price:
          item.baseFare != null
            ? `₱${Number(item.baseFare).toLocaleString()}`
            : "",
        sizeLimit: sizeLimit != null ? String(sizeLimit) : undefined,
        weightLimitKg,
      };
    });
  }, [vehicleOptionsSource]);
  const isUsingFallbackVehicles =
    vehiclePricingList.length === 0 && !isVehiclePricingLoading;

  /** Currently selected vehicle option, used to look up its weight limit for the cargo weight field */
  const selectedVehicleOption = useMemo(
    () => vehicleOptions.find((v) => v.vehicleType === truckType),
    [vehicleOptions, truckType]
  );
  const selectedVehicleWeightLimitKg = selectedVehicleOption?.weightLimitKg;
  /** Whether the entered cargo weight exceeds the selected vehicle's weight limit */
  const weightExceedsVehicleLimit = useMemo(() => {
    if (selectedVehicleWeightLimitKg == null) return false;
    const num = parseFloat((weight || "").trim());
    return !Number.isNaN(num) && num > selectedVehicleWeightLimitKg;
  }, [weight, selectedVehicleWeightLimitKg]);

  /** Fare result from calculate-fare; used for estimated total and create payload */
  const fareResult = calculateFareMutation.data;
  const isCreatePending = createBookingMutation.isPending;

  /**
   * Current calculate-fare payload (vehicleType/stops/weightKg). Shared by the auto-recalculation
   * effect above and the fare-changed retry below so both re-quote identically.
   */
  const currentFarePayload = useMemo(
    () => ({
      vehicleType: truckType,
      stops,
      weightKg: validatedWeightKg,
      deliveryMode,
    }),
    [truckType, stops, validatedWeightKg, deliveryMode]
  );

  // Any fresh quote (including a fare-changed refresh) requires the customer to confirm again
  useEffect(() => {
    setHasConfirmedFare(false);
  }, [fareResult?.totalFare]);

  /**
   * Handle the server-authoritative fare-changed 400 on booking creation: re-request the latest
   * quote via the existing calculate-fare mutation, surface the new fare, and require the
   * customer to explicitly confirm again before retrying (see handleSubmit gating below).
   */
  const handleFareChanged = useCallback(async () => {
    const previousFare = fareResult?.totalFare ?? 0;
    try {
      const refreshed = await calculateFareMutation.mutateAsync(currentFarePayload);
      setFareChangeNotice({ previousFare, newFare: refreshed.totalFare });
      setHasConfirmedFare(false);
      Alert.alert(
        "Fare updated",
        `The price changed since your last quote.\n\nPrevious: ₱${previousFare.toLocaleString()}\nNew: ₱${refreshed.totalFare.toLocaleString()}\n\nPlease review and confirm to continue.`,
        [{ text: "OK" }]
      );
    } catch {
      Alert.alert(
        "Could not refresh fare",
        "We could not get an updated price. Please check your details and try again."
      );
    }
  }, [fareResult?.totalFare, calculateFareMutation, currentFarePayload]);

  /**
   * Handle form submission using react-hook-form
   * Zod validation is handled automatically; this function receives validated form data
   * Creates booking (multi-stop endpoint) using validated data
   */
  const onSubmit = async (data: BookingFormData) => {
    // Image is required (not in form schema - stored in state)
    if (!itemImage) {
      Alert.alert(
        "Item image required",
        "Please upload an image of the item to be delivered.",
      );
      return;
    }

    // Additional validations not covered by Zod schema (API state, coordinates, fare)
    if (!fareResult?.totalFare) {
      Alert.alert(
        "Wait for fare",
        "Enter pickup, dropoff and vehicle type to see the estimated fare, then confirm.",
      );
      return;
    }

    if (!data.dropoff.address?.trim()) {
      Alert.alert("Error", "Please enter a dropoff address");
      return;
    }

    if (stops.length < 2) {
      Alert.alert(
        "Error",
        "Pickup and dropoff addresses are required",
      );
      return;
    }

    // Coordinates are required for an accurate fare - without them the backend falls back to a
    // flat 5km distance assumption regardless of actual trip length.
    if (!pickupCoordinates || !data.dropoff.coordinates) {
      Alert.alert(
        "Pin your locations",
        "Please set an exact pickup and dropoff location on the map for an accurate price.",
      );
      return;
    }

    // Derive serviceType and scheduleDate based on isScheduled
    let serviceType: "Immediate" | "Scheduled";
    let scheduleDateISO: string;
    let pickupWindow: string | undefined;

    if (data.isScheduled) {
      // Scheduled: Zod already validated date/time are present, valid, and at least 1 hour in future
      // Combine scheduled date and time into ISO string
      const timeWithSeconds =
        data.scheduledTime &&
          data.scheduledTime.includes(":") &&
          data.scheduledTime.split(":").length === 2
          ? `${data.scheduledTime}:00`
          : data.scheduledTime || "10:00:00";
      scheduleDateISO = new Date(
        `${data.scheduledDate}T${timeWithSeconds}`,
      ).toISOString();

      const scheduleDateObj = new Date(scheduleDateISO);
      if (Number.isNaN(scheduleDateObj.getTime())) {
        Alert.alert("Error", "Please enter a valid scheduled date and time");
        return;
      }

      // Note: "1 hour in future" validation is handled by Zod schema
      // No duplicate validation needed here

      serviceType = "Scheduled";
      // Only send pickup window if user filled it
      pickupWindow = data.scheduledPickupWindow;
    } else {
      // On Demand: use current date/time, serviceType is Immediate
      scheduleDateISO = new Date().toISOString();
      serviceType = "Immediate";
      pickupWindow = undefined; // Do not send pickup window for On Demand
    }

    // Parse weight from form data (Zod validates it's a valid positive number string or empty)
    const weightKg =
      data.weight && data.weight.trim() !== ""
        ? parseFloat(data.weight.trim())
        : undefined;

    // Build the submitted stops from `data` (RHF's validated, authoritative snapshot at submit
    // time) rather than the `stops` memo above, which is derived from `watch()` and can lag a
    // render behind — the exact symptom of bee-backend#85: dropoff contactName/contactPhone
    // showing up empty in the request even though Zod had just required (and thus confirmed
    // non-empty) them to reach this point at all.
    const finalStops: BookingStop[] = [
      {
        sequence: 0,
        address: data.pickup,
        type: "Pickup",
        latitude: pickupCoordinates?.latitude,
        longitude: pickupCoordinates?.longitude,
        contactName: data.pickupContactName?.trim() || undefined,
        contactPhone: data.pickupContactPhone?.trim() || undefined,
        notes: data.pickupNotes?.trim() || undefined,
      },
      {
        sequence: 1,
        address: data.dropoff.address,
        type: "Dropoff",
        latitude: data.dropoff.coordinates?.latitude,
        longitude: data.dropoff.coordinates?.longitude,
        contactName: data.dropoff.contactName?.trim() || undefined,
        contactPhone: data.dropoff.contactPhone?.trim() || undefined,
        notes: data.dropoff.notes?.trim() || undefined,
      },
    ];

    try {
      // For PayOnline: Create payment first, then booking after payment is confirmed
      // For Cash: Create booking immediately
      if (paymentMethod === "Pay online" && user?.id) {
        // Idempotency check: Prevent duplicate payment creation if already waiting for payment confirmation or creating payment
        if (
          isWaitingForPaymentConfirmation ||
          createdPaymentId ||
          isCreatingPayment
        ) {
          Alert.alert(
            "Payment in progress",
            "A payment is already being processed. Please wait for the payment confirmation.",
          );
          return;
        }

        // Set creating flag immediately to prevent double-clicks
        setIsCreatingPayment(true);

        // Store booking data temporarily (including dimensions for create after payment)
        const lengthNum = data.lengthCm?.trim() ? parseFloat(data.lengthCm.trim()) : undefined;
        const widthNum = data.widthCm?.trim() ? parseFloat(data.widthCm.trim()) : undefined;
        const heightNum = data.heightCm?.trim() ? parseFloat(data.heightCm.trim()) : undefined;
        setPendingBookingData({
          vehicleType: data.truckType,
          cargoDescription: data.description || "—",
          scheduleDate: scheduleDateISO,
          serviceType,
          stops: finalStops,
          estimatedFare: fareResult.totalFare,
          deliveryMode,
          weightKg,
          notes: data.notesForDriver || undefined,
          scheduledPickupWindow: pickupWindow,
          ...(lengthNum != null && !Number.isNaN(lengthNum) && { itemLengthCm: lengthNum }),
          ...(widthNum != null && !Number.isNaN(widthNum) && { itemWidthCm: widthNum }),
          ...(heightNum != null && !Number.isNaN(heightNum) && { itemHeightCm: heightNum }),
        });

        try {
          // Create payment WITHOUT bookingId (booking will be created after payment)
          const payment = await createPayment({
            bookingId: null, // No booking yet - will be created after payment
            customerId: user.id,
            amount: fareResult.totalFare,
            payerEmail: (user as { email?: string }).email ?? "",
            description: `Booking payment - ${data.truckType}`,
            method: "BankTransfer",
          });

          // Store payment ID to listen for payment status
          const paymentCreatedTime = new Date().toISOString();
          console.log(
            `[BookingScreen] [${paymentCreatedTime}] Payment created - PaymentId: ${payment.id}, InvoiceUrl: ${payment.xenditInvoiceUrl}`,
          );

          // Set payment ID IMMEDIATELY to start SSE connection (don't wait for browser to close)
          // Similar to driver topup: SignalR is always connected, so we ensure SSE connects before opening browser
          setCreatedPaymentId(payment.id);
          setIsCreatingPayment(false); // Payment created successfully, clear creating flag

          if (payment.xenditInvoiceUrl) {
            try {
              const browserOpenTime = new Date().toISOString();
              console.log(
                `[BookingScreen] [${browserOpenTime}] Opening in-app browser for payment - InvoiceUrl: ${payment.xenditInvoiceUrl}`,
              );

              // Open payment URL in in-app browser with "Return to Merchant" button
              // Wrap in try-catch to handle browser crashes
              let browserResult;
              try {
                browserResult = await WebBrowser.openBrowserAsync(
                  payment.xenditInvoiceUrl,
                  {
                    presentationStyle:
                      WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                    enableBarCollapsing: false,
                    showTitle: true,
                    toolbarColor: "#ffcd36", // Match app theme color
                    controlsColor: "#000000",
                  },
                );
              } catch (browserOpenError) {
                const errorTime = new Date().toISOString();
                console.error(
                  `[BookingScreen] [${errorTime}] Failed to open in-app browser:`,
                  browserOpenError,
                );
                // Fallback to external browser
                throw browserOpenError; // Will be caught by outer catch block
              }

              // Browser result types:
              // - 'opened': Browser opened successfully (still open, user hasn't closed it yet)
              // - 'cancel': User cancelled/closed browser without completing payment
              // - 'dismiss': User dismissed browser (may have completed payment)
              const browserCloseTime = new Date().toISOString();
              console.log(
                `[BookingScreen] [${browserCloseTime}] Browser result - type: ${browserResult.type}`,
              );

              // Only set loading state when browser is actually closed (cancel or dismiss)
              // On Android, 'opened' is returned immediately (browser doesn't block the promise)
              // so we must also handle it — the payment polling/SSE will detect completion
              if (
                browserResult.type === "cancel" ||
                browserResult.type === "dismiss"
              ) {
                console.log(
                  `[BookingScreen] [${browserCloseTime}] Browser closed (${browserResult.type}) - Setting loading state`,
                );
                setIsWaitingForPaymentConfirmation(true);
              } else if (browserResult.type === "opened") {
                console.log(
                  `[BookingScreen] [${browserCloseTime}] Browser opened (Android returns immediately) - Setting loading state, polling will detect payment`,
                );
                // On Android, browser opens in a separate activity and the promise resolves immediately.
                // Set loading state now — the polling fallback in usePaymentStatus will detect when payment is confirmed.
                setIsWaitingForPaymentConfirmation(true);
              }
            } catch (browserErr) {
              console.error(
                "[BookingScreen] Failed to open in-app browser:",
                browserErr,
              );
              // Fallback to external browser if in-app browser fails
              const canOpen = await Linking.canOpenURL(
                payment.xenditInvoiceUrl,
              );
              if (canOpen) {
                await Linking.openURL(payment.xenditInvoiceUrl);
                // For external browser, we can't detect when it closes, so show loading immediately
                setIsWaitingForPaymentConfirmation(true);
              } else {
                // Can't open browser - clear loading state and show alert
                setIsWaitingForPaymentConfirmation(false);
                Alert.alert(
                  "Payment link",
                  `Pay here: ${payment.xenditInvoiceUrl}`,
                  [{ text: "OK" }],
                );
              }
            }
          } else {
            // No payment URL - shouldn't happen, but clear loading state just in case
            setIsWaitingForPaymentConfirmation(false);
            Alert.alert(
              "Payment Error",
              "Payment was created but no payment URL was provided. Please contact support.",
              [{ text: "OK" }],
            );
          }
        } catch (payErr) {
          setIsCreatingPayment(false); // Clear creating flag on error
          Alert.alert(
            "Payment creation failed",
            `Failed to create payment. Please try again.\n\n${payErr instanceof Error ? payErr.message : "Unknown error"}`,
            [{ text: "OK" }],
          );
          setPendingBookingData(null);
        }
      } else {
        // Cash payment: Create booking immediately (JSON or multipart with itemImage)
        const lengthNum = data.lengthCm?.trim() ? parseFloat(data.lengthCm.trim()) : undefined;
        const widthNum = data.widthCm?.trim() ? parseFloat(data.widthCm.trim()) : undefined;
        const heightNum = data.heightCm?.trim() ? parseFloat(data.heightCm.trim()) : undefined;
        const createdBooking = await createBookingMutation.mutateAsync({
          vehicleType: data.truckType,
          cargoDescription: data.description || "—",
          scheduleDate: scheduleDateISO,
          serviceType,
          stops: finalStops,
          estimatedFare: fareResult.totalFare,
          deliveryMode,
          weightKg,
          notes: data.notesForDriver || undefined,
          customerId: user?.id,
          scheduledPickupWindow: pickupWindow,
          paymentMethod: "Cash",
          ...(lengthNum != null && !Number.isNaN(lengthNum) && { itemLengthCm: lengthNum }),
          ...(widthNum != null && !Number.isNaN(widthNum) && { itemWidthCm: widthNum }),
          ...(heightNum != null && !Number.isNaN(heightNum) && { itemHeightCm: heightNum }),
          ...(itemImage?.uri && { itemImage: { uri: itemImage.uri, type: itemImage.type, name: itemImage.name } }),
        });

        calculateFareMutation.reset();
        createBookingMutation.reset();

        router.replace({
          pathname: "/tracking",
          params: { id: createdBooking.id },
        });

        // Reset form for cash payments
        reset({
          pickup: "",
          pickupContactName: "",
          pickupContactPhone: "",
          pickupNotes: "",
          dropoff: {
            address: "",
            coordinates: null,
            contactName: "",
            contactPhone: "",
            notes: "",
          },
          truckType: "",
          isScheduled: false,
          scheduledDate: getDefaultScheduledDate(),
          scheduledTime: getDefaultScheduledTime(),
          scheduledPickupWindow: "",
          description: "",
          lengthCm: "",
          widthCm: "",
          heightCm: "",
          notesForDriver: "",
          weight: "",
        });

        setPickupCoordinates(null);
        setItemImage(null);
        setSelectedSavedPaymentMethod(null);
        setSavePaymentMethodAfterPayment(false);
      }
    } catch (error) {
      if (isFareChangedError(error)) {
        await handleFareChanged();
        return;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong";
      Alert.alert("Error", errorMessage);
    }
  };

  /**
   * Wrapper for form submission that shows validation errors
   * Uses react-hook-form's handleSubmit which validates with Zod before calling onSubmit
   */
  const handleSubmit = handleFormSubmit(onSubmit, (validationErrors) => {
    // Show first validation error
    const firstError = Object.values(validationErrors)[0];
    if (firstError?.message) {
      Alert.alert("Validation Error", firstError.message);
    } else {
      Alert.alert("Validation Error", "Please check all required fields");
    }
  }) as () => void;

  /**
   * Handle use my location button
   * Gets current user location, reverse geocodes it, and sets it as the active location
   */
  const handleUseMyLocation = useCallback(async () => {
    try {
      // Get current location
      const coordinates = await getCurrentLocation();

      if (!coordinates) {
        // Error message already set by getCurrentLocation
        if (locationError) {
          Alert.alert("Location Error", locationError);
        }
        return;
      }

      // Reverse geocode to get address
      try {
        const address = await mapService.reverseGeocode(coordinates);
        const locationWithAddress: LocationWithAddress = {
          coordinates,
          address,
        };

        // Set location based on active type, or default to pickup if empty, otherwise dropoff
        if (activeLocationType === "pickup") {
          setValue("pickup", address);
          setPickupCoordinates(coordinates);
          setActiveLocationType(null);
        } else if (activeLocationType === "dropoff") {
          setValue("dropoff", { ...watch("dropoff"), address, coordinates });
          setActiveLocationType(null);
        } else {
          if (!pickup || pickup.trim() === "") {
            setValue("pickup", address);
            setPickupCoordinates(coordinates);
          } else {
            setValue("dropoff", { ...watch("dropoff"), address, coordinates });
          }
        }

        // Show success message
        Alert.alert("Success", "Your location has been set.");
      } catch (geocodeError) {
        console.error("[BookingScreen] Reverse geocoding error:", geocodeError);
        Alert.alert(
          "Error",
          "Failed to get address for your location. Please try again or select a location manually.",
        );
      }
    } catch (error) {
      console.error("[BookingScreen] Error getting location:", error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to get your location. Please try again.",
      );
    }
  }, [
    getCurrentLocation,
    locationError,
    activeLocationType,
    pickup,
    setValue,
    watch,
  ]);

  /**
   * Handle location selection from map or search.
   * When options are provided (e.g. from confirm), uses them so the correct field is updated
   * even if state has changed; otherwise uses activeLocationType.
   */
  const handleLocationSelect = useCallback(
    (
      location: LocationWithAddress,
      options?: {
        locationType: "pickup" | "dropoff";
      },
    ) => {
      const type = options?.locationType ?? activeLocationType;

      if (type === "pickup") {
        setValue("pickup", location.address);
        setPickupCoordinates(location.coordinates);
        setActiveLocationType(null);
      } else if (type === "dropoff") {
        setValue("dropoff", {
          ...watch("dropoff"),
          address: location.address,
          coordinates: location.coordinates,
        });
        setActiveLocationType(null);
      } else {
        // Fallback: assign to pickup if empty, otherwise dropoff
        if (!pickup || pickup.trim() === "") {
          setValue("pickup", location.address);
          setPickupCoordinates(location.coordinates);
        } else {
          setValue("dropoff", {
            ...watch("dropoff"),
            address: location.address,
            coordinates: location.coordinates,
          });
        }
      }
    },
    [activeLocationType, pickup, setValue, watch],
  );

  /**
   * Handle map press - drop pin for location selection (pending confirmation)
   */
  const handleMapLocationSelect = useCallback(
    (location: LocationWithAddress) => {
      // Set as pending location - user needs to confirm
      setPendingLocation(location);
    },
    [],
  );

  /**
   * Handle confirming the pending location
   * Uses refs for which field we're editing so the new pin is always applied to the correct field
   * (avoids stale closure when user reopens map after a previous confirm).
   */
  const handleConfirmLocation = useCallback(() => {
    if (!pendingLocation) return;

    // Dismiss keyboard first to prevent focus issues
    Keyboard.dismiss();

    // Set flag to prevent pickup auto-focus when map closes
    justConfirmedLocationRef.current = true;

    // Apply pending location using the ref so we update the field that was opened, not stale state
    const type = activeLocationTypeRef.current;
    if (type === "pickup" || type === "dropoff") {
      handleLocationSelect(pendingLocation, { locationType: type });
    } else {
      handleLocationSelect(pendingLocation);
    }

    // Clear pending location
    setPendingLocation(null);

    // Close full-screen mode after confirmation
    setIsMapFullScreen(false);
    setIsMapExpanded(false);

    // Clear the flag after a short delay (allows modal close animation to complete)
    setTimeout(() => {
      justConfirmedLocationRef.current = false;
    }, 500);
  }, [pendingLocation, handleLocationSelect]);

  /**
   * Pin current device location as the selected location on the full-screen map.
   * Gets GPS position, reverse geocodes to address, sets pending location so user can confirm.
   */
  const handleUseMyLocationOnMap = useCallback(async () => {
    if (!activeLocationType) return;
    try {
      setIsPinningMyLocation(true);
      const coordinates = await getCurrentLocation();
      if (!coordinates) {
        if (locationError) Alert.alert("Location Error", locationError);
        return;
      }
      const address = await mapService.reverseGeocode(coordinates);
      setPendingLocation({ coordinates, address });
    } catch (err) {
      console.error("[BookingScreen] Use my location on map:", err);
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not use your location. Try again or pick on the map.",
      );
    } finally {
      setIsPinningMyLocation(false);
    }
  }, [activeLocationType, getCurrentLocation, locationError]);

  /**
   * Handle pickup search place selection
   */
  const handlePickupPlaceSelect = useCallback(
    async (prediction: PlacePrediction) => {
      const location = await pickupSearch.selectPlace(prediction);
      if (location) {
        setValue("pickup", location.address);
        setPickupCoordinates(location.coordinates);
      }
    },
    [pickupSearch, setValue],
  );

  /**
   * Handle dropoff search place selection
   */
  const handleDropoffPlaceSelect = useCallback(
    async (prediction: PlacePrediction) => {
      Keyboard.dismiss();
      const location = await dropoffSearch.selectPlace(prediction);
      if (location) {
        setValue("dropoff", {
          ...watch("dropoff"),
          address: location.address,
          coordinates: location.coordinates,
        });
      }
    },
    [dropoffSearch, setValue, watch],
  );

  /**
   * Handle map expand/collapse
   */
  const handleMapExpand = useCallback(() => {
    setIsMapExpanded(true);
  }, []);

  const handleMapCollapse = useCallback(() => {
    setIsMapExpanded(false);
    setIsMapFullScreen(false);
  }, []);

  /**
   * Handle full-screen map mode
   * Gets user location and centers map on it
   */
  const handleMapFullScreen = useCallback(async () => {
    setIsMapFullScreen(true);
    setIsMapExpanded(true);
    setPendingLocation(null);

    // Clear search results when opening map to prevent interference
    pickupSearch.clearSearch();
    dropoffSearch.clearSearch();

    // Get user location to center map on user's vicinity
    try {
      const coordinates = await getCurrentLocation();
      if (coordinates) {
        setUserLocationRegion(coordinates);
      }
    } catch (error) {
      console.error(
        "[BookingScreen] Error getting location for full-screen map:",
        error,
      );
      // Continue without user location - will use default region
    }
  }, [getCurrentLocation, pickupSearch, dropoffSearch]);

  /**
   * Handle "Edit on Map" button
   */
  const handleEditOnMap = useCallback(() => {
    handleMapFullScreen();
  }, [handleMapFullScreen]);

  /**
   * Handle route calculation result from MapView
   * Updates distance and duration display
   */
  const handleRouteCalculated = useCallback(
    (distance: string, duration: string) => {
      setRouteDistance(distance);
      setRouteDuration(duration);
    },
    [],
  );

  /**
   * Handle image picker (gallery)
   * Requests media library permissions and allows user to select an image
   */
  const handlePickImage = useCallback(async () => {
    try {
      // Android 13+ uses the system photo picker without READ_MEDIA_* permissions
      if (Platform.OS === "ios") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "We need access to your photos to upload an image of the item.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setItemImage({
          uri: asset.uri,
          type: asset.mimeType || "image/jpeg",
          name: asset.fileName || `item-image-${Date.now()}.jpg`,
        });
      }
    } catch (error) {
      console.error("[BookingScreen] Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  }, []);

  /**
   * Handle camera capture for item image
   */
  const handleTakePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "We need camera access to take a photo of the item to be delivered.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setItemImage({
          uri: asset.uri,
          type: asset.mimeType || "image/jpeg",
          name: asset.fileName || `item-image-${Date.now()}.jpg`,
        });
      }
    } catch (error) {
      console.error("[BookingScreen] Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  }, []);

  /**
   * Show action sheet to choose Take Photo or Choose from Gallery (Option C)
   */
  const handleItemImagePress = useCallback(() => {
    Alert.alert("Item Image", "Add a photo of the item to be delivered", [
      { text: "Take Photo", onPress: handleTakePhoto },
      { text: "Choose from Gallery", onPress: handlePickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleTakePhoto, handlePickImage]);

  /**
   * Handle removing selected image
   */
  const handleRemoveImage = useCallback(() => {
    setItemImage(null);
  }, []);

  /**
   * Open location in the in-app map view
   * Sets active location type and opens full-screen map
   */
  const openLocationInMap = useCallback(
    (locationType: "pickup" | "dropoff") => {
      setActiveLocationType(locationType);
      handleMapFullScreen();
    },
    [handleMapFullScreen],
  );

  /**
   * Map markers for pickup and dropoff, plus pending location.
   * When editing (pending pin exists), show only the pending pin for that field so the old one doesn't stick.
   */
  const mapMarkers = useMemo(() => {
    const markers = [];
    const hasPendingPickup = pendingLocation && activeLocationType === "pickup";
    const hasPendingDropoff = pendingLocation && activeLocationType === "dropoff";

    if (pickupCoordinates && !hasPendingPickup) {
      markers.push({
        id: "pickup",
        coordinates: pickupCoordinates,
        title: "Pickup Location",
        type: "pickup" as const,
      });
    }
    if (dropoff.coordinates && !hasPendingDropoff) {
      markers.push({
        id: "dropoff",
        coordinates: dropoff.coordinates,
        title: "Dropoff Location",
        type: "dropoff" as const,
      });
    }
    // Pending pin is already shown via pickupLocation/dropoffLocation props (no extra marker to avoid duplicate)
    return markers;
  }, [pickupCoordinates, dropoff, pendingLocation, activeLocationType]);

  /**
   * Initial map region - uses user location if available, otherwise defaults to Manila, Philippines
   * Initial map region - uses user location if available, otherwise defaults to Manila, Philippines
   */
  const initialMapRegion = useMemo(() => {
    // If user location is available, use it
    if (userLocationRegion) {
      return {
        latitude: userLocationRegion.latitude,
        longitude: userLocationRegion.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    // Default to Manila, Philippines (reasonable default for the region)
    // This will be updated when user location is available
    return {
      latitude: 14.5995,
      longitude: 120.9842,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }, [userLocationRegion]);

  /**
   * Full-screen map region - centers on pending location if selected, otherwise existing pinned location, user location, or defaults to Manila, Philippines
   */
  const fullScreenMapRegion = useMemo(() => {
    // Priority 1: If a location is selected from search, zoom to it
    if (pendingLocation?.coordinates) {
      return {
        latitude: pendingLocation.coordinates.latitude,
        longitude: pendingLocation.coordinates.longitude,
        latitudeDelta: 0.01, // Closer zoom for better location selection
        longitudeDelta: 0.01,
      };
    }
    
    // Priority 2: If map is opened for pickup and pickup is already pinned, zoom to it
    if (activeLocationType === "pickup" && pickupCoordinates) {
      return {
        latitude: pickupCoordinates.latitude,
        longitude: pickupCoordinates.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    
    // Priority 3: If map is opened for dropoff and the dropoff is already pinned, zoom to it
    if (activeLocationType === "dropoff" && dropoff.coordinates) {
      return {
        latitude: dropoff.coordinates.latitude,
        longitude: dropoff.coordinates.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    
    // Priority 4: User location if available
    if (userLocationRegion) {
      return {
        latitude: userLocationRegion.latitude,
        longitude: userLocationRegion.longitude,
        latitudeDelta: 0.01, // Closer zoom for better location selection
        longitudeDelta: 0.01,
      };
    }
    
    // Priority 5: Default to Manila, Philippines with closer zoom for location selection
    return {
      latitude: 14.5995, // Manila, Philippines latitude
      longitude: 120.9842, // Manila, Philippines longitude
      latitudeDelta: 0.05, // Closer zoom for better location selection
      longitudeDelta: 0.05,
    };
  }, [pendingLocation, activeLocationType, pickupCoordinates, dropoff, userLocationRegion]);

  /**
   * Handle canceling the wait for payment confirmation
   * Opens an alert to confirm in case the user has already paid
   */
  const handleCancelPaymentWait = useCallback(() => {
    Alert.alert(
      "Cancel Payment?",
      "If you have already paid, please wait for confirmation. Are you sure you want to cancel this wait?",
      [
        { text: "No, keep waiting", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: () => {
            setIsWaitingForPaymentConfirmation(false);
            setCreatedPaymentId(null);
            setPendingBookingData(null);
          },
        },
      ]
    );
  }, []);

  const styles = createStyles(theme);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Full Screen Map Modal */}
      {isMapFullScreen && (
        <Modal
          visible={isMapFullScreen}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handleMapCollapse}
        >
          <View style={styles.fullScreenMapContainer}>
            <View
              style={[styles.fullScreenMapHeader, { paddingTop: insets.top }]}
            >
              <Text style={styles.fullScreenMapTitle}>
                {activeLocationType === "pickup"
                  ? "Select Pickup Location"
                  : activeLocationType === "dropoff"
                    ? "Select Dropoff Location"
                    : "Select Location"}
              </Text>
              <TouchableOpacity
                onPress={handleMapCollapse}
                style={styles.fullScreenMapCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Map Search Bar - Only in Full Screen */}
            <View style={styles.fullScreenMapSearchContainer}>
              <View style={styles.mapSearchInputWrapper}>
                <Ionicons
                  name="search"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.mapSearchIcon}
                />
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search location on map"
                  placeholderTextColor={theme.placeholder}
                  value={mapSearch.query}
                  onChangeText={mapSearch.setQuery}
                />
                {/* Location Type Icon */}
                {activeLocationType && (
                  <View
                    style={[
                      styles.mapSearchLocationIcon,
                      activeLocationType === "pickup"
                        ? styles.pickupIconBadge
                        : styles.dropoffIconBadge,
                    ]}
                  >
                    <Ionicons name="location" size={16} color={theme.surface} />
                  </View>
                )}
                {mapSearch.query.length > 0 && (
                  <TouchableOpacity
                    onPress={mapSearch.clearSearch}
                    style={styles.mapSearchClearButton}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={theme.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.useMyLocationButton, { borderColor: theme.border }]}
                onPress={handleUseMyLocationOnMap}
                disabled={isPinningMyLocation}
              >
                {isPinningMyLocation ? (
                  <ActivityIndicator size="small" color={BeeColors.yellow[600]} />
                ) : (
                  <Ionicons name="locate" size={20} color={BeeColors.yellow[600]} />
                )}
                <Text style={[styles.useMyLocationButtonText, { color: theme.text }]}>
                  {isPinningMyLocation ? "Getting location…" : "Pin my location"}
                </Text>
              </TouchableOpacity>

              {/* Search Results */}
              {mapSearch.predictions.length > 0 && (
                <View style={styles.mapSearchResults}>
                  <FlatList
                    data={mapSearch.predictions}
                    keyExtractor={(item) => item.placeId}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.mapSearchResultItem}
                        onPress={async () => {
                          Keyboard.dismiss(); // Hide keyboard when location is selected
                          const location = await mapSearch.selectPlace(item);
                          if (location) {
                            handleMapLocationSelect(location);
                            mapSearch.clearSearch();
                          }
                        }}
                      >
                        <Ionicons
                          name="location"
                          size={20}
                          color={theme.textSecondary}
                          style={styles.mapSearchResultIcon}
                        />
                        <View style={styles.mapSearchResultText}>
                          <Text style={styles.mapSearchResultMainText}>
                            {item.mainText}
                          </Text>
                          <Text style={styles.mapSearchResultSecondaryText}>
                            {item.secondaryText}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    scrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  />
                </View>
              )}
            </View>

            <MapViewComponent
              mode="booking"
              initialRegion={fullScreenMapRegion}
              markers={mapMarkers}
              pickupLocation={
                pendingLocation && activeLocationType === "pickup"
                  ? pendingLocation.coordinates
                  : pickupCoordinates || undefined
              }
              dropoffLocation={
                pendingLocation && activeLocationType === "dropoff"
                  ? pendingLocation.coordinates
                  : dropoff.coordinates || undefined
              }
              isExpanded={true}
              onLocationSelect={handleMapLocationSelect}
              onRouteCalculated={handleRouteCalculated}
              showControls={false}
              style={styles.fullScreenMapView}
            />

            {/* Confirm Button - Shows when location is selected */}
            {pendingLocation && activeLocationType && (
              <View
                style={[
                  styles.fullScreenMapConfirmContainer,
                  { paddingBottom: insets.bottom + 16 },
                ]}
              >
                <View style={styles.fullScreenMapConfirmContent}>
                  <View style={styles.fullScreenMapConfirmInfo}>
                    <Ionicons
                      name="location"
                      size={20}
                      color={
                        activeLocationType === "pickup"
                          ? theme.success
                          : theme.error
                      }
                    />
                    <View style={styles.fullScreenMapConfirmText}>
                      <Text style={styles.fullScreenMapConfirmLabel}>
                        {activeLocationType === "pickup" ? "Pickup" : "Dropoff"}{" "}
                        Location
                      </Text>
                      <Text
                        style={styles.fullScreenMapConfirmAddress}
                        numberOfLines={1}
                      >
                        {pendingLocation.address}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.fullScreenMapConfirmButton,
                      activeLocationType === "pickup"
                        ? styles.pickupConfirmButton
                        : styles.dropoffConfirmButton,
                    ]}
                    onPress={handleConfirmLocation}
                  >
                    <Text style={styles.fullScreenMapConfirmButtonText}>
                      Confirm
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Creating booking loading overlay – shown while waiting for booking API response */}
      {isCreatePending && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.paymentLoadingOverlay}>
            <View style={styles.paymentLoadingContainer}>
              <ActivityIndicator size="large" color={BeeColors.yellow[400]} />
              <Text style={[styles.paymentLoadingText, { color: theme.text }]}>
                Creating your booking...
              </Text>
              <Text
                style={[
                  styles.paymentLoadingSubtext,
                  { color: theme.textSecondary },
                ]}
              >
                Please wait while we confirm your request.
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Payment Confirmation Loading Modal */}
      {isWaitingForPaymentConfirmation && !isCreatePending && (
        <Modal
          visible={isWaitingForPaymentConfirmation}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelPaymentWait}
        >
          <View style={styles.paymentLoadingOverlay}>
            <View style={styles.paymentLoadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.paymentLoadingText, { color: theme.text }]}>
                Waiting for payment confirmation...
              </Text>
              <Text
                style={[
                  styles.paymentLoadingSubtext,
                  { color: theme.textSecondary },
                ]}
              >
                Please don't close this screen. We're verifying your payment.
              </Text>
              {isConnected && (
                <Text
                  style={[
                    styles.paymentLoadingStatus,
                    { color: theme.success },
                  ]}
                >
                  Connected to payment system
                </Text>
              )}

              <TouchableOpacity
                style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: theme.surface || '#fff' }}
                onPress={handleCancelPaymentWait}
              >
                <Text style={{ color: theme.error || '#f44336', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Header – Create Booking, Step X of 3, progress segments */}
      <View style={[styles.header, styles.headerStep2]}>
        <TouchableOpacity
          onPress={() => {
            if (isWaitingForPaymentConfirmation) return;
            if (wizardStep > 1) {
              setWizardStep((wizardStep - 1) as 1 | 2 | 3);
            } else {
              router.back();
            }
          }}
          style={[
            styles.backButton,
            isWaitingForPaymentConfirmation && styles.backButtonDisabled,
          ]}
          disabled={isWaitingForPaymentConfirmation}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={
              isWaitingForPaymentConfirmation ? theme.textSecondary : theme.text
            }
          />
        </TouchableOpacity>
        <View style={styles.headerCenterStep2}>
          <Text style={[styles.headerTitleStep2, { color: theme.text }]}>
            Create Booking
          </Text>
          <Text style={styles.headerStepLabel}>
            STEP {wizardStep} OF 3
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      {/* Progress: 3 segments, filled up to current step */}
      <View style={styles.wizardProgressRow}>
        {([1, 2, 3] as const).map((step) => (
          <View
            key={step}
            style={[
              styles.wizardProgressSegment,
              step <= wizardStep && styles.wizardProgressSegmentFilled,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 200 },
        ]}
        style={styles.scrollViewBackground}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: On Demand / Scheduled on top, then Route & Stops, then Vehicle Type */}
        {wizardStep === 1 && (
          <>
        {isRebookLoading ? (
          <View style={[styles.vehicleOptionsLoading, { marginHorizontal: 16, marginTop: 12 }]}>
            <ActivityIndicator size="small" color={theme.info} />
            <Text style={[styles.vehicleOptionsLoadingText, { color: theme.textSecondary }]}>
              Loading your previous booking details…
            </Text>
          </View>
        ) : null}
        {/* Service & Timing – on top (On Demand / Scheduled) */}
        <View style={styles.section}>
          <View style={styles.logisticsCard}>
            <View style={styles.logisticsContent}>
              <View style={styles.serviceToggleWrap}>
                <Controller
                  control={control}
                  name="isScheduled"
                  render={({ field: { onChange, value } }) => (
                    <>
                      <TouchableOpacity
                        style={[styles.serviceToggleBtn, !value && styles.serviceToggleBtnActive]}
                        onPress={() => onChange(false)}
                      >
                        <Text style={[styles.serviceToggleBtnText, !value && styles.serviceToggleBtnTextActive]}>
                          On Demand
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.serviceToggleBtn, value && styles.serviceToggleBtnActive]}
                        onPress={() => onChange(true)}
                      >
                        <Text style={[styles.serviceToggleBtnText, value && styles.serviceToggleBtnTextActive]}>
                          Scheduled
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                />
              </View>
              {isScheduled && (
                <View style={styles.scheduledFields}>
                  <View style={styles.scheduledRow}>
                    <View style={styles.scheduledField}>
                      <Text style={styles.inputLabelSmall}>PICKUP DATE</Text>
                      <TouchableOpacity
                        style={[styles.dateInput, { backgroundColor: theme.inputBackground ?? theme.background }, errors.scheduledDate && styles.dateInputError]}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                        <Text style={[styles.dateInputText, { color: theme.text }]}>{scheduledDate || "Select date"}</Text>
                      </TouchableOpacity>
                      {errors.scheduledDate?.message ? <Text style={[styles.errorText, { color: theme.error }]}>{errors.scheduledDate.message}</Text> : null}
                    </View>
                    <View style={styles.scheduledField}>
                      <Text style={styles.inputLabelSmall}>PICKUP TIME</Text>
                      <TouchableOpacity
                        style={[styles.dateInput, { backgroundColor: theme.inputBackground ?? theme.background }, errors.scheduledTime && styles.dateInputError]}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
                        <Text style={[styles.dateInputText, { color: theme.text }]}>{scheduledTime || "Select time"}</Text>
                      </TouchableOpacity>
                      {errors.scheduledTime?.message ? <Text style={[styles.errorText, { color: theme.error }]}>{errors.scheduledTime.message}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabelSmall}>PICKUP WINDOW (OPTIONAL)</Text>
                    <Controller
                      control={control}
                      name="scheduledPickupWindow"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[styles.routeInput, { color: theme.text }]}
                          placeholder="e.g. 2:00 PM - 4:00 PM"
                          placeholderTextColor={theme.placeholder}
                          value={value ?? ""}
                          onChangeText={onChange}
                          onBlur={onBlur}
                        />
                      )}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Route & Stops Section (Step 1) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderWithIcon}>
            <Ionicons name="navigate" size={20} color={BeeColors.yellow[400]} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Route & Stops
            </Text>
          </View>
          <View style={styles.routeCard}>
            <View style={styles.stopCardsContainer}>
              <View
                style={[
                  styles.stopCardConnector,
                  { borderLeftColor: BeeColors.yellow[400] + "4D" },
                ]}
              />
              {/* Stop 1: Pickup */}
              <View style={[styles.stopCard, { backgroundColor: "#fff" }]}>
                <View style={[styles.stopDot, styles.stopDotPickup]} />
                <View style={styles.stopCardHeader}>
                  <View style={styles.stopCardTitleBlock}>
                    <Text style={styles.stopLabelPickup}>PICKUP POINT</Text>
                    <Controller
                      control={control}
                      name="pickup"
                      render={({ field: { value } }) => (
                        <Text
                          style={[styles.stopAddress, { color: theme.text }]}
                          numberOfLines={2}
                        >
                          {value && value.trim()
                            ? value.trim()
                            : "Enter address"}
                        </Text>
                      )}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setActiveLocationType("pickup");
                      handleMapFullScreen();
                    }}
                    style={styles.stopEditButton}
                  >
                    <Ionicons name="pencil" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.stopInputRow}>
                  <View style={styles.inputWrapper}>
                    <Controller
                      control={control}
                      name="pickup"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[styles.routeInput, styles.stopAddressInput]}
                          placeholder="Enter pickup address"
                          placeholderTextColor={theme.placeholder}
                          value={pickupSearch.query || value || ""}
                          onChangeText={(text) => {
                            onChange(text);
                            pickupSearch.setQuery(text);
                            if (text.trim() === "") {
                              setPickupCoordinates(null);
                            }
                          }}
                          onFocus={() => {
                            if (isMapFullScreen) return;
                            setActiveLocationType("pickup");
                            pickupSearch.setQuery(value || "");
                          }}
                          onBlur={onBlur}
                        />
                      )}
                    />
                    <TouchableOpacity
                      style={styles.inputActionButton}
                      onPress={() => {
                        setActiveLocationType("pickup");
                        handleMapFullScreen();
                      }}
                    >
                      <Ionicons
                        name="navigate"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {pickupSearch.predictions.length > 0 && (
                  <View style={styles.searchResultsContainer}>
                    <FlatList
                      data={pickupSearch.predictions}
                      keyExtractor={(item) => item.placeId}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.searchResultItem}
                          onPress={() => handlePickupPlaceSelect(item)}
                        >
                          <Ionicons
                            name="location"
                            size={20}
                            color={theme.textSecondary}
                            style={styles.searchResultIcon}
                          />
                          <View style={styles.searchResultText}>
                            <Text style={styles.searchResultMainText}>
                              {item.mainText}
                            </Text>
                            <Text style={styles.searchResultSecondaryText}>
                              {item.secondaryText}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      scrollEnabled={true}
                      nestedScrollEnabled={true}
                    />
                  </View>
                )}
                <View style={styles.stopContactRow}>
                  <View style={[styles.stopContactHalf, { marginRight: 8 }]}>
                    <Controller
                      control={control}
                      name="pickupContactName"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[
                            styles.routeInput,
                            styles.stopContactInput,
                            { color: theme.text },
                          ]}
                          placeholder="Contact name"
                          placeholderTextColor={theme.placeholder}
                          value={value ?? ""}
                          onChangeText={onChange}
                          onBlur={onBlur}
                        />
                      )}
                    />
                  </View>
                  <View style={styles.stopContactHalf}>
                    <Controller
                      control={control}
                      name="pickupContactPhone"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[
                            styles.routeInput,
                            styles.stopContactInput,
                            { color: theme.text },
                            errors.pickupContactPhone && styles.weightInputError,
                          ]}
                          placeholder="09XXXXXXXXX"
                          placeholderTextColor={theme.placeholder}
                          value={value ?? ""}
                          onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 11))}
                          onBlur={onBlur}
                          keyboardType="phone-pad"
                          maxLength={11}
                        />
                      )}
                    />
                    {errors.pickupContactPhone?.message && (
                      <Text style={[styles.inputErrorText, { color: theme.error }]}>
                        {errors.pickupContactPhone.message}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.stopNotesRow}>
                  <Controller
                    control={control}
                    name="pickupNotes"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <TextInput
                        style={[
                          styles.routeInput,
                          styles.stopNotesInput,
                          { color: theme.text },
                        ]}
                        placeholder="Pickup notes (optional)"
                        placeholderTextColor={theme.placeholder}
                        value={value ?? ""}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        multiline
                      />
                    )}
                  />
                </View>
              </View>
              <View style={[styles.stopCard, { backgroundColor: "#fff" }]}>
                <View style={[styles.stopDot, styles.stopDotDropoff]} />
                <View style={styles.stopCardHeader}>
                  <View style={styles.stopCardTitleBlock}>
                    <Text
                      style={[
                        styles.stopLabelDropoff,
                        { color: theme.textMuted },
                      ]}
                    >
                      DROPOFF POINT
                    </Text>
                    <Controller
                      control={control}
                      name="dropoff.address"
                      render={({ field: { value } }) => (
                        <Text
                          style={[
                            styles.stopAddress,
                            { color: theme.text },
                          ]}
                          numberOfLines={2}
                        >
                          {value && value.trim()
                            ? value.trim()
                            : "Enter address"}
                        </Text>
                      )}
                    />
                  </View>
                  <View style={styles.stopCardActions}>
                    <TouchableOpacity
                      style={styles.stopEditButton}
                      onPress={() => {
                        setActiveLocationType("dropoff");
                        handleMapFullScreen();
                      }}
                    >
                      <Ionicons
                        name="pencil"
                        size={18}
                        color={theme.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.stopInputRow}>
                  <View style={styles.inputWrapper}>
                    <Controller
                      control={control}
                      name="dropoff.address"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[
                            styles.routeInput,
                            styles.stopAddressInput,
                          ]}
                          placeholder="Enter dropoff address"
                          placeholderTextColor={theme.placeholder}
                          value={value || ""}
                          onChangeText={(text) => {
                            onChange(text);
                            dropoffSearch.setQuery(text);
                            if (text.trim() === "")
                              setValue("dropoff.coordinates", null);
                          }}
                          onFocus={() => {
                            if (isMapFullScreen) return;
                            setActiveLocationType("dropoff");
                            dropoffSearch.setQuery(value || "");
                          }}
                          onBlur={onBlur}
                        />
                      )}
                    />
                    <TouchableOpacity
                      style={styles.inputActionButton}
                      onPress={() => {
                        setActiveLocationType("dropoff");
                        handleMapFullScreen();
                      }}
                    >
                      <Ionicons
                        name="navigate"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {activeLocationType === "dropoff" &&
                  dropoffSearch.predictions.length > 0 && (
                    <View style={styles.searchResultsContainer}>
                      <FlatList
                        data={dropoffSearch.predictions}
                        keyExtractor={(item) => item.placeId}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.searchResultItem}
                            onPress={() => handleDropoffPlaceSelect(item)}
                          >
                            <Ionicons
                              name="location"
                              size={20}
                              color={theme.textSecondary}
                              style={styles.searchResultIcon}
                            />
                            <View style={styles.searchResultText}>
                              <Text style={styles.searchResultMainText}>
                                {item.mainText}
                              </Text>
                              <Text
                                style={styles.searchResultSecondaryText}
                              >
                                {item.secondaryText}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        scrollEnabled={true}
                        nestedScrollEnabled={true}
                      />
                    </View>
                  )}
                <View style={styles.stopContactRow}>
                  <View
                    style={[styles.stopContactHalf, { marginRight: 8 }]}
                  >
                    <Controller
                      control={control}
                      name="dropoff.contactName"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[
                            styles.routeInput,
                            styles.stopContactInput,
                            { color: theme.text },
                          ]}
                          placeholder="Contact name"
                          placeholderTextColor={theme.placeholder}
                          value={value ?? ""}
                          onChangeText={onChange}
                          onBlur={onBlur}
                        />
                      )}
                    />
                  </View>
                  <View style={styles.stopContactHalf}>
                    <Controller
                      control={control}
                      name="dropoff.contactPhone"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[
                            styles.routeInput,
                            styles.stopContactInput,
                            { color: theme.text },
                            errors.dropoff?.contactPhone && styles.weightInputError,
                          ]}
                          placeholder="09XXXXXXXXX"
                          placeholderTextColor={theme.placeholder}
                          value={value ?? ""}
                          onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 11))}
                          onBlur={onBlur}
                          keyboardType="phone-pad"
                          maxLength={11}
                        />
                      )}
                    />
                    {errors.dropoff?.contactPhone?.message && (
                      <Text style={[styles.inputErrorText, { color: theme.error }]}>
                        {errors.dropoff.contactPhone?.message}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.stopNotesRow}>
                  <Controller
                    control={control}
                    name="dropoff.notes"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <TextInput
                        style={[
                          styles.routeInput,
                          styles.stopNotesInput,
                          { color: theme.text },
                        ]}
                        placeholder="Dropoff notes (optional)"
                        placeholderTextColor={theme.placeholder}
                        value={value ?? ""}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        multiline
                      />
                    )}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Vehicle Type – carousel with details (icon, price, title, description, size, weight) */}
        <View style={[styles.section, styles.sectionFirst]}>
          <View style={styles.vehicleTypeSectionHeader}>
            <View style={styles.sectionHeaderWithIcon}>
              <Ionicons name="car" size={20} color={BeeColors.yellow[400]} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Vehicle Type
              </Text>
            </View>
           
          </View>
          {isVehiclePricingLoading ? (
            <View style={styles.vehicleOptionsLoading}>
              <ActivityIndicator size="small" color={theme.info} />
              <Text style={[styles.vehicleOptionsLoadingText, { color: theme.textSecondary }]}>
                Loading vehicle types…
              </Text>
            </View>
          ) : (
            <>
              {vehiclePricingError ? (
                <View style={styles.vehicleOptionsErrorBanner}>
                  <Text style={[styles.vehicleOptionsErrorText, { color: theme.error }]}>{vehiclePricingError}</Text>
                  <Text style={[styles.vehicleOptionsLoadingText, { color: theme.textSecondary, marginTop: 4 }]}>
                    Using default options below.
                  </Text>
                </View>
              ) : null}
              {isUsingFallbackVehicles ? (
                <Text style={[styles.vehicleOptionsLoadingText, { color: theme.textSecondary, marginBottom: 8 }]}>
                  Using default options. Configure API for live vehicle types.
                </Text>
              ) : null}
              <View style={styles.vehicleOptionsScrollWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.vehicleOptionsScrollView}
                  contentContainerStyle={styles.vehicleOptionsContainer}
                  bounces={true}
                >
                {vehicleOptions.map((option) => {
                  const isSelected = truckType === option.vehicleType;
                  const weightLabel =
                    option.weightLimitKg != null
                      ? `Max ${Number(option.weightLimitKg).toLocaleString()}kg`
                      : "—";
                  const sizeLabel = option.sizeLimit != null && option.sizeLimit !== "" ? option.sizeLimit : "—";
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.vehicleOptionCard,
                        isSelected && styles.vehicleOptionCardSelected,
                        !isSelected && styles.vehicleOptionCardUnselected,
                      ]}
                      onPress={() => setValue("truckType", option.vehicleType)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.vehicleOptionCardTopRow}>
                        <View style={[styles.vehicleOptionIconBox, isSelected && styles.vehicleOptionIconBoxSelected]}>
                          <MaterialCommunityIcons
                            name={getVehicleIconName(option.vehicleType, option.name)}
                            size={16}
                            color={isSelected ? BeeColors.yellow[400] : BeeColors.yellow[600]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.vehicleOptionPrice,
                            isSelected ? styles.vehicleOptionPriceSelected : { color: theme.text },
                          ]}
                          numberOfLines={1}
                        >
                          {option.price || "—"}
                        </Text>
                      </View>
                      <Text style={[styles.vehicleOptionName, isSelected && styles.vehicleOptionNameSelected]}>
                        {option.vehicleType}
                      </Text>
                      {option.name !== option.vehicleType ? (
                        <Text
                          style={[
                            styles.vehicleOptionDescription,
                            { color: isSelected ? theme.text : theme.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {option.name}
                        </Text>
                      ) : null}
                      <View style={styles.vehicleOptionDetailsSpacer} />
                      <View style={styles.vehicleOptionDetails}>
                        <View style={styles.vehicleOptionDetailRow}>
                          <Ionicons
                            name="resize-outline"
                            size={12}
                            color={isSelected ? theme.text : theme.textSecondary}
                          />
                          <Text
                            style={[
                              styles.vehicleOptionDetailText,
                              { color: isSelected ? theme.text : theme.textSecondary },
                            ]}
                            numberOfLines={2}
                          >
                            {typeof sizeLabel === "string" ? sizeLabel : "—"}
                          </Text>
                        </View>
                        <View style={styles.vehicleOptionDetailRow}>
                          <Ionicons
                            name="barbell-outline"
                            size={12}
                            color={isSelected ? BeeColors.yellow[600] : theme.text}
                          />
                          <Text
                            style={[
                              styles.vehicleOptionDetailTextBold,
                              { color: isSelected ? BeeColors.yellow[600] : theme.text },
                            ]}
                            numberOfLines={2}
                          >
                            {typeof weightLabel === "string" ? weightLabel : "—"}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                </ScrollView>
              </View>
            </>
          )}
        </View>

        {/* Delivery Mode – what the customer is buying beyond the delivery itself */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderWithIcon}>
            <Ionicons name="flash" size={20} color={BeeColors.yellow[400]} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Delivery Mode
            </Text>
          </View>
          <View style={styles.step3PaymentCards}>
            {(
              [
                { mode: "Regular" as const, icon: "cube-outline" as const, title: "Regular", subtitle: "Standard delivery." },
                { mode: "OnDemand" as const, icon: "flash-outline" as const, title: "On-Demand", subtitle: "Premium fare, dispatched first, driver found faster." },
                { mode: "Pooling" as const, icon: "people-outline" as const, title: "Pooling", subtitle: "Cheaper fare. May take longer — waits for a driver already heading your way." },
              ]
            ).map((option) => (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.step3PaymentCard,
                  deliveryMode === option.mode && styles.step3PaymentCardSelected,
                  {
                    borderColor: deliveryMode === option.mode ? BeeColors.yellow[400] : theme.border,
                    backgroundColor: deliveryMode === option.mode ? BeeColors.yellow[400] + "11" : "transparent",
                  },
                ]}
                onPress={() => setDeliveryMode(option.mode)}
                activeOpacity={0.8}
              >
                <View style={[styles.step3PaymentCardIcon, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
                  <Ionicons name={option.icon} size={24} color={theme.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.step3PaymentCardTitle, { color: theme.text }]}>{option.title}</Text>
                  <Text style={[styles.step3PaymentCardSubtitle, { color: theme.textSecondary }]}>{option.subtitle}</Text>
                </View>
                <View style={[styles.step3PaymentRadio, deliveryMode === option.mode && { borderColor: BeeColors.yellow[400], backgroundColor: BeeColors.yellow[400] }]}>
                  {deliveryMode === option.mode && <Ionicons name="checkmark" size={14} color="#1d180c" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Additional Services – collapsible (UI only; not sent to API yet) */}
        <View style={styles.additionalServicesSection}>
          <TouchableOpacity
            style={styles.additionalServicesHeader}
            onPress={() => setAdditionalServicesExpanded(!additionalServicesExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.additionalServicesHeaderLeft}>
              <Ionicons name="add-circle-outline" size={20} color={BeeColors.yellow[400]} />
              <Text style={[styles.additionalServicesTitle, { color: theme.text }]}>Additional Services</Text>
            </View>
            <Ionicons
              name={additionalServicesExpanded ? "chevron-up" : "chevron-down"}
              size={22}
              color={BeeColors.yellow[400]}
            />
          </TouchableOpacity>
          {additionalServicesExpanded && (
            <View style={styles.additionalServicesContent}>
              <TouchableOpacity
                style={[styles.additionalServiceRow, { backgroundColor: theme.surface ?? "#fff" }]}
                onPress={() => setAdditionalDocumentHandling(!additionalDocumentHandling)}
                activeOpacity={0.8}
              >
                <View style={styles.additionalServiceLeft}>
                  <View style={[styles.additionalServiceCheck, additionalDocumentHandling && styles.additionalServiceCheckSelected]}>
                    {additionalDocumentHandling && <Ionicons name="checkmark" size={12} color="#1d180c" />}
                  </View>
                  <View>
                    <Text style={[styles.additionalServiceName, { color: theme.text }]}>Document Handling</Text>
                    <Text style={[styles.additionalServiceDesc, { color: theme.textSecondary }]}>Includes secure envelope</Text>
                  </View>
                </View>
                <Text style={[styles.additionalServicePrice, { color: theme.text }]}>PHP 0.00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.additionalServiceRow, { backgroundColor: theme.surface ?? "#fff" }]}
                onPress={() => setAdditionalTollFees(!additionalTollFees)}
                activeOpacity={0.8}
              >
                <View style={styles.additionalServiceLeft}>
                  <View style={[styles.additionalServiceCheck, additionalTollFees && styles.additionalServiceCheckSelected]}>
                    {additionalTollFees && <Ionicons name="checkmark" size={12} color="#1d180c" />}
                  </View>
                  <View>
                    <Text style={[styles.additionalServiceName, { color: theme.text }]}>Toll Fees</Text>
                    <Text style={[styles.additionalServiceDesc, { color: theme.textSecondary }]}>Skyway & Expressways</Text>
                  </View>
                </View>
                <Text style={[styles.additionalServicePrice, { color: theme.text }]}>PHP 0.00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.additionalServiceRow, { backgroundColor: theme.surface ?? "#fff" }]}
                onPress={() => setAdditionalRoundTrip(!additionalRoundTrip)}
                activeOpacity={0.8}
              >
                <View style={styles.additionalServiceLeft}>
                  <View style={[styles.additionalServiceCheck, additionalRoundTrip && styles.additionalServiceCheckSelected]}>
                    {additionalRoundTrip && <Ionicons name="checkmark" size={12} color="#1d180c" />}
                  </View>
                  <View>
                    <Text style={[styles.additionalServiceName, { color: theme.text }]}>Round Trip</Text>
                    <Text style={[styles.additionalServiceDesc, { color: theme.textSecondary }]}>Return to pickup location</Text>
                  </View>
                </View>
                <Text style={[styles.additionalServicePrice, { color: theme.text }]}>PHP 0.00</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
          </>
        )}

        {/* Date / Time pickers for Scheduled (shared by Service & Timing section) */}
        {showDatePicker &&
          (() => {
            const currentDate = scheduledDate
              ? new Date(scheduledDate + "T00:00:00")
              : new Date();
            return Platform.OS === "ios" ? (
              <Modal
                transparent
                animationType="slide"
                visible={showDatePicker}
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.pickerModalContainer}>
                  <View style={styles.pickerModalContent}>
                    <View style={styles.pickerModalHeader}>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text
                          style={[
                            styles.pickerModalButton,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={[styles.pickerModalTitle, { color: theme.text }]}
                      >
                        Select Date
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text
                          style={[
                            styles.pickerModalButton,
                            { color: theme.primary },
                          ]}
                        >
                          Done
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={currentDate}
                      mode="date"
                      display="spinner"
                      minimumDate={new Date()}
                      onChange={(_event: any, selectedDate?: Date) => {
                        if (selectedDate) {
                          const y = selectedDate.getFullYear();
                          const m = String(
                            selectedDate.getMonth() + 1,
                          ).padStart(2, "0");
                          const d = String(selectedDate.getDate()).padStart(
                            2,
                            "0",
                          );
                          setValue("scheduledDate", `${y}-${m}-${d}`);
                        }
                        setShowDatePicker(false);
                      }}
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={currentDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(_event: any, selectedDate?: Date) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    const y = selectedDate.getFullYear();
                    const m = String(selectedDate.getMonth() + 1).padStart(
                      2,
                      "0",
                    );
                    const d = String(selectedDate.getDate()).padStart(2, "0");
                    setValue("scheduledDate", `${y}-${m}-${d}`);
                  }
                }}
              />
            );
          })()}
        {showTimePicker &&
          (() => {
            const [hours = 10, minutes = 0] = (scheduledTime || "10:00")
              .split(":")
              .map(Number);
            const currentTime = new Date();
            currentTime.setHours(hours, minutes, 0, 0);
            return Platform.OS === "ios" ? (
              <Modal
                transparent
                animationType="slide"
                visible={showTimePicker}
                onRequestClose={() => setShowTimePicker(false)}
              >
                <View style={styles.pickerModalContainer}>
                  <View style={styles.pickerModalContent}>
                    <View style={styles.pickerModalHeader}>
                      <TouchableOpacity
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text
                          style={[
                            styles.pickerModalButton,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={[styles.pickerModalTitle, { color: theme.text }]}
                      >
                        Select Time
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text
                          style={[
                            styles.pickerModalButton,
                            { color: theme.primary },
                          ]}
                        >
                          Done
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={currentTime}
                      mode="time"
                      display="spinner"
                      onChange={(_event: any, selectedTime?: Date) => {
                        if (selectedTime) {
                          const h = String(selectedTime.getHours()).padStart(
                            2,
                            "0",
                          );
                          const min = String(
                            selectedTime.getMinutes(),
                          ).padStart(2, "0");
                          setValue("scheduledTime", `${h}:${min}`);
                        }
                        setShowTimePicker(false);
                      }}
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={currentTime}
                mode="time"
                display="default"
                onChange={(_event: any, selectedTime?: Date) => {
                  setShowTimePicker(false);
                  if (selectedTime) {
                    const h = String(selectedTime.getHours()).padStart(2, "0");
                    const min = String(selectedTime.getMinutes()).padStart(
                      2,
                      "0",
                    );
                    setValue("scheduledTime", `${h}:${min}`);
                  }
                }}
              />
            );
          })()}

        {/* Step 2: Cargo Details – design: title, subtitle, Weight → Description → Notes → Dimensions → Tip → Image */}
        {wizardStep === 2 && (
          <>
        <View style={styles.step2Content}>
          <Text style={[styles.step2Title, { color: theme.text }]}>Cargo Details</Text>
          <Text style={[styles.step2Subtitle, { color: theme.textSecondary }]}>
            Tell us more about the items you're sending so we can assign the right vehicle.
          </Text>
          <View style={styles.packageCard}>
            <View style={styles.packageContent}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabelSmall, styles.step2Label]}>WEIGHT (KG) *</Text>
                {selectedVehicleWeightLimitKg != null && (
                  <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 6 }}>
                    Max {selectedVehicleWeightLimitKg.toLocaleString()}kg for {truckType}
                  </Text>
                )}
                <View
                  style={[
                    styles.weightInputContainer,
                    (errors.weight || weightExceedsVehicleLimit) && styles.weightInputError,
                  ]}
                >
                  <Controller
                    control={control}
                    name="weight"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <TextInput
                        style={styles.weightInput}
                        placeholder="e.g. 5.5"
                        placeholderTextColor={theme.placeholder}
                        value={value || ""}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="numeric"
                      />
                    )}
                  />
                  <View style={styles.weightUnit}>
                    <Text style={styles.weightUnitText}>KG</Text>
                  </View>
                </View>
                {errors.weight?.message && (
                  <Text
                    style={[styles.inputErrorText, { color: theme.error }]}
                  >
                    {errors.weight.message}
                  </Text>
                )}
                {!errors.weight?.message && weightExceedsVehicleLimit && (
                  <Text style={[styles.inputErrorText, { color: theme.error }]}>
                    Weight exceeds the {selectedVehicleWeightLimitKg?.toLocaleString()}kg limit for {truckType}. Reduce the weight or choose a bigger vehicle.
                  </Text>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabelSmall, styles.step2Label]}>CARGO DESCRIPTION</Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <TextInput
                      style={[styles.descriptionInput, styles.step2TextArea, { color: theme.text, borderColor: BeeColors.yellow[400] + "33", backgroundColor: theme.surface ?? "#fff" }]}
                      placeholder="What are you sending? (e.g. 2 boxes of books, fragile glass)"
                      placeholderTextColor={theme.placeholder}
                      value={value || ""}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  )}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabelSmall, styles.step2Label]}>NOTES FOR DRIVER</Text>
                <Controller
                  control={control}
                  name="notesForDriver"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <TextInput
                      style={[styles.routeInput, styles.stopNotesInput, styles.step2TextArea, { color: theme.text, borderColor: BeeColors.yellow[400] + "33", backgroundColor: theme.surface ?? "#fff" }]}
                      placeholder="Special instructions (e.g. gate code, knock softly)"
                      placeholderTextColor={theme.placeholder}
                      value={value ?? ""}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                    />
                  )}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabelSmall, styles.step2Label]}>DIMENSIONS (CM)</Text>
                <View style={styles.dimensionsRow}>
                  <View style={styles.dimensionField}>
                    <Text style={[styles.dimensionLabel, { color: theme.textSecondary }]}>Length</Text>
                    <Controller
                      control={control}
                      name="lengthCm"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[styles.dimensionsInput, { color: theme.text, backgroundColor: theme.inputBackground ?? theme.background, borderColor: theme.border }]}
                          placeholder="0"
                          placeholderTextColor={theme.placeholder}
                          value={value ?? ""}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          keyboardType="decimal-pad"
                        />
                      )}
                    />
                    <Text style={[styles.dimensionUnit, { color: theme.textSecondary }]}>cm</Text>
                  </View>
                  <View style={styles.dimensionField}>
                    <Text style={[styles.dimensionLabel, { color: theme.textSecondary }]}>Width</Text>
                    <Controller
                      control={control}
                      name="widthCm"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[styles.dimensionsInput, { color: theme.text, backgroundColor: theme.inputBackground ?? theme.background, borderColor: theme.border }]}
                          placeholder="0"
                          placeholderTextColor={theme.placeholder}
                          value={value ?? ""}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          keyboardType="decimal-pad"
                        />
                      )}
                    />
                    <Text style={[styles.dimensionUnit, { color: theme.textSecondary }]}>cm</Text>
                  </View>
                  <View style={styles.dimensionField}>
                    <Text style={[styles.dimensionLabel, { color: theme.textSecondary }]}>Height</Text>
                    <Controller
                      control={control}
                      name="heightCm"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <TextInput
                          style={[styles.dimensionsInput, { color: theme.text, backgroundColor: theme.inputBackground ?? theme.background, borderColor: theme.border }]}
                          placeholder="0"
                          placeholderTextColor={theme.placeholder}
                          value={value ?? ""}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          keyboardType="decimal-pad"
                        />
                      )}
                    />
                    <Text style={[styles.dimensionUnit, { color: theme.textSecondary }]}>cm</Text>
                  </View>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <View style={styles.tipLabelRow}>
                  <Text style={[styles.inputLabelSmall, styles.step2Label]}>TIP (OPTIONAL)</Text>
                  <View style={styles.tipBadge}>
                    <Text style={styles.tipBadgeText}>Make a driver's day</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.tipInputRow,
                    styles.step2TipInputRow,
                    errors.tipAmount && styles.weightInputError,
                  ]}
                >
                  <View style={styles.tipCurrency}>
                    <Text style={[styles.tipCurrencyText, { color: theme.text }]}>₱</Text>
                  </View>
                  <Controller
                    control={control}
                    name="tipAmount"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <TextInput
                        style={[styles.tipInput, { color: theme.text }]}
                        placeholder="0.00"
                        placeholderTextColor={theme.placeholder}
                        value={value || ""}
                        keyboardType="numeric"
                        onChangeText={onChange}
                        onBlur={() => {
                          const raw = value || "";
                          const normalized = raw.replace(/[₱,\s]/g, "");
                          const num = parseFloat(normalized);
                          if (!Number.isNaN(num) && num >= 0) {
                            const formatted = num.toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                            onChange(formatted);
                          }
                          onBlur();
                        }}
                      />
                    )}
                  />
                  <View style={styles.tipQuickButtons}>
                    <TouchableOpacity
                      style={styles.tipQuickButton}
                      onPress={() => setValue("tipAmount", "20.00")}
                    >
                      <Text style={styles.tipQuickButtonText}>₱20</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.tipQuickButton}
                      onPress={() => setValue("tipAmount", "50.00")}
                    >
                      <Text style={styles.tipQuickButtonText}>₱50</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {errors.tipAmount?.message && (
                  <Text style={[styles.inputErrorText, { color: theme.error }]}>{errors.tipAmount.message}</Text>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabelSmall, styles.step2Label]}>
                  TIP MESSAGE / COMMENT (OPTIONAL)
                </Text>
                <Controller
                  control={control}
                  name="tipMessage"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <TextInput
                      style={styles.descriptionInput}
                      placeholder="Thank you for your help..."
                      placeholderTextColor={theme.placeholder}
                      value={value || ""}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  )}
                />
              </View>
              {/* Item Image Section */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabelSmall}>
                  ITEM IMAGE *
                </Text>
                {itemImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: itemImage.uri }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={handleRemoveImage}
                    >
                      <Ionicons
                        name="close-circle"
                        size={24}
                        color={theme.error}
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.imagePickerButton}
                    onPress={handleItemImagePress}
                  >
                    <Ionicons name="camera" size={24} color={theme.primary} />
                    <Text style={styles.imagePickerText}>
                      Upload Image of Item
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
          </>
        )}

        {/* Step 3: Payment Method (design: in scroll) + Booking Summary */}
        {wizardStep === 3 && (
          <>
        <View style={styles.section}>
          <Text style={[styles.step3SectionTitle, { color: theme.text }]}>Payment Method</Text>
          <View style={styles.step3PaymentCards}>
            <TouchableOpacity
              style={[
                styles.step3PaymentCard,
                paymentMethod === "Cash" && styles.step3PaymentCardSelected,
                { borderColor: paymentMethod === "Cash" ? BeeColors.yellow[400] : theme.border, backgroundColor: paymentMethod === "Cash" ? BeeColors.yellow[400] + "11" : "transparent" },
              ]}
              onPress={() => setPaymentMethod("Cash")}
              activeOpacity={0.8}
            >
              <View style={[styles.step3PaymentCardIcon, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
                <Ionicons name="cash-outline" size={24} color={theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.step3PaymentCardTitle, { color: theme.text }]}>Cash on Delivery</Text>
                <Text style={[styles.step3PaymentCardSubtitle, { color: theme.textSecondary }]}>Pay at your doorstep</Text>
              </View>
              <View style={[styles.step3PaymentRadio, paymentMethod === "Cash" && { borderColor: BeeColors.yellow[400], backgroundColor: BeeColors.yellow[400] }]}>
                {paymentMethod === "Cash" && <Ionicons name="checkmark" size={14} color="#1d180c" />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.step3PaymentCard,
                paymentMethod === "Pay online" && styles.step3PaymentCardSelected,
                { borderColor: paymentMethod === "Pay online" ? BeeColors.yellow[400] : theme.border, backgroundColor: paymentMethod === "Pay online" ? BeeColors.yellow[400] + "11" : "transparent" },
              ]}
              onPress={() => setPaymentMethod("Pay online")}
              activeOpacity={0.8}
            >
              <View style={[styles.step3PaymentCardIcon, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
                <Ionicons name="card-outline" size={24} color={theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.step3PaymentCardTitle, { color: theme.text }]}>Pay online</Text>
                <Text style={[styles.step3PaymentCardSubtitle, { color: theme.textSecondary }]}>Fast and secure</Text>
              </View>
              <View style={[styles.step3PaymentRadio, paymentMethod === "Pay online" && { borderColor: BeeColors.yellow[400], backgroundColor: BeeColors.yellow[400] }]}>
                {paymentMethod === "Pay online" && <Ionicons name="checkmark" size={14} color="#1d180c" />}
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.step3SectionTitle, { color: theme.text, marginBottom: 12 }]}>
            Booking Summary
          </Text>
          <View style={[styles.summaryCard, { backgroundColor: theme.surface ?? "#fff", borderColor: theme.border }]}>
            <View style={styles.summaryRouteRow}>
              <View style={styles.summaryRouteDots}>
                <Ionicons name="radio-button-on" size={14} color={BeeColors.yellow[400]} />
                <View style={[styles.summaryRouteLine, { backgroundColor: theme.border }]} />
                <Ionicons name="location" size={14} color={BeeColors.red[500]} />
              </View>
              <View style={styles.summaryAddresses}>
                <View>
                  <Text style={styles.summaryLabel}>PICKUP</Text>
                  <Text style={[styles.summaryAddressText, { color: theme.text }]} numberOfLines={2}>
                    {pickup?.trim() || "—"}
                  </Text>
                </View>
                <View>
                  <Text style={styles.summaryLabel}>DROPOFF</Text>
                  <Text style={[styles.summaryAddressText, { color: theme.text }]} numberOfLines={2}>
                    {dropoff?.address?.trim() || "—"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryVehicleRow}>
              <View style={styles.summaryVehicleLeft}>
                <View style={[styles.summaryVehicleIcon, { backgroundColor: BeeColors.yellow[400] + "22" }]}>
                  <MaterialCommunityIcons
                    name={getVehicleIconName(truckType || "", selectedVehicleOption?.name)}
                    size={24}
                    color={BeeColors.yellow[400]}
                  />
                </View>
                <View>
                  <Text style={[styles.summarySubtext, { color: theme.textSecondary }]}>Vehicle Type</Text>
                  <Text style={[styles.summaryVehicleName, { color: theme.text }]}>{truckType || "—"}</Text>
                </View>
              </View>
              <View style={styles.summaryTotalBlock}>
                <Text style={[styles.summarySubtext, { color: theme.textSecondary }]}>Estimated Fare</Text>
                <Text style={[styles.summaryTotalFare, { color: theme.text }]}>
                  {fareResult?.totalFare != null ? `₱${Number(fareResult.totalFare).toLocaleString()}` : "—"}
                </Text>
              </View>
            </View>
            {fareResult?.breakdown ? (
              <>
                <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
                <View style={styles.fareBreakdownContainer}>
                  {fareResult.breakdown.split("\n").map((line, i) => (
                    <Text
                      key={i}
                      style={[
                        styles.fareBreakdownLine,
                        { color: line.startsWith("Total:") ? theme.text : theme.textSecondary },
                        line.startsWith("Total:") && styles.fareBreakdownTotalLine,
                      ]}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>
          </>
        )}

        {/* Extra spacing for bottom bar */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Fixed Bottom Bar – step-specific: Step 1/2 Next CTA, Step 3 Payment + Confirm */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 32 }]}>
        {/* Step 1 footer: Estimated + Next: Cargo Details */}
        {wizardStep === 1 && (
          <>
            <View style={styles.bottomBarHeader}>
              <View>
                <Text style={styles.estimatedLabel}>ESTIMATED FARE</Text>
                {calculateFareMutation.isPending ? (
                  <Text style={[styles.estimatedTotal, { color: theme.textSecondary }]}>Calculating…</Text>
                ) : fareResult?.totalFare != null ? (
                  <Text style={[styles.estimatedTotal, { color: theme.text }]}>
                    ₱{Number(fareResult.totalFare).toLocaleString()}
                  </Text>
                ) : (
                  <Text style={[styles.estimatedTotal, { color: theme.textSecondary, fontSize: 14 }]}>
                    Enter pickup, dropoff & vehicle
                  </Text>
                )}
                {fareResult?.distanceKm != null && (
                  <Text style={[styles.estimatedDistance, { color: theme.textSecondary }]}>
                    ~{fareResult.distanceKm.toFixed(1)} km
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.confirmButton, styles.wizardNextButton]}
              onPress={() => {
                const hasPickup = !!pickup?.trim();
                const hasDropoff = !!dropoff.address?.trim();
                if (!hasPickup) {
                  Alert.alert("Missing pickup", "Please enter a pickup address.");
                  return;
                }
                if (!pickupContactName?.trim() || !pickupContactPhone?.trim()) {
                  Alert.alert(
                    "Missing pickup contact",
                    "Please enter a contact name and phone number for the pickup point."
                  );
                  return;
                }
                if (!PH_PHONE_REGEX.test(pickupContactPhone.trim())) {
                  Alert.alert("Invalid pickup phone", PHONE_VALIDATION_MESSAGE);
                  return;
                }
                if (!hasDropoff) {
                  Alert.alert("Missing dropoff", "Please enter a dropoff address.");
                  return;
                }
                if (!dropoff.contactName?.trim() || !dropoff.contactPhone?.trim()) {
                  Alert.alert(
                    "Missing dropoff contact",
                    "Please enter a contact name and phone number for the dropoff point."
                  );
                  return;
                }
                if (!PH_PHONE_REGEX.test(dropoff.contactPhone.trim())) {
                  Alert.alert("Invalid dropoff phone", PHONE_VALIDATION_MESSAGE);
                  return;
                }
                if (!pickupCoordinates || !dropoff.coordinates) {
                  Alert.alert(
                    "Pin your locations",
                    "Please set an exact pickup and dropoff location on the map for an accurate price."
                  );
                  return;
                }
                if (!truckType) {
                  Alert.alert("Select vehicle", "Please select a vehicle type.");
                  return;
                }
                if (isScheduled && (!scheduledDate?.trim() || !scheduledTime?.trim())) {
                  Alert.alert("Schedule required", "Please select date and time for scheduled pickup.");
                  return;
                }
                setWizardStep(2);
              }}
              activeOpacity={0.98}
            >
              <Text style={styles.confirmButtonText}>Next: Cargo Details</Text>
              <Ionicons name="arrow-forward" size={22} color="#1d180c" />
            </TouchableOpacity>
          </>
        )}

        {/* Step 2 footer: Estimated + Base badge + Next: Payment Method (design) */}
        {wizardStep === 2 && (
          <>
            <View style={styles.bottomBarHeader}>
              <View>
                <Text style={styles.estimatedLabel}>ESTIMATED TOTAL</Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text style={[styles.estimatedTotal, { color: theme.text }]}>
                    {fareResult?.totalFare != null ? `₱${Number(fareResult.totalFare).toLocaleString()}` : "—"}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.confirmButton, styles.wizardNextButton]}
              onPress={() => {
                if (!weight?.trim()) {
                  Alert.alert("Weight required", "Please enter the cargo weight (kg).");
                  return;
                }
                const num = parseFloat(weight.trim());
                if (Number.isNaN(num) || num <= 0) {
                  Alert.alert("Invalid weight", "Please enter a valid weight (e.g. 5.5).");
                  return;
                }
                if (selectedVehicleWeightLimitKg != null && num > selectedVehicleWeightLimitKg) {
                  Alert.alert(
                    "Weight exceeds vehicle limit",
                    `${truckType} can carry up to ${selectedVehicleWeightLimitKg.toLocaleString()}kg. Please reduce the weight or choose a bigger vehicle.`
                  );
                  return;
                }
                if (!itemImage) {
                  Alert.alert("Item image required", "Please upload an image of the item to be delivered.");
                  return;
                }
                setWizardStep(3);
              }}
              activeOpacity={0.98}
            >
              <Text style={styles.confirmButtonText}>Next: Payment Method</Text>
              <Ionicons name="arrow-forward" size={22} color="#1d180c" />
            </TouchableOpacity>
          </>
        )}

        {/* Step 3 footer: Amount to pay + Confirm & Request Bee (design) */}
        {wizardStep === 3 && (
          <>
        <View style={styles.step3FooterRow}>
          <Text style={[styles.step3AmountLabel, { color: theme.textSecondary }]}>Amount to pay</Text>
          <Text style={[styles.step3AmountValue, { color: theme.text }]}>
            {fareResult?.totalFare != null ? `₱${Number(fareResult.totalFare).toLocaleString()}` : "—"}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (isCreatePending ||
              !fareResult?.totalFare ||
              isWaitingForPaymentConfirmation ||
              isCreatingPayment) &&
            styles.confirmButtonDisabled,
          ]}
          onPress={() => {
            if (fareChangeNotice && !hasConfirmedFare) {
              Alert.alert(
                "Confirm updated fare",
                `New total: ₱${Number(fareResult?.totalFare ?? 0).toLocaleString()}. Book at this price?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Confirm & Book",
                    onPress: () => {
                      setHasConfirmedFare(true);
                      setFareChangeNotice(null);
                      handleSubmit();
                    },
                  },
                ]
              );
              return;
            }
            handleSubmit();
          }}
          disabled={
            isCreatePending ||
            !fareResult?.totalFare ||
            isWaitingForPaymentConfirmation ||
            isCreatingPayment
          }
          activeOpacity={0.98}
        >
          {(isCreatePending || isCreatingPayment || isWaitingForPaymentConfirmation) && (
            <View style={styles.confirmButtonSpinner}>
              <ActivityIndicator size="small" color="#1d180c" />
            </View>
          )}
          <Text style={styles.confirmButtonText}>
            {isCreatePending
              ? "Creating…"
              : isCreatingPayment
                ? "Creating payment…"
                : isWaitingForPaymentConfirmation
                  ? "Processing payment…"
                  : "Confirm & Request Bee"}
          </Text>
          {!(isCreatePending || isCreatingPayment || isWaitingForPaymentConfirmation) && (
            <Ionicons name="flash" size={22} color="#1d180c" />
          )}
        </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

/** Design: Create Booking screen colors */
const BOOKING_SCREEN_BG = "#f8f8f5";
const BOOKING_CARD_BORDER = "#f3f4f6";
const BOOKING_INPUT_BG = "#f9fafb";

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: BOOKING_SCREEN_BG,
    },
    scrollViewBackground: {
      backgroundColor: BOOKING_SCREEN_BG,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      backgroundColor: "rgba(255,255,255,0.9)",
      borderBottomWidth: 1,
      borderBottomColor: BOOKING_CARD_BORDER,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    backButtonDisabled: {
      opacity: 0.5,
    },
    headerCenter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    beeIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    beeIcon: {
      width: 20,
      height: 20,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    moreButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    headerStep2: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerCenterStep2: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitleStep2: {
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    headerStepLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: BeeColors.yellow[400],
      letterSpacing: 2,
      marginTop: 2,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    progressBarTrack: {
      height: 6,
      backgroundColor: BeeColors.yellow[400] + "33",
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 999,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      width: "100%",
      backgroundColor: BeeColors.yellow[400],
      borderRadius: 999,
    },
    wizardProgressRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    wizardProgressSegment: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: BeeColors.yellow[400] + "33",
      overflow: "hidden",
    },
    wizardProgressSegmentFilled: {
      backgroundColor: BeeColors.yellow[400],
    },
    additionalServicesSection: {
      marginTop: 8,
      marginBottom: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: BeeColors.yellow[400] + "33",
      backgroundColor: BeeColors.yellow[400] + "11",
      overflow: "hidden",
    },
    additionalServicesHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
    },
    additionalServicesHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    additionalServicesTitle: {
      fontSize: 14,
      fontWeight: "700",
    },
    additionalServicesContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 12,
    },
    additionalServiceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      borderRadius: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    additionalServiceLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    additionalServiceCheck: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    additionalServiceCheckSelected: {
      borderColor: BeeColors.yellow[400],
      backgroundColor: BeeColors.yellow[400],
    },
    additionalServiceName: {
      fontSize: 12,
      fontWeight: "700",
    },
    additionalServiceDesc: {
      fontSize: 10,
      marginTop: 2,
    },
    additionalServicePrice: {
      fontSize: 12,
      fontWeight: "700",
    },
    scrollContent: {
      paddingTop: 16,
      paddingBottom: 20,
    },
    mapSection: {
      height: 256,
      width: "100%",
      position: "relative",
    },
    mapSectionFullScreen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      backgroundColor: theme.surface,
    },
    mapContainer: {
      width: "100%",
      height: "100%",
      position: "relative",
    },
    mapView: {
      width: "100%",
      height: "100%",
    },
    mapExpandButton: {
      position: "absolute",
      top: 16,
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.surface,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapImage: {
      width: "100%",
      height: "100%",
    },
    fullScreenMapContainer: {
      flex: 1,
      width: "100%",
      height: "100%",
      backgroundColor: theme.surface,
    },
    fullScreenMapHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    fullScreenMapTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    fullScreenMapCloseButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    fullScreenMapView: {
      flex: 1,
      width: "100%",
    },
    fullScreenMapConfirmContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 16,
      paddingHorizontal: 16,
      paddingTop: 16,
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 10,
    },
    fullScreenMapConfirmContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    fullScreenMapConfirmInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 12,
    },
    fullScreenMapConfirmText: {
      flex: 1,
    },
    fullScreenMapConfirmLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    fullScreenMapConfirmAddress: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.text,
    },
    fullScreenMapConfirmButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      minWidth: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    pickupConfirmButton: {
      backgroundColor: theme.success,
    },
    dropoffConfirmButton: {
      backgroundColor: theme.error,
    },
    fullScreenMapConfirmButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.surface,
    },
    searchResultsContainer: {
      marginTop: 8,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      maxHeight: 200,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    searchResultItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchResultIcon: {
      marginRight: 12,
    },
    searchResultText: {
      flex: 1,
    },
    searchResultMainText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.text,
      marginBottom: 2,
    },
    searchResultSecondaryText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    locationButton: {
      position: "absolute",
      top: 16,
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.surface,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    fullScreenMapSearchContainer: {
      position: "absolute",
      top: 100, // Below the header with spacing
      left: 16,
      right: 16,
      zIndex: 10,
    },
    mapSearchInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapSearchIcon: {
      marginRight: 8,
    },
    mapSearchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      padding: 0,
    },
    mapSearchClearButton: {
      marginLeft: 8,
      padding: 4,
    },
    useMyLocationButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: theme.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    useMyLocationButtonText: {
      fontSize: 14,
      fontWeight: "600",
    },
    mapSearchLocationIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 8,
    },
    pickupIconBadge: {
      backgroundColor: theme.success, // Green
    },
    dropoffIconBadge: {
      backgroundColor: theme.error, // Red
    },
    mapSearchResults: {
      marginTop: 8,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      maxHeight: 200,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      overflow: "hidden",
    },
    mapSearchResultItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    mapSearchResultIcon: {
      marginRight: 12,
    },
    mapSearchResultText: {
      flex: 1,
    },
    mapSearchResultMainText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.text,
      marginBottom: 2,
    },
    mapSearchResultSecondaryText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    mapOverlay: {
      position: "absolute",
      bottom: 16,
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface + "F2",
      borderRadius: 12,
      padding: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    overlayItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    overlayIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.inputBackground,
      justifyContent: "center",
      alignItems: "center",
    },
    overlayLabel: {
      fontSize: 10,
      fontWeight: "500",
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    overlayLabelRight: {
      textAlign: "right",
    },
    overlayValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    overlayDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.border,
      marginHorizontal: 12,
    },
    section: {
      paddingHorizontal: 16,
      marginTop: 24,
    },
    sectionFirst: {
      marginTop: 16,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionHeaderRowWithIcon: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    sectionHeaderWithIcon: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    editMapLink: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.primaryDark,
    },
    routeCard: {
      backgroundColor: "transparent",
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    routeContainer: {
      position: "relative",
      paddingLeft: 8,
    },
    routeLine: {
      position: "absolute",
      left: 19,
      top: 32,
      bottom: 32,
      width: 2,
      backgroundColor: theme.border,
      borderLeftWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.borderDark,
    },
    stopCardsContainer: {
      position: "relative",
      gap: 16,
    },
    stopCardConnector: {
      position: "absolute",
      left: 22,
      top: 28,
      bottom: 28,
      width: 0,
      borderLeftWidth: 2,
      borderStyle: "dashed",
    },
    stopCard: {
      position: "relative",
      paddingLeft: 48,
      paddingRight: 16,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: BOOKING_CARD_BORDER,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    stopDot: {
      position: "absolute",
      left: 14,
      top: 20,
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    stopDotPickup: {
      backgroundColor: BeeColors.yellow[400],
      borderWidth: 0,
    },
    stopDotDropoff: {
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: BeeColors.yellow[400],
    },
    stopCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    stopCardTitleBlock: {
      flex: 1,
    },
    stopCardActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stopLabelPickup: {
      fontSize: 11,
      fontWeight: "700",
      color: BeeColors.yellow[400],
      letterSpacing: 1,
      marginBottom: 4,
    },
    stopLabelDropoff: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 4,
    },
    stopAddress: {
      fontSize: 14,
      fontWeight: "600",
    },
    stopEditButton: {
      padding: 4,
    },
    stopInputRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    stopAddressInput: {
      marginRight: 0,
    },
    stopContactRow: {
      flexDirection: "row",
      marginTop: 12,
    },
    stopContactHalf: {
      flex: 1,
    },
    stopContactInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      fontSize: 14,
      backgroundColor: BOOKING_INPUT_BG,
    },
    stopNotesRow: {
      marginTop: 8,
    },
    stopNotesInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      fontSize: 14,
      minHeight: 56,
      backgroundColor: BOOKING_INPUT_BG,
    },
    addStopButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderWidth: 2,
      borderStyle: "dashed",
      borderRadius: 12,
      marginTop: 8,
    },
    addStopButtonText: {
      fontSize: 14,
      fontWeight: "700",
    },
    addDropoffButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingLeft: 8,
      marginBottom: 8,
    },
    addDropoffText: {
      fontSize: 14,
      fontWeight: "600",
    },
    routeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 4,
      borderWidth: 4,
      borderColor: theme.surface,
    },
    pickupIcon: {
      backgroundColor: theme.success + "20", // success with 20% opacity
    },
    dropoffIcon: {
      backgroundColor: theme.error + "20", // error with 20% opacity
    },
    routeInputContainer: {
      flex: 1,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.textSecondary,
      marginBottom: 4,
    },
    inputLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    openMapsButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    openMapsText: {
      fontSize: 11,
      fontWeight: "600",
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBackground,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dimensionsRow: {
      flexDirection: "row",
      gap: 12,
    },
    dimensionField: {
      flex: 1,
      position: "relative",
    },
    dimensionLabel: {
      fontSize: 11,
      fontWeight: "600",
      marginBottom: 4,
    },
    dimensionsInput: {
      paddingHorizontal: 10,
      paddingVertical: 10,
      paddingRight: 28,
      fontSize: 14,
      borderRadius: 8,
      borderWidth: 1,
    },
    dimensionUnit: {
      position: "absolute",
      right: 10,
      bottom: 10,
      fontSize: 12,
      fontWeight: "600",
    },
    routeInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: "500",
      color: theme.text,
    },
    inputActionButton: {
      padding: 8,
    },
    logisticsCard: {
      backgroundColor: "transparent",
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    dateInputError: {
      borderColor: theme.error,
      borderWidth: 1.5,
    },
    weightInputError: {
      borderColor: theme.error,
      borderWidth: 1.5,
    },
    inputErrorText: {
      fontSize: 12,
      marginTop: 4,
    },
    logisticsContent: {
      marginTop: 12,
      gap: 16,
    },
    inputGroup: {
      gap: 6,
    },
    inputLabelLarge: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    availableOptionsTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 16,
    },
    vehicleTypeSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    vehicleTypeViewMapButton: {
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    vehicleTypeViewMapText: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    vehicleOptionsScrollWrap: {
      width: "100%",
    },
    vehicleOptionsScrollView: {
      flexGrow: 0,
      flexShrink: 0,
    },
    vehicleOptionsContainer: {
      paddingRight: 24,
      paddingLeft: 2,
      gap: 10,
    },
    vehicleOptionsLoading: {
      paddingVertical: 24,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    vehicleOptionsLoadingText: {
      fontSize: 14,
      fontWeight: "500",
    },
    vehicleOptionsErrorText: {
      fontSize: 14,
      fontWeight: "500",
      textAlign: "center",
    },
    vehicleOptionsErrorBanner: {
      marginBottom: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.error + "15",
      borderRadius: 8,
    },
    vehicleOptionCard: {
      width:240,
      minWidth: 240,
      maxWidth: 240,
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 10,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: BeeColors.yellow[400] + "30",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    vehicleOptionCardSelected: {
      borderColor: BeeColors.yellow[400],
      borderWidth: 2,
      backgroundColor: BeeColors.yellow[400] + "38",
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    vehicleOptionCardUnselected: {
      opacity: 0.92,
    },
    vehicleOptionCardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      width: "100%",
      marginBottom: 4,
    },
    vehicleOptionIconBox: {
      width: 34,
      height: 34,
      borderRadius: 6,
      backgroundColor: BeeColors.yellow[400] + "18",
      justifyContent: "center",
      alignItems: "center",
    },
    vehicleOptionIconBoxSelected: {
      backgroundColor: "transparent",
    },
    vehicleOptionPrice: {
      fontSize: 22,
      fontWeight: "700",
    },
    vehicleOptionPriceSelected: {
      color: BeeColors.yellow[400],
      fontWeight: "800",
    },
    vehicleOptionDescription: {
      fontSize: 17,
      lineHeight: 22,
      marginBottom: 4,
    },
    vehicleOptionDetailsSpacer: {
      minHeight: 6,
    },
    vehicleOptionDetails: {
      marginTop: 8,
      paddingTop: 4,
      gap: 6,
      minHeight: 48,
      width: "100%",
    },
    vehicleOptionDetailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 20,
    },
    vehicleOptionDetailText: {
      fontSize: 13,
      flex: 1,
      flexShrink: 1,
      minHeight: 18,
    },
    vehicleOptionDetailTextBold: {
      fontSize: 15,
      fontWeight: "700",
      flex: 1,
      flexShrink: 1,
      minHeight: 18,
    },
    selectedCheckmark: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    vehicleOptionIcon: {
      width: 54,
      height: 54,
      borderRadius: 24,
      backgroundColor: BeeColors.gray[50],
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    vehicleOptionIconSelected: {
      backgroundColor: BeeColors.yellow[400],
    },
    vehicleOptionName: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 2,
      textAlign: "left",
    },
    vehicleOptionNameSelected: {
      color: theme.text,
    },
    vehicleOptionSubtext: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.textMuted,
      textAlign: "center",
    },
    vehicleOptionSubtextSelected: {
      color: BeeColors.yellow[600],
      fontWeight: "700",
    },
    vehicleOptionTime: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.textSecondary,
      marginBottom: 8,
      textAlign: "center",
    },
    toggleContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    toggleHint: {
      fontSize: 12,
      fontWeight: "400",
      marginTop: 4,
    },
    serviceToggleWrap: {
      flexDirection: "row",
      backgroundColor: "#fff",
      padding: 4,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    serviceToggleBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    serviceToggleBtnActive: {
      backgroundColor: BeeColors.yellow[400],
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    serviceToggleBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    serviceToggleBtnTextActive: {
      color: "#fff",
      fontWeight: "700",
    },
    scheduledFields: {
      marginTop: 12,
      gap: 12,
    },
    scheduledRow: {
      flexDirection: "row",
      gap: 12,
    },
    scheduledField: {
      flex: 1,
    },
    errorText: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 4,
    },
    dateInput: {
      height: 48,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateInputText: {
      fontSize: 14,
      fontWeight: "500",
      flex: 1,
    },
    pickerModalContainer: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    pickerModalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 20,
    },
    pickerModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    pickerModalTitle: {
      fontSize: 16,
      fontWeight: "600",
    },
    pickerModalButton: {
      fontSize: 16,
      fontWeight: "500",
    },
    packageCard: {
      backgroundColor: "#fff",
      borderRadius: 12,
      padding: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
      borderWidth: 1,
      borderColor: BOOKING_CARD_BORDER,
    },
    packageContent: {
      marginTop: 16,
      gap: 16,
    },
    step2Content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    step2Title: {
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.5,
      marginBottom: 8,
      paddingTop: 8,
    },
    step2Subtitle: {
      fontSize: 14,
      marginBottom: 24,
      lineHeight: 20,
    },
    step2Label: {
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    step2TextArea: {
      borderRadius: 12,
      borderWidth: 1,
      minHeight: 80,
      padding: 16,
    },
    step2TipInputRow: {
      borderColor: BeeColors.yellow[400] + "33",
      borderRadius: 12,
      height: 56,
    },
    tipLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    tipBadge: {
      backgroundColor: BeeColors.yellow[400] + "22",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    tipBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: BeeColors.gray[800] ?? "#1d180c",
      letterSpacing: 0.5,
    },
    tipQuickButtons: {
      flexDirection: "row",
      gap: 4,
      paddingRight: 12,
    },
    tipQuickButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: BeeColors.yellow[400] + "33",
    },
    tipQuickButtonText: {
      fontSize: 12,
      fontWeight: "700",
      color: BeeColors.gray[800] ?? "#1d180c",
    },
    step3SectionTitle: {
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 16,
    },
    step3PaymentCards: {
      gap: 12,
    },
    step3PaymentCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      gap: 16,
    },
    step3PaymentCardSelected: {
      borderWidth: 2,
    },
    step3PaymentCardIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    step3PaymentCardTitle: {
      fontSize: 14,
      fontWeight: "700",
    },
    step3PaymentCardSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    step3PaymentRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    step3FooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    step3AmountLabel: {
      fontSize: 14,
      fontWeight: "500",
    },
    step3AmountValue: {
      fontSize: 18,
      fontWeight: "800",
    },
    summaryCard: {
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    summaryRouteRow: {
      flexDirection: "row",
      gap: 12,
    },
    summaryRouteDots: {
      alignItems: "center",
      gap: 4,
    },
    summaryRouteLine: {
      width: 2,
      height: 24,
      borderRadius: 1,
    },
    summaryAddresses: {
      flex: 1,
      gap: 12,
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1,
      color: BeeColors.gray[500],
      marginBottom: 2,
    },
    summaryAddressText: {
      fontSize: 14,
      fontWeight: "600",
    },
    summaryDivider: {
      height: 1,
      marginVertical: 16,
    },
    summaryVehicleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    summaryVehicleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    summaryVehicleIcon: {
      width: 48,
      height: 48,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    summarySubtext: {
      fontSize: 12,
      marginBottom: 2,
    },
    summaryVehicleName: {
      fontSize: 14,
      fontWeight: "700",
    },
    summaryTotalBlock: {
      alignItems: "flex-end",
    },
    summaryTotalFare: {
      fontSize: 20,
      fontWeight: "800",
    },
    fareBreakdownContainer: {
      gap: 4,
    },
    fareBreakdownLine: {
      fontSize: 13,
    },
    fareBreakdownTotalLine: {
      fontWeight: "700",
      marginTop: 4,
    },
    inputLabelSmall: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    weightInputContainer: {
      flexDirection: "row",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
      overflow: "hidden",
    },
    weightInput: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 14,
      color: theme.text,
    },
    weightUnit: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.inputBackground,
      borderLeftWidth: 1,
      borderLeftColor: theme.border,
      justifyContent: "center",
    },
    weightUnitText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textSecondary,
    },
    tipInputRow: {
      flexDirection: "row",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
      overflow: "hidden",
      alignItems: "center",
    },
    tipCurrency: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.inputBackground,
      borderRightWidth: 1,
      borderRightColor: theme.border,
      justifyContent: "center",
    },
    tipCurrencyText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textSecondary,
    },
    tipInput: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 14,
      color: theme.text,
    },
    descriptionInput: {
      minHeight: 100,
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
      fontSize: 14,
      color: theme.text,
    },
    imagePickerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.primary,
      borderStyle: "dashed",
      backgroundColor: theme.inputBackground,
    },
    imagePickerText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primary,
    },
    imagePreviewContainer: {
      position: "relative",
      width: "100%",
      height: 200,
      borderRadius: 8,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    imagePreview: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    removeImageButton: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: theme.surface + "CC",
      borderRadius: 16,
      padding: 4,
    },
    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "#fff",
      paddingHorizontal: 16,
      paddingTop: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.02,
      shadowRadius: 20,
      elevation: 10,
      borderTopWidth: 1,
      borderTopColor: BOOKING_CARD_BORDER,
    },
    bottomBarHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    estimatedLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: "#6b7280",
      marginBottom: 2,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    estimatedFareRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },
    viewBreakdownLink: {
      fontSize: 12,
      fontWeight: "700",
      color: BeeColors.yellow[400],
      textDecorationLine: "underline",
    },
    estimatedTotal: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
    },
    estimatedDistance: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    footerBadges: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 8,
    },
    footerBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: "#fff",
      justifyContent: "center",
      alignItems: "center",
      marginLeft: -8,
    },
    footerBadgePrimary: {
      backgroundColor: BeeColors.yellow[400],
    },
    footerBadgeGreen: {
      backgroundColor: BeeColors.green[500],
    },
    paymentMethodRow: {
      marginTop: 14,
      gap: 8,
    },
    paymentMethodLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    paymentMethodOptions: {
      gap: 12,
    },
    paymentMethodRadioOption: {
      width: "100%",
    },
    radioButtonContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    paymentMethodRadioText: {
      fontSize: 14,
      fontWeight: "500",
    },
    standardBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.inputBackground,
      borderWidth: 1,
      borderColor: theme.border,
    },
    standardText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.text,
    },
    confirmButton: {
      width: "100%",
      paddingVertical: 16,
      backgroundColor: BeeColors.yellow[400],
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      shadowColor: BeeColors.yellow[400],
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 6,
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    wizardNextButton: {
      marginTop: 8,
    },
    confirmButtonSpinner: {
      marginRight: 10,
    },
    confirmButtonText: {
      fontSize: 18,
      fontWeight: "900",
      color: "#1d180c",
    },
    paymentLoadingOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      alignItems: "center",
    },
    paymentLoadingContainer: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 32,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 280,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    paymentLoadingText: {
      fontSize: 18,
      fontWeight: "700",
      marginTop: 20,
      textAlign: "center",
    },
    paymentLoadingSubtext: {
      fontSize: 14,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 20,
    },
    paymentLoadingStatus: {
      fontSize: 12,
      marginTop: 16,
      fontWeight: "600",
    },
    savedPaymentMethodsSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.1)',
    },
    savePaymentMethodOption: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.1)',
    },
    savePaymentMethodCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkboxSmall: {
      width: 18,
      height: 18,
      borderWidth: 2,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    savePaymentMethodLabel: {
      fontSize: 12,
      flex: 1,
    },
  });
