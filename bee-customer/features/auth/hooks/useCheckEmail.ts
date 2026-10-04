import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { authService } from '../services/authService';

/**
 * Return type for useCheckEmail hook
 */
export interface UseCheckEmailReturn {
  /** Whether email is available (null = not checked yet) */
  available: boolean | null;
  /** Message from API about email availability */
  message: string | null;
  /** Existing role if email is already registered */
  existingRole?: string;
  /** Whether email check is in progress */
  isChecking: boolean;
  /** Error message if check failed */
  error: string | null;
  /** Manually refetch email check */
  refetch: () => void;
}

/**
 * Custom hook for checking email availability
 * Uses TanStack Query to fetch and cache email availability status
 * Automatically validates email format before making API call
 * 
 * @param email - Email address to check
 * @returns Object containing availability status, message, and loading state
 * 
 * @example
 * ```tsx
 * function RegistrationForm() {
 *   const [email, setEmail] = useState('');
 *   const emailCheck = useCheckEmail(email);
 * 
 *   return (
 *     <View>
 *       <TextInput value={email} onChangeText={setEmail} />
 *       {emailCheck.isChecking && <Text>Checking...</Text>}
 *       {emailCheck.available === false && (
 *         <Text>{emailCheck.message}</Text>
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export function useCheckEmail(email: string): UseCheckEmailReturn {
  // Use ref to store email value to avoid re-renders during typing
  // This prevents state updates from interrupting the TextInput
  const emailRef = useRef<string>(email);
  const [debouncedEmail, setDebouncedEmail] = useState<string | null>(null);
  const lastEmailRef = useRef<string>('');
  
  // Update ref immediately without causing re-render
  const trimmedEmail = email.trim();
  emailRef.current = trimmedEmail;
  
  // Only update debounced email if email actually changed
  // This prevents unnecessary state updates and re-renders
  useEffect(() => {
    // Skip if email hasn't actually changed (prevents re-renders from other state changes)
    if (trimmedEmail === lastEmailRef.current) {
      return;
    }
    lastEmailRef.current = trimmedEmail;
    
    if (!trimmedEmail || trimmedEmail.length === 0) {
      setDebouncedEmail(null);
      return;
    }
    
    // Debounce the email check to avoid interfering with typing
    // Only update state after user stops typing for 1000ms (increased from 800ms)
    // This prevents any re-renders while user is actively typing
    const timer = setTimeout(() => {
      // Only update if email hasn't changed (user stopped typing)
      if (emailRef.current === trimmedEmail) {
        const normalized = trimmedEmail.toLowerCase();
        setDebouncedEmail(normalized);
      }
    }, 1000); // Wait 1000ms after user stops typing
    
    return () => clearTimeout(timer);
  }, [trimmedEmail]); // Only depend on trimmed email

  // Only check email availability if email looks VERY complete
  // Require: something@something.something (minimum 8 chars after @ including dot and extension)
  // This prevents API calls for incomplete emails and avoids interfering with typing
  // Example: "user@gmail.com" (8 chars after @) would trigger, but "user@gmail.c" (7 chars) would not
  const trimmedDebounced = debouncedEmail || '';
  const atIndex = trimmedDebounced.indexOf('@');
  const afterAt = atIndex > 0 ? trimmedDebounced.substring(atIndex + 1) : '';
  const hasDot = afterAt.includes('.');
  const dotIndex = afterAt.indexOf('.');
  const afterDot = dotIndex >= 0 ? afterAt.substring(dotIndex + 1) : '';
  
  // Only check if:
  // 1. Has @ with text before it
  // 2. Has at least 4 chars after @ before the dot (e.g., "gmail")
  // 3. Has at least 2 chars after the dot (e.g., "com")
  // This ensures we only check when email is truly complete, not during typing
  const looksComplete = atIndex > 0 && 
                        hasDot &&
                        dotIndex >= 4 && // At least 4 chars before dot (e.g., "gmail")
                        afterDot.length >= 2; // At least 2 chars after dot (e.g., "com")

  // Email availability check using useQuery
  // Use refetchInterval: false and notifyOnChangeProps to minimize re-renders
  const {
    data: emailCheckData,
    isLoading: isCheckingEmail,
    error: queryError,
    refetch: refetchEmailCheck,
  } = useQuery({
    queryKey: ['auth', 'checkEmail', debouncedEmail],
    queryFn: () => {
      if (!debouncedEmail) {
        throw new Error('Invalid email');
      }
      return authService.checkEmail(debouncedEmail);
    },
    // Only enable query if email looks reasonably complete AND is debounced
    // This prevents API calls for incomplete emails and avoids interfering with typing
    enabled: !!debouncedEmail && looksComplete,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry email checks
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

  // Transform query result to hook return format
  // Use ref value for checking, but only return query results when debounced
  const currentEmail = emailRef.current;
  if (!currentEmail || currentEmail.length === 0) {
    return {
      available: null,
      message: null,
      isChecking: false,
      error: null,
      refetch: refetchEmailCheck,
    };
  }

  return {
    available: emailCheckData?.available ?? null,
    message: emailCheckData?.message ?? null,
    existingRole: emailCheckData?.existingRole,
    isChecking: isCheckingEmail,
    error: queryError?.message || null,
    refetch: refetchEmailCheck,
  };
}
