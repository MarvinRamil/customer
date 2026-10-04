import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { loginSchema, type LoginFormData } from '../schemas/validationSchemas';

/**
 * Return type for useLogin hook
 */
interface UseLoginReturn {
  /** Email input value */
  email: string;
  /** Password input value */
  password: string;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Set email value */
  setEmail: (email: string) => void;
  /** Set password value */
  setPassword: (password: string) => void;
  /** Handle login submission */
  handleLogin: () => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

/**
 * Custom hook for managing login form state and submission
 * Provides form state management, validation, and login functionality
 * @returns Object containing form state, handlers, and login function
 *
 * @example
 * ```tsx
 * function LoginScreen() {
 *   const { email, password, isLoading, error, setEmail, setPassword, handleLogin } = useLogin();
 *
 *   return (
 *     <View>
 *       <TextInput value={email} onChangeText={setEmail} />
 *       <TextInput value={password} onChangeText={setPassword} secureTextEntry />
 *       {error && <Text>{error}</Text>}
 *       <Button title="Login" onPress={handleLogin} disabled={isLoading} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useLogin(): UseLoginReturn {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Login mutation using TanStack Query
  const loginMutation = useMutation({
    mutationFn: async ({ email: emailValue, password: passwordValue }: { email: string; password: string }) => {
      return login(emailValue, passwordValue);
    },
    onSuccess: () => {
      // Login successful - AuthContext will update user state
      // Clear password for security
      setPassword('');
    },
    onError: () => {
      // Clear password on error for security
      setPassword('');
    },
  });

  /**
   * Handle login form submission
   * Validates inputs using Zod schema and calls login API via mutation
   */
  const handleLogin = useCallback(async () => {
    // Clear previous errors
    setValidationError(null);
    loginMutation.reset();

    // Validate form data using Zod schema
    const validationResult = loginSchema.safeParse({
      email,
      password,
    });

    if (!validationResult.success) {
      // Get first error message from Zod validation
      const firstError = validationResult.error.issues[0];
      setValidationError(firstError.message);
      return;
    }

    // Validation passed - use transformed data from Zod
    const validatedData: LoginFormData = validationResult.data;

    // Call login mutation with validated and transformed data
    loginMutation.mutate({
      email: validatedData.email, // Already trimmed and lowercased by Zod transform
      password: validatedData.password,
    });
  }, [email, password, loginMutation]);

  /**
   * Get error from mutation or validation
   */
  const error = validationError || loginMutation.error?.message || null;

  /**
   * Get loading state from mutation
   */
  const isLoading = loginMutation.isPending;

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setValidationError(null);
    loginMutation.reset();
  }, [loginMutation]);

  return {
    email,
    password,
    isLoading,
    error,
    setEmail,
    setPassword,
    handleLogin,
    clearError,
  };
}

