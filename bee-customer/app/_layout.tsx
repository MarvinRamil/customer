import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  CommonActions,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/features/auth";
import { AnimatedSplash } from "@/shared/components/AnimatedSplash";
import { AppClerkProvider } from "@/shared/providers/AppClerkProvider";
import { NotificationPermissionModal } from "@/shared/components/NotificationPermissionModal";
import { useNotificationPermission } from "@/shared/hooks/useNotificationPermission";
import { useNotifications } from "@/shared/hooks/useNotifications";
import { usePostAuthDestination } from "@/shared/hooks/usePostAuthDestination";
import { useOTAUpdates } from "@/shared/hooks/useOTAUpdates";
import { useSignalRNotifications } from "@/shared/hooks/useSignalRNotifications";
import { driverLocationStorage } from "@/shared/services/driverLocationStorage";
import { queryClient } from "@/shared/services/queryClient";
import { configService } from "@/shared/services/configService";

// GlitchTip (self-hosted, Sentry-protocol compatible) crash/error reporting. Init runs
// before configService.initialize() so errors during that call are captured too.
const sentryDsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;

// Matches the `<slug>@<version>+<runtimeVersion>` / `dist: updateId` naming that
// `sentry-expo-upload-sourcemaps` generates once source-map upload is wired up (see
// docs/plans/sentry-glitchtip-integration-plan.md), so events captured now already line
// up with maps uploaded later. `updateId` is null on the embedded (non-OTA) launch.
const sentryRelease = `bee-customer-app@${Constants.expoConfig?.version ?? "0.0.0"}+${Updates.runtimeVersion ?? "dev"}`;
const sentryDist = Updates.updateId ?? "embedded";

type JsonRecord = Record<string, unknown>;

// Keys that must never leave the device in a Sentry/GlitchTip event: auth material and
// precise location.
const SENSITIVE_KEY_PATTERN = /authorization|token|password|secret|latitude|longitude|\blat\b|\blng\b|\blon\b/i;

function scrubSensitiveKeys(obj: JsonRecord | undefined): JsonRecord | undefined {
  if (!obj) return obj;
  const scrubbed: JsonRecord = { ...obj };
  for (const key of Object.keys(scrubbed)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      delete scrubbed[key];
    }
  }
  return scrubbed;
}

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: Constants.expoConfig?.extra?.environment as string | undefined,
    release: sentryRelease,
    dist: sentryDist,
    // GlitchTip does not support Sentry "sessions".
    enableAutoSessionTracking: false,
    // Performance tracing deferred alongside source maps — revisit once both are in place.
    tracesSampleRate: 0,
    // Errors: capture 100% (acceptance criterion for this integration).
    sampleRate: 1.0,
    debug: __DEV__,
    // Strip auth headers/tokens and precise location from breadcrumb data before it's queued.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrubSensitiveKeys(breadcrumb.data);
      }
      return breadcrumb;
    },
    // Same scrub applied to the event itself: drop request headers/cookies/body outright
    // (never needed for debugging here) and strip sensitive keys from extra/contexts.
    beforeSend(event) {
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
      }
      event.extra = scrubSensitiveKeys(event.extra as JsonRecord | undefined);
      if (event.contexts) {
        for (const key of Object.keys(event.contexts)) {
          const ctx = event.contexts[key];
          if (ctx) {
            event.contexts[key] = scrubSensitiveKeys(ctx as JsonRecord);
          }
        }
      }
      return event;
    },
  });
} else if (__DEV__) {
  console.warn("[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — error reporting disabled.");
}

// Hydrate cached config (incl. Mapbox token) and apply it to the Mapbox SDK before any
// map renders. Token resolves from Vault (configService) with EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
// fallback; loadRemoteConfig() (on login) re-applies the fresh Vault value.
configService.initialize();

// Import images as constants for reliable bundling in release builds
const splashIcon = require("../assets/images/splash-icon.png");

// Prevent the splash screen from auto-hiding before asset loading is complete

SplashScreen.preventAutoHideAsync();
// Cross-fade the native (OS) splash into the animated splash instead of a hard
// cut, for a smoother handoff. `fade` is iOS-only; Android still cuts.
SplashScreen.setOptions({ fade: true, duration: 200 });

/**
 * Navigation guard component
 * Handles protected routes and redirects based on authentication state
 * Ensures unauthenticated users are redirected to login immediately
 */
function NavigationGuard() {
  const { user, isLoading, isInitializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const { destination } = usePostAuthDestination(user?.id);

  // Check if user is authenticated (user !== null)
  const isAuthenticated = user !== null;

  useEffect(() => {
    // Only skip redirect during the very first session check (app load).
    if (isLoading && isInitializing) {
      return;
    }

    const currentRoute = segments[0] as string | undefined;
    const inTabsGroup = currentRoute === "(tabs)";
    const isIndexPage = currentRoute === "index";
    const isWelcomeScreen = currentRoute === "welcome";
    const isLoginPage = currentRoute === "login";
    const isRegisterPage = currentRoute === "register";
    const isVerifyEmailPage = currentRoute === "verify-email";
    const isForgotPasswordPage = currentRoute === "forgot-password";
    const isKycPage = currentRoute === "kyc-verification";

    // If no user, redirect protected routes to login.
    if (!isAuthenticated) {
      if (isWelcomeScreen) {
        router.replace("/login");
        return;
      }
      if (isIndexPage || isLoginPage || isRegisterPage || isVerifyEmailPage || isForgotPasswordPage) {
        return;
      }
      const ref = navigationRef.current;
      if (ref?.isReady()) {
        ref.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "login" }],
          })
        );
      } else {
        router.replace("/login");
      }
      return;
    }

    // Didit KYC approval stamps LivenessVerifiedAt on the user, so this flag doubles as
    // "identity verified" for the onboarding gate (liveness is deprecated in favour of KYC).
    const livenessVerifiedAt = user?.livenessVerifiedAt ?? (user as { LivenessVerifiedAt?: string } | null)?.LivenessVerifiedAt;
    const needsKyc = isAuthenticated && !livenessVerifiedAt;

    // Root index or welcome: send users through KYC first when needed.
    if (isAuthenticated && (isIndexPage || isWelcomeScreen)) {
      if (needsKyc) {
        router.replace("/kyc-verification" as any);
      } else if (destination && (isIndexPage || destination === "/(tabs)")) {
        // On index, always move on. On welcome, only redirect away if this
        // account has already seen it (or it's disabled) — a first-timer
        // stays put so the screen can actually render.
        router.replace(destination);
      }
      return;
    }

    if (needsKyc && !isKycPage) {
      router.replace("/kyc-verification" as any);
      return;
    }

    // KYC done but still on the verification screen — move on.
    if (isAuthenticated && !needsKyc && isKycPage) {
      if (destination) {
        router.replace(destination);
      }
      return;
    }

    // If user is authenticated and on login/register/forgot-password, redirect into the app flow.
    if (isAuthenticated && (isLoginPage || isRegisterPage || isVerifyEmailPage || isForgotPasswordPage)) {
      if (needsKyc) {
        router.replace("/kyc-verification" as any);
      } else if (destination) {
        router.replace(destination);
      }
      return;
    }

    // If user is authenticated and in tabs or other protected routes, allow access.
    // (Welcome isn't listed here — the block above already redirects away from it
    // once this account has seen it, and lets a first-timer render it directly.)
    if (
      isAuthenticated &&
      (inTabsGroup ||
        currentRoute === "booking" ||
        currentRoute === "tracking" ||
        currentRoute === "kyc-verification")
    ) {
      return;
    }
  }, [user, isLoading, isInitializing, segments, router, navigationRef, destination]);

  return null;
}

/**
 * Root layout component that wraps the app with theme, safe area, and auth providers
 * Handles authentication state and protected route navigation
 */
function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // NOTE: the native splash is intentionally NOT hidden here. Hiding it before
  // SafeAreaProvider has measured its insets (it renders null for a frame or
  // two on first launch) exposes a white flash. Instead, AnimatedSplash — which
  // lives inside SafeAreaProvider — hides the native splash from its own
  // onLayout, so the OS splash hands off directly to the animation.
  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#ffcd36" }}>
      <Sentry.ErrorBoundary
        fallback={({ resetError }) => <ErrorFallback onRetry={resetError} />}
      >
        <AppClerkProvider>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ThemeProvider value={DefaultTheme}>
            <AuthProvider>
              <AppInitializer />
              <AuthenticatedSignalRConnector />
              <NavigationGuard />
              <NotificationPermissionPrompt />
              <RootLayoutNav />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
        </QueryClientProvider>
        </AppClerkProvider>
      </Sentry.ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

/**
 * Fallback UI shown when Sentry.ErrorBoundary catches a render error. The error was
 * already reported to Sentry/GlitchTip by the boundary before this renders; "Try again"
 * calls resetError() to re-render the subtree instead of leaving the app stuck.
 */
function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorFallback}>
      <Text style={styles.errorFallbackText}>Something went wrong.</Text>
      <Pressable style={styles.errorFallbackButton} onPress={onRetry}>
        <Text style={styles.errorFallbackButtonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const PUBLIC_ROUTES = ["index", "login", "register", "verify-email", "forgot-password"];

function RootLayoutNav() {
  const [showInAppSplash, setShowInAppSplash] = useState(true);
  const { user, isInitializing } = useAuth();
  const segments = useSegments();

  const currentRoute = segments[0] ?? "";
  const isPublicRoute = PUBLIC_ROUTES.includes(currentRoute as string);
  const showWelcomeOverlay = user === null && !isInitializing && !isPublicRoute;

  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="booking" options={{ headerShown: false }} />
        <Stack.Screen name="tracking" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="kyc-verification" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      {showWelcomeOverlay && (
        // Logged-out user briefly on a protected route — cover it while the
        // NavigationGuard redirects to /login (no landing page anymore).
        <View style={[styles.inAppSplash, { zIndex: 9999 }]}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      )}
      {showInAppSplash && (
        <AnimatedSplash
          logo={splashIcon}
          appReady={!isInitializing}
          onHidden={() => setShowInAppSplash(false)}
        />
      )}
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  // Brief cover shown while a logged-out user on a protected route is
  // redirected to /login. Matches the splash background.
  inAppSplash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffcd36',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorFallback: {
    flex: 1,
    backgroundColor: '#ffcd36',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorFallbackText: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
  },
  errorFallbackButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  errorFallbackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffcd36',
  },
});

/**
 * Keeps the SignalR notifications hub connected when the user is authenticated
 * so that booking status pushes are received as soon as they're sent (user is already in user-{userId}).
 * Without this, the connection would only start when opening the tracking screen, often too late.
 */
function AuthenticatedSignalRConnector() {
  const { user } = useAuth();
  if (!user) return null;
  // Mounting this child runs useSignalRNotifications() and starts/keeps the shared connection.
  return <SignalRNotificationsConnector />;
}

function SignalRNotificationsConnector() {
  useSignalRNotifications();
  return null;
}

/**
 * Component to initialize app services (notifications, OTA updates, driver location purge)
 */
function AppInitializer() {
  useNotifications();
  useOTAUpdates();

  // Purge driver location storage on mount and when app comes to foreground
  // so storage is cleaned even if the user rarely or never opens the tracking screen
  useEffect(() => {
    driverLocationStorage.purgeDriverLocationsIfNeeded().catch((err) => {
      console.warn("[AppInitializer] Driver location purge failed:", err);
    });

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        driverLocationStorage.purgeDriverLocationsIfNeeded().catch((err) => {
          console.warn("[AppInitializer] Driver location purge on foreground failed:", err);
        });
      }
    });

    return () => subscription.remove();
  }, []);

  return null;
}

/**
 * Component to handle notification permission prompt
 * Shows modal on first app launch if permission hasn't been requested
 */
function NotificationPermissionPrompt() {
  const { showModal, isChecking, handleEnable, handleSkip } = useNotificationPermission();

  if (isChecking) {
    return null;
  }

  return (
    <NotificationPermissionModal
      visible={showModal}
      onEnable={handleEnable}
      onSkip={handleSkip}
    />
  );
}
