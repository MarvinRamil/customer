import { BeeColors, BRAND_YELLOW } from "@/constants/theme";
import { useAuth, useLogin } from "@/features/auth";
import {
  clearLastLoginUser,
  getLastLoginUser,
  type LastLoginUser,
} from "@/shared/services/lastLoginStorage";
// Biometric login disabled for now
// import {
//   getBiometricEnabled,
//   hasBiometricHardware,
//   isBiometricEnrolled,
//   setBiometricEnabled,
// } from "@/shared/services/biometricService";
import { useTheme } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";

const WELCOME_LOGO = require("@/assets/images/screen-welcome-logo.png");
const VERIFIED_GREEN = "#6b8e23";

/** Sign-up is paused; flip to true to re-enable the links to /register. */
const REGISTRATION_OPEN = true;
const REGISTRATION_NOTICE = "Registration will continue on July 20, 2026";

// Biometric login disabled for now
// /** Once per app session — avoids re-prompting Face ID after navigating back to login. */
// let hasAutoPromptedBiometricThisSession = false;

function AnimatedWelcomeLogo({
  size = 160,
  wrapSize = 192,
  style,
}: {
  size?: number;
  wrapSize?: number;
  style?: object;
}) {
  const float = useSharedValue(0);

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

  return (
    <Animated.View
      style={[
        { width: wrapSize, height: wrapSize, alignItems: "center", justifyContent: "center" },
        logoFloatStyle,
        style,
      ]}
    >
      <Image source={WELCOME_LOGO} style={{ width: size, height: size }} contentFit="contain" />
    </Animated.View>
  );
}

function LoginScreenShell({
  insets,
  topColor,
  bottomColor,
  children,
}: {
  insets: EdgeInsets;
  topColor: string;
  bottomColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.container, { backgroundColor: bottomColor }]}>
      <View style={{ height: insets.top, backgroundColor: topColor }} />
      <View style={styles.flex}>{children}</View>
      <View style={{ height: insets.bottom, backgroundColor: bottomColor }} />
    </View>
  );
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts[0]?.length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts[0]?.slice(0, 1).toUpperCase() ?? "?";
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * Login screen.
 * - welcome_back: a saved/returning user → yellow header + profile card + password.
 * - full_login: no saved user → email + password.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const {
    email,
    password,
    isLoading,
    error,
    setEmail,
    setPassword,
    handleLogin,
    clearError,
  } = useLogin();
  const { error: authError } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [lastUser, setLastUser] = useState<LastLoginUser | null>(null);
  const [lastUserChecked, setLastUserChecked] = useState(false);

  // Biometric login disabled for now
  // const { loginWithBiometric, error: authError } = useAuth();
  // const [showFaceIDButton, setShowFaceIDButton] = useState(false);
  // const [hasAutoPrompted, setHasAutoPrompted] = useState(false);
  // const autoPromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getLastLoginUser()
      .then((user) => {
        setLastUser(user);
        setLastUserChecked(true);
      })
      .catch(() => {
        setLastUser(null);
        setLastUserChecked(true);
      });
  }, []);

  useEffect(() => {
    if (lastUser) setEmail(lastUser.email);
  }, [lastUser, setEmail]);

  // Biometric login disabled for now
  // const refreshBiometricVisibility = useCallback(async () => {
  //   const enabled = await getBiometricEnabled();
  //   if (!enabled) {
  //     setShowFaceIDButton(false);
  //     return;
  //   }
  //   const [hasHardware, enrolled] = await Promise.all([
  //     hasBiometricHardware(),
  //     isBiometricEnrolled(),
  //   ]);
  //   setShowFaceIDButton(Boolean(hasHardware && enrolled));
  // }, []);
  //
  // useFocusEffect(
  //   useCallback(() => {
  //     refreshBiometricVisibility();
  //   }, [refreshBiometricVisibility]),
  // );
  //
  // const attemptAutoBiometricLogin = useCallback(async () => {
  //   setHasAutoPrompted(true);
  //   hasAutoPromptedBiometricThisSession = true;
  //   try {
  //     await loginWithBiometric();
  //   } catch (e) {
  //     console.error("Biometric auto-login error:", e);
  //   } finally {
  //     await refreshBiometricVisibility();
  //   }
  // }, [loginWithBiometric, refreshBiometricVisibility]);
  //
  // useEffect(() => {
  //   const ready = lastUserChecked && lastUser !== null && showFaceIDButton;
  //   if (ready && !hasAutoPrompted && !hasAutoPromptedBiometricThisSession && !isLoading) {
  //     if (autoPromptTimeoutRef.current) {
  //       clearTimeout(autoPromptTimeoutRef.current);
  //     }
  //     autoPromptTimeoutRef.current = setTimeout(() => {
  //       attemptAutoBiometricLogin();
  //     }, 800);
  //   }
  //   return () => {
  //     if (autoPromptTimeoutRef.current) {
  //       clearTimeout(autoPromptTimeoutRef.current);
  //     }
  //   };
  // }, [
  //   lastUserChecked,
  //   lastUser,
  //   showFaceIDButton,
  //   hasAutoPrompted,
  //   isLoading,
  //   attemptAutoBiometricLogin,
  // ]);

  const onLoginPress = async () => {
    try {
      await handleLogin();
      // Biometric opt-in popup disabled for now
      // const hasHardware = await hasBiometricHardware();
      // const isEnrolled = await isBiometricEnrolled();
      // const alreadyEnabled = await getBiometricEnabled();
      // if (hasHardware && isEnrolled && !alreadyEnabled) {
      //   Alert.alert(
      //     "Use Face ID next time?",
      //     "You can sign in with Face ID or fingerprint instead of your password.",
      //     [
      //       { text: "Not now", style: "cancel" },
      //       {
      //         text: "Enable",
      //         onPress: async () => {
      //           await setBiometricEnabled(true);
      //           await refreshBiometricVisibility();
      //         },
      //       },
      //     ]
      //   );
      // }
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  // Biometric login disabled for now
  // const handleFaceIDLogin = async () => {
  //   try {
  //     await loginWithBiometric();
  //   } catch (e) {
  //     console.error("Biometric login error:", e);
  //   } finally {
  //     await refreshBiometricVisibility();
  //   }
  // };

  const handleSignInAsDifferentUser = async () => {
    await clearLastLoginUser();
    setLastUser(null);
    setEmail("");
    setPassword("");
    clearError();
    // Biometric login disabled for now
    // await setBiometricEnabled(false);
    // setShowFaceIDButton(false);
    // setHasAutoPrompted(false);
    // hasAutoPromptedBiometricThisSession = false;
  };

  const viewMode: "loading" | "welcome_back" | "full_login" = !lastUserChecked
    ? "loading"
    : lastUser !== null
      ? "welcome_back"
      : "full_login";

  const displayError = error || authError;

  // Shared password field
  const PasswordField = (
    <View style={styles.inputGroup}>
      <View style={styles.passwordLabelRow}>
        <Text style={[styles.label, { color: theme.text }]}>Password</Text>
        <TouchableOpacity onPress={() => router.push("/forgot-password")}>
          <Text style={styles.forgotLink}>Forgot?</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="lock-closed" size={20} color={theme.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Enter your password"
          placeholderTextColor={theme.placeholder}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clearError();
          }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.visibilityButton}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const ErrorBanner = displayError ? (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
      <Text style={styles.errorText}>{displayError}</Text>
    </View>
  ) : null;

  // ---------- Loading ----------
  if (viewMode === "loading") {
    return (
      <LoginScreenShell insets={insets} topColor={BRAND_YELLOW} bottomColor={theme.background}>
        <View style={[styles.loadingContent, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={BeeColors.yellow[500]} />
        </View>
      </LoginScreenShell>
    );
  }

  // ---------- Welcome back (saved user) ----------
  if (viewMode === "welcome_back" && lastUser) {
    const name = lastUser.fullName || lastUser.email;
    return (
      <LoginScreenShell insets={insets} topColor={BRAND_YELLOW} bottomColor={theme.background}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Yellow header */}
          <View style={[styles.wbHeader, { paddingTop: 24 }]}>
            <AnimatedWelcomeLogo size={140} wrapSize={140} style={styles.wbLogo} />
            <Text style={styles.wbWelcome}>Welcome back!</Text>
            <Text style={styles.wbWelcomeSub}>Ready to get moving today?</Text>
          </View>

          {/* Profile card */}
          <View style={styles.wbCardWrap}>
            <View style={[styles.wbCard, { backgroundColor: theme.surface }]}>
              {/* Avatar */}
              <View style={styles.wbAvatarWrap}>
                <View style={styles.wbAvatarRing}>
                  {lastUser.photoUrl ? (
                    <Image source={{ uri: lastUser.photoUrl }} style={styles.wbAvatarImg} contentFit="cover" />
                  ) : (
                    <View style={styles.wbAvatarInitials}>
                      <Text style={styles.wbAvatarInitialsText}>{getInitials(name)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.wbVerifiedBadge}>
                  <Ionicons name="checkmark" size={12} color="#ffffff" />
                </View>
              </View>

              {/* User info */}
              <Text
                style={[styles.wbName, { color: theme.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {name}
              </Text>
              <Text
                style={[styles.wbEmail, { color: theme.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {lastUser.email}
              </Text>

              <View style={styles.wbActions}>
                {/* Biometric login disabled for now */}
                {/* {showFaceIDButton && (
                  <>
                    <TouchableOpacity
                      style={styles.loginButton}
                      onPress={handleFaceIDLogin}
                      disabled={isLoading}
                      activeOpacity={0.95}
                    >
                      <Ionicons name="finger-print" size={22} color="#000000" />
                      <Text style={styles.loginButtonText}>Sign in with Face ID</Text>
                    </TouchableOpacity>

                    <View style={styles.dividerRow}>
                      <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                      <Text style={[styles.dividerText, { color: theme.textSecondary }]}>OR</Text>
                      <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                    </View>
                  </>
                )} */}

                {PasswordField}
                {ErrorBanner}

                {/* Log In */}
                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                  onPress={onLoginPress}
                  disabled={isLoading}
                  activeOpacity={0.95}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Log In</Text>
                      <Ionicons name="arrow-forward" size={20} color="#000000" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Secondary actions */}
            <View style={styles.wbSecondary}>
              <TouchableOpacity
                style={[styles.switchPill, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={handleSignInAsDifferentUser}
              >
                <Ionicons name="swap-horizontal" size={18} color={theme.text} />
                <Text style={[styles.switchPillText, { color: theme.text }]}>Switch Account</Text>
              </TouchableOpacity>
              <Text style={[styles.footerText, { color: theme.textSecondary, marginTop: 20 }]}>
                Not {firstNameOf(name)}?{" "}
                <Text
                  style={[
                    styles.signUpLink,
                    REGISTRATION_OPEN
                      ? { color: theme.text }
                      : [styles.signUpLinkDisabled, { color: theme.textSecondary }],
                  ]}
                  onPress={REGISTRATION_OPEN ? () => router.push("/register") : undefined}
                >
                  Sign up for a new account
                </Text>
              </Text>
              {!REGISTRATION_OPEN && (
                <Text style={[styles.registrationNotice, { color: theme.textSecondary }]}>
                  {REGISTRATION_NOTICE}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </LoginScreenShell>
    );
  }

  // ---------- Full login (no saved user) ----------
  return (
    <LoginScreenShell insets={insets} topColor={BRAND_YELLOW} bottomColor={theme.background}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Brand header */}
        <View style={[styles.header, { paddingTop: 24 }]}>
          <AnimatedWelcomeLogo size={150} wrapSize={150} />
        </View>

        {/* Form card */}
        <View style={[styles.card, { backgroundColor: theme.background, paddingBottom: 24 }]}>
          <Text style={[styles.title, { color: theme.text }]}>Welcome!</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in to continue your journey.</Text>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="mail" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.placeholder}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  clearError();
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {PasswordField}
          {ErrorBanner}

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={onLoginPress}
            disabled={isLoading}
            activeOpacity={0.95}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Log In</Text>
                <Ionicons name="arrow-forward" size={20} color="#000000" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerLinkWrap}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Don't have an account?{" "}
              <Text
                style={[
                  styles.signUpLink,
                  REGISTRATION_OPEN
                    ? { color: theme.text }
                    : [styles.signUpLinkDisabled, { color: theme.textSecondary }],
                ]}
                onPress={REGISTRATION_OPEN ? () => router.push("/register") : undefined}
              >
                Sign Up
              </Text>
            </Text>
            {!REGISTRATION_OPEN && (
              <Text style={[styles.registrationNotice, { color: theme.textSecondary }]}>
                {REGISTRATION_NOTICE}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </LoginScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  loadingContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flexGrow: 1 },

  // ----- Full login (yellow header) -----
  header: {
    minHeight: 260,
    backgroundColor: BRAND_YELLOW,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  card: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 36,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  title: { fontSize: 30, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 16, marginBottom: 30,marginTop: -10 },

  // ----- Welcome back (yellow header) -----
  wbHeader: {
    backgroundColor: BRAND_YELLOW,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  wbLogo: { marginBottom: 12 },
  wbWelcome: { fontSize: 26, fontWeight: "700", color: "#241a00",marginTop: -30 },
  wbWelcomeSub: { fontSize: 15, fontWeight: "500", color: "rgba(111,87,0,0.8)", marginTop: 0,marginBottom: 30 },
  wbCardWrap: { paddingHorizontal: 24, marginTop: -48, alignItems: "center", width: "100%", maxWidth: 480, alignSelf: "center" },
  wbCard: {
    width: "100%",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 60,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  wbAvatarWrap: { position: "absolute", top: -48 },
  wbAvatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: "#ffffff",
    overflow: "hidden",
    backgroundColor: BRAND_YELLOW,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  wbAvatarImg: { width: "100%", height: "100%" },
  wbAvatarInitials: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: BRAND_YELLOW },
  wbAvatarInitialsText: { fontSize: 32, fontWeight: "700", color: "#000000" },
  wbVerifiedBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: VERIFIED_GREEN,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  wbName: { fontSize: 22, fontWeight: "700", textAlign: "center", width: "100%" },
  wbEmail: { fontSize: 14, marginTop: 2, marginBottom: 24, textAlign: "center", width: "100%" },
  wbActions: { width: "100%" },
  wbSecondary: { alignItems: "center", marginTop: 32, marginBottom: 24 },
  switchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  switchPillText: { fontSize: 14, fontWeight: "600" },

  // ----- Shared -----
  inputGroup: { marginBottom: 18, width: "100%" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  passwordLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  forgotLink: { fontSize: 13, fontWeight: "700", color: BeeColors.yellow[600] },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16 },
  visibilityButton: { padding: 4 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BeeColors.red[50],
    borderWidth: 1,
    borderColor: BeeColors.red[200],
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    width: "100%",
  },
  errorText: { flex: 1, fontSize: 14, color: BeeColors.red[700] },
  loginButton: {
    width: "100%",
    height: 56,
    backgroundColor: BRAND_YELLOW,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
    shadowColor: BeeColors.yellow[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { fontSize: 17, fontWeight: "700", color: "#000000" },
  faceIdButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  faceIdText: { fontSize: 15, fontWeight: "600" },
  footerLinkWrap: { alignItems: "center", marginTop: 28 },
  footerText: { fontSize: 14, textAlign: "center" },
  signUpLink: {
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: BRAND_YELLOW,
  },
  signUpLinkDisabled: {
    opacity: 0.5,
    textDecorationLine: "none",
  },
  registrationNotice: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
});
