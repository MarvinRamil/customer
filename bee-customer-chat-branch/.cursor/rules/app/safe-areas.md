---
description: "Safe area handling for screens and tab bars – use useSafeAreaInsets(), never SafeAreaView for screens."
alwaysApply: true
---

# Safe Area Handling

All screens and full-screen components MUST handle safe areas so content does not overlap status bar, notch, or home indicator.

## Requirements

- **Root layout**: Wrap the app with `SafeAreaProvider` from `react-native-safe-area-context` in `app/_layout.tsx`.
- **Screens**: Use `useSafeAreaInsets()` – do NOT use React Native's `SafeAreaView` for screens.
- **Top**: Apply `paddingTop: insets.top` to the root container of every screen.
- **Bottom**: Apply `paddingBottom: insets.bottom` to scrollable content and fixed bottom elements (FABs, buttons).
- **Tab bars**: Include bottom inset in `tabBarStyle` (height and paddingBottom).
- **ScrollView/FlatList**: Include bottom safe area in `contentContainerStyle`.

## Screen pattern

```typescript
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ScreenComponent() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* content */}
      </ScrollView>
      <View style={{ paddingBottom: insets.bottom }}>
        {/* FAB, buttons */}
      </View>
    </View>
  );
}
```

## Tab bar pattern

```typescript
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
      }}
    />
  );
}
```

## Do NOT

- Use React Native's `SafeAreaView` for screens (use `useSafeAreaInsets` instead).
- Hardcode padding that ignores safe areas.
- Omit top safe area on screens or bottom safe area on scroll content or fixed bottom elements.

Exceptions: Small non–full-screen components or components always inside a safe-area-aware container do not need their own handling.
