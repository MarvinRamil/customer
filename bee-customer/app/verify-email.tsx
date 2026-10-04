import { BeeColors } from "@/constants/theme";
import { useVerifyEmail } from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Verify Email screen component
 * Handles email verification via token from email link
 * Reads email and token from URL query parameters
 * Shows success/error state and redirects to login
 */
export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  
  // Get email and token from URL query parameters
  const { email, token } = useLocalSearchParams<{ email?: string; token?: string }>();

  // Initialize verify email hook (will only run if email and token are present)
  const {
    isLoading,
    error,
    isSuccess,
    successMessage,
    verifyEmail,
    clearError,
  } = useVerifyEmail(email || '', token || '');

  /**
   * Automatically verify email when component mounts if email and token are present
   */
  useEffect(() => {
    if (email && token) {
      verifyEmail({ email: decodeURIComponent(email), token: decodeURIComponent(token) });
    }
  }, [email, token]);

  /**
   * Handle navigation to login
   */
  const handleGoToLogin = () => {
    router.replace('/login');
  };

  /**
   * Handle navigation to register
   */
  const handleGoToRegister = () => {
    router.replace('/register');
  };

  // Show loading state while verifying
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Image
              source={require("@/assets/images/bee_logo.jpg")}
              style={styles.logo}
              resizeMode="contain"
            />
            <ActivityIndicator size="large" color={BeeColors.yellow[400]} />
            <Text style={[styles.title, { color: theme.text }]}>Verifying your email...</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Please wait while we verify your email address.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Show success state
  if (isSuccess) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Image
              source={require("@/assets/images/bee_logo.jpg")}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={[styles.iconContainer, { backgroundColor: BeeColors.green[100] }]}>
              <Ionicons name="checkmark-circle" size={64} color={BeeColors.green[600]} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Email Verified!</Text>
            <Text style={[styles.message, { color: theme.textSecondary }]}>
              {successMessage || 'Your email has been verified successfully. You can now log in.'}
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: BeeColors.yellow[400] }]}
              onPress={handleGoToLogin}
              activeOpacity={0.98}
            >
              <Text style={styles.buttonText}>Go to Login</Text>
              <Ionicons name="arrow-forward" size={20} color={BeeColors.gray[900]} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Show error state
  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Image
            source={require("@/assets/images/bee_logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={[styles.iconContainer, { backgroundColor: BeeColors.red[100] }]}>
            <Ionicons name="close-circle" size={64} color={BeeColors.red[600]} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Verification Failed</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {error || 'Invalid or expired verification link. Please request a new verification email.'}
          </Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { borderColor: theme.border }]}
              onPress={handleGoToRegister}
              activeOpacity={0.98}
            >
              <Text style={[styles.buttonText, styles.buttonTextSecondary, { color: theme.text }]}>
                Sign Up Again
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: BeeColors.yellow[400] }]}
              onPress={handleGoToLogin}
              activeOpacity={0.98}
            >
              <Text style={styles.buttonText}>Go to Login</Text>
              <Ionicons name="arrow-forward" size={20} color={BeeColors.gray[900]} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
    width: "100%",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    width: "100%",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
    width: "100%",
  },
  buttonGroup: {
    width: "100%",
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: BeeColors.gray[900],
  },
  buttonTextSecondary: {
    color: BeeColors.gray[700],
  },
});
