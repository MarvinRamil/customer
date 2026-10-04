import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth as useClerkAuth, useSignIn } from "@clerk/clerk-expo";
import * as Sentry from "@sentry/react-native";
import { useRouter } from "expo-router";
import { authService } from "../services/authService";
import type { User } from "../types";
// Biometric login disabled for now
// import {
//   authenticateAsync,
//   getBiometricEnabled,
//   setBiometricEnabled,
// } from "@/shared/services/biometricService";
import { setLastLoginUser } from "@/shared/services/lastLoginStorage";
import { isClerkEnabled } from "@/shared/providers/AppClerkProvider";
import { queryClient } from "@/shared/services/queryClient";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { matrixSessionService } from "@/features/chat";
import { configService } from "@/shared/services/configService";
import { notificationService } from "@/shared/services/notificationService";

/**
 * Auth context value interface
 * Defines the shape of data and methods provided by AuthContext
 */
interface AuthContextValue {
  /** Current user information */
  user: User | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is being checked */
  isLoading: boolean;
  /** True only during the very first session check on app load */
  isInitializing: boolean;
  /** Error message if any */
  error: string | null;
  /** Login function */
  login: (email: string, password: string) => Promise<void>;
  /** Logout function */
  logout: () => Promise<void>;
  /** Refresh user data from API */
  refreshUser: () => Promise<void>;
  /** Login with biometric (Face ID / fingerprint) using stored refresh token */
  loginWithBiometric: () => Promise<void>;
}

/**
 * Auth context
 * Provides authentication state and methods throughout the app
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider component props
 */
interface AuthProviderProps {
  /** Child components */
  children: React.ReactNode;
}

/**
 * AuthProvider — selects the auth implementation at module load based on whether
 * Clerk is configured. The branch is stable for the app lifetime (driven by an env
 * constant), so hook order is never violated.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  if (isClerkEnabled) {
    return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
  }
  return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
}

/**
 * LegacyAuthProvider — original custom-auth implementation (email/password +
 * refresh token in secure storage). Used when Clerk is disabled.
 * Initializes auth state on mount by checking for existing token and fetching user.
 */
function LegacyAuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  /**
   * Check if user is authenticated based on token presence
   */
  const isAuthenticated = user !== null;

  /**
   * Initialize auth state on mount
   * Checks for existing token and fetches user if token exists
   * Prevents race conditions by tracking initialization state
   */
  useEffect(() => {
    /**
     * Initialize authentication state
     */
    const initializeAuth = async () => {
      // Prevent multiple simultaneous initialization calls (race condition protection)
      if (isInitializing) {
        return;
      }

      setIsInitializing(true);
      setIsLoading(true);
      setError(null);

      try {
        // Verify session by checking token and fetching user
        const currentUser = await authService.verifySession();
        setUser(currentUser);
        if (currentUser) {
          await configService.loadRemoteConfig();
        }
        // Biometric login disabled for now — always restore session on launch
        // const biometricEnabled = await getBiometricEnabled();
        // if (!biometricEnabled) {
        //   setUser(currentUser);
        //   if (currentUser) {
        //     await configService.loadRemoteConfig();
        //   }
        // } else {
        //   if (currentUser) {
        //     await setLastLoginUser({ email: currentUser.email, fullName: currentUser.fullName });
        //   }
        // }
      } catch (err) {
        // Session is invalid or error occurred (e.g. 401 after deploy - token from different API)
        setUser(null);
        const message =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401
              ? "Session expired or invalid. Please sign in again."
              : "Failed to initialize auth";
        setError(message);
      } finally {
        setIsLoading(false);
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Login user with email and password
   * @param email - User email address
   * @param password - User password
   */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    // Ensure user is cleared before attempting login
    setUser(null);

    try {
      // Call login API
      const loginResponse = await authService.login({ email, password });

      // Verify token is stored and accessible before proceeding
      // This helps catch token storage issues early
      const tokenCheck = await tokenStorage.getAccessToken();
      if (!tokenCheck) {
        console.error('[AuthContext] ⚠️ Token not found after login - this will cause 401 errors');
        throw new Error('Authentication failed. Please try again.');
      }

      // Set user from login response
      setUser(loginResponse.user);
      await setLastLoginUser({
        email: loginResponse.user.email,
        fullName: loginResponse.user.fullName,
      });
      await configService.loadRemoteConfig();

      // If notifications are already enabled, register the push token now instead of
      // waiting for the next app start. Fire-and-forget: never block or fail login.
      console.log('[push] AuthContext(Legacy).login → registerIfPermitted');
      notificationService.registerIfPermitted().catch(() => {});

      if (__DEV__) {
        console.log('[AuthContext] ✓ Login successful, user set:', loginResponse.user.email);
      }
    } catch (err) {
      // Handle login errors - ensure tokens are cleared on failure
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      setUser(null);

      // Clear any tokens that might have been stored during failed login
      try {
        await authService.logout();
      } catch (logoutError) {
        // Ignore logout errors - we're already handling a login error
        console.warn("Failed to clear tokens after login error:", logoutError);
      }

      throw err; // Re-throw to allow caller to handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user and clear session: clear user state, tokens, and query cache.
   * Last-login profile (email/name) is kept so the login screen can show "Welcome back".
   */
  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // 1. Clear user state immediately so UI shows logged-out (no stale user on Home)
    setUser(null);

    try {
      // 2. Clear tokens and biometric flag; keep last-login user for returning-user login
      await authService.logout();
      await matrixSessionService.clearSession();
      await configService.clearRemoteConfig();
      // 3. Clear all cached query data (bookings, profile, etc.) so no previous session data is shown
      queryClient.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
      // Still clear cache and ensure user stays null
      queryClient.clear();
    } finally {
      setIsLoading(false);
    }

    // Redirect is handled by the welcome overlay when user is null and we're on a protected route
    setTimeout(() => {
      try {
        router.dismissTo("/");
      } catch {
        try {
          router.replace("/");
        } catch {
          router.navigate("/");
        }
      }
    }, 0);
  }, [router]);

  /**
   * Refresh user data from API
   * Useful for updating user information after profile changes
   * Prevents race conditions by checking if already refreshing
   */
  const refreshUser = useCallback(async () => {
    if (!isAuthenticated || isInitializing || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    try {
      // Fetch current user from API (refresh token logic in apiClient handles 401)
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setError(null);
    } catch (err) {
      // If refresh fails, user might be logged out
      const errorMessage =
        err instanceof Error ? err.message : "Failed to refresh user";
      setError(errorMessage);

      // If session expired (after refresh token attempt), clear user
      if (
        errorMessage.includes("Session expired") ||
        errorMessage.includes("Unauthorized") ||
        (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401)
      ) {
        setUser(null);
        await authService.logout();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthenticated, isInitializing, isRefreshing]);

  /** Biometric login disabled for now */
  const loginWithBiometric = useCallback(async () => {
    // setError(null);
    // const ok = await authenticateAsync({ promptMessage: "Sign in to BEE APP" });
    // if (!ok) {
    //   setError("Biometric authentication failed or was cancelled.");
    //   return;
    // }
    // const refreshToken = await tokenStorage.getRefreshToken();
    // if (!refreshToken) {
    //   await setBiometricEnabled(false);
    //   setError("Please sign in with email and password.");
    //   return;
    // }
    // const currentUser = await authService.restoreSessionFromRefreshToken();
    // if (!currentUser) {
    //   await tokenStorage.clearAllTokens();
    //   await setBiometricEnabled(false);
    //   setError("Session expired. Please sign in with email and password.");
    //   return;
    // }
    // setUser(currentUser);
    // await configService.loadRemoteConfig();
    // setError(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isLoading,
    isInitializing,
    error,
    login,
    logout,
    refreshUser,
    loginWithBiometric,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * ClerkAuthProvider — Clerk-backed implementation. Clerk owns the session
 * (email/password + email OTP); the app's User (role, onboarding, etc.) is loaded
 * from the backend `/api/auth/me`, with the Clerk token supplied by the apiClient bridge.
 * Exposes the same AuthContextValue so all consumers are unchanged.
 */
function ClerkAuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn, signOut, userId } = useClerkAuth();
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();

  // Sentry/GlitchTip user context: id only, never email/phone/name (PII).
  useEffect(() => {
    if (!isLoaded) return;
    Sentry.setUser(isSignedIn && userId ? { id: userId } : null);
  }, [isLoaded, isSignedIn, userId]);

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const isAuthenticated = user !== null;

  // Load the backend profile for the active Clerk session (and react to sign in/out).
  const loadBackendUser = useCallback(async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    await setLastLoginUser({ email: currentUser.email, fullName: currentUser.fullName });
    await configService.loadRemoteConfig();
    return currentUser;
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        if (!isSignedIn) {
          setUser(null);
          if (!cancelled) setError(null);
          return;
        }
        // Signed into Clerk. The backend profile is created by the Clerk
        // `user.created` webhook, which can lag a second or two behind setActive
        // (e.g. right after registration). Retry /api/auth/me a few times before
        // giving up so a fresh sign-up isn't stranded on the auth screen.
        const maxAttempts = 6;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (cancelled) return;
          try {
            await loadBackendUser();
            if (!cancelled) setError(null);
            return;
          } catch (err) {
            if (attempt === maxAttempts) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      } catch (err) {
        if (!cancelled) {
          // Signed into Clerk but still no backend profile (webhook not synced) — surface gently.
          setUser(null);
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsInitializing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, loadBackendUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!signInLoaded || !signIn) {
        throw new Error("Authentication is not ready yet. Please try again.");
      }
      setIsLoading(true);
      setError(null);
      setUser(null);
      try {
        // Clerk is single-session: any leftover session makes signIn.create throw
        // "session already exists". `isSignedIn` is a render-time snapshot that can be
        // stale by the time this callback runs (e.g. a session created after the last
        // render), so sign out unconditionally rather than gating on it. Signing out
        // with no active session is a harmless no-op.
        await signOut().catch(() => {});
        const attempt = await signIn.create({ identifier: email, password });
        if (attempt.status !== "complete") {
          // e.g. needs email-code or MFA (not enabled on free tier). Caller can branch on this.
          throw new Error("Additional verification is required to sign in.");
        }
        await setActive!({ session: attempt.createdSessionId });
        await loadBackendUser();

        // If notifications are already enabled, register the push token now instead of
        // waiting for the next app start. Fire-and-forget: never block or fail login.
        console.log('[push] AuthContext(Clerk).login → registerIfPermitted');
        notificationService.registerIfPermitted().catch(() => {});
      } catch (err) {
        const message =
          (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
          (err instanceof Error ? err.message : "Login failed");
        setError(message);
        setUser(null);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [signIn, setActive, signInLoaded, loadBackendUser, signOut],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setUser(null);
    try {
      await signOut();
      // Keep last-login profile so the login screen can show "Welcome back"
      // await setBiometricEnabled(false); // Biometric login disabled for now
      await matrixSessionService.clearSession();
      await configService.clearRemoteConfig();
      queryClient.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
      queryClient.clear();
    } finally {
      setIsLoading(false);
    }
    setTimeout(() => {
      try {
        router.dismissTo("/");
      } catch {
        try {
          router.replace("/");
        } catch {
          router.navigate("/");
        }
      }
    }, 0);
  }, [router, signOut]);

  const refreshUser = useCallback(async () => {
    if (!isAuthenticated || isInitializing || isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    try {
      await loadBackendUser();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh user");
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthenticated, isInitializing, isRefreshing, loadBackendUser]);

  /** Biometric login disabled for now */
  const loginWithBiometric = useCallback(async () => {
    // setError(null);
    // const ok = await authenticateAsync({ promptMessage: "Sign in to BEE APP" });
    // if (!ok) {
    //   setError("Biometric authentication failed or was cancelled.");
    //   return;
    // }
    // if (!isSignedIn) {
    //   await setBiometricEnabled(false);
    //   setError("Please sign in with email and password.");
    //   return;
    // }
    // try {
    //   await loadBackendUser();
    //   setError(null);
    // } catch {
    //   setError("Session expired. Please sign in with email and password.");
    // }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isLoading,
    isInitializing,
    error,
    login,
    logout,
    refreshUser,
    loginWithBiometric,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access auth context
 * @returns AuthContextValue with user, auth state, and methods
 * @throws Error if used outside AuthProvider
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
