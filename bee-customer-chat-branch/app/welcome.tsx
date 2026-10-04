import { BeeColors } from "@/constants/theme";
import { useAuth } from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import { usePostAuthDestination } from "@/shared/hooks/usePostAuthDestination";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WELCOME_LOGO = require("@/assets/images/screen-welcome-logo.png");

const CONFETTI_COLORS = [BeeColors.yellow[400], "#caa400", "#1c190d", "#b9e16d"];

function ConfettiParticle({
  left,
  size,
  color,
  duration,
}: {
  left: number;
  size: number;
  color: string;
  duration: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(progress);
  }, [duration, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-20, 900]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, 360])}deg` },
    ],
    opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 0.9, 0.9, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.confettiParticle,
        style,
        {
          left: `${left}%`,
          width: size,
          height: size,
          backgroundColor: color,
        },
      ]}
    />
  );
}

function ConfettiLayer() {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 4 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        duration: 6000 + Math.random() * 4000,
      })),
    []
  );

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} {...p} />
      ))}
    </View>
  );
}

/**
 * One-time post-KYC welcome screen. Shown exactly once per account, right
 * after their first KYC approval; "Got it" marks it seen and moves on to
 * the main app.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user, isInitializing, logout } = useAuth();
  const router = useRouter();
  const { destination, isLoading: destLoading, markWelcomeSeen } = usePostAuthDestination(user?.id);
  const float = useSharedValue(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(float);
  }, [float]);

  const logoFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [0, -15]) }],
  }));

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
          } catch (error) {
            console.error("Logout error:", error);
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleGotIt = async () => {
    setIsNavigating(true);
    await markWelcomeSeen();
    router.replace("/(tabs)");
  };

  if (isInitializing || destLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={BeeColors.yellow[500]} />
      </View>
    );
  }

  if (user === null) {
    return <Redirect href="/login" />;
  }

  const livenessVerifiedAt =
    user.livenessVerifiedAt ?? (user as { LivenessVerifiedAt?: string }).LivenessVerifiedAt;
  if (!livenessVerifiedAt) {
    return <Redirect href={"/kyc-verification" as any} />;
  }

  // This account has already seen welcome (or the screen is disabled) — a
  // deep link or a stale nav stack could still land here, so bounce onward
  // instead of showing it again.
  if (destination !== "/welcome") {
    return <Redirect href={destination ?? "/(tabs)"} />;
  }

  const maxContentWidth = Math.min(width - 48, 448);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      <ConfettiLayer />

      <View
        style={[
          styles.centeredMain,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 48,
            minHeight: height - insets.top - insets.bottom,
          },
        ]}
      >
        <View style={[styles.content, { maxWidth: maxContentWidth }]}>
          <Animated.View style={[styles.logoWrap, logoFloatStyle]}>
            <Image source={WELCOME_LOGO} style={styles.logo} contentFit="contain" />
          </Animated.View>

          <View style={styles.copyBlock}>
            <Text style={[styles.display, { color: theme.text }]}>Welcome to the Hive!</Text>
            <Text style={styles.headlineSm}>You&apos;re Verified!</Text>
            <Text style={[styles.bodyLg, { color: "#696454" }]}>
              Your identity has been verified and your account is ready to go.
              Start booking your first delivery.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleGotIt}
            activeOpacity={0.9}
            disabled={isLoggingOut || isNavigating}
          >
            {isNavigating ? (
              <ActivityIndicator size="small" color="#715700" />
            ) : (
              <>
                <Text style={styles.ctaText}>Got it</Text>
                <Ionicons name="checkmark-circle" size={22} color="#715700" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.9}
            disabled={isLoggingOut || isNavigating}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={BeeColors.red[600]} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={22} color={BeeColors.red[600]} />
                <Text style={styles.logoutText}>Log out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.footerText}>Bee On-Demand © 2024 • Flying to your doorstep</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  root: {
    flex: 1,
    overflow: "hidden",
  },
  blobTop: {
    position: "absolute",
    top: "-10%",
    right: "-10%",
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: "rgba(255, 205, 54, 0.2)",
  },
  blobBottom: {
    position: "absolute",
    bottom: "5%",
    left: "-15%",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(185, 225, 109, 0.1)",
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
  confettiParticle: {
    position: "absolute",
    top: -20,
    borderRadius: 2,
  },
  centeredMain: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  content: {
    width: "100%",
    alignItems: "center",
    zIndex: 1,
  },
  logoWrap: {
    width: 192,
    height: 192,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  logo: {
    width: 160,
    height: 160,
  },
  copyBlock: {
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 8,
  },
  headlineSm: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#755b00",
    textAlign: "center",
    marginBottom: 16,
  },
  bodyLg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 280,
  },
  ctaButton: {
    width: "100%",
    height: 56,
    backgroundColor: BeeColors.yellow[400],
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#caa400",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 6,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#715700",
  },
  logoutButton: {
    width: "100%",
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BeeColors.red[50],
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BeeColors.red[200],
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: BeeColors.red[600],
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    alignItems: "center",
  },
  footerText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#d2c5ad",
    textTransform: "uppercase",
  },
});
