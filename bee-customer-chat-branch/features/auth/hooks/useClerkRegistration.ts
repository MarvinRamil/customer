import { useAuth, useSignUp } from '@clerk/clerk-expo';
import { useCallback, useState } from 'react';
import { emailOnlySchema, registrationDetailsSchema } from '../schemas/validationSchemas';

/**
 * Clerk-backed email registration steps.
 */
export type ClerkRegistrationStep = 'email-entry' | 'enter-details' | 'email-otp';

export interface UseClerkRegistrationReturn {
  step: ClerkRegistrationStep;

  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  fullName: string;
  setFullName: (v: string) => void;
  referralCode: string;
  setReferralCode: (v: string) => void;
  code: string;
  setCode: (v: string) => void;

  error: string | null;
  clearError: () => void;
  isReady: boolean;
  isSubmitting: boolean;
  isVerifying: boolean;
  isResending: boolean;
  isSigningIn: boolean;

  proceedFromEmailEntry: () => boolean;
  startSignUp: () => Promise<void>;
  verifyCode: () => Promise<void>;
  resendCode: () => Promise<boolean>;
  back: () => void;
  reset: () => void;
}

function extractClerkError(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'errors' in err &&
    Array.isArray((err as { errors?: unknown }).errors)
  ) {
    const first = (err as { errors: { longMessage?: string; message?: string }[] }).errors[0];
    return first?.longMessage || first?.message || 'Something went wrong. Please try again.';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

function splitFullName(fullName: string): { firstName: string; lastName?: string } {
  const trimmedName = fullName.trim();
  const spaceIdx = trimmedName.indexOf(' ');
  const firstName = spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
  const lastName = spaceIdx === -1 ? undefined : trimmedName.slice(spaceIdx + 1).trim() || undefined;
  return { firstName, lastName };
}

/**
 * Clerk-native email registration.
 * Backend UserProfile is created by the Clerk `user.created` webhook.
 */
export function useClerkRegistration(): UseClerkRegistrationReturn {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { signOut } = useAuth();

  const [step, setStep] = useState<ClerkRegistrationStep>('email-entry');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [code, setCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setStep('email-entry');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setReferralCode('');
    setCode('');
    setError(null);
    setIsSubmitting(false);
    setIsVerifying(false);
    setIsResending(false);
    setIsSigningIn(false);
  }, []);

  const proceedFromEmailEntry = useCallback((): boolean => {
    setError(null);
    const result = emailOnlySchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return false;
    }
    setEmail(result.data.email);
    setStep('enter-details');
    return true;
  }, [email]);

  const startSignUp = useCallback(async () => {
    setError(null);

    const result = registrationDetailsSchema.safeParse({ fullName, password });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!isLoaded || !signUp) {
      setError('Sign-up is not ready yet. Please try again in a moment.');
      return;
    }

    const emailResult = emailOnlySchema.safeParse({ email });
    if (!emailResult.success) {
      setError(emailResult.error.issues[0].message);
      return;
    }

    const data = result.data;
    const { firstName, lastName } = splitFullName(data.fullName);
    const normalizedEmail = emailResult.data.email;
    const trimmedReferral = referralCode.trim() || null;

    setIsSubmitting(true);
    try {
      // Single-session: a leftover session makes signUp.create throw "session already
      // exists". `isSignedIn` is a render-time snapshot and can be stale here, so sign
      // out unconditionally; doing so with no active session is a no-op.
      await signOut().catch(() => {});
      await signUp.create({
        emailAddress: normalizedEmail,
        password: data.password,
        firstName,
        lastName,
        legalAccepted: true,
        unsafeMetadata: {
          referralCode: trimmedReferral,
        },
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('email-otp');
    } catch (err) {
      setError(extractClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    email,
    password,
    confirmPassword,
    fullName,
    referralCode,
    isLoaded,
    signUp,
    signOut,
  ]);

  const verifyCode = useCallback(async () => {
    setError(null);
    if (!isLoaded || !signUp) {
      setError('Sign-up is not ready yet. Please try again in a moment.');
      return;
    }
    if (code.trim().length === 0) {
      setError('Please enter the verification code from your email.');
      return;
    }

    setIsVerifying(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        setIsSigningIn(true);
        await setActive({ session: attempt.createdSessionId });
      } else {
        console.warn('[register] sign-up not complete after email verification', {
          status: attempt.status,
          missingFields: attempt.missingFields,
          unverifiedFields: attempt.unverifiedFields,
          requiredFields: attempt.requiredFields,
        });
        const missing = attempt.missingFields?.join(', ');
        setError(
          missing
            ? `Couldn't finish sign-up — still required: ${missing}.`
            : 'Verification could not be completed. Please try again.'
        );
      }
    } catch (err) {
      setError(extractClerkError(err));
    } finally {
      setIsVerifying(false);
    }
  }, [code, isLoaded, signUp, setActive]);

  const resendCode = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!isLoaded || !signUp) {
      return false;
    }
    setIsResending(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      return true;
    } catch (err) {
      setError(extractClerkError(err));
      return false;
    } finally {
      setIsResending(false);
    }
  }, [isLoaded, signUp]);

  const back = useCallback(() => {
    setError(null);
    if (step === 'email-otp') {
      setCode('');
      setStep('enter-details');
      return;
    }
    if (step === 'enter-details') {
      setStep('email-entry');
    }
  }, [step]);

  return {
    step,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    fullName,
    setFullName,
    referralCode,
    setReferralCode,
    code,
    setCode,
    error,
    clearError,
    isReady: isLoaded,
    isSubmitting,
    isVerifying,
    isResending,
    isSigningIn,
    proceedFromEmailEntry,
    startSignUp,
    verifyCode,
    resendCode,
    back,
    reset,
  };
}
