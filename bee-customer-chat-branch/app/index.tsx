import { BeeColors } from "@/constants/theme";
import { useAuth } from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import { usePostAuthDestination } from "@/shared/hooks/usePostAuthDestination";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

/**
 * Root route — delegates to the correct entry screen:
 * - loading while session initializes
 * - signed out → login
 * - signed in but liveness incomplete → liveness
 * - signed in with liveness done → the one-time /welcome screen (first time
 *   only, per account) or straight to the tabs afterward
 */
export default function Index() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isInitializing } = useAuth();
  const { destination } = usePostAuthDestination(user?.id);

  const livenessVerifiedAt =
    user?.livenessVerifiedAt ?? (user as { LivenessVerifiedAt?: string } | null)?.LivenessVerifiedAt;

  useEffect(() => {
    if (isInitializing || user === null || !livenessVerifiedAt || !destination) {
      return;
    }
    router.replace(destination);
  }, [isInitializing, user, livenessVerifiedAt, destination, router]);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={BeeColors.yellow[500]} />
      </View>
    );
  }

  if (user === null) {
    return <Redirect href="/login" />;
  }

  if (!livenessVerifiedAt) {
    return <Redirect href={"/kyc-verification" as any} />;
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}>
      <ActivityIndicator size="large" color={BeeColors.yellow[500]} />
    </View>
  );
}
