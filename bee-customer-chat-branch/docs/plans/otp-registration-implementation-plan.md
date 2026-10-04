# OTP-Based Registration Implementation Plan

## Implementation Checklist

### Phase 1: Type Definitions and Service Layer
- [x] Add `SendOtpRequest` interface to `features/auth/types.ts`
- [x] Add `SendOtpResponse` interface to `features/auth/types.ts`
- [x] Add `VerifyOtpRequest` interface to `features/auth/types.ts`
- [x] Add `VerifyOtpResponse` interface to `features/auth/types.ts`
- [x] Add `ResendOtpRequest` interface to `features/auth/types.ts`
- [x] Add `ResendOtpResponse` interface to `features/auth/types.ts`
- [x] Add `RegistrationStatusRequest` interface to `features/auth/types.ts` (optional)
- [x] Add `RegistrationStatusResponse` interface to `features/auth/types.ts` (optional)
- [x] Verify `RegisterResponse` includes `requiresEmailVerification` field
- [x] Add `sendOtp()` method to `features/auth/services/authService.ts`
- [x] Add `verifyOtp()` method to `features/auth/services/authService.ts`
- [x] Add `resendOtp()` method to `features/auth/services/authService.ts`
- [x] Add `getRegistrationStatus()` method to `features/auth/services/authService.ts` (optional)
- [x] Update `register()` method documentation
- [x] Add OTP-specific error handling (email locked, invalid OTP, etc.)
- [ ] Test service methods with API

**Status:** ✅ Completed (Testing pending)

---

### Phase 2: OTP Hooks
- [x] Create `features/auth/hooks/useSendOtp.ts`
- [x] Implement loading state management in `useSendOtp`
- [x] Implement rate limiting error handling in `useSendOtp`
- [x] Create `features/auth/hooks/useVerifyOtp.ts`
- [x] Implement loading state management in `useVerifyOtp`
- [x] Implement invalid/expired OTP error handling in `useVerifyOtp`
- [x] Track email verification status in `useVerifyOtp`
- [x] Create `features/auth/hooks/useResendOtp.ts`
- [x] Implement loading state management in `useResendOtp`
- [x] Implement rate limiting error handling in `useResendOtp`
- [x] Update `features/auth/hooks/useRegister.ts` to support OTP-verified email flow
- [x] Add OTP verification tracking to `useRegister`
- [x] Update registration logic to handle both OTP and email link flows
- [x] Export new hooks from `features/auth/index.ts`
- [ ] Test hooks individually

**Status:** ✅ Completed (Testing pending)

---

### Phase 3: Registration Flow Hook Refactoring
- [x] Create `features/auth/hooks/useRegistrationFlow.ts`
- [x] Implement OTP flow state management (Send OTP → Verify OTP → Register → Login)
- [x] Implement email link flow state management (Register → Verify Email Link → Login)
- [x] Add step tracking (email-entry, otp-verification, registration-form, success)
- [x] Implement flow transitions between steps
- [x] Add error handling for each step
- [x] Maintain backward compatibility with existing API (useRegister remains unchanged)
- [x] Export new hook from `features/auth/index.ts`
- [ ] Test complete flows

**Status:** ✅ Completed (Testing pending)

**Note:** `useRegister.ts` was not refactored to use the new hook internally to maintain full backward compatibility. The new `useRegistrationFlow` hook can be used directly in new implementations.

---

### Phase 4: UI Components
- [x] Create `features/auth/components/OtpInput.tsx`
- [x] Implement 6-digit OTP input with auto-focus
- [x] Add paste support to `OtpInput`
- [x] Add visual feedback (valid/invalid) to `OtpInput`
- [x] Create `features/auth/components/OtpVerificationScreen.tsx`
- [x] Display email address in OTP verification screen
- [x] Add OTP input field to verification screen
- [x] Add resend OTP button with countdown timer
- [x] Add error handling UI to verification screen
- [x] Update `app/register.tsx` to support OTP flow
- [x] Add Step 1: Email entry + Send OTP
- [x] Add Step 2: OTP verification screen
- [x] Add Step 3: Registration form (full name, password, etc.)
- [x] Add Step 4: Success screen
- [x] Add option to skip OTP and use email link verification
- [x] Add step indicator/navigation UI (via step-based rendering)
- [x] Export new components from `features/auth/index.ts`
- [ ] Test UI flow end-to-end

**Status:** ✅ Completed (Testing pending)

---

### Phase 5: Error Handling and Edge Cases
- [ ] Handle email locked error (too many failed attempts)
- [ ] Handle invalid OTP error
- [ ] Handle expired OTP error
- [ ] Handle rate limiting errors (send, verify, resend)
- [ ] Handle network errors
- [ ] Handle email already registered during OTP flow
- [ ] Handle app close during OTP flow
- [ ] Handle wrong email entered in OTP step
- [ ] Handle email change after sending OTP
- [ ] Handle OTP expiration while filling form
- [ ] Handle multiple OTP requests (invalidate previous)
- [ ] Add clear error messages for all scenarios
- [ ] Add loading states for all operations
- [ ] Add success feedback
- [ ] Add resend OTP countdown timer
- [ ] Add option to go back and change email
- [ ] Test all error scenarios
- [ ] Test all edge cases

**Status:** ⏳ Not Started

---

### Phase 6: Testing and Validation
- [ ] Write unit tests for OTP hooks
- [ ] Write unit tests for registration flow hook
- [ ] Write unit tests for error handling
- [ ] Write integration tests for complete OTP flow
- [ ] Write integration tests for email link flow
- [ ] Write integration tests for error scenarios
- [ ] Manual test: OTP flow end-to-end
- [ ] Manual test: Email link flow end-to-end
- [ ] Manual test: All error scenarios
- [ ] Manual test: All edge cases
- [ ] Test on iOS device
- [ ] Test on Android device
- [ ] Test on web (if applicable)
- [ ] Performance testing
- [ ] Accessibility testing
- [ ] Code review
- [ ] Documentation review

**Status:** ⏳ Not Started

---

## Overall Progress

**Completed Phases:** 4 / 6  
**Current Phase:** Phase 4 - UI Components ✅  
**Next Phase:** Phase 5 - Error Handling and Edge Cases  
**Overall Status:** 🟡 In Progress

---

## Overview

This document outlines the implementation plan for updating the registration flow to support the new OTP-based registration API. The new API introduces a recommended 3-step OTP flow while maintaining backward compatibility with the existing email link verification flow.

## Current State Analysis

### Existing Implementation

**Current Registration Flow:**
1. User enters email → Email availability check (optional)
2. User fills registration form → Submit
3. Account created → Email verification link sent
4. User clicks link → Email verified → Can login

**Current Components:**
- `features/auth/hooks/useRegister.ts` - Registration hook
- `features/auth/hooks/useCheckEmail.ts` - Email availability check
- `features/auth/services/authService.ts` - Auth service methods
- `features/auth/types.ts` - Type definitions
- `app/register.tsx` - Registration UI

**Current API Endpoints Used:**
- `POST /api/auth/check-email` - Check email availability ✅ (unchanged)
- `POST /api/auth/register` - Register account ✅ (updated behavior)
- `POST /api/auth/resend-verification` - Resend verification email ✅ (unchanged)
- `POST /api/auth/verify-email` - Verify email via link ✅ (unchanged)

### New API Endpoints Required

**OTP-Based Registration (Recommended):**
- `POST /api/auth/send-otp` - Send OTP to email ⚠️ (NEW)
- `POST /api/auth/verify-otp` - Verify OTP code ⚠️ (NEW)
- `POST /api/auth/resend-otp` - Resend OTP ⚠️ (NEW)

**Supporting Endpoints:**
- `GET /api/auth/security-questions` - Get security questions ✅ (exists)
- `GET /api/auth/registration-status` - Check registration status ⚠️ (NEW - optional)

## Implementation Phases

### Phase 1: Type Definitions and Service Layer

**Objective:** Add new types and service methods for OTP operations

**Tasks:**

1. **Update `features/auth/types.ts`**
   - Add `SendOtpRequest` interface
   - Add `SendOtpResponse` interface
   - Add `VerifyOtpRequest` interface
   - Add `VerifyOtpResponse` interface
   - Add `ResendOtpRequest` interface
   - Add `ResendOtpResponse` interface
   - Update `RegisterResponse` to include `requiresEmailVerification` (already exists)
   - Add `RegistrationStatusRequest` interface (optional)
   - Add `RegistrationStatusResponse` interface (optional)

2. **Update `features/auth/services/authService.ts`**
   - Add `sendOtp(email: string): Promise<SendOtpResponse>` method
   - Add `verifyOtp(email: string, otp: string): Promise<VerifyOtpResponse>` method
   - Add `resendOtp(email: string): Promise<ResendOtpResponse>` method
   - Update `register()` method documentation (behavior unchanged, but now supports OTP-verified emails)
   - Add `getRegistrationStatus(email: string): Promise<RegistrationStatusResponse>` method (optional)
   - Add error handling for OTP-specific errors (email locked, invalid OTP, etc.)

**Files to Modify:**
- `features/auth/types.ts`
- `features/auth/services/authService.ts`

**Estimated Time:** 2-3 hours

---

### Phase 2: OTP Hooks

**Objective:** Create hooks for managing OTP flow state

**Tasks:**

1. **Create `features/auth/hooks/useSendOtp.ts`**
   - Hook for sending OTP
   - Manages loading state
   - Handles rate limiting errors
   - Returns success/error state

2. **Create `features/auth/hooks/useVerifyOtp.ts`**
   - Hook for verifying OTP
   - Manages loading state
   - Handles invalid/expired OTP errors
   - Returns verification success state
   - Tracks email verification status

3. **Create `features/auth/hooks/useResendOtp.ts`**
   - Hook for resending OTP
   - Manages loading state
   - Handles rate limiting errors
   - Returns success/error state

4. **Update `features/auth/hooks/useRegister.ts`**
   - Add support for OTP-verified email flow
   - Track whether email was verified via OTP
   - Update registration logic to handle both flows
   - Maintain backward compatibility with email link verification

**Files to Create:**
- `features/auth/hooks/useSendOtp.ts`
- `features/auth/hooks/useVerifyOtp.ts`
- `features/auth/hooks/useResendOtp.ts`

**Files to Modify:**
- `features/auth/hooks/useRegister.ts`
- `features/auth/index.ts` (export new hooks)

**Estimated Time:** 4-5 hours

---

### Phase 3: Registration Flow Hook Refactoring

**Objective:** Create a unified registration flow hook that supports both OTP and email link verification

**Tasks:**

1. **Create `features/auth/hooks/useRegistrationFlow.ts`**
   - Unified hook managing the entire registration flow
   - Supports two flows:
     - **OTP Flow (Recommended):** Send OTP → Verify OTP → Register → Login
     - **Email Link Flow (Alternative):** Register → Verify Email Link → Login
   - Manages flow state (step tracking)
   - Handles transitions between steps
   - Provides error handling for each step

2. **Update `features/auth/hooks/useRegister.ts`**
   - Refactor to use new flow hook internally
   - Maintain existing API for backward compatibility
   - Add new methods for OTP flow if needed

**Files to Create:**
- `features/auth/hooks/useRegistrationFlow.ts`

**Files to Modify:**
- `features/auth/hooks/useRegister.ts`
- `features/auth/index.ts`

**Estimated Time:** 5-6 hours

---

### Phase 4: UI Components

**Objective:** Update registration UI to support OTP flow

**Tasks:**

1. **Create `features/auth/components/OtpInput.tsx`**
   - OTP input component (6-digit code)
   - Auto-focus next input
   - Paste support
   - Visual feedback for valid/invalid

2. **Create `features/auth/components/OtpVerificationScreen.tsx`**
   - Screen for OTP verification step
   - Shows email address
   - OTP input field
   - Resend OTP button
   - Error handling
   - Countdown timer for resend (optional)

3. **Update `app/register.tsx`**
   - Add OTP verification step before registration
   - Update flow to support:
     - Step 1: Email entry + Send OTP
     - Step 2: OTP verification
     - Step 3: Registration form (full name, password, etc.)
     - Step 4: Success screen
   - Add option to skip OTP and use email link verification (for backward compatibility)
   - Update UI to show current step
   - Add navigation between steps

**Files to Create:**
- `features/auth/components/OtpInput.tsx`
- `features/auth/components/OtpVerificationScreen.tsx`

**Files to Modify:**
- `app/register.tsx`
- `features/auth/index.ts` (export new components)

**Estimated Time:** 6-8 hours

---

### Phase 5: Error Handling and Edge Cases

**Objective:** Handle all error scenarios and edge cases

**Tasks:**

1. **Error Handling:**
   - Email locked (too many failed attempts)
   - Invalid/expired OTP
   - Rate limiting errors
   - Network errors
   - Email already registered (during OTP flow)
   - OTP expired

2. **Edge Cases:**
   - User closes app during OTP flow
   - User enters wrong email in OTP step
   - User wants to change email after sending OTP
   - OTP expires while user is filling form
   - Multiple OTP requests (invalidate previous)

3. **User Experience:**
   - Clear error messages
   - Loading states
   - Success feedback
   - Resend OTP with countdown
   - Option to go back and change email

**Files to Modify:**
- `features/auth/hooks/useRegistrationFlow.ts`
- `features/auth/services/authService.ts`
- `app/register.tsx`
- `features/auth/components/OtpVerificationScreen.tsx`

**Estimated Time:** 3-4 hours

---

### Phase 6: Testing and Validation

**Objective:** Test all flows and validate implementation

**Tasks:**

1. **Unit Tests:**
   - Test OTP hooks
   - Test registration flow hook
   - Test error handling

2. **Integration Tests:**
   - Test complete OTP flow
   - Test email link flow (backward compatibility)
   - Test error scenarios

3. **Manual Testing:**
   - Test OTP flow end-to-end
   - Test email link flow end-to-end
   - Test error scenarios
   - Test edge cases
   - Test on iOS and Android

**Estimated Time:** 4-5 hours

---

## Implementation Details

### Type Definitions

```typescript
// OTP Request/Response Types
export interface SendOtpRequest {
  email: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
}

export interface ResendOtpRequest {
  email: string;
}

export interface ResendOtpResponse {
  success: boolean;
  message: string;
}

// Registration Status (Optional)
export interface RegistrationStatusResponse {
  success: boolean;
  emailVerified: boolean;
  registrationComplete: boolean;
  canResume: boolean;
}
```

### Service Methods

```typescript
// authService.ts additions
async sendOtp(email: string): Promise<SendOtpResponse>
async verifyOtp(email: string, otp: string): Promise<VerifyOtpResponse>
async resendOtp(email: string): Promise<ResendOtpResponse>
async getRegistrationStatus(email: string): Promise<RegistrationStatusResponse> // Optional
```

### Registration Flow States

```typescript
type RegistrationStep = 
  | 'email-entry'      // Step 1: Enter email, send OTP
  | 'otp-verification' // Step 2: Verify OTP
  | 'registration-form' // Step 3: Fill registration form
  | 'success';         // Step 4: Registration complete

type RegistrationFlow = 'otp' | 'email-link';
```

### UI Flow

```
┌─────────────────────────────────────┐
│  Registration Screen                 │
├─────────────────────────────────────┤
│                                     │
│  Step 1: Email Entry                │
│  [Email Input]                      │
│  [Send OTP Button]                  │
│  [Skip OTP - Use Email Link]        │
│                                     │
└─────────────────────────────────────┘
           ↓ (OTP Flow)
┌─────────────────────────────────────┐
│  OTP Verification Screen             │
├─────────────────────────────────────┤
│                                     │
│  Email: user@example.com            │
│  [OTP Input: _ _ _ _ _ _]          │
│  [Verify OTP Button]                │
│  [Resend OTP] (30s countdown)       │
│                                     │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Registration Form                  │
├─────────────────────────────────────┤
│                                     │
│  Full Name: [________]              │
│  Password: [________]               │
│  Phone: [________] (optional)       │
│  Referral Code: [________] (opt)    │
│  [Create Account Button]           │
│                                     │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Success Screen                     │
├─────────────────────────────────────┤
│                                     │
│  ✓ Account Created                  │
│  Email verified via OTP            │
│  [Go to Login]                      │
│                                     │
└─────────────────────────────────────┘
```

## Backward Compatibility

### Email Link Verification Flow (Alternative)

Users can still register using the traditional email link verification:

1. User fills registration form
2. Account created → Email verification link sent
3. User clicks link → Email verified → Can login

This flow remains unchanged and will continue to work.

## Security Considerations

1. **Rate Limiting:**
   - OTP Send: 5 requests per email per 15 minutes
   - OTP Verify: 10 attempts per email per 10 minutes
   - OTP Resend: 3 requests per email per 15 minutes
   - Handle rate limit errors gracefully

2. **Email Lock:**
   - After 5 failed OTP attempts, email is locked for 30 minutes
   - Show clear error message to user
   - Prevent further attempts until lock expires

3. **OTP Expiration:**
   - OTP expires after 10 minutes
   - Show expiration warning to user
   - Allow resend if expired

4. **Email Enumeration Prevention:**
   - Generic success messages (API handles this)
   - Don't reveal if email exists or not

## Migration Strategy

1. **Phase 1-2:** Add OTP support without changing UI (backend ready)
2. **Phase 3-4:** Update UI to support OTP flow (default to OTP)
3. **Phase 5-6:** Test and refine
4. **Optional:** Add feature flag to toggle between OTP and email link flows

## Testing Checklist

- [ ] Send OTP with valid email
- [ ] Send OTP with invalid email format
- [ ] Send OTP with rate limit exceeded
- [ ] Verify OTP with correct code
- [ ] Verify OTP with incorrect code
- [ ] Verify OTP with expired code
- [ ] Resend OTP
- [ ] Resend OTP with rate limit
- [ ] Register with OTP-verified email
- [ ] Register with email link verification (backward compatibility)
- [ ] Error handling for all scenarios
- [ ] UI flow navigation
- [ ] Edge cases (app close, network errors, etc.)

## Estimated Total Time

- **Phase 1:** 2-3 hours
- **Phase 2:** 4-5 hours
- **Phase 3:** 5-6 hours
- **Phase 4:** 6-8 hours
- **Phase 5:** 3-4 hours
- **Phase 6:** 4-5 hours

**Total:** 24-31 hours (~3-4 days)

## Dependencies

- TanStack Query (already in use)
- React Native components (already in use)
- Existing auth service structure
- Existing type definitions

## Notes

1. **OTP Flow is Recommended:** The API documentation recommends OTP-based registration for better security and UX
2. **Backward Compatibility:** Email link verification remains available
3. **Optional Features:** Registration status endpoint is optional and can be added later
4. **Security Questions:** Already supported, no changes needed
5. **Error References:** API returns error references for server-side tracking (log but don't show to user)

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (Type Definitions and Service Layer)
3. Implement phases sequentially
4. Test after each phase
5. Deploy incrementally if possible

