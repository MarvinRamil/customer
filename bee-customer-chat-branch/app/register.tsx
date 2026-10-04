import { BeeColors } from "@/constants/theme";
import {
  useClerkRegistration,
  usePhoneRegistration,
  useRegistrationStatus,
} from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import type { ThemeColors } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type RegistrationPath = "email" | "phone";

const OTP_LENGTH = 6;
const OTP_RESEND_COOLDOWN_SECONDS = 10 * 60;
const PRIVACY_POLICY_URL = "https://mybeeapp.com/privacy";
const TERMS_URL = "https://mybeeapp.com/terms";

// Runs inside the policy WebViews. Two jobs: strip the site's "Sign In" nav button, and
// post a message once the reader reaches the bottom so the Accept button can unlock.
const POLICY_INJECTED_JS = `
(function () {
  var style = document.createElement('style');
  style.textContent = 'header button { display: none !important; }';
  document.head.appendChild(style);

  var sent = false;
  function checkAtEnd() {
    if (sent) return;
    var doc = document.documentElement;
    var scrollTop = window.pageYOffset || doc.scrollTop || 0;
    var viewport = window.innerHeight || doc.clientHeight || 0;
    var total = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
    // 48px slack so a near-miss at the bottom still counts.
    if (scrollTop + viewport >= total - 48) {
      sent = true;
      window.ReactNativeWebView.postMessage('reached-end');
    }
  }

  window.addEventListener('scroll', checkAtEnd, { passive: true });
  window.addEventListener('resize', checkAtEnd, { passive: true });
  // Content shorter than the viewport never fires a scroll event - unlock after layout settles.
  setTimeout(checkAtEnd, 800);
})();
true;
`;

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const [path, setPath] = useState<RegistrationPath>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [questionPickerIndex, setQuestionPickerIndex] = useState<0 | 1 | 2 | null>(null);
  const [otpResendSecondsLeft, setOtpResendSecondsLeft] = useState(0);
  const [agreedToDocsPolicy, setAgreedToDocsPolicy] = useState(false);
  const [privacyPolicyVisible, setPrivacyPolicyVisible] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  const emailReg = useClerkRegistration();
  const phoneReg = usePhoneRegistration();
  const prevOtpStepRef = useRef<{ emailStep: string; phoneStep: string }>({
    emailStep: "",
    phoneStep: "",
  });
  const registrationStatus = useRegistrationStatus(emailReg.email);

  const navigateToLogin = () => router.replace("/login");
  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/login");
    }
  };

  const dismissKeyboard = () => Keyboard.dismiss();
  const withKeyboardDismiss = (fn: () => void) => () => {
    dismissKeyboard();
    fn();
  };
  const handleEmailBack = withKeyboardDismiss(emailReg.back);
  const handlePhoneBack = withKeyboardDismiss(phoneReg.back);
  const handleNavigateBack = withKeyboardDismiss(navigateBack);

  const switchToPhone = () => {
    emailReg.reset();
    phoneReg.reset();
    setOtpResendSecondsLeft(0);
    setAgreedToDocsPolicy(false);
    setAgreedToTerms(false);
    setPath("phone");
  };

  const switchToEmail = () => {
    emailReg.reset();
    phoneReg.reset();
    setOtpResendSecondsLeft(0);
    setAgreedToDocsPolicy(false);
    setAgreedToTerms(false);
    setPath("email");
  };

  const onOtpStep =
    (path === "email" && emailReg.step === "email-otp") ||
    (path === "phone" && phoneReg.step === "enter-otp");

  // Start 10-minute resend cooldown whenever user lands on an OTP step (code was just sent).
  useEffect(() => {
    const enteredEmailOtp =
      path === "email" &&
      emailReg.step === "email-otp" &&
      prevOtpStepRef.current.emailStep !== "email-otp";
    const enteredPhoneOtp =
      path === "phone" &&
      phoneReg.step === "enter-otp" &&
      prevOtpStepRef.current.phoneStep !== "enter-otp";

    if (enteredEmailOtp || enteredPhoneOtp) {
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
    }

    prevOtpStepRef.current = { emailStep: emailReg.step, phoneStep: phoneReg.step };
  }, [path, emailReg.step, phoneReg.step]);

  useEffect(() => {
    if (!onOtpStep || otpResendSecondsLeft <= 0) {
      return;
    }
    const id = setInterval(() => {
      setOtpResendSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [onOtpStep, otpResendSecondsLeft]);

  const handleResendEmailOtp = async () => {
    const ok = await emailReg.resendCode();
    if (ok) {
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleResendPhoneOtp = async () => {
    const ok = await phoneReg.resendOtp();
    if (ok) {
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
    }
  };

  const activeError = path === "email" ? emailReg.error : phoneReg.error;
  const isLoading =
    path === "email"
      ? emailReg.isSubmitting || emailReg.isVerifying || emailReg.isResending
      : phoneReg.isSubmitting || phoneReg.isResending;

  const renderShell = (
    shellKey: string,
    onBack: (() => void) | null,
    headline: string,
    subheadline: string,
    children: React.ReactNode,
    options?: { centeredForm?: boolean; hideBack?: boolean }
  ) => (
    <View
      key={shellKey}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={{ height: insets.top, backgroundColor: theme.background }} />
      <View style={styles.flex}>
        <View style={styles.content}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
          >
          <View style={styles.headerContainer}>
            {onBack && !options?.hideBack ? (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <Text style={[styles.headline, { color: theme.text }]}>{headline}</Text>
            <Text style={[styles.subheadline, { color: theme.textSecondary }]}>{subheadline}</Text>
          </View>
          <View style={[styles.form, options?.centeredForm && styles.formCentered]}>{children}</View>
          </ScrollView>
        </View>
      </View>
      <View style={{ height: insets.bottom, backgroundColor: theme.background }} />
    </View>
  );

  // ---- Email path: OTP verification ----
  if (path === "email" && emailReg.step === "email-otp") {
    if (emailReg.isSigningIn) {
      return renderShell(
        "email-email-otp-signing-in",
        null,
        "Email verified",
        "Signing you in…",
        <View style={styles.signingInSection}>
          <Ionicons name="checkmark-circle" size={64} color={theme.success} />
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
        </View>,
        { hideBack: true }
      );
    }

    return renderShell(
      "email-email-otp",
      handleEmailBack,
      "Verification code",
      `We sent a 6-digit code to ${emailReg.email.trim().toLowerCase()}`,
      <>
        <View style={styles.otpInputWrap}>
          <Text style={[styles.label, { color: theme.text }]}>Enter the code from your email</Text>
          <View style={[styles.otpInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.otpInput, { color: theme.text }]}
              placeholder="000000"
              placeholderTextColor={theme.placeholder}
              value={emailReg.code}
              onChangeText={(t) => {
                emailReg.setCode(t.replace(/\D/g, "").slice(0, OTP_LENGTH));
                emailReg.clearError();
              }}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              editable={!emailReg.isVerifying}
            />
          </View>
          <OtpResendControl
            theme={theme}
            secondsLeft={otpResendSecondsLeft}
            isResending={emailReg.isResending}
            onResend={handleResendEmailOtp}
          />
        </View>
        <ErrorBanner error={activeError} />
        <SubmitButton
          theme={theme}
          label="Continue"
          loading={emailReg.isVerifying}
          disabled={emailReg.isVerifying || emailReg.code.trim().length === 0}
          onPress={emailReg.verifyCode}
        />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
      </>,
      { centeredForm: true }
    );
  }

  // ---- Email path: enter details ----
  if (path === "email" && emailReg.step === "enter-details") {
    return renderShell(
      "email-enter-details",
      handleEmailBack,
      "Create your account",
      emailReg.email.trim().toLowerCase(),
      <>
        <DetailsFields
          theme={theme}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
          fullName={emailReg.fullName}
          setFullName={(v) => {
            emailReg.setFullName(v);
            emailReg.clearError();
          }}
          password={emailReg.password}
          setPassword={(v) => {
            emailReg.setPassword(v);
            emailReg.clearError();
          }}
          confirmPassword={emailReg.confirmPassword}
          setConfirmPassword={(v) => {
            emailReg.setConfirmPassword(v);
            emailReg.clearError();
          }}
          disabled={emailReg.isSubmitting}
        />
        <PolicyAgreementCheckbox
          theme={theme}
          checked={agreedToDocsPolicy}
          // Ticking requires reading the document first, so the box can only be checked by
          // accepting inside the modal. Unticking stays a plain toggle.
          onToggle={() => {
            if (agreedToDocsPolicy) setAgreedToDocsPolicy(false);
            else setPrivacyPolicyVisible(true);
          }}
          onOpenDocument={() => setPrivacyPolicyVisible(true)}
          leadingText="I agree to submit my personal documents for verification and have read the"
          linkLabel="Privacy Policy"
          disabled={emailReg.isSubmitting}
        />
        <PolicyAgreementCheckbox
          theme={theme}
          checked={agreedToTerms}
          onToggle={() => {
            if (agreedToTerms) setAgreedToTerms(false);
            else setTermsVisible(true);
          }}
          onOpenDocument={() => setTermsVisible(true)}
          leadingText="I have read and accept the"
          linkLabel="Terms and Conditions"
          disabled={emailReg.isSubmitting}
        />
        <ErrorBanner error={activeError} />
        <SubmitButton
          theme={theme}
          label="Send verification code"
          loading={emailReg.isSubmitting}
          disabled={emailReg.isSubmitting || !agreedToDocsPolicy || !agreedToTerms}
          onPress={emailReg.startSignUp}
        />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
        <PolicyDocumentModal
          theme={theme}
          visible={privacyPolicyVisible}
          title="Privacy Policy"
          url={PRIVACY_POLICY_URL}
          onClose={() => setPrivacyPolicyVisible(false)}
          onAccept={() => {
            setAgreedToDocsPolicy(true);
            setPrivacyPolicyVisible(false);
          }}
        />
        <PolicyDocumentModal
          theme={theme}
          visible={termsVisible}
          title="Terms and Conditions"
          url={TERMS_URL}
          onClose={() => setTermsVisible(false)}
          onAccept={() => {
            setAgreedToTerms(true);
            setTermsVisible(false);
          }}
        />
      </>
    );
  }

  // ---- Email path: email entry ----
  if (path === "email" && emailReg.step === "email-entry") {
    const emailTaken =
      registrationStatus.emailCheck?.available === false ||
      registrationStatus.status?.registrationComplete === true;

    return renderShell(
      "email-email-entry",
      handleNavigateBack,
      "Create Account",
      "Enter your email to get started",
      <>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Email</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputLeadingIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="you@example.com"
              placeholderTextColor={theme.placeholder}
              value={emailReg.email}
              onChangeText={(v) => {
                emailReg.setEmail(v);
                emailReg.clearError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>
          {registrationStatus.isChecking && (
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>Checking email…</Text>
          )}
          {registrationStatus.status?.registrationComplete && (
            <View style={styles.statusIndicator}>
              <Text style={[styles.statusText, { color: theme.info }]}>Account exists. Please log in instead.</Text>
            </View>
          )}
          {!registrationStatus.status?.registrationComplete &&
            registrationStatus.status?.emailVerified && (
              <View style={styles.statusIndicator}>
                <Text style={[styles.statusText, { color: theme.success }]}>
                  Email verified. You can continue to create your account.
                </Text>
              </View>
            )}
          {registrationStatus.hints
            .filter(
              (h) =>
                !h.message.toLowerCase().includes("already registered") &&
                !h.message.toLowerCase().includes("registration is already complete")
            )
            .map((hint, index) => (
              <View key={`${hint.type}-${index}`} style={styles.statusIndicator}>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        hint.type === "success"
                          ? theme.success
                          : hint.type === "warning"
                            ? theme.error
                            : theme.textSecondary,
                    },
                  ]}
                >
                  {hint.message}
                </Text>
              </View>
            ))}
        </View>
        <ErrorBanner error={activeError} />
        <SubmitButton
          theme={theme}
          label="Continue"
          disabled={emailTaken}
          onPress={() => {
            if (!emailTaken) emailReg.proceedFromEmailEntry();
          }}
        />
        {/* Phone registration — not supported yet; re-enable when backend is ready
        <ChannelToggle theme={theme} label="Use phone number instead" onPress={switchToPhone} disabled={isLoading} />
        */}
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
      </>
    );
  }

  // ---- Phone path: security questions ----
  if (path === "phone" && phoneReg.step === "enter-security-questions") {
    return (
      <>
        {renderShell(
          "phone-enter-security-questions",
          handlePhoneBack,
          "Security questions",
          "Step 2 of 2: Set up security questions for account recovery",
          <>
            {phoneReg.isLoadingQuestions ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 24 }} />
            ) : (
              <SecurityQuestionsBlock
                theme={theme}
                securityQuestions={phoneReg.securityQuestions}
                securityFields={phoneReg.securityFields}
                onOpenPicker={setQuestionPickerIndex}
                onAnswerChange={(index, answer) => {
                  phoneReg.setSecurityField(index, { answer });
                  phoneReg.clearError();
                }}
                disabled={phoneReg.isSubmitting}
              />
            )}
            <ErrorBanner error={activeError} />
            <SubmitButton
              theme={theme}
              label="Create account"
              loading={phoneReg.isSubmitting}
              disabled={phoneReg.isSubmitting || phoneReg.isLoadingQuestions}
              onPress={phoneReg.createAccount}
            />
            <LoginFooter theme={theme} onLogin={navigateToLogin} />
          </>
        )}
        <QuestionPickerModal
          visible={questionPickerIndex !== null}
          questions={phoneReg.securityQuestions}
          selectedIds={phoneReg.securityFields.map((f) => f.questionId)}
          currentIndex={questionPickerIndex}
          onSelect={(questionId) => {
            if (questionPickerIndex !== null) {
              phoneReg.setSecurityField(questionPickerIndex, { questionId });
              phoneReg.clearError();
            }
            setQuestionPickerIndex(null);
          }}
          onClose={() => setQuestionPickerIndex(null)}
          theme={theme}
        />
      </>
    );
  }

  // ---- Phone path: details ----
  if (path === "phone" && phoneReg.step === "enter-details") {
    return renderShell(
      "phone-enter-details",
      handlePhoneBack,
      "Create your account",
      `Step 1 of 2: ${phoneReg.normalizedPhone ?? ""}`,
      <>
        <DetailsFields
          theme={theme}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
          fullName={phoneReg.fullName}
          setFullName={(v) => {
            phoneReg.setFullName(v);
            phoneReg.clearError();
          }}
          password={phoneReg.password}
          setPassword={(v) => {
            phoneReg.setPassword(v);
            phoneReg.clearError();
          }}
          confirmPassword={phoneReg.confirmPassword}
          setConfirmPassword={(v) => {
            phoneReg.setConfirmPassword(v);
            phoneReg.clearError();
          }}
          disabled={phoneReg.isSubmitting}
        />
        <ErrorBanner error={activeError} />
        <SubmitButton theme={theme} label="Continue" onPress={phoneReg.proceedFromDetails} />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
      </>
    );
  }

  // ---- Phone path: OTP ----
  if (path === "phone" && phoneReg.step === "enter-otp") {
    return renderShell(
      "phone-enter-otp",
      handlePhoneBack,
      "Verification code",
      `We sent a 6-digit code to ${phoneReg.normalizedPhone ?? ""}`,
      <>
        <View style={styles.otpInputWrap}>
          <Text style={[styles.label, { color: theme.text }]}>Enter the code from your SMS</Text>
          <View style={[styles.otpInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.otpInput, { color: theme.text }]}
              placeholder="000000"
              placeholderTextColor={theme.placeholder}
              value={phoneReg.otp}
              onChangeText={(v) => {
                phoneReg.setOtp(v.replace(/\D/g, "").slice(0, OTP_LENGTH));
                phoneReg.clearError();
              }}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              editable={!phoneReg.isSubmitting}
            />
          </View>
          <OtpResendControl
            theme={theme}
            secondsLeft={otpResendSecondsLeft}
            isResending={phoneReg.isResending}
            onResend={handleResendPhoneOtp}
          />
        </View>
        <ErrorBanner error={activeError} />
        <SubmitButton
          theme={theme}
          label="Continue"
          loading={phoneReg.isSubmitting}
          disabled={phoneReg.isSubmitting || phoneReg.otp.trim().length === 0}
          onPress={phoneReg.verifyOtp}
        />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
      </>,
      { centeredForm: true }
    );
  }

  // ---- Phone path: enter phone (default) ----
  return renderShell(
    "phone-enter-phone",
    handleNavigateBack,
    "Create Account",
    "Enter your phone number to receive a verification code",
    <>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Phone number</Text>
        <View
          style={[
            styles.inputContainer,
            styles.phoneInputContainer,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.countryCodeBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.countryCodeText, { color: theme.text }]}>+63</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput, { color: theme.text }]}
            placeholder="9XXXXXXXXX"
            placeholderTextColor={theme.placeholder}
            value={phoneReg.phoneInput}
            onChangeText={(text) => {
              let next = text.replace(/\D/g, "");
              if (next.startsWith("09")) next = next.slice(1);
              if (next && !next.startsWith("9")) next = next.replace(/^[0-8]+/, "");
              next = next.slice(0, 10);
              phoneReg.setPhoneInput(next);
              phoneReg.clearError();
            }}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!phoneReg.isSubmitting}
            maxLength={10}
          />
        </View>
      </View>
      <ErrorBanner error={activeError} />
      <SubmitButton
        theme={theme}
        label="Send verification code"
        loading={phoneReg.isSubmitting}
        disabled={phoneReg.isSubmitting}
        onPress={phoneReg.sendOtp}
      />
      <ChannelToggle theme={theme} label="Use email instead" onPress={switchToEmail} disabled={phoneReg.isSubmitting} />
      <LoginFooter theme={theme} onLogin={navigateToLogin} />
    </>
  );
}

function OtpResendControl({
  theme,
  secondsLeft,
  isResending,
  onResend,
}: {
  theme: ThemeColors;
  secondsLeft: number;
  isResending: boolean;
  onResend: () => void;
}) {
  if (secondsLeft > 0) {
    return (
      <View style={styles.timerRow}>
        <Ionicons name="time-outline" size={16} color="#000000" />
        <Text style={styles.timerText}>
          Resend code in {Math.floor(secondsLeft / 60)}:
          {(secondsLeft % 60).toString().padStart(2, "0")}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onResend} disabled={isResending} style={styles.resendButton}>
      <Text style={[styles.resendText, { color: theme.primary }]}>
        {isResending ? "Resending…" : "Resend code"}
      </Text>
    </TouchableOpacity>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
}

function SubmitButton({
  theme,
  label,
  onPress,
  loading,
  disabled,
}: {
  theme: ThemeColors;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={styles.buttonGroup}>
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: theme.primary },
          (loading || disabled) && styles.submitButtonDisabled,
        ]}
        onPress={onPress}
        disabled={loading || disabled}
        activeOpacity={0.98}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.primaryText} />
        ) : (
          <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function PolicyAgreementCheckbox({
  theme,
  checked,
  onToggle,
  onOpenDocument,
  leadingText,
  linkLabel,
  disabled,
}: {
  theme: ThemeColors;
  checked: boolean;
  onToggle: () => void;
  onOpenDocument: () => void;
  leadingText: string;
  linkLabel: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.policyAgreementRow}
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.policyCheckbox,
          { borderColor: theme.border },
          checked && { backgroundColor: BeeColors.yellow[400], borderColor: BeeColors.yellow[400] },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={14} color="#1d180c" />}
      </View>
      <Text style={[styles.policyAgreementText, { color: theme.text }]}>
        {leadingText}{" "}
        {/* Nested Text handles its own press, so tapping the link opens the document
            instead of toggling the checkbox. */}
        <Text
          style={[styles.policyPolicyLink, { color: theme.text }]}
          onPress={onOpenDocument}
          suppressHighlighting
        >
          {linkLabel}
        </Text>
        .
      </Text>
    </TouchableOpacity>
  );
}

function PolicyDocumentModal({
  theme,
  visible,
  title,
  url,
  onClose,
  onAccept,
}: {
  theme: ThemeColors;
  visible: boolean;
  title: string;
  url: string;
  onClose: () => void;
  onAccept: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [reachedEnd, setReachedEnd] = useState(false);

  // Re-arm the scroll gate every time the document is reopened.
  useEffect(() => {
    if (visible) setReachedEnd(false);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.privacyModalContainer,
          { backgroundColor: theme.surface, paddingTop: insets.top },
        ]}
      >
        <View style={[styles.privacyModalHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.privacyModalTitle, { color: theme.text }]}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <WebView
          source={{ uri: url }}
          style={styles.privacyWebview}
          originWhitelist={["http://*", "https://*"]}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.privacyWebviewLoading, { backgroundColor: theme.surface }]}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
          // Hides the site's sticky nav "Sign In" button (the header's only <button>) and reports
          // back once the reader hits the bottom. Injected as CSS so it survives Next.js hydration
          // re-rendering the header, which a one-shot element.remove() would not.
          injectedJavaScript={POLICY_INJECTED_JS}
          onMessage={(event) => {
            if (event.nativeEvent.data === "reached-end") setReachedEnd(true);
          }}
        />

        <View
          style={[
            styles.privacyModalFooter,
            { borderTopColor: theme.border, paddingBottom: insets.bottom + 16 },
          ]}
        >
          {!reachedEnd && (
            <Text style={[styles.privacyScrollHint, { color: theme.textSecondary }]}>
              Please scroll to the end of the document to continue.
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.privacyAcceptButton,
              { backgroundColor: BeeColors.yellow[400] },
              !reachedEnd && styles.privacyAcceptButtonDisabled,
            ]}
            onPress={onAccept}
            disabled={!reachedEnd}
            activeOpacity={0.8}
          >
            <Text style={styles.privacyAcceptButtonText}>I have read and agree</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ChannelToggle({
  theme,
  label,
  onPress,
  disabled,
}: {
  theme: ThemeColors;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.channelToggle} onPress={onPress} disabled={disabled}>
      <Text style={[styles.channelToggleText, { color: theme.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function LoginFooter({ theme, onLogin }: { theme: ThemeColors; onLogin: () => void }) {
  return (
    <View style={styles.loginContainer}>
      <Text style={[styles.loginText, { color: theme.textMuted }]}>
        Already have an account?{" "}
        <Text style={[styles.loginLink, { color: theme.text }]} onPress={onLogin}>
          Log In
        </Text>
      </Text>
    </View>
  );
}

function DetailsFields({
  theme,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  fullName,
  setFullName,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  disabled,
}: {
  theme: ThemeColors;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  fullName: string;
  setFullName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Full name</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="As it appears on your ID"
            placeholderTextColor={theme.placeholder}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            editable={!disabled}
          />
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Password</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Min. 8 characters, include uppercase, number & symbol"
            placeholderTextColor={theme.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!disabled}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.visibilityButton}>
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Confirm password</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Re-enter your password"
            placeholderTextColor={theme.placeholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            editable={!disabled}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={styles.visibilityButton}
          >
            <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && confirmPassword !== password && (
          <Text style={[styles.statusText, { color: BeeColors.red[600], marginTop: 4 }]}>
            Passwords do not match
          </Text>
        )}
      </View>
    </>
  );
}

function SecurityQuestionsBlock({
  theme,
  securityQuestions,
  securityFields,
  onOpenPicker,
  onAnswerChange,
  disabled,
}: {
  theme: ThemeColors;
  securityQuestions: { id: number; question: string }[];
  securityFields: [{ questionId: number | null; answer: string }, { questionId: number | null; answer: string }, { questionId: number | null; answer: string }];
  onOpenPicker: (index: 0 | 1 | 2) => void;
  onAnswerChange: (index: 0 | 1 | 2, answer: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.securityQuestionsSection}>
      <Text style={[styles.securityQuestionsSubtitle, { color: theme.textSecondary }]}>
        All 3 are required for account recovery (e.g. forgot password)
      </Text>
      {([0, 1, 2] as const).map((index) => {
        const field = securityFields[index];
        const selected = field.questionId
          ? securityQuestions.find((q) => q.id === field.questionId)
          : null;
        return (
          <View key={index} style={styles.securityQuestionRow}>
            <Text style={[styles.label, { color: theme.text }]}>
              Security question {index + 1} <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => onOpenPicker(index)}
              disabled={disabled}
            >
              <Text
                style={[styles.pickerButtonText, { color: selected ? theme.text : theme.textSecondary }]}
                numberOfLines={1}
              >
                {selected?.question ?? "Select a question"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={[
                styles.securityAnswerInput,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              placeholder="Your answer"
              placeholderTextColor={theme.placeholder}
              value={field.answer}
              onChangeText={(v) => onAnswerChange(index, v)}
              editable={!disabled}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        );
      })}
    </View>
  );
}

function QuestionPickerModal({
  visible,
  questions,
  selectedIds,
  currentIndex,
  onSelect,
  onClose,
  theme,
}: {
  visible: boolean;
  questions: { id: number; question: string }[];
  selectedIds: (number | null)[];
  currentIndex: 0 | 1 | 2 | null;
  onSelect: (questionId: number) => void;
  onClose: () => void;
  theme: ThemeColors;
}) {
  const filtered = questions.filter(
    (q) =>
      selectedIds[currentIndex ?? -1] === q.id ||
      !selectedIds.some((id, i) => i !== currentIndex && id === q.id)
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Select question {(currentIndex ?? 0) + 1}
          </Text>
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalOption, { borderBottomColor: theme.border }]}
                onPress={() => onSelect(item.id)}
              >
                <Text style={[styles.modalOptionText, { color: theme.text }]}>{item.question}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={[styles.modalCancel, { borderColor: theme.border }]} onPress={onClose}>
            <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headline: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 14,
    fontWeight: "500",
  },
  form: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    marginTop: 24,
  },
  formCentered: {
    alignItems: "center",
  },
  signingInSection: {
    alignItems: "center",
    paddingVertical: 32,
    width: "100%",
  },
  inputGroup: {
    marginBottom: 18,
    paddingHorizontal: 16,
    width: "100%",
  },
  buttonGroup: {
    paddingHorizontal: 16,
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  required: {
    color: BeeColors.red[600],
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  inputLeadingIcon: {
    marginRight: 12,
  },
  phoneInputContainer: {
    gap: 8,
  },
  countryCodeBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
  },
  otpInputWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  otpInputContainer: {
    width: "100%",
    maxWidth: 280,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 24,
    minHeight: 72,
    height: 72,
    marginTop: 10,
  },
  otpInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 8,
    paddingVertical: 8,
  },
  visibilityButton: {
    padding: 4,
  },
  resendButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  resendText: {
    fontSize: 14,
    fontWeight: "600",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    width: "100%",
    alignSelf: "center",
  },
  timerText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#000000",
  },
  statusIndicator: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BeeColors.red[50],
    borderWidth: 1,
    borderColor: BeeColors.red[200],
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: BeeColors.red[700],
  },
  policyAgreementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  policyCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  policyAgreementText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  policyPolicyLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  privacyModalContainer: {
    flex: 1,
  },
  privacyModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  privacyModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  privacyWebview: {
    flex: 1,
  },
  privacyWebviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyModalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  privacyScrollHint: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
  privacyAcceptButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyAcceptButtonDisabled: {
    opacity: 0.45,
  },
  privacyAcceptButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1d180c",
  },
  submitButton: {
    width: "100%",
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: BeeColors.yellow[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  channelToggle: {
    alignItems: "center",
    paddingTop: 16,
  },
  channelToggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loginContainer: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 24,
    marginTop: 16,
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  securityQuestionsSection: {
    marginTop: 4,
    width: "100%",
    paddingHorizontal: 16,
  },
  securityQuestionsSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  securityQuestionRow: {
    marginBottom: 16,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    marginBottom: 8,
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  securityAnswerInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    fontSize: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
  },
  modalCancel: {
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
