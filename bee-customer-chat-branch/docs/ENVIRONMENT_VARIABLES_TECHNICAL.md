# Environment Variables Technical Guide

This document explains the technical details of how environment variables work in Expo/React Native applications, including local development and CI/CD builds.

## Table of Contents

1. [Overview](#overview)
2. [Build-Time vs Runtime Variables](#build-time-vs-runtime-variables)
3. [How Expo Handles Environment Variables](#how-expo-handles-environment-variables)
4. [Local Development Flow](#local-development-flow)
5. [CI/CD Build Flow](#cicd-build-flow)
6. [Why We Use Constants.expoConfig](#why-we-use-constantsexpoconfig)
7. [The Complete Flow](#the-complete-flow)
8. [Troubleshooting](#troubleshooting)

## Overview

In Expo/React Native applications, environment variables work differently than in traditional web applications. Understanding these differences is crucial for proper configuration.

### Key Concepts

- **Build-Time Variables**: Variables that are embedded into the app bundle during the build process
- **Runtime Variables**: Variables that are available when the app is running
- **app.config.js**: Configuration file that runs during the build process (Node.js context)
- **Constants.expoConfig**: Runtime access to values embedded in the app bundle

## Build-Time vs Runtime Variables

### Build-Time (app.config.js)

When `app.config.js` runs, it executes in a **Node.js environment** during the build/prebuild phase. At this stage:

- ✅ You can use Node.js APIs (like `require('dotenv')`)
- ✅ You can read `.env` files using `dotenv`
- ✅ You can access `process.env` variables
- ✅ Variables are embedded into the app bundle

**Important**: Variables must be available when `app.config.js` runs, not when the app runs.

### Runtime (React Native App)

When your React Native app runs on a device/emulator:

- ❌ You **cannot** use Node.js APIs
- ❌ You **cannot** read `.env` files directly
- ⚠️ `process.env.EXPO_PUBLIC_*` variables are embedded at build time (if available)
- ✅ You can access values via `Constants.expoConfig.extra` (most reliable)

**Important**: `process.env.EXPO_PUBLIC_*` variables in the app are **static values** embedded during the build. They don't change after the app is built.

## How Expo Handles Environment Variables

### Expo's EXPO_PUBLIC_* Convention

Expo automatically embeds `EXPO_PUBLIC_*` environment variables into the app bundle:

1. **During Build**: Expo looks for `EXPO_PUBLIC_*` variables in the environment
2. **Embedding**: These variables are embedded as static values in the JavaScript bundle
3. **Runtime Access**: The app can access them via `process.env.EXPO_PUBLIC_*`

### The Problem

**The issue**: Expo only embeds variables that are available in the environment when the build starts. If you have a `.env` file, Expo doesn't automatically load it.

### The Solution

We explicitly load the `.env` file in `app.config.js` using `dotenv`:

```javascript
// app.config.js
require('dotenv').config(); // Load .env file

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'default';
```

This ensures:
1. `.env` file is loaded when `app.config.js` runs
2. Variables are available in `process.env`
3. Expo can embed them into the bundle
4. Values are also stored in `extra` for reliable runtime access

## Local Development Flow

### Step-by-Step Process

1. **Developer starts Expo**:
   ```bash
   npx expo start --clear
   ```

2. **Expo loads app.config.js**:
   - `app.config.js` runs in Node.js context
   - `require('dotenv').config()` loads `.env` file
   - Variables are now in `process.env`

3. **app.config.js processes variables**:
   ```javascript
   // Load .env
   require('dotenv').config();
   
   // Read variable
   const API_URL = process.env.EXPO_PUBLIC_API_URL;
   
   // Store in extra for runtime access
   export default {
     extra: {
       apiUrl: API_URL,
     },
   };
   ```

4. **Expo embeds values**:
   - Expo reads `app.config.js` output
   - Embeds `EXPO_PUBLIC_*` variables into bundle
   - Stores `extra` values in `Constants.expoConfig`

5. **App runs**:
   - App can access `process.env.EXPO_PUBLIC_API_URL` (embedded value)
   - App can access `Constants.expoConfig.extra.apiUrl` (from config)

### Why We Need Both

- **`process.env.EXPO_PUBLIC_API_URL`**: Works, but only if the variable was embedded during build
- **`Constants.expoConfig.extra.apiUrl`**: More reliable because it's explicitly set in `app.config.js`

## CI/CD Build Flow

### Step-by-Step Process

1. **CI Pipeline starts**:
   ```yaml
   # .gitlab-ci.yml
   before_script:
     - export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL_PRODUCTION}"
   ```

2. **Environment variables are set**:
   - CI/CD sets environment variables based on branch
   - Variables are available in `process.env`

3. **Expo build runs**:
   ```bash
   npx expo prebuild
   npx expo build
   ```

4. **app.config.js runs**:
   - No `.env` file in CI (not committed to repo)
   - Reads from `process.env` (set by CI/CD)
   - Processes environment-specific variables:
     ```javascript
     const API_URL = getEnvVar('API_URL', {
       production: 'https://api.production.com',
       staging: 'https://api.staging.com',
     });
     ```

5. **Values embedded**:
   - `extra.apiUrl` contains the resolved value
   - App bundle includes the correct API URL

### Environment-Specific Variables

Our setup supports environment-specific variables:

```javascript
// app.config.js
const ENV = getEnvironment(); // 'development', 'staging', 'production'
const ENV_KEY = ENV.toUpperCase();

const API_URL = getEnvVar('API_URL', {
  // Priority:
  // 1. EXPO_PUBLIC_API_URL_PRODUCTION (if ENV === 'production')
  // 2. EXPO_PUBLIC_API_URL (fallback)
  // 3. Default value
});
```

**CI/CD sets variables like**:
- `EXPO_PUBLIC_API_URL_PRODUCTION` (for main branch)
- `EXPO_PUBLIC_API_URL_STAGING` (for dev branch)
- `EXPO_PUBLIC_API_URL_DEVELOPMENT` (for features branch)

## Why We Use Constants.expoConfig

### The Problem

`process.env.EXPO_PUBLIC_*` variables have limitations:

1. **Only available if embedded during build**: If the variable wasn't in the environment when Expo started, it won't be available
2. **Static values**: Once embedded, they don't change
3. **Unreliable in some scenarios**: Metro bundler might not always include them

### The Solution: Constants.expoConfig.extra

`Constants.expoConfig.extra` is more reliable because:

1. **Explicitly set**: We explicitly set values in `app.config.js`
2. **Always available**: If set in config, it's always in `Constants.expoConfig.extra`
3. **Type-safe**: Can be typed with TypeScript
4. **Consistent**: Works the same way in all environments

### Code Example

```typescript
// app.config.js
export default {
  extra: {
    apiUrl: API_URL, // Explicitly set
    environment: ENV,
  },
};

// In your app code
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.apiUrl;
// ✅ Always works if set in app.config.js
```

### Why Not Just process.env?

```typescript
// ❌ Might not work
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
// Problem: Only works if variable was embedded during build

// ✅ More reliable
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
// Problem: None - always works if set in app.config.js
```

## The Complete Flow

### Local Development

```
┌─────────────────┐
│   .env file     │
│ EXPO_PUBLIC_    │
│ API_URL=...     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  app.config.js  │
│ require('dotenv')│
│ .config()       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  process.env    │
│ EXPO_PUBLIC_    │
│ API_URL=...     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  app.config.js  │
│ extra: {        │
│   apiUrl: ...   │
│ }               │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Expo Bundle    │
│ - process.env   │
│ - Constants     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Your App       │
│ Constants.      │
│ expoConfig.     │
│ extra.apiUrl    │
└─────────────────┘
```

### CI/CD Build

```
┌─────────────────┐
│  GitLab CI/CD   │
│ Environment     │
│ Variables       │
│ EXPO_PUBLIC_    │
│ API_URL_        │
│ PRODUCTION=...  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  process.env    │
│ (set by CI)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  app.config.js  │
│ getEnvVar()     │
│ resolves value  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  app.config.js  │
│ extra: {        │
│   apiUrl: ...   │
│ }               │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Expo Bundle    │
│ - process.env   │
│ - Constants     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Your App       │
│ Constants.      │
│ expoConfig.     │
│ extra.apiUrl    │
└─────────────────┘
```

## Troubleshooting

### Problem: API URL is always "https://api.example.com"

**Cause**: `.env` file not loaded or variable not set

**Solution**:
1. Check `.env` file exists in project root
2. Verify variable name: `EXPO_PUBLIC_API_URL` (case-sensitive)
3. Restart Expo: `npx expo start --clear`
4. Check console logs for `.env` loading messages

### Problem: Variable works in app.config.js but not in app

**Cause**: Variable not embedded in bundle

**Solution**:
1. Use `Constants.expoConfig.extra.apiUrl` instead of `process.env.EXPO_PUBLIC_API_URL`
2. Ensure value is set in `app.config.js` `extra` section
3. Restart Expo to rebuild bundle

### Problem: Different values in local vs CI

**Cause**: Environment-specific variables not configured

**Solution**:
1. Check `getEnvVar()` function in `app.config.js`
2. Verify CI/CD sets correct environment-specific variables
3. Check environment detection logic

### Problem: Changes to .env don't take effect

**Cause**: Expo caches the bundle

**Solution**:
```bash
# Clear cache and restart
npx expo start --clear

# Or rebuild completely
rm -rf node_modules/.cache
npx expo start --clear
```

## Best Practices

### 1. Always Use Constants.expoConfig.extra

```typescript
// ✅ Recommended
const apiUrl = Constants.expoConfig?.extra?.apiUrl;

// ⚠️ Less reliable
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

### 2. Set Values in app.config.js extra

```javascript
// ✅ Always set in extra
export default {
  extra: {
    apiUrl: API_URL,
    environment: ENV,
  },
};
```

### 3. Load .env in app.config.js

```javascript
// ✅ Load .env explicitly
require('dotenv').config();
```

### 4. Use Environment-Specific Variables

```javascript
// ✅ Support multiple environments
const API_URL = getEnvVar('API_URL', {
  development: 'http://localhost:5248',
  staging: 'https://api-staging.com',
  production: 'https://api.production.com',
});
```

### 5. Document All Variables

- List all `EXPO_PUBLIC_*` variables in `.env.example`
- Document in `docs/ENVIRONMENT_VARIABLES.md`
- Include default values and descriptions

## Summary

1. **Build-Time**: `app.config.js` runs in Node.js, can load `.env` files
2. **Runtime**: App runs in React Native, can't load `.env` files
3. **Constants.expoConfig**: Most reliable way to access config values at runtime
4. **process.env.EXPO_PUBLIC_***: Works but less reliable, depends on build-time embedding
5. **Always restart Expo** after changing `.env` files
6. **Use `extra` section** in `app.config.js` for reliable runtime access

## Related Documentation

- [Environment Variables Configuration Guide](./ENVIRONMENT_VARIABLES.md) - User-facing guide
- [API Documentation](./API.md) - API endpoint documentation
- [CI/CD Configuration](../.gitlab-ci.yml) - CI/CD pipeline setup

