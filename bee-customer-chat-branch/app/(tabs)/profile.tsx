import { BeeColors } from "@/constants/theme";
import { useAuth } from "@/features/auth";
// Biometric login disabled for now
// import {
//   getBiometricEnabled,
//   hasBiometricHardware,
//   isBiometricEnrolled,
//   setBiometricEnabled,
// } from "@/shared/services/biometricService";
import { useTheme } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChangePassword } from "@/features/auth";

const PROFILE_CARD_BORDER = "#e2e8f0"; // slate-200

/**
 * Profile screen component
 * Matches design: header, user identity (avatar, name, phone), option cards, logout + security note
 */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { user, logout } = useAuth();
  const { changePassword, isLoading: isChangingPassword, isSuccess: passwordChanged, error: changePasswordError, reset: resetChangePassword } = useChangePassword();
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Biometric login disabled for now
  // const [biometricEnabled, setBiometricEnabledState] = useState<boolean | null>(null);
  // const [biometricAvailable, setBiometricAvailable] = useState(false);
  //
  // useEffect(() => {
  //   (async () => {
  //     const [hasHardware, enrolled] = await Promise.all([
  //       hasBiometricHardware(),
  //       isBiometricEnrolled(),
  //     ]);
  //     setBiometricAvailable(Boolean(hasHardware && enrolled));
  //     if (hasHardware && enrolled) {
  //       const enabled = await getBiometricEnabled();
  //       setBiometricEnabledState(enabled);
  //     }
  //   })();
  // }, []);

  const displayName = user?.fullName?.trim() || "John Doe";
  const userWithPhone = user as (typeof user & { phoneNumber?: string; profileImageUrl?: string }) | null;
  const displayPhone = userWithPhone?.phoneNumber?.trim() || "+1 234 567 890";

  /**
   * Handle logout
   */
  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              router.dismissTo("/");
            } catch (error) {
              console.error("Logout error:", error);
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    // TODO: Navigate to edit profile screen
    Alert.alert("Info", "Edit profile feature coming soon");
  };

  const handlePaymentMethods = () => {
    router.push('/payments/saved-payment-methods');
  };

  const handleAddressBook = () => {
    Alert.alert("Info", "Address book feature coming soon");
  };

  const handleHelpSupport = () => {
    Alert.alert("Info", "Help & support feature coming soon");
  };

  const handleChangePhoto = () => {
    Alert.alert("Info", "Change photo feature coming soon");
  };

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setValidationError(null);
    resetChangePassword();
  };

  const handleCloseChangePasswordModal = () => {
    setShowChangePasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setValidationError(null);
    resetChangePassword();
  };

  const validatePasswords = (): boolean => {
    if (!currentPassword) {
      setValidationError("Current password is required");
      return false;
    }
    if (!newPassword || newPassword.length < 8) {
      setValidationError("New password must be at least 8 characters");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match");
      return false;
    }
    if (currentPassword === newPassword) {
      setValidationError("New password must be different from current password");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmitChangePassword = async () => {
    if (!validatePasswords()) {
      return;
    }
    
    try {
      await changePassword({
        currentPassword,
        newPassword,
      });
    } catch (err) {
      // Error is handled by hook
      console.error("Change password error:", err);
    }
  };

  // Handle successful password change
  React.useEffect(() => {
    if (passwordChanged) {
      Alert.alert(
        "Password Changed",
        "Your password has been changed successfully. Please login again.",
        [
          {
            text: "OK",
            onPress: async () => {
              handleCloseChangePasswordModal();
              await logout();
              router.dismissTo("/");
            },
          },
        ]
      );
    }
  }, [passwordChanged]);

  return (
    <View style={[styles.container, { backgroundColor: "#fff", paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: PROFILE_CARD_BORDER }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* User Identity Section */}
        <View style={styles.identitySection}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarRing, { borderColor: BeeColors.yellow[400] }]}>
              <View style={[styles.avatarInner, { backgroundColor: theme.surface }]}>
                {userWithPhone?.profileImageUrl ? (
                  <Image
                    source={{ uri: userWithPhone.profileImageUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={48} color={theme.textSecondary} />
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.editPhotoButton, { backgroundColor: BeeColors.yellow[400] }]}
              onPress={handleChangePhoto}
              activeOpacity={0.9}
            >
              <Ionicons name="pencil" size={18} color="#111827" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.userPhone, { color: BeeColors.yellow[600] }]} numberOfLines={1}>
            {displayPhone}
          </Text>
        </View>

        {/* Options List */}
        <View style={styles.optionsSection}>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleEditProfile}
            activeOpacity={0.98}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
              <Ionicons name="person" size={22} color={theme.text} />
            </View>
            <Text style={[styles.optionLabel, { color: theme.text }]}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={handlePaymentMethods}
            activeOpacity={0.98}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
              <Ionicons name="card" size={22} color={theme.text} />
            </View>
            <Text style={[styles.optionLabel, { color: theme.text }]}>Payment Methods</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleAddressBook}
            activeOpacity={0.98}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
              <Ionicons name="location" size={22} color={theme.text} />
            </View>
            <Text style={[styles.optionLabel, { color: theme.text }]}>Address Book</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleHelpSupport}
            activeOpacity={0.98}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
              <Ionicons name="help-circle" size={22} color={theme.text} />
            </View>
            <Text style={[styles.optionLabel, { color: theme.text }]}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleChangePassword}
            activeOpacity={0.98}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
              <Ionicons name="lock-closed" size={22} color={theme.text} />
            </View>
            <Text style={[styles.optionLabel, { color: theme.text }]}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>

          {/* Biometric login disabled for now */}
          {/* {biometricAvailable && biometricEnabled !== null && (
            <View style={styles.optionCard}>
              <View style={[styles.optionIconWrap, { backgroundColor: BeeColors.yellow[400] + "33" }]}>
                <Ionicons name="finger-print" size={22} color={theme.text} />
              </View>
              <Text style={[styles.optionLabel, { color: theme.text }]}>Login with Face ID</Text>
              <Switch
                value={biometricEnabled}
                onValueChange={async (value) => {
                  await setBiometricEnabled(value);
                  setBiometricEnabledState(value);
                }}
                trackColor={{ false: theme.border, true: BeeColors.yellow[400] }}
                thumbColor="#fff"
              />
            </View>
          )} */}
        </View>

        {/* Footer: Logout + security note */}
        <View style={styles.footerSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.98}
          >
            <Ionicons name="log-out-outline" size={22} color={BeeColors.red[600]} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          <Text style={[styles.securityNote, { color: theme.textSecondary }]}>
            Note: For your security, you will be automatically logged out when your session expires.
          </Text>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseChangePasswordModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
                <TouchableOpacity
                  onPress={handleCloseChangePasswordModal}
                  style={styles.modalCloseButton}
                  disabled={isChangingPassword}
                >
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Current Password Input */}
              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { color: theme.text }]}>Current Password</Text>
                <View style={[styles.modalInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={theme.textSecondary}
                    style={styles.modalInputIcon}
                  />
                  <TextInput
                    style={[styles.modalInput, { color: theme.text }]}
                    placeholder="Enter current password"
                    placeholderTextColor={theme.placeholder}
                    value={currentPassword}
                    onChangeText={(text) => {
                      setCurrentPassword(text);
                      setValidationError(null);
                    }}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isChangingPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.modalVisibilityButton}
                  >
                    <Ionicons
                      name={showCurrentPassword ? "eye-off" : "eye"}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password Input */}
              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { color: theme.text }]}>New Password</Text>
                <View style={[styles.modalInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={theme.textSecondary}
                    style={styles.modalInputIcon}
                  />
                  <TextInput
                    style={[styles.modalInput, { color: theme.text }]}
                    placeholder="Enter new password"
                    placeholderTextColor={theme.placeholder}
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      setValidationError(null);
                    }}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isChangingPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.modalVisibilityButton}
                  >
                    <Ionicons
                      name={showNewPassword ? "eye-off" : "eye"}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { color: theme.text }]}>Confirm New Password</Text>
                <View style={[styles.modalInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={theme.textSecondary}
                    style={styles.modalInputIcon}
                  />
                  <TextInput
                    style={[styles.modalInput, { color: theme.text }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={theme.placeholder}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setValidationError(null);
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isChangingPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.modalVisibilityButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error Message */}
              {(changePasswordError || validationError) && (
                <View style={styles.modalErrorContainer}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={BeeColors.red[600]}
                  />
                  <Text style={styles.modalErrorText}>{changePasswordError || validationError}</Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  { backgroundColor: BeeColors.yellow[400] },
                  isChangingPassword && styles.modalSubmitButtonDisabled
                ]}
                onPress={handleSubmitChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                activeOpacity={0.98}
              >
                <Text style={styles.modalSubmitButtonText}>
                  {isChangingPassword ? "Changing Password..." : "Change Password"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: "#fff",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  identitySection: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  avatarRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    padding: 4,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  editPhotoButton: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  userPhone: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionsSection: {
    paddingHorizontal: 16,
    gap: 8,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PROFILE_CARD_BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    gap: 16,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  footerSection: {
    marginTop: 40,
    paddingHorizontal: 16,
    gap: 24,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BeeColors.red[50],
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BeeColors.red[200],
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: BeeColors.red[600],
  },
  securityNote: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: 40,
  },
  modalScrollContent: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalInputGroup: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  modalInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 56,
  },
  modalInputIcon: {
    marginRight: 12,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
  },
  modalVisibilityButton: {
    padding: 4,
  },
  modalErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BeeColors.red[50],
    borderWidth: 1,
    borderColor: BeeColors.red[200],
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 14,
    color: BeeColors.red[700],
  },
  modalSubmitButton: {
    width: "100%",
    height: 56,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  modalSubmitButtonDisabled: {
    opacity: 0.6,
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
  },
});
