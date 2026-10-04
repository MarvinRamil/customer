# Google Maps Integration Implementation Plan

## Overview

This plan outlines the integration of Google Maps into the Bee Customer App using React Native Maps. The implementation will create a shared, reusable map component that can be used in both the Booking and Tracking screens, eliminating code duplication and ensuring consistent map behavior across the app.

**Key Features**:
- Interactive map with slide-in/out functionality
- Location pinning with reverse geocoding (address + coordinates)
- Different map display modes for Booking vs Tracking screens
- Route visualization with shortest path calculation
- Full-screen map mode for location selection

## Objectives

1. **Integrate Google Maps** using `react-native-maps` library
2. **Create a shared map component** (`shared/components/MapView.tsx`) that can be configured for different use cases
3. **Implement slide-in/out map functionality** - Map can expand/collapse on command
4. **Replace static map images** in Booking screen with interactive Google Maps
5. **Replace mock map UI** in Tracking screen with real Google Maps
6. **Support location pinning with reverse geocoding** - Get address and coordinates when dropping a pin
7. **Support location search/autocomplete** - Search for pickup and dropoff locations using Google Places API
8. **Support location selection** in Booking screen (pickup/dropoff) - Both via search and map pinning
9. **Support real-time tracking** in Tracking screen (driver location, route visualization)
9. **Draw route polylines** - Auto-select and draw shortest path between pickup and dropoff
10. **Support route drawing based on booking status** - Different routes for pending, in-transit, etc.
11. **Implement screen-specific map behaviors**:
    - Booking: 75% height by default, expandable when pickup/dropoff active, full-screen mode for selection
    - Tracking: Almost full height by default, pull-up details card
12. **Maintain feature-based architecture** - keep map component in `shared/` since it's used across features
13. **Ensure proper configuration** - set up Google Maps API keys and permissions

## Technical Approach

### Library Selection
- **Primary Library**: `react-native-maps` - The standard React Native library for maps
- **Expo Integration**: Use `expo-location` for location services
- **Google Maps SDK**: Configure via Expo config plugin for native modules
- **Map Provider**: Force Google Maps on both iOS and Android (not Apple Maps on iOS)

### Architecture Decision
- **Location**: `shared/components/MapView.tsx` - Shared component used across features
- **Rationale**: Map is used by both `bookings` and `tracking` features, making it a shared component
- **Configuration**: Map props will allow customization for different use cases (booking vs tracking)

## Prerequisites

**⚠️ CRITICAL: Complete these BEFORE starting Phase 1**

Before you begin implementation, you must complete the Google Cloud Console setup and configure your API keys. Phase 1 assumes these prerequisites are already complete.

### Quick Checklist

**Before starting Phase 1, verify:**
- [ ] Google Cloud project created/selected
- [ ] Maps SDK for iOS enabled
- [ ] Maps SDK for Android enabled
- [ ] Directions API enabled ⚠️
- [ ] Geocoding API enabled ⚠️
- [ ] Places API enabled ⚠️
- [ ] API key created
- [ ] API key added to `.env` file as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- [ ] Billing account linked (if required)

**Note**: Phase 1 will add `.env` configuration template. You must complete Google Cloud Console setup and add your API key to `.env` before proceeding to Phase 2.

### Google Cloud Console Setup Instructions

#### Step 1: Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click on the project dropdown at the top
4. Either:
   - **Select an existing project**, OR
   - **Create a new project** by clicking "New Project"
     - Enter project name (e.g., "Bee Customer App")
     - Click "Create"

#### Step 2: Enable Required APIs

1. In the Google Cloud Console, go to **"APIs & Services" > "Library"**
2. Search for and enable the following APIs:
   
   **a. Maps SDK for iOS**
   - Search: "Maps SDK for iOS"
   - Click on it
   - Click **"Enable"** button
   
   **b. Maps SDK for Android**
   - Search: "Maps SDK for Android"
   - Click on it
   - Click **"Enable"** button
   
   **c. Directions API** ⚠️ **REQUIRED for route drawing**
   - Search: "Directions API"
   - Click on it
   - Click **"Enable"** button
   - This API is used to calculate routes between pickup and dropoff locations
   
   **d. Geocoding API** ⚠️ **REQUIRED for reverse geocoding (address lookup)**
   - Search: "Geocoding API"
   - Click on it
   - Click **"Enable"** button
   - This API is used to get address from coordinates when user drops a pin
   
   **e. Places API** ⚠️ **REQUIRED for location search/autocomplete**
   - Search: "Places API"
   - Click on it
   - Click **"Enable"** button
   - This API is used for location search and autocomplete in pickup/dropoff fields
   - **Note**: Make sure to enable "Places API" (not "Places API (New)" - use the classic version)

#### Step 3: Create API Key

1. Go to **"APIs & Services" > "Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"API key"**
4. A new API key will be created and displayed
5. **Copy the API key** - you'll need it for the `.env` file

#### Step 4: Restrict API Key (Recommended for Production)

**For Development/Testing**: You can skip this step, but it's recommended for production.

1. Click on the API key you just created (or click "Edit" if it's already open)
2. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check the following APIs:
     - ✅ Maps SDK for iOS
     - ✅ Maps SDK for Android
     - ✅ Directions API
     - ✅ Geocoding API
     - ✅ Places API
3. Under **"Application restrictions"** (optional but recommended):
   - For iOS: Add your iOS bundle identifier
   - For Android: Add your Android package name
4. Click **"Save"**

#### Step 5: Add API Key to Environment Variables

1. Open your project's `.env` file (create it if it doesn't exist)
2. Add the following lines:
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL=https://maps.googleapis.com/maps/api
   ```
3. Replace `your_api_key_here` with the API key you copied in Step 3
4. **Note**: `EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL` is optional - defaults to `https://maps.googleapis.com/maps/api` if not set
   - Only change this if you need to use a different API endpoint (e.g., proxy, custom domain)
5. **Important**: Never commit the `.env` file to git (it should be in `.gitignore`)

#### Step 6: Verify API Key Setup

1. Check that your `.env` file has the API key
2. Verify that the following APIs are enabled:
   - ✅ Maps SDK for iOS
   - ✅ Maps SDK for Android
   - ✅ Directions API
   - ✅ Geocoding API
   - ✅ Places API

### API Key Restrictions Best Practices

**For Development**:
- You can use an unrestricted key for easier testing
- Make sure to restrict it before going to production

**For Production**:
- Always restrict the API key to specific APIs
- Add application restrictions (iOS bundle ID, Android package name)
- Consider setting up billing alerts to monitor usage
- Enable API key rotation for security

### Billing Setup

**Note**: Google Maps APIs require a billing account, but they offer:
- **$200 free credit per month** for Maps, Routes, and Places
- This is usually enough for development and small-scale production

1. Go to **"Billing"** in Google Cloud Console
2. Link a billing account (credit card required)
3. Set up billing alerts to monitor usage

### Troubleshooting

**Common Issues**:

1. **"This API key is not authorized"**
   - Make sure you've enabled all required APIs (Maps SDK for iOS, Maps SDK for Android, Directions API, Geocoding API, Places API)
   - Check that the API key is correctly set in `.env` file

2. **"API key not valid"**
   - Verify the API key is copied correctly (no extra spaces)
   - Check that the API key exists in Google Cloud Console
   - Make sure billing is enabled

3. **Routes not showing**
   - Verify Directions API is enabled
   - Check API key restrictions allow Directions API
   - Verify API key is set correctly in environment variables

4. **Maps not loading on iOS**
   - Make sure Maps SDK for iOS is enabled
   - Verify API key is in iOS config in `app.json`
   - Check that `PROVIDER_GOOGLE` is set in MapView component

5. **Location search not working**
   - Verify Places API is enabled
   - Check API key restrictions allow Places API
   - Verify API key is set correctly in environment variables

## Phases

### Phase 1: Setup and Dependencies
**Complexity**: Low  
**Dependencies**: None  
**Estimated Time**: 30 minutes

**Objectives**:
- Install required dependencies
- Configure Google Maps API keys
- Set up Expo config for maps
- Add location permissions

**Files to Create/Modify**:
- `package.json` - Add dependencies
- `app.json` - Add Google Maps configuration and permissions
- `.env` - Add Google Maps API key (if not already present)
- `docs/README.md` - Document API key setup

**Dependencies to Install**:
- `react-native-maps` - Core maps library
- `expo-location` - Location services for getting user location
- `@react-native-google-signin/google-signin` - Not needed, we'll use HTTP API
- Note: We'll use Google Maps Directions API via HTTP (no additional package needed)

**Configuration Changes**:
- Add Google Maps API key to Expo config
- Add location permissions for iOS and Android
- Configure Expo config plugin for react-native-maps

**Deliverables**:
- ✅ Dependencies installed
- ✅ Google Maps configured in app.json
- ✅ Location permissions configured
- ✅ API key setup documented

---

### Phase 2: Create Shared Map Component
**Complexity**: Medium  
**Dependencies**: Phase 1  
**Estimated Time**: 1-2 hours

**Objectives**:
- Create reusable `MapView` component in `shared/components/`
- Support different map modes (booking selection, tracking display)
- Handle location permissions
- Support custom markers and overlays
- Support map controls (zoom, location button)

**Files to Create**:
- `shared/components/MapView.tsx` - Main map component with slide functionality
- `shared/types/map.ts` - Map-related types (MapMarker, Route, LocationWithAddress, etc.)
- `shared/services/mapService.ts` - Service for Google Maps Directions API and Geocoding API calls
- `shared/hooks/useMapSlide.ts` - Hook for managing map slide-in/out state (optional, can be in component)

**Component Features**:
- **Map Provider**: Force Google Maps on iOS (use `PROVIDER_GOOGLE` from react-native-maps)
- **Slide Functionality**: Map can slide in/out on command with smooth animations
- **Props Interface**:
  - `mode`: `'booking' | 'tracking'` - Different behaviors for different screens
  - `initialRegion`: Map region to display initially
  - `markers`: Array of markers to display
  - `onMarkerPress`: Callback when marker is pressed
  - `onRegionChange`: Callback when map region changes
  - `onLocationSelect`: Callback for location selection - returns `{ coordinates: LocationCoordinates, address: string }`
  - `onLocationConfirm`: Callback when location is confirmed (full-screen mode)
  - `isExpanded`: Boolean to control map expansion state
  - `onExpand`: Callback when map should expand
  - `onCollapse`: Callback when map should collapse
  - `showControls`: Boolean to show/hide map controls
  - `style`: Custom styling

- **Booking Mode Features**:
  - **Default State**: Map shows at ~75% height (check current booking form design)
  - **Expandable**: When pickup/dropoff bars are active, map can expand
  - **Full-Screen Mode**: Click map component to render full-screen
    - In full-screen: Show route, dropoff/pickup points, pin elements
    - User can drop pins and confirm location
    - After confirmation, form re-renders and map slides back to view
  - **Location Pinning**:
    - Tap map to drop a pin
    - **Reverse geocoding**: Get both address and coordinates when pin is dropped
    - Display address in UI
    - Return both coordinates and address via `onLocationSelect` callback
  - **Route Drawing**: Draw shortest route between pickup and dropoff (when both are selected)
  - Auto-calculate and display route polyline
  - **Location Search/Autocomplete**: 
    - Search for pickup location using Google Places API
    - Search for dropoff location using Google Places API
    - Autocomplete suggestions as user types
    - Select location from search results
    - Update map when location is selected from search

- **Tracking Mode Features**:
  - **Default State**: Map renders almost full height
  - **Pull-up Details Card**: User can pull up details card to view tracking information
  - Display route polyline based on booking status:
    - **Pending/Unassigned**: Draw shortest path from pickup to dropoff ✅ (Phase 4)
    - **On the way to pickup** (future): Draw route from driver location to pickup
    - **After pickup** (future): Draw route from driver location to dropoff
  - Show driver location with animation (when available)
  - Show pickup/dropoff markers
  - Auto-center map to show entire route
  - Auto-update route when status changes

**Implementation Details**:
```typescript
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { mapService } from '@/shared/services/mapService';

// Route data structure
interface Route {
  coordinates: LocationCoordinates[];
  distance: number; // in meters
  duration: number; // in seconds
}

// Location with address (from reverse geocoding)
interface LocationWithAddress {
  coordinates: LocationCoordinates;
  address: string;
}

interface MapViewProps {
  mode: 'booking' | 'tracking';
  initialRegion?: Region;
  markers?: MapMarker[];
  pickupLocation?: LocationCoordinates;
  dropoffLocation?: LocationCoordinates;
  driverLocation?: LocationCoordinates; // For tracking mode
  bookingStatus?: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered';
  isExpanded?: boolean; // Control map expansion state
  onLocationSelect?: (location: LocationWithAddress) => void; // Returns both coordinates and address
  onLocationConfirm?: (location: LocationWithAddress) => void; // For full-screen mode confirmation
  onExpand?: () => void; // Callback when map should expand
  onCollapse?: () => void; // Callback when map should collapse
  onMarkerPress?: (marker: MapMarker) => void;
  showControls?: boolean;
  style?: ViewStyle;
}

export function MapView({ 
  mode, 
  pickupLocation, 
  dropoffLocation, 
  bookingStatus,
  isExpanded,
  onLocationSelect,
  onLocationConfirm,
  onExpand,
  onCollapse,
  ...props 
}: MapViewProps) {
  const [route, setRoute] = useState<Route | null>(null);
  
  // Handle map tap to drop pin and get address
  const handleMapPress = async (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const coordinates: LocationCoordinates = { latitude, longitude };
    
    // Call reverse geocoding to get address
    try {
      const address = await mapService.reverseGeocode(coordinates);
      const locationWithAddress: LocationWithAddress = { coordinates, address };
      
      // Call callback with both coordinates and address
      onLocationSelect?.(locationWithAddress);
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
  };
  
  // Calculate route when pickup and dropoff are available
  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      // For pending/unassigned: draw route from pickup to dropoff
      if (mode === 'tracking' && bookingStatus === 'pending') {
        mapService.getRoute(pickupLocation, dropoffLocation)
          .then(setRoute)
          .catch(console.error);
      }
      // For booking mode: always draw route when both locations selected
      if (mode === 'booking') {
        mapService.getRoute(pickupLocation, dropoffLocation)
          .then(setRoute)
          .catch(console.error);
      }
    }
  }, [pickupLocation, dropoffLocation, mode, bookingStatus]);
  
  return (
    <Animated.View style={[styles.mapContainer, { height: isExpanded ? '100%' : '75%' }]}>
      <MapView
        provider={PROVIDER_GOOGLE} // Force Google Maps on iOS
        onPress={handleMapPress}
        // ... other props
      >
        {/* Route polyline */}
        {route && (
          <Polyline
            coordinates={route.coordinates}
            strokeColor="#3b82f6" // Blue route line
            strokeWidth={4}
          />
        )}
        {/* Markers */}
        {/* ... */}
      </MapView>
    </Animated.View>
  );
}
```

**Map Service Implementation**:
- Create `shared/services/mapService.ts` with three main functions:
  1. **`getRoute(origin, destination)`** - Calls Google Maps Directions API
     - Returns route coordinates for polyline drawing
     - Returns distance and duration
  2. **`reverseGeocode(coordinates)`** - Calls Google Maps Geocoding API
     - Takes latitude/longitude
     - Returns formatted address string
     - Used when user drops a pin on the map
  3. **`searchPlaces(query: string)`** - Calls Google Places API Autocomplete
     - Takes search query string
     - Returns array of place predictions with addresses and coordinates
     - Used for location search/autocomplete in pickup/dropoff fields
  4. **`getPlaceDetails(placeId: string)`** - Calls Google Places API Place Details
     - Takes place ID from autocomplete result
     - Returns full place details including coordinates and formatted address
     - Used when user selects a location from search results
- Use HTTP fetch to Google Maps API endpoints
- Parse responses to extract data
- Handle errors gracefully

**Location Selection Flow**:
1. User taps map to drop a pin
2. Call `reverseGeocode()` with pin coordinates
3. Get formatted address
4. Return both `{ coordinates, address }` via `onLocationSelect` callback
5. Update form fields with address
6. Store coordinates for route calculation

**Important**: The `provider={PROVIDER_GOOGLE}` prop forces Google Maps on iOS instead of the default Apple Maps.

**Deliverables**:
- ✅ `shared/components/MapView.tsx` created with slide functionality
- ✅ `shared/components/LocationSearch.tsx` created for location search/autocomplete (or integrated into MapView)
- ✅ `shared/services/mapService.ts` created with:
  - Route calculation (Directions API)
  - Reverse geocoding (Geocoding API)
  - Place search/autocomplete (Places API)
  - Place details (Places API)
- ✅ `shared/hooks/useLocationSearch.ts` created for search functionality
- ✅ `shared/types/map.ts` created with Route, MapMarker, LocationWithAddress, PlacePrediction types
- ✅ Component supports booking and tracking modes
- ✅ Route calculation and polyline drawing implemented
- ✅ Reverse geocoding implemented (coordinates → address)
- ✅ Location search/autocomplete implemented
- ✅ Location pinning with address retrieval
- ✅ Slide-in/out functionality implemented
- ✅ Location permissions handled
- ✅ Basic map controls implemented
- ✅ TypeScript types defined

---

### Phase 3: Integrate Map into Booking Screen
**Complexity**: Medium  
**Dependencies**: Phase 2  
**Estimated Time**: 1-2 hours

**Objectives**:
- Replace static map image with interactive `MapView` component
- Implement location selection for pickup and dropoff
- Add location search/autocomplete (optional, can be Phase 4)
- Update form state when locations are selected
- Maintain existing UI design and styling

**Files to Modify**:
- `app/booking.tsx` - Replace map section with MapView component

**Changes**:
1. Import `MapView` and `LocationSearch` (or use search hook) from shared components
2. Replace static `Image` component with `MapView`
3. Add location search/autocomplete to pickup and dropoff input fields
4. Add state for selected pickup/dropoff coordinates
5. Implement `onLocationSelect` handler (for map pinning)
6. Implement location search handler (for search selection)
7. Update form fields when location is selected (from search or map)
8. Update map when location is selected from search
9. Add markers for selected locations
10. Maintain existing styling and layout

**Features to Implement**:
- **Map Display Behavior**:
  - Default: Map shows at ~75% height (match current booking form design)
  - Expandable: When pickup/dropoff bars are active, map can expand
  - Full-screen mode: Click map component to render full-screen
  - Slide animation: Smooth slide-in/out transitions
- **Location Selection**:
  - Tap map to drop a pin for pickup location
  - Tap map to drop a pin for dropoff location (when pickup is selected)
  - **Reverse geocoding**: Get address from coordinates when pin is dropped
  - Display markers for selected locations
  - Update address text fields with selected location (both pickup and dropoff)
- **Full-Screen Map Mode**:
  - Click map to enter full-screen mode
  - Show route, dropoff/pickup points, pin elements
  - User can drop pins and confirm location
  - After confirmation, form re-renders and map slides back to view
- **Route Drawing**:
  - Auto-calculate and draw shortest route between pickup and dropoff
  - Auto-fit map to show entire route when both locations are selected
- **Other Features**:
  - Support "Use My Location" button functionality
  - Maintain existing UI design and styling

**Deliverables**:
- ✅ Booking screen uses interactive map
- ✅ Location selection works for pickup/dropoff
- ✅ Markers display correctly
- ✅ Form state updates when locations selected
- ✅ Existing UI design maintained

---

### Phase 4: Integrate Map into Tracking Screen
**Complexity**: Medium-High  
**Dependencies**: Phase 2  
**Estimated Time**: 1.5-2 hours

**Objectives**:
- Replace mock map UI with real `MapView` component
- Display route polyline between pickup and dropoff
- Show driver location with real-time updates
- Animate driver marker (pulse effect)
- Auto-center map on driver location (optional)
- Display estimated arrival time on driver marker

**Files to Modify**:
- `app/tracking.tsx` - Replace map section with MapView component

**Changes**:
1. Import `MapView` from `shared/components/MapView`
2. Replace mock map UI with `MapView` in tracking mode
3. Pass tracking data (pickup, dropoff, driver location) to map
4. Configure map to show route polyline
5. Add driver location marker with animation
6. Handle real-time location updates (if available)

**Features to Implement**:
- **Map Display Behavior**:
  - Default: Map renders almost full height
  - Pull-up details card: User can pull up details card to view tracking information
  - Slide animation: Smooth transitions when details card is pulled up/down
- **Route Drawing**:
  - Display route polyline based on booking status:
    - **Pending/Unassigned**: Draw shortest path from pickup to dropoff ✅ (Phase 4)
    - **On the way to pickup** (future): Draw route from driver location to pickup
    - **After pickup** (future): Draw route from driver location to dropoff
- **Markers and Location**:
  - Show driver location marker with pulse animation (when available)
  - Display pickup and dropoff markers
  - Show estimated arrival time on driver marker
  - Auto-update driver location (if real-time updates available)
- **Map Controls**:
  - Auto-fit map to show entire route
  - Map controls (locate button, layers)
  - Zoom controls

**Deliverables**:
- ✅ Tracking screen uses real Google Maps
- ✅ Route polyline displays correctly
- ✅ Driver location shows with animation
- ✅ All markers display correctly
- ✅ Real-time updates work (if API supports)

---

### Phase 5: Location Services and Permissions
**Complexity**: Low-Medium  
**Dependencies**: Phase 2, Phase 3  
**Estimated Time**: 1 hour

**Objectives**:
- Implement "Use My Location" functionality
- Handle location permissions gracefully
- Add location permission requests
- Handle permission denials with user-friendly messages

**Files to Create/Modify**:
- `shared/hooks/useLocation.ts` - Hook for location services
- `app/booking.tsx` - Use location hook for "Use My Location" button

**Implementation**:
- Create `useLocation` hook using `expo-location`
- Request location permissions
- Get current user location
- Handle errors and permission denials

**Deliverables**:
- ✅ Location hook created
- ✅ "Use My Location" button works
- ✅ Permissions handled gracefully
- ✅ Error messages user-friendly

---

### Phase 6: Testing and Refinement
**Complexity**: Low  
**Dependencies**: All previous phases  
**Estimated Time**: 1 hour

**Objectives**:
- Test on iOS and Android
- Test location permissions
- Test map interactions
- Verify styling matches design
- Fix any bugs or issues
- Optimize performance

**Testing Checklist**:
- ✅ Map loads correctly on iOS
- ✅ Map loads correctly on Android
- ✅ Location permissions work
- ✅ Location selection works in booking (both map pinning and search)
- ✅ Location search/autocomplete works for pickup
- ✅ Location search/autocomplete works for dropoff
- ✅ Reverse geocoding works when dropping pins
- ✅ Tracking map displays correctly
- ✅ Markers display correctly
- ✅ Route polyline displays correctly
- ✅ Driver animation works
- ✅ Map controls work
- ✅ Slide animations work smoothly
- ✅ Styling matches design
- ✅ Performance is acceptable

**Deliverables**:
- ✅ All features tested
- ✅ Bugs fixed
- ✅ Performance optimized
- ✅ Code reviewed and refined

---

## Dependencies

### External Dependencies
1. **Google Maps API Key** - Required for map functionality
   - See **Prerequisites** section above for complete setup instructions
   - Must be configured before starting Phase 1

2. **Location Permissions** - Required for "Use My Location" feature
   - iOS: `NSLocationWhenInUseUsageDescription` in Info.plist
   - Android: `ACCESS_FINE_LOCATION` permission
   - These will be configured in Phase 1

### Internal Dependencies
- Existing `features/tracking/types.ts` - LocationCoordinates type
- Existing `shared/types/booking.ts` - LocationCoordinates type
- Both screens already have location data structures

---

**Note**: For detailed Google Cloud Console setup instructions, API key configuration, troubleshooting, and checklist, see the **Prerequisites** section at the top of this document (before the Phases section).

### Step-by-Step Guide

**IMPORTANT**: You must complete these steps in Google Cloud Console before starting implementation.

#### Step 1: Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click on the project dropdown at the top
4. Either:
   - **Select an existing project**, OR
   - **Create a new project** by clicking "New Project"
     - Enter project name (e.g., "Bee Customer App")
     - Click "Create"

#### Step 2: Enable Required APIs

1. In the Google Cloud Console, go to **"APIs & Services" > "Library"**
2. Search for and enable the following APIs:
   
   **a. Maps SDK for iOS**
   - Search: "Maps SDK for iOS"
   - Click on it
   - Click **"Enable"** button
   
   **b. Maps SDK for Android**
   - Search: "Maps SDK for Android"
   - Click on it
   - Click **"Enable"** button
   
   **c. Directions API** ⚠️ **REQUIRED for route drawing**
   - Search: "Directions API"
   - Click on it
   - Click **"Enable"** button
   - This API is used to calculate routes between pickup and dropoff locations
   
   **d. Geocoding API** ⚠️ **REQUIRED for reverse geocoding (address lookup)**
   - Search: "Geocoding API"
   - Click on it
   - Click **"Enable"** button
   - This API is used to get address from coordinates when user drops a pin
   
   **e. Places API** ⚠️ **REQUIRED for location search/autocomplete**
   - Search: "Places API"
   - Click on it
   - Click **"Enable"** button
   - This API is used for location search and autocomplete in pickup/dropoff fields
   - **Note**: Make sure to enable "Places API" (not "Places API (New)" - use the classic version)

#### Step 3: Create API Key

1. Go to **"APIs & Services" > "Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"API key"**
4. A new API key will be created and displayed
5. **Copy the API key** - you'll need it for the `.env` file

#### Step 4: Restrict API Key (Recommended for Production)

**For Development/Testing**: You can skip this step, but it's recommended for production.

1. Click on the API key you just created (or click "Edit" if it's already open)
2. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check the following APIs:
     - ✅ Maps SDK for iOS
     - ✅ Maps SDK for Android
     - ✅ Directions API
3. Under **"Application restrictions"** (optional but recommended):
   - For iOS: Add your iOS bundle identifier
   - For Android: Add your Android package name
4. Click **"Save"**

#### Step 5: Add API Key to Environment Variables

1. Open your project's `.env` file (create it if it doesn't exist)
2. Add the following lines:
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL=https://maps.googleapis.com/maps/api
   ```
3. Replace `your_api_key_here` with the API key you copied in Step 3
4. **Note**: `EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL` is optional - defaults to `https://maps.googleapis.com/maps/api` if not set
   - Only change this if you need to use a different API endpoint (e.g., proxy, custom domain)
5. **Important**: Never commit the `.env` file to git (it should be in `.gitignore`)

#### Step 6: Verify API Key Setup

1. Check that your `.env` file has the API key
2. Verify that the following APIs are enabled:
   - ✅ Maps SDK for iOS
   - ✅ Maps SDK for Android
   - ✅ Directions API
   - ✅ Geocoding API
   - ✅ Places API

### API Key Restrictions Best Practices

**For Development**:
- You can use an unrestricted key for easier testing
- Make sure to restrict it before going to production

**For Production**:
- Always restrict the API key to specific APIs
- Add application restrictions (iOS bundle ID, Android package name)
- Consider setting up billing alerts to monitor usage
- Enable API key rotation for security

### Billing Setup

**Note**: Google Maps APIs require a billing account, but they offer:
- **$200 free credit per month** for Maps, Routes, and Places
- This is usually enough for development and small-scale production

1. Go to **"Billing"** in Google Cloud Console
2. Link a billing account (credit card required)
3. Set up billing alerts to monitor usage

### Troubleshooting

**Common Issues**:

1. **"This API key is not authorized"**
   - Make sure you've enabled all required APIs (Maps SDK for iOS, Maps SDK for Android, Directions API, Geocoding API, Places API)
   - Check that the API key is correctly set in `.env` file

2. **"API key not valid"**
   - Verify the API key is copied correctly (no extra spaces)
   - Check that the API key exists in Google Cloud Console
   - Make sure billing is enabled

3. **Routes not showing**
   - Verify Directions API is enabled
   - Check API key restrictions allow Directions API
   - Verify API key is set correctly in environment variables

4. **Maps not loading on iOS**
   - Make sure Maps SDK for iOS is enabled
   - Verify API key is in iOS config in `app.json`
   - Check that `PROVIDER_GOOGLE` is set in MapView component

### Quick Checklist

**Before starting Phase 1, verify:**
- [ ] Google Cloud project created/selected
- [ ] Maps SDK for iOS enabled
- [ ] Maps SDK for Android enabled
- [ ] Directions API enabled ⚠️
- [ ] Geocoding API enabled ⚠️
- [ ] Places API enabled ⚠️
- [ ] API key created
- [ ] API key added to `.env` file as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- [ ] Billing account linked (if required)

**Note**: Phase 1 will add `.env` configuration template. You must complete Google Cloud Console setup and add your API key to `.env` before proceeding to Phase 2.

## Configuration Requirements

### app.json Changes
```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow Bee App to use your location for pickup and delivery tracking."
        }
      ],
      [
        "react-native-maps",
        {
          "googleMapsApiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      ]
    ],
    "ios": {
      "config": {
        "googleMapsApiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "We need your location to help you select pickup and dropoff locations."
      }
    },
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ]
    }
  }
}
```

### Environment Variables
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key (required)
- `EXPO_PUBLIC_GOOGLE_MAPS_API_BASE_URL` - Google Maps API base URL (optional, defaults to `https://maps.googleapis.com/maps/api`)

## Risk Assessment

### Potential Issues
1. **API Key Configuration** - May require rebuild if not configured correctly
2. **Location Permissions** - Users may deny permissions, need graceful handling
3. **Platform Differences** - iOS and Android may behave differently
4. **Performance** - Maps can be resource-intensive, need optimization
5. **Build Requirements** - May require `npx expo prebuild --clean` after adding native modules

### Mitigation Strategies
- Test on both platforms early
- Handle permission denials gracefully
- Use React.memo and useMemo for performance
- Document rebuild requirements clearly
- Provide fallback UI if maps fail to load

## Success Criteria

1. ✅ Map component is shared and reusable
2. ✅ Booking screen has interactive map with location selection
3. ✅ Tracking screen shows real-time driver location and route
4. ✅ No code duplication between screens
5. ✅ All features work on iOS and Android
6. ✅ Location permissions handled gracefully
7. ✅ Performance is acceptable
8. ✅ Code follows project architecture and conventions

## Timeline Estimate

- **Phase 1**: 30 minutes
- **Phase 2**: 1-2 hours
- **Phase 3**: 1-2 hours
- **Phase 4**: 1.5-2 hours
- **Phase 5**: 1 hour
- **Phase 6**: 1 hour

**Total Estimated Time**: 6-8 hours

## Notes

- This implementation will require a rebuild (`npx expo prebuild --clean`) after Phase 1
- Google Maps API key must be obtained before starting
- **Google Maps Directions API must be enabled** in Google Cloud Console for route calculation
- Location permissions must be tested on real devices
- **Route drawing is implemented in Phase 2 and 4**:
  - Phase 2: Basic route service and component support
  - Phase 4: Route drawing in tracking screen based on booking status
- **Future enhancements** (not in current scope):
  - Route from driver location to pickup (when driver is assigned)
  - Route from driver location to dropoff (after pickup)
  - Real-time route updates as driver moves
- Consider adding location autocomplete/search in a future phase
- Map styling can be customized to match app theme (dark/light mode)
- Route polylines will use blue color (#3b82f6) to match design system

---

## Approval Status

- [ ] Phase 1: Setup and Dependencies
- [ ] Phase 2: Create Shared Map Component
- [ ] Phase 3: Integrate Map into Booking Screen
- [ ] Phase 4: Integrate Map into Tracking Screen
- [ ] Phase 5: Location Services and Permissions
- [ ] Phase 6: Testing and Refinement

**Status**: Awaiting approval

---

## Post-Implementation Documentation

### Architecture Decisions

#### Native Google Maps SDK vs REST APIs

**Decision**: Use **Native Google Maps SDK** for map display and **REST APIs** for services.

**Implementation**:
- **Map Display**: `react-native-maps` with `PROVIDER_GOOGLE` - Uses native Google Maps SDK
  - iOS: Google Maps SDK for iOS (native)
  - Android: Google Maps SDK for Android (native)
- **Services**: REST APIs via HTTP fetch
  - Directions API (HTTP) - Route calculation
  - Geocoding API (HTTP) - Reverse geocoding
  - Places API (HTTP) - Place search/autocomplete

**Reasoning**:

1. **Native SDK for Map Display**:
   - ✅ **Better Performance**: Native rendering is faster and smoother
   - ✅ **Native UI/UX**: Uses platform-native map controls and gestures
   - ✅ **Offline Support**: Native SDKs can cache map tiles
   - ✅ **Better Integration**: Seamless integration with device features (location services, etc.)
   - ✅ **Standard Practice**: Industry standard for React Native map implementations

2. **REST APIs for Services**:
   - ✅ **Simpler Implementation**: No additional native modules required
   - ✅ **Easier Testing**: Can test API calls without native builds
   - ✅ **Cross-Platform**: Same code works on iOS, Android, and Web
   - ✅ **Flexibility**: Easy to switch providers or add caching layers
   - ✅ **Lower Complexity**: No need for platform-specific native code
   - ✅ **Standard Practice**: REST APIs are well-documented and widely used

**Alternative Considered**:
- Using native SDKs for services (e.g., Google Maps SDK Directions API)
  - ❌ Would require additional native modules
  - ❌ More complex setup and configuration
  - ❌ Platform-specific code needed
  - ❌ Harder to test and maintain

**Conclusion**: The hybrid approach (native SDK for display, REST APIs for services) provides the best balance of performance, simplicity, and maintainability. This is the standard pattern used in most React Native map implementations.

### API Key Security Considerations

**Important Security Note**: API keys are sent in HTTP request URLs (query parameters), which is **the official Google Maps API authentication method**.

**Official Google Documentation**:
- Google's official docs show API keys in URL query parameters: `?key=YOUR_API_KEY`
- Reference: https://developers.google.com/maps/api-security-best-practices
- This is the **standard and recommended** way to authenticate Google Maps REST API requests
- Google expects API keys to be used client-side and relies on **API key restrictions** for security

**Current Implementation**:
- API key is stored in `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` environment variable
- In React Native/Expo, `EXPO_PUBLIC_*` variables are bundled into JavaScript code
- This means the API key is **visible** in the app bundle and network requests
- **This is expected and documented behavior** by Google for client-side API usage

**Security Measures** (CRITICAL):

1. **API Key Restrictions** (MUST DO):
   - Restrict API key to specific APIs only (Directions, Geocoding, Places)
   - Add application restrictions:
     - iOS: Bundle identifier (`com.anonymous.beecustomerapp`)
     - Android: Package name (`com.anonymous.beecustomerapp`)
   - This prevents unauthorized use even if the key is extracted

2. **Monitor Usage**:
   - Set up billing alerts in Google Cloud Console
   - Monitor API usage regularly
   - Set up usage quotas if needed

3. **For Production** (Recommended):
   - **Option A**: Use API key restrictions (current approach) - acceptable for most apps
   - **Option B**: Create a backend proxy (more secure):
     - Client calls your backend API
     - Backend adds API key and calls Google Maps APIs
     - API key never exposed to client
     - Requires backend infrastructure

**Why This is Acceptable**:
- ✅ **Official Google Method**: This is the documented way to use Google Maps REST APIs
- ✅ **Designed for Client-Side**: Google Maps API keys are designed to be used client-side
- ✅ **Security via Restrictions**: Google's security model relies on API key restrictions, not hiding keys
- ✅ **Industry Standard**: Most React Native/Expo apps use this approach
- ✅ **Google's Documentation**: Google's official docs show this exact pattern

**When to Use Backend Proxy**:
- High-security requirements
- Need to hide API usage from client
- Want to add rate limiting or caching
- Need to modify requests/responses

**Recommendation**: For this app, API key restrictions are sufficient. If security requirements increase, implement a backend proxy.

---

