import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
// Biometric login disabled for now
// import { setBiometricEnabled } from '@/shared/services/biometricService';
import { normalizePhilippineMobile } from '@/shared/utils/phone';
import { registrationDetailsSchema } from '../schemas/validationSchemas';
import { authService } from '../services/authService';
import { registrationTokenStorage } from '../services/registrationTokenStorage';
import type { SecurityQuestion, SecurityQuestionAnswer } from '../types';

export type PhoneRegistrationStep =
  | 'enter-phone'
  | 'enter-otp'
  | 'enter-details'
  | 'enter-security-questions';

export interface SecurityQuestionField {
  questionId: number | null;
  answer: string;
}

export interface UsePhoneRegistrationReturn {
  step: PhoneRegistrationStep;

  phoneInput: string;
  setPhoneInput: (v: string) => void;
  normalizedPhone: string | null;
  otp: string;
  setOtp: (v: string) => void;
  fullName: string;
  setFullName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  securityQuestions: SecurityQuestion[];
  securityFields: [SecurityQuestionField, SecurityQuestionField, SecurityQuestionField];
  setSecurityField: (index: 0 | 1 | 2, field: Partial<SecurityQuestionField>) => void;

  error: string | null;
  clearError: () => void;
  isLoadingQuestions: boolean;
  isSubmitting: boolean;
  isResending: boolean;

  sendOtp: () => Promise<void>;
  verifyOtp: () => Promise<void>;
  resendOtp: () => Promise<boolean>;
  proceedFromDetails: () => boolean;
  createAccount: () => Promise<void>;
  back: () => void;
  reset: () => void;
}

const EMPTY_SECURITY_FIELDS: [SecurityQuestionField, SecurityQuestionField, SecurityQuestionField] = [
  { questionId: null, answer: '' },
  { questionId: null, answer: '' },
  { questionId: null, answer: '' },
];

export function usePhoneRegistration(): UsePhoneRegistrationReturn {
  const router = useRouter();

  const [step, setStep] = useState<PhoneRegistrationStep>('enter-phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [securityFields, setSecurityFields] =
    useState<[SecurityQuestionField, SecurityQuestionField, SecurityQuestionField]>(EMPTY_SECURITY_FIELDS);

  const [error, setError] = useState<string | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setStep('enter-phone');
    setPhoneInput('');
    setNormalizedPhone(null);
    setOtp('');
    setFullName('');
    setPassword('');
    setConfirmPassword('');
    setSecurityFields(EMPTY_SECURITY_FIELDS);
    setError(null);
    setIsSubmitting(false);
    setIsResending(false);
    void registrationTokenStorage.clearToken();
  }, []);

  useEffect(() => {
    if (step !== 'enter-security-questions' || securityQuestions.length > 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingQuestions(true);
      setError(null);
      try {
        const response = await authService.getSecurityQuestions();
        if (!cancelled) {
          setSecurityQuestions(response.questions ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load security questions');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQuestions(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, securityQuestions.length]);

  const sendOtp = useCallback(async () => {
    setError(null);
    const phone = normalizePhilippineMobile(phoneInput);
    if (!phone) {
      setError('Enter a valid Philippine mobile number (e.g. 9XX XXX XXXX).');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.sendSmsOtp(phone);
      setNormalizedPhone(phone);
      setOtp('');
      setStep('enter-otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send SMS code');
    } finally {
      setIsSubmitting(false);
    }
  }, [phoneInput]);

  const verifyOtp = useCallback(async () => {
    setError(null);
    if (!normalizedPhone) {
      setError('Phone number is missing. Please go back and try again.');
      return;
    }
    if (otp.trim().length < 4) {
      setError('Please enter the verification code from your SMS.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.verifySmsOtp(normalizedPhone, otp.trim());
      await registrationTokenStorage.setToken(response.registrationToken);
      setStep('enter-details');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify SMS code');
    } finally {
      setIsSubmitting(false);
    }
  }, [normalizedPhone, otp]);

  const resendOtp = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!normalizedPhone) {
      return false;
    }
    setIsResending(true);
    try {
      await authService.sendSmsOtp(normalizedPhone);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend SMS code');
      return false;
    } finally {
      setIsResending(false);
    }
  }, [normalizedPhone]);

  const proceedFromDetails = useCallback((): boolean => {
    setError(null);
    const result = registrationDetailsSchema.safeParse({ fullName, password });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    setStep('enter-security-questions');
    return true;
  }, [fullName, password, confirmPassword]);

  const setSecurityField = useCallback(
    (index: 0 | 1 | 2, field: Partial<SecurityQuestionField>) => {
      setSecurityFields((prev) => {
        const next = [...prev] as [SecurityQuestionField, SecurityQuestionField, SecurityQuestionField];
        next[index] = { ...next[index], ...field };
        return next;
      });
    },
    []
  );

  const toSecurityAnswer = (field: SecurityQuestionField): SecurityQuestionAnswer | null => {
    if (field.questionId == null || !field.answer.trim()) {
      return null;
    }
    return { questionId: field.questionId, answer: field.answer.trim() };
  };

  const createAccount = useCallback(async () => {
    setError(null);

    const q1 = toSecurityAnswer(securityFields[0]);
    const q2 = toSecurityAnswer(securityFields[1]);
    const q3 = toSecurityAnswer(securityFields[2]);
    if (!q1 || !q2 || !q3) {
      setError('Please answer all three security questions.');
      return;
    }

    const ids = [q1.questionId, q2.questionId, q3.questionId];
    if (new Set(ids).size !== ids.length) {
      setError('Please choose three different security questions.');
      return;
    }

    const details = registrationDetailsSchema.safeParse({ fullName, password });
    if (!details.success) {
      setError(details.error.issues[0].message);
      return;
    }

    const token = await registrationTokenStorage.getToken();
    if (!token) {
      setError('Registration session expired. Please verify your phone again.');
      setStep('enter-phone');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.registerByPhone({
        registrationToken: token,
        fullName: details.data.fullName,
        password: details.data.password,
        securityQuestion1: q1,
        securityQuestion2: q2,
        securityQuestion3: q3,
      });
      await registrationTokenStorage.clearToken();
      // await setBiometricEnabled(false); // Biometric login disabled for now
      Alert.alert('Account created', 'You can now sign in with your phone number.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [securityFields, fullName, password, router]);

  const back = useCallback(() => {
    setError(null);
    if (step === 'enter-otp') {
      setOtp('');
      setStep('enter-phone');
      return;
    }
    if (step === 'enter-details') {
      setStep('enter-otp');
      return;
    }
    if (step === 'enter-security-questions') {
      setStep('enter-details');
    }
  }, [step]);

  return {
    step,
    phoneInput,
    setPhoneInput,
    normalizedPhone,
    otp,
    setOtp,
    fullName,
    setFullName,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    securityQuestions,
    securityFields,
    setSecurityField,
    error,
    clearError,
    isLoadingQuestions,
    isSubmitting,
    isResending,
    sendOtp,
    verifyOtp,
    resendOtp,
    proceedFromDetails,
    createAccount,
    back,
    reset,
  };
}
