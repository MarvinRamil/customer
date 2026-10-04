import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BeeColors } from "@/constants/theme";

/**
 * Tab layout component that handles bottom tab navigation
 * Uses safe area insets to prevent tab bar from overlapping system UI
 * Always uses light mode - dark mode is disabled
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Tab bar colors (light mode only)
  const tabBarBackground = BeeColors.white;
  const tabBarBorder = BeeColors.gray[200];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tabBarBackground,
          borderTopColor: tabBarBorder,
          borderTopWidth: 1,
          height: 45 + insets.bottom + 16,
          paddingBottom: insets.bottom + 16,
          paddingTop: 6,
          paddingHorizontal: 16,
          position: "absolute",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 5,
        },
        tabBarActiveTintColor: BeeColors.yellow[400], // yellow-400 - primary brand color
        tabBarInactiveTintColor: BeeColors.gray[500],
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "500",
          marginTop: 1,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name="home"
              size={20}
              color={focused ? BeeColors.yellow[400] : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "time" : "time-outline"}
              size={20}
              color={focused ? BeeColors.yellow[400] : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={20}
              color={focused ? BeeColors.yellow[400] : color}
            />
          ),
        }}
      />
      {/* booking.tsx is a root-level route (app/booking.tsx), not a tab, so it shouldn't be defined here */}
    </Tabs>
  );
}
