# Bee Customers App

A React Native application built with Expo for managing customer bookings and logistics operations.

## Tech Stack

- **Framework**: Expo ~54.0.30 with React Native 0.81.5
- **Language**: TypeScript (strict mode enabled)
- **Routing**: Expo Router ~6.0.21 (file-based routing)
- **Navigation**: React Navigation
- **State Management**: React Context API & Custom Hooks
- **Styling**: React Native StyleSheet with theme support
- **Safe Areas**: react-native-safe-area-context

## Project Structure

This project follows a **feature-based architecture** where code is organized by business features rather than technical layers.

```
bee-customers-app/
├── app/                    # Routes (Expo Router) - screens only
│   ├── _layout.tsx        # Root layout with SafeAreaProvider
│   ├── (tabs)/            # Tab navigation group
│   │   ├── _layout.tsx    # Tab layout
│   │   ├── index.tsx       # Dashboard screen
│   │   └── explore.tsx    # Bookings screen
│   ├── booking.tsx         # Booking creation screen
│   ├── tracking.tsx        # Tracking screen
│   └── modal.tsx           # Modal screen
│
├── features/               # Feature modules (business domains)
│   ├── auth/              # Authentication feature
│   │   ├── services/
│   │   │   └── tokenService.ts
│   │   ├── types.ts
│   │   └── index.ts       # Public API exports
│   │
│   └── bookings/          # Bookings feature
│       ├── components/
│       │   ├── BookingCard.tsx
│       │   └── StatusBadge.tsx
│       ├── hooks/
│       │   ├── useBookings.ts
│       │   └── useBookingStats.ts
│       ├── services/
│       │   └── bookingService.ts
│       ├── types.ts
│       └── index.ts        # Public API exports
│
├── shared/                 # Shared across features
│   ├── components/        # Reusable UI primitives
│   │   ├── BeeButton.tsx
│   │   ├── StatsCard.tsx
│   │   ├── themed-text.tsx
│   │   ├── themed-view.tsx
│   │   ├── external-link.tsx
│   │   ├── haptic-tab.tsx
│   │   └── ui/
│   │       ├── collapsible.tsx
│   │       └── icon-symbol.tsx
│   │
│   ├── hooks/             # Shared hooks
│   │   ├── use-color-scheme.ts
│   │   └── use-theme-color.ts
│   │
│   ├── services/          # Base services (API client, storage)
│   │   ├── apiClient.ts
│   │   └── tokenStorage.ts
│   │
│   └── types/             # Common types
│       ├── api.ts
│       └── booking.ts
│
├── constants/             # Constants and configuration
│   └── theme.ts          # Theme colors and styles
│
├── docs/                  # Documentation
│   ├── plans/            # Implementation plans
│   └── API.md            # API client documentation
│
└── components/            # Legacy components (being migrated)
```

## Architecture Principles

### Feature-Based Organization

- **Features** (`features/`): Business domain modules (auth, bookings, etc.)

  - Each feature is self-contained with its own components, hooks, services, and types
  - Features export a public API via `index.ts`
  - Other features import from feature's `index.ts`, not internal paths

- **Shared** (`shared/`): Cross-cutting concerns

  - UI primitives used across multiple features
  - Base services (API client, storage)
  - Common types and utilities
  - Shared hooks

- **App** (`app/`): Routes and screens only
  - Uses Expo Router file-based routing
  - Screens compose features and shared components
  - No business logic in screens

### Import Rules

```typescript
// ✅ CORRECT: Import from feature's public API
import { BookingCard, useBookings } from "@/features/bookings";

// ✅ CORRECT: Import shared components directly
import { BeeButton } from "@/shared/components/BeeButton";

// ❌ WRONG: Don't import from feature's internal paths
import { BookingCard } from "@/features/bookings/components/BookingCard";
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_API_URL=https://api.example.com
```

3. Start the development server:

```bash
npx expo start
```

4. Run on your preferred platform:

- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web browser
- Scan QR code with Expo Go app on your device

## Key Features

### Safe Area Handling

All screens properly handle safe areas to prevent content from overlapping system UI (notches, home indicators, status bars):

```typescript
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Screen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Content */}
      </ScrollView>
    </View>
  );
}
```

### API Integration

The app uses a centralized API client with automatic token injection:

```typescript
import { bookingService } from "@/features/bookings";

// Create a booking
const booking = await bookingService.createBooking({
  pickupLocation: "123 Main St",
  dropoffLocation: "456 Oak Ave",
  truckType: "Small Truck",
  scheduleDate: "2024-12-25",
});
```

See [docs/API.md](./docs/API.md) for detailed API documentation.

### Custom Hooks

Use custom hooks for data fetching:

```typescript
import { useBookings, useBookingStats } from "@/features/bookings";

function Dashboard() {
  const { stats, isLoading } = useBookingStats();
  const { bookings } = useBookings("All");

  // Use data...
}
```

## Development Guidelines

### Code Style

- Use TypeScript with strict mode
- Follow the feature-based architecture
- Add JSDoc comments to all functions, components, and hooks
- Use meaningful variable and function names
- Keep components small and focused

### Safe Area Handling

**CRITICAL**: All screens MUST use `useSafeAreaInsets()` and apply:

- `paddingTop: insets.top` to root container
- `paddingBottom: insets.bottom` to scrollable content and fixed bottom elements

### Type Safety

- No `any` types allowed
- Define proper interfaces for all data structures
- Use TypeScript's type inference where appropriate

### Component Patterns

- Use functional components with hooks
- Prefer named exports
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

## Documentation

- [API Client Documentation](./docs/API.md) - How to use the API client and services
- [Architecture Migration Plan](./docs/plans/architecture-migration-plan.md) - Detailed migration documentation

## Scripts

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web

# Type check
npm run type-check

# Lint code
npm run lint
```

## Contributing

1. Follow the feature-based architecture
2. Add JSDoc comments to all new code
3. Ensure TypeScript strict mode compliance
4. Handle safe areas on all screens
5. Write self-documenting code

## License

[Your License Here]
