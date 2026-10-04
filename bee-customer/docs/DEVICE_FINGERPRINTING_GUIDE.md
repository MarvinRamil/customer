# Device Fingerprinting Implementation Guide

## Overview

Device fingerprinting has been implemented across all frontend applications to enhance security and detect token theft. This guide explains how it works and how to use it.

## Security Benefits

- **Token Theft Detection**: If a refresh token is stolen and used from a different device, the backend will detect the mismatch and revoke the token
- **Unauthorized Access Prevention**: Helps prevent unauthorized access even if tokens are compromised
- **Audit Trail**: Device information is logged for security monitoring

## Implementation Details

### Mobile Apps (React Native/Expo)

**Location**: `shared/services/deviceFingerprint.ts`

**How it works**:
1. Generates a unique fingerprint based on:
   - Device installation ID (most stable)
   - Device name, brand, model
   - OS name and version
   - Platform (iOS/Android)
   - App version

2. Stores fingerprint securely using `expo-secure-store`
3. Reuses the same fingerprint across app sessions
4. Automatically included in refresh token requests

**Usage**:
```typescript
import { getDeviceFingerprint, getDeviceId } from '@/shared/services/deviceFingerprint';

// Get device fingerprint (automatically generated and cached)
const fingerprint = await getDeviceFingerprint();

// Get device ID (shorter identifier)
const deviceId = await getDeviceId();
```

### Web App (Back-Office)

**Location**: `lib/utils/deviceFingerprint.ts`

**How it works**:
1. Generates a unique fingerprint based on:
   - User agent
   - Screen resolution and color depth
   - Browser language and platform
   - Timezone
   - Canvas fingerprint (browser-specific)

2. Stores fingerprint in `sessionStorage`
3. Reuses the same fingerprint across sessions
4. Automatically included in refresh token requests

**Usage**:
```typescript
import { getDeviceFingerprint, getDeviceId } from '@/lib/utils/deviceFingerprint';

// Get device fingerprint (automatically generated and cached)
const fingerprint = getDeviceFingerprint();

// Get device ID (shorter identifier)
const deviceId = getDeviceId();
```

## Automatic Integration

Device fingerprinting is **automatically integrated** into refresh token requests:

### Mobile Apps (`apiClient.ts`)
```typescript
// Automatically included in refresh token requests
body: JSON.stringify({ 
  refreshToken,
  deviceId,        // Automatically added
  deviceFingerprint, // Automatically added
})
```

### Web App (`client.ts` & `auth.ts`)
```typescript
// Automatically included in refresh token requests
{
  refreshToken,
  deviceId,        // Automatically added
  deviceFingerprint, // Automatically added
}
```

## Backend Validation

The backend validates device fingerprints when refresh tokens are used:

1. **First Use**: Device fingerprint is stored with the refresh token
2. **Subsequent Uses**: Backend compares provided fingerprint with stored fingerprint
3. **Mismatch Detection**: If fingerprints don't match, the token is revoked and an audit log is created

## Testing

### Clear Device Fingerprint (for testing)

**Mobile**:
```typescript
import { clearDeviceFingerprint } from '@/shared/services/deviceFingerprint';
await clearDeviceFingerprint();
```

**Web**:
```typescript
import { clearDeviceFingerprint } from '@/lib/utils/deviceFingerprint';
clearDeviceFingerprint();
```

## Privacy Considerations

- **No Personal Data**: Device fingerprints don't contain personal information
- **Device-Specific**: Fingerprints are unique per device, not per user
- **Secure Storage**: Mobile apps use Expo SecureStore; web uses sessionStorage
- **Optional**: Device fingerprinting is optional - if not provided, tokens still work (backward compatible)

## Troubleshooting

### Fingerprint Not Working

1. **Mobile**: Ensure `expo-device` and `expo-constants` are installed
2. **Web**: Ensure browser supports `sessionStorage`
3. **Check Logs**: Look for `[DeviceFingerprint]` logs in development mode

### Token Refresh Failing

- Check if device fingerprint is being sent (inspect network requests)
- Verify backend migration has been applied
- Check backend logs for "Device fingerprint mismatch" errors

## Future Enhancements

- **Canvas Fingerprinting**: Enhanced browser fingerprinting (web)
- **Hardware Fingerprinting**: Additional device characteristics (mobile)
- **Fingerprint Rotation**: Periodic fingerprint updates for enhanced security
