# Login Feature Implementation Plan

## Overview

This document outlines the implementation plan for the authentication/login feature based on the provided API documentation. The feature will integrate seamlessly with the existing feature-based architecture.

## Objectives

1. Implement user authentication (login) functionality
2. Create auth context for global state management
3. Implement "Who Me" endpoint for session validation
4. Create login screen UI
5. Integrate with existing API client and token storage
6. Add protected route handling
7. Update user profile management

## API Endpoints

### POST /api/auth/login

- **Purpose**: Authenticate user and receive JWT token
- **Auth Required**: No
- **Request**: `{ email: string, password: string }`
- **Response**: `{ token: string, expiration: string, user: User }`

### GET /api/auth/me

- **Purpose**: Get current authenticated user information
- **Auth Required**: Yes (Bearer Token)
- **Request**: None
- **Response**: `User` object

## Phase 1: Update Auth Types and Services

### Tasks

1. **Update `features/auth/types.ts`**

   - Add `LoginRequest` interface matching API
   - Add `LoginResponse` interface matching API
   - Update `User` interface to match API response:
     - `id: string` (Guid)
     - `email: string`
     - `fullName: string`
     - `role: string` (Admin, Owner, Driver, Client, etc.)
     - `tenantId: string | null` (Guid?)
     - `isOnboarded: boolean`
     - `businessType: string | null` ("Fleet" | "Individual" | null)
     - `isSoloDriver: boolean`
   - Add `UserRole` type union
   - Add `BusinessType` type union

2. **Update `features/auth/services/authService.ts`**

   - Create `login()` method:
     - Accepts `LoginRequest`
     - Calls `POST /api/auth/login`
     - Stores token using `tokenStorage`
     - Returns `LoginResponse`
   - Create `getCurrentUser()` method:
     - Calls `GET /api/auth/me`
     - Returns `User`
   - Create `logout()` method:
     - Clears tokens
     - Clears user data
   - Handle error responses:
     - 401 Unauthorized (Invalid credentials)
     - 401 Unauthorized (Account deactivated)
     - 400 Bad Request (Validation errors)

3. **Update `features/auth/services/tokenService.ts`**
   - Keep existing token storage methods
   - Add method to store user data
   - Add method to retrieve user data
   - Update `login()` to use actual API call (remove mock)

### Files to Create/Update

- `features/auth/types.ts` (Update)
- `features/auth/services/authService.ts` (Create)
- `features/auth/services/tokenService.ts` (Update)
- `features/auth/index.ts` (Update exports)

### Dependencies

- `shared/services/apiClient.ts` (existing)
- `shared/services/tokenStorage.ts` (existing)

**Estimated Complexity**: Medium

---

## Phase 2: Create Auth Context and Hooks

### Tasks

1. **Create `features/auth/context/AuthContext.tsx`**

   - Create `AuthContext` with:
     - `user: User | null`
     - `isAuthenticated: boolean`
     - `isLoading: boolean`
     - `login: (email: string, password: string) => Promise<void>`
     - `logout: () => Promise<void>`
     - `refreshUser: () => Promise<void>`
   - Implement `AuthProvider` component:
     - Initialize auth state on mount
     - Check for existing token
     - Fetch user if token exists
     - Handle token expiration

2. **Create `features/auth/hooks/useAuth.ts`**

   - Custom hook to consume `AuthContext`
   - Returns auth state and methods
   - Throws error if used outside provider

3. **Create `features/auth/hooks/useLogin.ts`**
   - Custom hook for login form
   - Manages form state (email, password)
   - Handles loading and error states
   - Calls auth service and updates context

### Files to Create

- `features/auth/context/AuthContext.tsx`
- `features/auth/hooks/useAuth.ts`
- `features/auth/hooks/useLogin.ts`
- `features/auth/index.ts` (Update exports)

### Dependencies

- Phase 1 (auth services)

**Estimated Complexity**: Medium

---

## Phase 3: Create Login Screen

### Tasks

1. **Create `app/login.tsx`**

   - Login form UI:
     - Email input field
     - Password input field (secure text entry)
     - Login button
     - Loading state
     - Error message display
   - Form validation:
     - Email format validation
     - Password required
     - Show validation errors
   - Handle login:
     - Call `useLogin` hook
     - Show loading state
     - Handle errors (invalid credentials, deactivated account)
     - Navigate to dashboard on success
   - Safe area handling
   - Proper styling matching app theme

2. **Create `features/auth/components/LoginForm.tsx`** (Optional)
   - Reusable login form component
   - Can be used in modal or separate screen
   - Props: `onLoginSuccess`, `onLoginError`

### Files to Create

- `app/login.tsx`
- `features/auth/components/LoginForm.tsx` (Optional)

### Dependencies

- Phase 2 (auth hooks)

**Estimated Complexity**: Low-Medium

---

## Phase 4: Update Root Layout and Navigation

### Tasks

1. **Update `app/_layout.tsx`**

   - Wrap app with `AuthProvider`
   - Add protected route logic
   - Handle initial auth state check
   - Show loading screen while checking auth

2. **Create `app/(auth)/login.tsx`** (Alternative structure)

   - If using auth group for login/register screens
   - Update navigation structure

3. **Update navigation flow**
   - Redirect to login if not authenticated
   - Redirect to dashboard if authenticated
   - Handle deep linking with auth check

### Files to Update

- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx` (if needed)

### Dependencies

- Phase 2 (AuthProvider)

**Estimated Complexity**: Medium

---

## Phase 5: Update API Client Configuration

### Tasks

1. **Update `shared/services/apiClient.ts`**

   - Ensure base URL can be configured
   - Update default base URL to match API
   - Verify token injection works correctly
   - Handle 401 responses:
     - Clear tokens on 401
     - Trigger logout in auth context
     - Redirect to login

2. **Create environment configuration**
   - Create `.env.example` file with API configuration template (THIS FILE WILL BE COMMITTED)
   - Update `.gitignore` to exclude `.env` files but allow `.env.example`
   - Update `apiClient.ts` to use `EXPO_PUBLIC_API_URL` from environment
   - Add support for optional `EXPO_PUBLIC_API_TIMEOUT` and `EXPO_PUBLIC_API_DEBUG`
   - Document environment variables in README
   - **Important**: `.env` should NOT be committed, only `.env.example` (template) should be in git

### Files to Create/Update

- `shared/services/apiClient.ts` (Update)
- `.env.example` (Create - template file, **WILL BE COMMITTED** to git)
- `.gitignore` (Update - ensure `.env` is ignored but `.env.example` is **NOT** ignored)
- `README.md` (Update - add env setup instructions)

**Important**:

- `.env` → Should **NOT** be committed (contains sensitive API URLs)
- `.env.example` → **SHOULD** be committed (template file, no sensitive data)

### Dependencies

- Phase 1 (auth services)

**Estimated Complexity**: Low

---

## Phase 6: Protected Routes and Session Management

### Tasks

1. **Create `shared/components/ProtectedRoute.tsx`** (If needed)

   - Component wrapper for protected screens
   - Checks authentication
   - Redirects to login if not authenticated
   - Shows loading state

2. **Update screens to use auth**

   - Dashboard: Show user name from auth context
   - All screens: Access user data if needed
   - Handle logout functionality

3. **Implement session refresh**
   - Check token expiration
   - Refresh user data periodically
   - Handle token expiration gracefully

### Files to Create/Update

- `shared/components/ProtectedRoute.tsx` (Optional)
- `app/(tabs)/index.tsx` (Update to use user from auth)
- `app/(tabs)/explore.tsx` (Update if needed)

### Dependencies

- Phase 2 (AuthContext)
- Phase 4 (Navigation)

**Estimated Complexity**: Medium

---

## Phase 7: Error Handling and User Feedback

### Tasks

1. **Implement comprehensive error handling**

   - Network errors
   - Invalid credentials
   - Account deactivated
   - Token expiration
   - Validation errors

2. **Add user feedback**

   - Loading indicators
   - Success messages
   - Error messages (user-friendly)
   - Toast notifications (optional)

3. **Add form validation**
   - Email format validation
   - Password requirements (if any)
   - Real-time validation feedback

### Files to Create/Update

- `features/auth/components/LoginForm.tsx` (if created)
- `app/login.tsx`
- `shared/utils/validation.ts` (Create if needed)

### Dependencies

- Phase 3 (Login screen)

**Estimated Complexity**: Low-Medium

---

## File Structure After Implementation

```
features/auth/
├── components/
│   └── LoginForm.tsx (Optional)
├── context/
│   └── AuthContext.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useLogin.ts
├── services/
│   ├── authService.ts
│   └── tokenService.ts
├── types.ts
└── index.ts

app/
├── _layout.tsx (Updated with AuthProvider)
├── login.tsx (New)
└── (tabs)/
    └── index.tsx (Updated to use auth)

shared/
├── components/
│   └── ProtectedRoute.tsx (Optional)
└── utils/
    └── validation.ts (Optional)
```

## Type Definitions

### LoginRequest

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

### LoginResponse

```typescript
interface LoginResponse {
  token: string;
  expiration: string; // ISO 8601 datetime
  user: User;
}
```

### User

```typescript
interface User {
  id: string; // Guid
  email: string;
  fullName: string;
  role: UserRole;
  tenantId: string | null; // Guid | null
  isOnboarded: boolean;
  businessType: BusinessType | null;
  isSoloDriver: boolean;
}

type UserRole = "Admin" | "Owner" | "Driver" | "Client" | string;
type BusinessType = "Fleet" | "Individual";
```

## Implementation Order

1. **Phase 1**: Update types and services (Foundation)
2. **Phase 2**: Create context and hooks (State management)
3. **Phase 5**: Update API client (Infrastructure)
4. **Phase 3**: Create login screen (UI)
5. **Phase 4**: Update navigation (Integration)
6. **Phase 6**: Protected routes (Security)
7. **Phase 7**: Error handling (Polish)

## Testing Considerations

1. **Unit Tests**

   - Auth service methods
   - Token storage
   - Form validation

2. **Integration Tests**

   - Login flow
   - Token injection
   - Protected routes

3. **E2E Tests**
   - Complete login flow
   - Session persistence
   - Logout flow

## Security Considerations

1. **Token Storage**

   - Use `expo-secure-store` (already implemented)
   - Never expose tokens in logs
   - Clear tokens on logout

2. **Password Handling**

   - Never store passwords
   - Use secure text input
   - Clear password fields after use

3. **API Security**

   - Always use HTTPS in production
   - Validate responses
   - Handle errors securely

4. **Session Management**
   - Check token expiration
   - Handle 401 responses
   - Implement automatic logout

## Environment Configuration

### Environment Variables

The application uses environment variables to configure the API base URL and other settings. These variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the Expo/React Native app.

### .env.example

Create a `.env.example` file in the project root with the following content:

```env
# API Configuration
# Base URL for the API server
# Development options:
#   - http://localhost:5248/api (HTTP)
#   - https://localhost:7201/api (HTTPS)
# Production:
#   - https://api.yourdomain.com/api

EXPO_PUBLIC_API_URL=http://localhost:5248/api

# Optional: API Timeout (in milliseconds)
# Default: 30000 (30 seconds)
EXPO_PUBLIC_API_TIMEOUT=30000

# Optional: Enable API request logging (for debugging)
# Values: true | false
# Default: false
EXPO_PUBLIC_API_DEBUG=false
```

### .env (Create this file - DO NOT commit to git)

Create a `.env` file in the project root (this file should be in `.gitignore`):

**For Development:**

```env
EXPO_PUBLIC_API_URL=http://localhost:5248/api
EXPO_PUBLIC_API_TIMEOUT=30000
EXPO_PUBLIC_API_DEBUG=true
```

**For Production:**

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api
EXPO_PUBLIC_API_TIMEOUT=30000
EXPO_PUBLIC_API_DEBUG=false
```

### Environment Variable Reference

| Variable                  | Type    | Required | Default                   | Description                                          |
| ------------------------- | ------- | -------- | ------------------------- | ---------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`     | string  | Yes      | `https://api.example.com` | Base URL for API requests (must include `/api` path) |
| `EXPO_PUBLIC_API_TIMEOUT` | number  | No       | `30000`                   | Request timeout in milliseconds                      |
| `EXPO_PUBLIC_API_DEBUG`   | boolean | No       | `false`                   | Enable API request/response logging                  |

### Setup Instructions

1. **Copy the example file:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**

   - Update `EXPO_PUBLIC_API_URL` with your API server URL
   - Adjust timeout if needed
   - Enable debug mode for development

3. **Verify `.gitignore` configuration:**
   Ensure `.env` is ignored but `.env.example` is NOT ignored:

   ```
   # Ignore .env files but keep .env.example (template)
   .env
   .env.local
   .env*.local
   !.env.example
   ```

   **Important**:

   - `.env` → Should NOT be committed (contains sensitive data)
   - `.env.example` → SHOULD be committed (template file, no sensitive data)

4. **Restart Expo:**
   After creating/updating `.env`, restart Expo:
   ```bash
   npx expo start --clear
   ```

### API Base URL Examples

**Local Development (HTTP):**

```env
EXPO_PUBLIC_API_URL=http://localhost:5248/api
```

**Local Development (HTTPS):**

```env
EXPO_PUBLIC_API_URL=https://localhost:7201/api
```

**Staging Environment:**

```env
EXPO_PUBLIC_API_URL=https://staging-api.yourdomain.com/api
```

**Production Environment:**

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api
```

### Using Environment Variables in Code

Environment variables are accessed via `process.env.EXPO_PUBLIC_*`:

```typescript
// In shared/services/apiClient.ts
const DEFAULT_CONFIG: ApiClientConfig = {
  baseURL: process.env.EXPO_PUBLIC_API_URL || "https://api.example.com",
  timeout: Number(process.env.EXPO_PUBLIC_API_TIMEOUT) || 30000,
  // ... other config
};

// Enable debug logging if configured
if (process.env.EXPO_PUBLIC_API_DEBUG === "true") {
  console.log("API Debug Mode Enabled");
}
```

### Platform-Specific Configuration

For different environments (development, staging, production), you can create separate files:

- `.env.development` - Development settings
- `.env.staging` - Staging settings
- `.env.production` - Production settings

Then use a script to copy the appropriate file:

```bash
# Development
cp .env.development .env

# Staging
cp .env.staging .env

# Production
cp .env.production .env
```

### Verification

To verify environment variables are loaded correctly:

```typescript
// Add this temporarily to check values
console.log("API URL:", process.env.EXPO_PUBLIC_API_URL);
console.log("API Timeout:", process.env.EXPO_PUBLIC_API_TIMEOUT);
console.log("API Debug:", process.env.EXPO_PUBLIC_API_DEBUG);
```

### Troubleshooting

**Issue: Environment variables not loading**

- Ensure variables are prefixed with `EXPO_PUBLIC_`
- Restart Expo with `--clear` flag
- Check that `.env` file is in project root
- Verify `.env` file syntax (no spaces around `=`)

**Issue: API calls failing**

- Verify `EXPO_PUBLIC_API_URL` includes `/api` path
- Check API server is running
- Verify network connectivity
- Check CORS settings on API server

**Issue: Timeout errors**

- Increase `EXPO_PUBLIC_API_TIMEOUT` value
- Check network latency
- Verify API server is responsive

## Error Scenarios and Handling

### Invalid Credentials (401)

- Show error message: "Email or password is incorrect"
- Keep form filled (except password)
- Allow retry

### Account Deactivated (401)

- Show error message: "Your account has been deactivated. Please contact support."
- Disable login button
- Provide support contact info

### Network Error

- Show error message: "Network error. Please check your connection."
- Allow retry
- Show offline indicator if applicable

### Token Expired (401 on /me)

- Clear stored tokens
- Redirect to login
- Show message: "Your session has expired. Please login again."

### Validation Errors (400)

- Show field-specific errors
- Highlight invalid fields
- Allow correction and resubmission

## Success Flow

1. User enters email and password
2. Clicks "Login" button
3. Form validates input
4. Shows loading indicator
5. API call to `/api/auth/login`
6. On success:
   - Store token securely
   - Store user data
   - Update auth context
   - Navigate to dashboard
7. On dashboard load:
   - Verify token with `/api/auth/me`
   - Display user information
   - Load user-specific data

## Future Enhancements

1. **Remember Me** functionality
2. **Biometric authentication** (Face ID / Touch ID)
3. **Password reset** flow
4. **Two-factor authentication** (2FA)
5. **Social login** (Google, Apple, etc.)
6. **Session timeout** warning
7. **Multiple device** management
8. **Account settings** screen

## Dependencies

- Existing `shared/services/apiClient.ts`
- Existing `shared/services/tokenStorage.ts`
- Existing `shared/types/api.ts`
- React Context API
- Expo Router
- React Native components

## Estimated Timeline

- **Phase 1**: 2-3 hours
- **Phase 2**: 3-4 hours
- **Phase 3**: 2-3 hours
- **Phase 4**: 2-3 hours
- **Phase 5**: 1 hour
- **Phase 6**: 2-3 hours
- **Phase 7**: 2-3 hours

**Total**: ~14-20 hours

## Notes

1. The API returns user object directly in `/api/auth/me` (not wrapped in `{ success: true, data: ... }`)
2. Token expiration is 60 minutes (configurable on backend)
3. Account deactivation prevents login
4. Tenant isolation is handled on backend
5. Onboarding status affects feature access (may need future implementation)

## Approval

This plan should be reviewed and approved before implementation begins. Each phase can be implemented and tested independently.
