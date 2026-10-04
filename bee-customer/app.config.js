/**
 * Expo app configuration
 * Using .js to support environment variable evaluation during prebuild
 * The react-native-maps plugin needs the actual API key value, not a placeholder
 */

const fs = require("fs");
const path = require("path");

// Load .env file explicitly (Expo doesn't auto-load .env in app.config.js at build time)
// This ensures environment variables from .env are available when app.config.js runs
// Note: In the app runtime, Expo automatically loads EXPO_PUBLIC_* variables
try {
  // Try to load .env file using dotenv (available via expo dependencies)
  const dotenvResult = require("dotenv").config();

  // Log if .env was loaded (only in local development)
  if (
    !process.env.CI &&
    (process.env.EXPO_PUBLIC_DEBUG === "true" ||
      process.env.NODE_ENV !== "production")
  ) {
    if (dotenvResult.error) {
      console.warn(
        "[app.config.js] .env file not found or error loading:",
        dotenvResult.error.message,
      );
    } else if (dotenvResult.parsed) {
      console.log("[app.config.js] .env file loaded successfully");
      console.log(
        "[app.config.js] EXPO_PUBLIC_API_URL from .env:",
        dotenvResult.parsed.EXPO_PUBLIC_API_URL || "not set",
      );
    }
  }
} catch (error) {
  // dotenv not available or .env file doesn't exist - continue with system env vars
  // This is fine - variables may be set via system environment or CI/CD
  if (!process.env.CI) {
    console.warn("[app.config.js] Could not load .env file:", error.message);
  }
}

/**
 * Detect environment based on:
 * 1. CI_ENVIRONMENT_NAME (GitLab CI - highest priority)
 * 2. CI_COMMIT_REF_NAME (GitLab CI branch name)
 * 3. EXPO_PUBLIC_ENV (explicit local override)
 * 4. NODE_ENV (standard Node.js environment)
 * 5. Default to 'development' for local development
 */
const getEnvironment = () => {
  // GitLab CI environment (highest priority)
  const ciEnv = process.env.CI_ENVIRONMENT_NAME;
  if (ciEnv != null && String(ciEnv).trim() !== "") {
    return String(ciEnv).toLowerCase();
  }

  // GitLab CI branch detection
  const branchName = process.env.CI_COMMIT_REF_NAME;
  if (branchName != null && String(branchName).trim() !== "") {
    const branch = String(branchName).toLowerCase();
    if (branch === "main" || branch === "master") return "production";
    if (branch === "dev") return "staging";
    if (branch === "features") return "development";
  }

  // Explicit environment override (for local development)
  const expoEnv = process.env.EXPO_PUBLIC_ENV;
  if (expoEnv != null && String(expoEnv).trim() !== "") {
    return String(expoEnv).toLowerCase();
  }

  // Standard NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv != null && String(nodeEnv).trim() !== "") {
    return String(nodeEnv).toLowerCase();
  }

  // Default to development for local development
  return "development";
};

const ENV = getEnvironment();
const IS_CI = !!process.env.CI;
const IS_LOCAL = !IS_CI;

/** Normalized env key (never null) for use in getEnvVar */
const ENV_KEY =
  ENV != null && typeof ENV === "string" ? ENV.toUpperCase() : "DEVELOPMENT";

/**
 * Get environment-specific variable with fallbacks
 * Priority:
 * 1. EXPO_PUBLIC_{VAR}_{ENV} (e.g., EXPO_PUBLIC_API_URL_PRODUCTION)
 * 2. EXPO_PUBLIC_{VAR} (fallback)
 * 3. Default value based on environment
 */
const getEnvVar = (varName, defaults = {}) => {
  // Try environment-specific variable first
  const envSpecificVar = process.env[`EXPO_PUBLIC_${varName}_${ENV_KEY}`];
  if (envSpecificVar) return envSpecificVar;

  // Try generic variable
  const genericVar = process.env[`EXPO_PUBLIC_${varName}`];
  if (genericVar) return genericVar;

  // Use default based on environment
  return defaults[ENV] || defaults.development || defaults.default || "";
};

// Get API key from environment
const GOOGLE_MAPS_API_KEY = getEnvVar("GOOGLE_MAPS_API_KEY", {
  development: process.env.GOOGLE_MAPS_API_KEY || "",
  staging: "",
  production: "",
  default: process.env.GOOGLE_MAPS_API_KEY || "",
});

// Mapbox public access token (for map display and Mapbox APIs when provider is Mapbox)
// Used at runtime via Mapbox.setAccessToken(); also exposed in extra for the app
const MAPBOX_ACCESS_TOKEN = getEnvVar("MAPBOX_ACCESS_TOKEN", {
  development: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "",
  staging: "",
  production: "",
  default: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "",
});

// Get API URL from environment (base URL only; do NOT include /api or trailing slash)
// Services use paths like /api/bookings, /api/auth/login — client builds baseURL + path
// Resolution order: EXPO_PUBLIC_API_URL_DEVELOPMENT (or _STAGING/_PRODUCTION) overrides EXPO_PUBLIC_API_URL.
// If you see dev-api.bee-app.tech instead of .env, check that EXPO_PUBLIC_API_URL_DEVELOPMENT is not set elsewhere (system env, CI, or another .env).
const API_URL = getEnvVar("API_URL", {
  development: "http://localhost:5248",
  staging: "https://api-staging.yourdomain.com",
  production: "https://api.yourdomain.com",
  default: "http://localhost:5248",
});

// Sentry / GlitchTip DSN — self-hosted, Sentry-protocol-compatible error & crash reporting.
// Single DSN for all environments; events are segmented via the "environment" tag below.
const SENTRY_DSN = getEnvVar("SENTRY_DSN", {
  development: "",
  staging: "",
  production: "",
  default: "",
});

// Debug: Log API URL resolution (only in local development or if debug is enabled)
if (IS_LOCAL || process.env.EXPO_PUBLIC_DEBUG === "true") {
  console.log("[app.config.js] API_URL resolved:", API_URL);
  console.log(
    "[app.config.js] EXPO_PUBLIC_API_URL from process.env:",
    process.env.EXPO_PUBLIC_API_URL,
  );
  console.log(
    "[app.config.js] EXPO_PUBLIC_API_URL_DEVELOPMENT (overrides generic if set):",
    process.env.EXPO_PUBLIC_API_URL_DEVELOPMENT || "(not set)",
  );
  console.log(
    "[app.config.js] EXPO_PUBLIC_API_URL_STAGING:",
    process.env.EXPO_PUBLIC_API_URL_STAGING,
  );
  console.log(
    "[app.config.js] EXPO_PUBLIC_API_URL_PRODUCTION:",
    process.env.EXPO_PUBLIC_API_URL_PRODUCTION,
  );
}

// Get MQTT configuration from environment
// Uses existing variables from .env.example: MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD
// Resolution order:
// 1. EXPO_PUBLIC_MQTT_HOST_${ENV} (e.g., EXPO_PUBLIC_MQTT_HOST_PRODUCTION)
// 2. EXPO_PUBLIC_MQTT_HOST (base variable from .env or CI/CD)
// 3. Default value based on environment
const MQTT_HOST = getEnvVar("MQTT_HOST", {
  development: "localhost", // Default for local development
  staging: "", // Must be set via EXPO_PUBLIC_MQTT_HOST_STAGING or EXPO_PUBLIC_MQTT_HOST
  production: "", // Must be set via EXPO_PUBLIC_MQTT_HOST_PRODUCTION or EXPO_PUBLIC_MQTT_HOST
  default: "", // Fallback if no environment-specific default
});

const MQTT_PORT = getEnvVar("MQTT_PORT", {
  development: "1883", // Default for local development
  staging: "", // Must be set via EXPO_PUBLIC_MQTT_PORT_STAGING or EXPO_PUBLIC_MQTT_PORT
  production: "", // Must be set via EXPO_PUBLIC_MQTT_PORT_PRODUCTION or EXPO_PUBLIC_MQTT_PORT
  default: "1883", // Default MQTT port
});

const MQTT_USERNAME = getEnvVar("MQTT_USERNAME", {
  development: "", // Set via EXPO_PUBLIC_MQTT_USERNAME_DEVELOPMENT or EXPO_PUBLIC_MQTT_USERNAME
  staging: "", // Set via EXPO_PUBLIC_MQTT_USERNAME_STAGING or EXPO_PUBLIC_MQTT_USERNAME
  production: "", // Set via EXPO_PUBLIC_MQTT_USERNAME_PRODUCTION or EXPO_PUBLIC_MQTT_USERNAME
  default: "",
});

const MQTT_PASSWORD = getEnvVar("MQTT_PASSWORD", {
  development: "", // Set via EXPO_PUBLIC_MQTT_PASSWORD_DEVELOPMENT or EXPO_PUBLIC_MQTT_PASSWORD
  staging: "", // Set via EXPO_PUBLIC_MQTT_PASSWORD_STAGING or EXPO_PUBLIC_MQTT_PASSWORD
  production: "", // Set via EXPO_PUBLIC_MQTT_PASSWORD_PRODUCTION or EXPO_PUBLIC_MQTT_PASSWORD
  default: "",
});

// iOS Firebase client config. Counterpart of android/google-services.json: public
// client config (not a secret), belongs in the repo next to it so builds pick it up.
// Download from Firebase console -> project mybeeapp-f3911 -> iOS app com.mybeeapp.customer.
// Resolved against __dirname so it works regardless of the cwd prebuild/EAS runs from.
const IOS_GOOGLE_SERVICES_FILE = "./GoogleService-Info.plist";
const HAS_IOS_GOOGLE_SERVICES = fs.existsSync(
  path.resolve(__dirname, IOS_GOOGLE_SERVICES_FILE),
);

if (!HAS_IOS_GOOGLE_SERVICES) {
  console.warn(
    `[app.config.js] ${IOS_GOOGLE_SERVICES_FILE} missing — iOS builds will have no Firebase config and cannot obtain an FCM token. Android is unaffected.`,
  );
}

// Log environment info (only in CI or if EXPO_PUBLIC_DEBUG is set)
if (IS_CI || process.env.EXPO_PUBLIC_DEBUG === "true") {
  console.log(`[app.config.js] Environment: ${ENV}`);
  console.log(`[app.config.js] Is CI: ${IS_CI}`);
  console.log(`[app.config.js] API URL: ${API_URL}`);
  console.log(
    `[app.config.js] Google Maps API Key: ${GOOGLE_MAPS_API_KEY ? "Set" : "Not set"}`,
  );
  console.log(
    `[app.config.js] Mapbox Access Token: ${MAPBOX_ACCESS_TOKEN ? "Set" : "Not set"}`,
  );
  console.log(`[app.config.js] MQTT Host: ${MQTT_HOST || "Not set"}`);
  console.log(`[app.config.js] MQTT Port: ${MQTT_PORT || "Not set"}`);
  console.log(`[app.config.js] MQTT Username: ${MQTT_USERNAME || "Not set"}`);
  console.log(`[app.config.js] Sentry DSN: ${SENTRY_DSN ? "Set" : "Not set"}`);
}

module.exports = {
  expo: {
    name: "BEE On-Demand",
    slug: "bee-customer-app",
    version: "1.2.1",
    // Native only. Without this Expo defaults to ["ios","android","web"] (because
    // react-native-web is present) and `eas update` exports a web bundle too —
    // which fails on @rnmapbox/maps' web entry importing mapbox-gl's CSS.
    platforms: ["ios", "android"],
    orientation: "portrait",
    icon: "./assets/images/splash-icon.png",
    scheme: "beecustomerapp",
    userInterfaceStyle: "light",
    // Root view / window background. Defaults to white, which is what shows as a
    // brief white flash between the native splash hiding and React's first
    // paint. Match the brand yellow so the whole launch stays one color.
    backgroundColor: "#ffcd36",
    // New Architecture required by react-native-reanimated v4 / react-native-worklets (SDK 54 default)
    newArchEnabled: true,
    runtimeVersion: {
      policy: "appVersion",
    },
    // Logo-less splash: a transparent image over the brand-yellow background so
    // the native (OS) splash is a solid yellow that hands off seamlessly to the
    // animated splash. (A transparent image is required to suppress the icon on
    // Android 12+, which always draws something on the splash.)
    splash: {
      image: "./assets/images/splash-blank.png",
      resizeMode: "contain",
      backgroundColor: "#ffcd36",
    },
    ios: {
      supportsTablet: true,
      icon: "./assets/images/ios/icons/ios-icon-1024.png",
      splash: {
        image: "./assets/images/splash-blank.png",
        resizeMode: "contain",
        backgroundColor: "#ffcd36",
      },
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSExceptionDomains: {
            localhost: {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: true,
            },
          },
        },
        CFBundleDisplayName: "BEE APP",
        NSLocationWhenInUseUsageDescription:
          "We need your location to help you select pickup and dropoff locations.",
        NSUserNotificationsUsageDescription:
          "We need to send you notifications about your booking status and delivery updates.",
        NSPhotoLibraryUsageDescription:
          "We need access to your photos to upload an image of the item to be delivered.",
        NSPhotoLibraryAddUsageDescription:
          "We need access to save images to your photo library.",
        NSCameraUsageDescription:
          "Allow Bee App to access your camera to verify your identity.",
        // Lets the OS wake the app for silent/data-only pushes. The
        // aps-environment entitlement is handled by the expo-notifications
        // plugin (mode: "production") — do not hand-edit ios/BEEAPP.entitlements.
        UIBackgroundModes: ["remote-notification"],
      },
      // FCM/APNs via Firebase: only wired once GoogleService-Info.plist is added
      // (download from the Firebase console). Guarded so builds don't fail before then.
      ...(HAS_IOS_GOOGLE_SERVICES
        ? { googleServicesFile: IOS_GOOGLE_SERVICES_FILE }
        : {}),
      bundleIdentifier: "com.mybeeapp.customer",
    },
    android: {
      backgroundColor: "#ffcd36",
      adaptiveIcon: {
        foregroundImage: "./assets/images/android/icons/android-icon-512.png",
        backgroundColor: "#FFCD36",
      },
      icon: "./assets/images/adaptive-icon.png",
      splash: {
        image: "./assets/images/splash-blank.png",
        resizeMode: "contain",
        backgroundColor: "#ffcd36",
        imageWidth: 120,
      },
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY,
        },
      },
      permissions: [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "android.permission.CAMERA",
      ],
      // Play policy: one-time photo pick uses system picker, not broad media access
      blockedPermissions: [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
      ],
      usesCleartextTraffic: true,
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      // FCM: embeds google-services.json into the Android build for native FCM tokens.
      googleServicesFile: "./google-services.json",
      package: "com.mybeeapp.customer",
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "./plugins/withFmtConstevalFix",
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-blank.png",
          backgroundColor: "#ffcd36",
          resizeMode: "contain",
          dark: {
            image: "./assets/images/splash-blank.png",
            backgroundColor: "#ffcd36",
          },
          android: {
            // imageWidth: 120,
          },
        },
      ],
      [
        "expo-local-authentication",
        {
          faceIDPermission: "Allow BEE APP to use Face ID to sign in.",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow Bee App to use your location for pickup and delivery tracking.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/adaptive-icon.png",
          color: "#FFD700",
          sounds: [],
          mode: "production",
        },
      ],
      // Mapbox Maps SDK – used when EXPO_PUBLIC_MAP_PROVIDER=mapbox (Phase 2+)
      // Token is set at runtime via Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxAccessToken)
      "@rnmapbox/maps",
      [
        "expo-image-picker",
        {
          photosPermission:
            "We need access to your photos to upload an image of the item to be delivered.",
          cameraPermission:
            "We need camera access to take a photo of the item to be delivered.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow Bee App to access your camera to verify your identity.",
        },
      ],
      // @sentry/react-native/expo config plugin intentionally omitted for now — it only
      // wires sentry-cli source-map/dSYM upload into the native build (deferred, no
      // SENTRY_AUTH_TOKEN yet). JS + native crash capture works without it.
      // To add later: ["@sentry/react-native/expo", { url: "https://glitchtip.ilocosscript.live/", organization: "bee-on-demand", project: "2" }]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      eas: {
        projectId: "0ddd0c10-7ef3-42d7-b2d8-25fc887dbe0d",
      },
      // Expose environment variables to the app
      apiUrl: API_URL,
      environment: ENV,
      mapboxAccessToken: MAPBOX_ACCESS_TOKEN,
      sentryDsn: SENTRY_DSN,
      mqtt: {
        host: MQTT_HOST,
        port: MQTT_PORT,
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
      },
    },
    updates: {
      url: "https://u.expo.dev/0ddd0c10-7ef3-42d7-b2d8-25fc887dbe0d",
    },
  },
};
