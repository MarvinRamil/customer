# Booking Screen: Item Image – Direct Camera Capture

## Overview

This plan documents how to add direct camera capture for the optional item image on the booking screen. Currently, users can only pick an image from their photo library. The goal is to allow users to take a photo directly with the camera.

## Current Implementation

### Location

- **File:** `app/booking.tsx`
- **Handler:** `handlePickImage` (lines ~1341–1378)
- **UI:** Single "Upload Image of Item" button with camera icon

### Current Flow

1. User taps "Upload Image of Item"
2. `handlePickImage` runs
3. Requests **media library permission** only: `ImagePicker.requestMediaLibraryPermissionsAsync()`
4. Launches **photo library picker**: `ImagePicker.launchImageLibraryAsync()`
5. User selects an image from gallery
6. Result stored in `itemImage` state: `{ uri, type, name }`

### Data Flow

- `itemImage` → `bookingService.createBooking()` → FormData → multipart API
- The API expects `{ uri, type, name }` – both `launchImageLibraryAsync` and `launchCameraAsync` return compatible asset structures

### Dependencies

- `expo-image-picker` (already installed)
- `expo-camera` (already installed – used for identity verification elsewhere)
- Permissions: `photosPermission` in app.config; `cameraPermission` exists via expo-camera plugin

---

## API: `launchCameraAsync`

`expo-image-picker` provides `ImagePicker.launchCameraAsync()` which opens the device camera directly.

### Basic Usage

```typescript
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.8,
});
```

### Permissions

- **Camera:** `ImagePicker.requestCameraPermissionsAsync()` – required before launching camera
- **Platforms:** Android, iOS, Web (web requires user interaction, e.g. button press)

### Config

- `expo-image-picker` config plugin should include `cameraPermission` message
- On Android/iOS 10, `Permissions.CAMERA_ROLL` may also be required in some cases

---

## Implementation Options

### Option A: Camera Only

- Replace gallery picker with camera only
- Simpler UX but removes ability to choose existing photos

### Option B: Two Buttons – Camera + Gallery (Recommended)

- Two actions: "Take Photo" and "Choose from Gallery"
- Clear and explicit choices

### Option C: Action Sheet

- Single button that opens action sheet: "Take Photo" | "Choose from Gallery"
- Common pattern in many apps

---

## Implementation Plan (Option B or C)

### 1. Permissions

| Action | Current | New |
|--------|---------|-----|
| Gallery | `requestMediaLibraryPermissionsAsync` | Keep as-is |
| Camera | Not used | Add `requestCameraPermissionsAsync` |

Request each permission only when the user selects that action.

### 2. New Handler

Add `handleTakePhoto` that:

1. Calls `ImagePicker.requestCameraPermissionsAsync()`
2. If granted, calls `ImagePicker.launchCameraAsync()` with same options as current picker (`allowsEditing`, `aspect`, `quality`)
3. On success, sets `itemImage` with same structure: `{ uri, type, name }`

### 3. UI Changes

**Option B:**
- Add second button: "Take Photo" (camera)
- Keep "Choose from Gallery" (images) for library

**Option C:**
- Keep single entry point
- On press, show `ActionSheet` with:
  - "Take Photo"
  - "Choose from Gallery"
  - "Cancel"

### 4. Code Structure

```typescript
// New: handleTakePhoto - uses launchCameraAsync
const handleTakePhoto = useCallback(async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission Required", "We need camera access to take a photo of the item.");
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
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
}, []);

// Existing: handlePickImage - uses launchImageLibraryAsync (unchanged)
```

### 5. App Config

Update `expo-image-picker` plugin in `app.config.js` to include camera permission:

```javascript
[
  "expo-image-picker",
  {
    photosPermission: "We need access to your photos to upload an image of the item to be delivered.",
    cameraPermission: "We need camera access to take a photo of the item to be delivered.",
  },
],
```

---

## Platform Considerations

| Platform | Notes |
|----------|-------|
| **Android** | May require `Permissions.CAMERA_ROLL` on Android/iOS 10 in addition to `CAMERA` |
| **iOS** | `NSCameraUsageDescription` already present via expo-camera plugin |
| **Web** | Must be called from user interaction (e.g. button press) – already the case |

---

## Implementation Steps

1. **Update app.config.js**  
   Add `cameraPermission` to the `expo-image-picker` plugin config.

2. **Add `handleTakePhoto`**  
   Implement camera handler with `launchCameraAsync` and same result handling as `handlePickImage`.

3. **Update UI**  
   - **Option B:** Add second button for camera  
   - **Option C:** Replace single button with action sheet before picking

4. **Test**  
   Verify on iOS and Android that permissions and capture flow work correctly.

---

## Summary

| Item | Details |
|------|---------|
| **Scope** | Add direct camera capture for item image on booking screen |
| **API** | `ImagePicker.launchCameraAsync()` (expo-image-picker) |
| **Permissions** | Add `requestCameraPermissionsAsync`; keep media library for gallery |
| **Data Format** | No change – same `{ uri, type, name }` for both camera and gallery |
| **Config** | Add `cameraPermission` to expo-image-picker plugin |
| **Estimated Effort** | ~30–45 minutes |
