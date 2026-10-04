import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { validateEmail } from '@/shared/utils/validation';
import { registrationService } from '../services/registrationService';
import type { CheckEmailResponse, RegistrationStatusResponse } from '../types';

export interface RegistrationStatusHint {
  type: 'info' | 'warning' | 'success';
  message: string;
}

export interface UseRegistrationStatusReturn {
  status: RegistrationStatusResponse | null;
  emailCheck: CheckEmailResponse | null;
  hints: RegistrationStatusHint[];
  isChecking: boolean;
  error: string | null;
}

/**
 * Debounced registration status + email availability check for the email-entry step.
 */
export function useRegistrationStatus(email: string): UseRegistrationStatusReturn {
  const emailRef = useRef(email);
  const [debouncedEmail, setDebouncedEmail] = useState<string | null>(null);
  const lastEmailRef = useRef('');

  const trimmedEmail = email.trim();
  emailRef.current = trimmedEmail;

  useEffect(() => {
    if (trimmedEmail === lastEmailRef.current) {
      return;
    }
    lastEmailRef.current = trimmedEmail;

    if (!trimmedEmail) {
      setDebouncedEmail(null);
      return;
    }

    const timer = setTimeout(() => {
      if (emailRef.current === trimmedEmail) {
        const validation = validateEmail(trimmedEmail);
        if (validation.valid && validation.normalized) {
          setDebouncedEmail(validation.normalized);
        } else {
          setDebouncedEmail(null);
        }
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [trimmedEmail]);

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['auth', 'registrationStatus', debouncedEmail],
    queryFn: async () => {
      if (!debouncedEmail) {
        throw new Error('Invalid email');
      }
      const [status, emailCheck] = await Promise.all([
        registrationService.checkRegistrationStatus(debouncedEmail),
        registrationService.checkEmail(debouncedEmail),
      ]);
      return { status, emailCheck };
    },
    enabled: !!debouncedEmail,
    staleTime: 2 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const hints = useMemo((): RegistrationStatusHint[] => {
    if (!data) {
      return [];
    }

    const result: RegistrationStatusHint[] = [];
    const { status, emailCheck } = data;

    if (emailCheck.available === false) {
      result.push({
        type: 'warning',
        message:
          emailCheck.existingRole != null
            ? `This email is already registered as ${emailCheck.existingRole}. Try logging in instead.`
            : emailCheck.message || 'This email is already registered. Try logging in instead.',
      });
    }

    if (status.registrationComplete) {
      result.push({
        type: 'warning',
        message: 'Registration is already complete for this email. Please log in.',
      });
    } else if (status.emailVerified) {
      result.push({
        type: 'info',
        message: 'This email has been verified. You can continue to create your account.',
      });
    } else if (status.canResume) {
      result.push({
        type: 'info',
        message: 'You can resume registration with this email.',
      });
    } else if (emailCheck.available === true) {
      result.push({
        type: 'success',
        message: emailCheck.message || 'Email is available.',
      });
    }

    return result;
  }, [data]);

  return {
    status: data?.status ?? null,
    emailCheck: data?.emailCheck ?? null,
    hints,
    isChecking: isLoading,
    error: queryError?.message ?? null,
  };
}
