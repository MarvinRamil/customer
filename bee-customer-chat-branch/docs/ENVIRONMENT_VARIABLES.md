# Environment Variables Configuration Guide

This guide explains how to configure branch-based environment variables for the Bee Customer App.

> **📚 For Technical Details**: See [Environment Variables Technical Guide](./ENVIRONMENT_VARIABLES_TECHNICAL.md) for in-depth explanation of how environment variables work in Expo, why we use `Constants.expoConfig`, and the build-time vs runtime differences.

## Overview

The app uses different environment configurations based on the Git branch:
- **`features` branch** → `development` environment
- **`dev` branch** → `staging` environment  
- **`main`/`master` branch** → `production` environment

## How It Works

### 1. Branch Detection

The CI pipeline automatically detects the branch and sets environment variables:

```bash
# Features branch → development
export CI_ENVIRONMENT_NAME="development"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL_DEVELOPMENT}"
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEVELOPMENT}"
export EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN="${EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_DEVELOPMENT}"
export EXPO_PUBLIC_MQTT_HOST="${EXPO_PUBLIC_MQTT_HOST_DEVELOPMENT}"
export EXPO_PUBLIC_MQTT_PORT="${EXPO_PUBLIC_MQTT_PORT_DEVELOPMENT}"
export EXPO_PUBLIC_MQTT_USERNAME="${EXPO_PUBLIC_MQTT_USERNAME_DEVELOPMENT}"
export EXPO_PUBLIC_MQTT_PASSWORD="${EXPO_PUBLIC_MQTT_PASSWORD_DEVELOPMENT}"

# Dev branch → staging
export CI_ENVIRONMENT_NAME="staging"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL_STAGING}"
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_STAGING}"
export EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN="${EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_STAGING}"
export EXPO_PUBLIC_MQTT_HOST="${EXPO_PUBLIC_MQTT_HOST_STAGING}"
export EXPO_PUBLIC_MQTT_PORT="${EXPO_PUBLIC_MQTT_PORT_STAGING}"
export EXPO_PUBLIC_MQTT_USERNAME="${EXPO_PUBLIC_MQTT_USERNAME_STAGING}"
export EXPO_PUBLIC_MQTT_PASSWORD="${EXPO_PUBLIC_MQTT_PASSWORD_STAGING}"

# Main/Master branch → production
export CI_ENVIRONMENT_NAME="production"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL_PRODUCTION}"
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_PRODUCTION}"
export EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN="${EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_PRODUCTION}"
export EXPO_PUBLIC_MQTT_HOST="${EXPO_PUBLIC_MQTT_HOST_PRODUCTION}"
export EXPO_PUBLIC_MQTT_PORT="${EXPO_PUBLIC_MQTT_PORT_PRODUCTION}"
export EXPO_PUBLIC_MQTT_USERNAME="${EXPO_PUBLIC_MQTT_USERNAME_PRODUCTION}"
export EXPO_PUBLIC_MQTT_PASSWORD="${EXPO_PUBLIC_MQTT_PASSWORD_PRODUCTION}"
```

### 2. app.config.js

The `app.config.js` file reads these environment variables and configures the app accordingly:

```javascript
const ENV = getEnvironment(); // Detects branch from CI_COMMIT_REF_NAME
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5248';
```

**API URL format:** Use the **base URL only** — do **not** include `/api` or a trailing slash. The app uses paths like `/api/bookings` and `/api/auth/login`; the client builds the full URL as `baseURL + path`. Example: `https://api.mybeeapp.com` (not `https://api.mybeeapp.com/api`).

## GitLab CI/CD Variables Setup

### Step 1: Go to GitLab CI/CD Variables

1. Navigate to your GitLab project
2. Go to: **Settings → CI/CD → Variables**
3. Expand the **Variables** section

### Step 2: Add Environment-Specific Variables

Add variables with **Environment scope** to target specific branches:

#### For Development (features branch)

| Key | Value | Environment scope | Protected | Masked |
|-----|-------|------------------|-----------|--------|
| `EXPO_PUBLIC_API_URL_DEVELOPMENT` | `http://localhost:5248` | `features` | ❌ | ❌ |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEVELOPMENT` | `your-dev-api-key` | `features` | ❌ | ✅ |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_DEVELOPMENT` | `your-mapbox-token` | `features` | ❌ | ✅ |
| `EXPO_PUBLIC_MQTT_HOST_DEVELOPMENT` | `dev-mqtt.yourdomain.com` | `features` | ❌ | ❌ |
| `EXPO_PUBLIC_MQTT_PORT_DEVELOPMENT` | `80` | `features` | ❌ | ❌ |
| `EXPO_PUBLIC_MQTT_USERNAME_DEVELOPMENT` | `dev-username` | `features` | ❌ | ❌ |
| `EXPO_PUBLIC_MQTT_PASSWORD_DEVELOPMENT` | `dev-password` | `features` | ❌ | ✅ |

#### For Staging (dev branch)

| Key | Value | Environment scope | Protected | Masked |
|-----|-------|------------------|-----------|--------|
| `EXPO_PUBLIC_API_URL_STAGING` | `https://api-staging.yourdomain.com` | `dev` | ❌ | ❌ |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_STAGING` | `your-staging-api-key` | `dev` | ❌ | ✅ |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_STAGING` | `your-mapbox-token` | `dev` | ❌ | ✅ |
| `EXPO_PUBLIC_MQTT_HOST_STAGING` | `staging-mqtt.yourdomain.com` | `dev` | ❌ | ❌ |
| `EXPO_PUBLIC_MQTT_PORT_STAGING` | `80` | `dev` | ❌ | ❌ |
| `EXPO_PUBLIC_MQTT_USERNAME_STAGING` | `staging-username` | `dev` | ❌ | ❌ |
| `EXPO_PUBLIC_MQTT_PASSWORD_STAGING` | `staging-password` | `dev` | ❌ | ✅ |

#### For Production (main/master branch)

| Key | Value | Environment scope | Protected | Masked |
|-----|-------|------------------|-----------|--------|
| `EXPO_PUBLIC_API_URL_PRODUCTION` | `https://api.yourdomain.com` | `main` | ✅ | ❌ |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_PRODUCTION` | `your-production-api-key` | `main` | ✅ | ✅ |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_PRODUCTION` | `your-mapbox-token` | `main` | ✅ | ✅ |
| `EXPO_PUBLIC_MQTT_HOST_PRODUCTION` | `mqtt.yourdomain.com` | `main` | ✅ | ❌ |
| `EXPO_PUBLIC_MQTT_PORT_PRODUCTION` | `80` | `main` | ✅ | ❌ |
| `EXPO_PUBLIC_MQTT_USERNAME_PRODUCTION` | `prod-username` | `main` | ✅ | ❌ |
| `EXPO_PUBLIC_MQTT_PASSWORD_PRODUCTION` | `prod-password` | `main` | ✅ | ✅ |

### Step 3: Add Fallback Variables (Optional)

You can also add variables without environment scope as fallbacks:

| Key | Value | Environment scope | Protected | Masked |
|-----|-------|------------------|-----------|--------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:5248` | `*` (all) | ❌ | ❌ |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `your-default-api-key` | `*` (all) | ❌ | ✅ |

**Note:** Environment-specific variables take priority over fallback variables.

## Variable Priority

The app uses variables in this order (highest to lowest priority):

1. `EXPO_PUBLIC_API_URL_${ENV}` (e.g., `EXPO_PUBLIC_API_URL_PRODUCTION`)
2. `EXPO_PUBLIC_API_URL` (fallback)
3. Default value in code

## Required Variables

### API Configuration

- `EXPO_PUBLIC_API_URL_DEVELOPMENT` - API URL for features branch
- `EXPO_PUBLIC_API_URL_STAGING` - API URL for dev branch
- `EXPO_PUBLIC_API_URL_PRODUCTION` - API URL for main/master branch

### Google Maps API Keys

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEVELOPMENT` - Maps API key for features branch
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_STAGING` - Maps API key for dev branch
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_PRODUCTION` - Maps API key for main/master branch

### Map provider and Mapbox (see docs/plans/mapbox-migration-plan.md)

- `EXPO_PUBLIC_MAP_PROVIDER` - Active map provider. When **unset**, the app defaults to **mapbox**. Set to `google` to use Google for directions, geocoding, and place search. Google API key and config are kept; both providers remain available.
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` - Mapbox public access token (required when provider is mapbox). Optional env-specific: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_DEVELOPMENT`, `_STAGING`, `_PRODUCTION`.

### Sentry / GlitchTip (crash & error reporting)

- `EXPO_PUBLIC_SENTRY_DSN` - DSN for the self-hosted GlitchTip instance (Sentry-protocol compatible). Single value across all environments — events are segmented by the `environment` tag (`extra.environment` in `app.config.js`), not by a separate DSN per branch. See [docs/plans/sentry-glitchtip-integration-plan.md](plans/sentry-glitchtip-integration-plan.md) and [docs/PLAY_DATA_SAFETY.md](PLAY_DATA_SAFETY.md).
- `SENTRY_AUTH_TOKEN` - **Not an `EXPO_PUBLIC_*` var** — must never be committed or embedded in the app bundle. Only needed at build/update time (`expo prebuild`, `eas update`) to upload source maps; stored as an **EAS secret** (`eas secret:create`), not in `.env`.

### MQTT Configuration (Optional)

- `EXPO_PUBLIC_MQTT_HOST_DEVELOPMENT` - MQTT broker host for features branch
- `EXPO_PUBLIC_MQTT_PORT_DEVELOPMENT` - MQTT broker port for features branch
- `EXPO_PUBLIC_MQTT_USERNAME_DEVELOPMENT` - MQTT username for features branch
- `EXPO_PUBLIC_MQTT_PASSWORD_DEVELOPMENT` - MQTT password for features branch
- `EXPO_PUBLIC_MQTT_HOST_STAGING` - MQTT broker host for dev branch
- `EXPO_PUBLIC_MQTT_PORT_STAGING` - MQTT broker port for dev branch
- `EXPO_PUBLIC_MQTT_USERNAME_STAGING` - MQTT username for dev branch
- `EXPO_PUBLIC_MQTT_PASSWORD_STAGING` - MQTT password for dev branch
- `EXPO_PUBLIC_MQTT_HOST_PRODUCTION` - MQTT broker host for main/master branch
- `EXPO_PUBLIC_MQTT_PORT_PRODUCTION` - MQTT broker port for main/master branch
- `EXPO_PUBLIC_MQTT_USERNAME_PRODUCTION` - MQTT username for main/master branch
- `EXPO_PUBLIC_MQTT_PASSWORD_PRODUCTION` - MQTT password for main/master branch

**Note:** MQTT variables are optional. If not set, the app will fall back to base variables (`EXPO_PUBLIC_MQTT_HOST`, `EXPO_PUBLIC_MQTT_PORT`, etc.) or default values in code. The broker URL is automatically constructed from host and port as `mqtt://${HOST}:${PORT}`.

### Android Signing (Required for all branches)

- `CUSTOMER_ANDROID_KEYSTORE_BASE64` - Base64 encoded keystore
- `CUSTOMER_ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `CUSTOMER_ANDROID_KEY_ALIAS` - Key alias
- `CUSTOMER_ANDROID_KEY_PASSWORD` - Key password

### Google Play Store Deployment

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` - Google Play service account JSON (for all branches)

## Auto-Version Increment

The CI/CD pipeline automatically increments the app version number on each build:

### How It Works

1. **Reads current version** from `app.config.js` (e.g., `1.0.0`)
2. **Increments patch version** (third octet) by 1 (e.g., `1.0.0` → `1.0.1`)
3. **Updates both files**:
   - `app.config.js` - Expo version
   - `package.json` - npm package version
4. **Uses new version** for APK/AAB file naming

### Version Format

Versions follow semantic versioning: `MAJOR.MINOR.PATCH`

- **Major**: Breaking changes (manually updated)
- **Minor**: New features (manually updated)
- **Patch**: Bug fixes (auto-incremented on each build)

### File Naming

Built artifacts are named with version and build number:

- **Features branch**: `app-release-test_v1.0.1_build123.apk`
- **Dev branch**: `app-release-staging_v1.0.1_build123.apk`
- **Main/Master**: `app-release-v1.0.1_build123.apk`

### Example

```bash
# Build 1: Version 1.0.0 → 1.0.1
Current version: 1.0.0
New version: 1.0.1

# Build 2: Version 1.0.1 → 1.0.2
Current version: 1.0.1
New version: 1.0.2
```

### Manual Version Updates

To update major or minor version, manually edit `app.config.js`:

```javascript
version: "2.0.0"  // Next build will be 2.0.1
```

## How to Add Variables in GitLab

### Method 1: Using GitLab UI

1. Go to **Settings → CI/CD → Variables**
2. Click **Add variable**
3. Fill in:
   - **Key**: `EXPO_PUBLIC_API_URL_DEVELOPMENT`
   - **Value**: `http://localhost:5248`
   - **Type**: Variable
   - **Environment scope**: `features` (or `*` for all)
   - **Flags**: 
     - ✅ **Protect variable** (only for production)
     - ✅ **Mask variable** (for sensitive data like API keys)
4. Click **Add variable**

### Method 2: Using GitLab API

```bash
curl --request POST \
  --header "PRIVATE-TOKEN: <your-token>" \
  --data "key=EXPO_PUBLIC_API_URL_DEVELOPMENT" \
  --data "value=http://localhost:5248" \
  --data "environment_scope=features" \
  "https://gitlab.com/api/v4/projects/<project-id>/variables"
```

## Local Development Setup

### Step 1: Create .env File

Copy the example file:

```bash
cp .env.example .env
```

### Step 2: Configure Your .env File

Edit `.env` and set your local values:

```env
# Set environment (optional, defaults to 'development')
EXPO_PUBLIC_ENV=development

# API URL for local development
EXPO_PUBLIC_API_URL=http://localhost:5248

# Google Maps API Key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_local_api_key_here

# MQTT Configuration (optional)
EXPO_PUBLIC_MQTT_HOST=localhost
EXPO_PUBLIC_MQTT_PORT=1883
EXPO_PUBLIC_MQTT_USERNAME=your_mqtt_username
EXPO_PUBLIC_MQTT_PASSWORD=your_mqtt_password
```

### Step 3: Start Expo

```bash
# Clear cache and start
npx expo start --clear
```

The app will automatically use values from your `.env` file.

### Local Environment Detection

When running locally (not in CI), `app.config.js` will:
1. Check `EXPO_PUBLIC_ENV` (if set)
2. Check `NODE_ENV` (if set)
3. Default to `development`

### Override Environment Locally

You can override the environment:

```bash
# Development (default)
npx expo start

# Staging
EXPO_PUBLIC_ENV=staging npx expo start

# Production
EXPO_PUBLIC_ENV=production npx expo start
```

## Related Documentation

- **[Environment Variables Technical Guide](./ENVIRONMENT_VARIABLES_TECHNICAL.md)** - In-depth technical explanation of how environment variables work in Expo, build-time vs runtime, why we use `Constants.expoConfig`, and troubleshooting

## Testing Environment Variables

### Check Variables Locally

Enable debug mode to see environment info:

```bash
EXPO_PUBLIC_DEBUG=true npx expo start
```

You'll see logs like:
```
[app.config.js] Environment: development
[app.config.js] Is CI: false
[app.config.js] API URL: http://localhost:5248
```

### Check Variables in CI Logs

The CI pipeline logs will show which environment is detected:

```
=== Setting environment variables based on branch ===
Branch: features
Environment: development
API URL: http://localhost:5248
```

### Verify in app.config.js

The `app.config.js` logs environment info during CI builds:

```
[app.config.js] Environment: development
[app.config.js] Is CI: true
[app.config.js] API URL: http://localhost:5248
```

## Example Configuration

### Development (features branch)

```env
EXPO_PUBLIC_API_URL_DEVELOPMENT=http://localhost:5248
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEVELOPMENT=AIzaSyDev123...
EXPO_PUBLIC_MQTT_HOST_DEVELOPMENT=dev-mqtt.yourdomain.com
EXPO_PUBLIC_MQTT_PORT_DEVELOPMENT=80
EXPO_PUBLIC_MQTT_USERNAME_DEVELOPMENT=dev-username
EXPO_PUBLIC_MQTT_PASSWORD_DEVELOPMENT=dev-password
```

### Staging (dev branch)

```env
EXPO_PUBLIC_API_URL_STAGING=https://api-staging.yourdomain.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_STAGING=AIzaSyStaging123...
EXPO_PUBLIC_MQTT_HOST_STAGING=staging-mqtt.yourdomain.com
EXPO_PUBLIC_MQTT_PORT_STAGING=80
EXPO_PUBLIC_MQTT_USERNAME_STAGING=staging-username
EXPO_PUBLIC_MQTT_PASSWORD_STAGING=staging-password
```

### Production (main/master branch)

```env
EXPO_PUBLIC_API_URL_PRODUCTION=https://api.yourdomain.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_PRODUCTION=AIzaSyProd123...
EXPO_PUBLIC_MQTT_HOST_PRODUCTION=mqtt.yourdomain.com
EXPO_PUBLIC_MQTT_PORT_PRODUCTION=80
EXPO_PUBLIC_MQTT_USERNAME_PRODUCTION=prod-username
EXPO_PUBLIC_MQTT_PASSWORD_PRODUCTION=prod-password
```

## Troubleshooting

### Variables Not Being Used

1. **Check environment scope**: Ensure the variable's environment scope matches your branch
2. **Check variable name**: Use exact names like `EXPO_PUBLIC_API_URL_DEVELOPMENT`
3. **Check CI logs**: Look for "Setting environment variables based on branch" section

### Wrong Environment Detected

- Verify branch name matches: `features`, `dev`, `main`, or `master`
- Check `CI_COMMIT_REF_NAME` in CI logs

### Variables Not Available in App

- Ensure variables start with `EXPO_PUBLIC_` prefix (required by Expo)
- Restart Expo after adding variables: `npx expo start --clear`
- Check `app.config.js` logs for environment detection

## Security Best Practices

1. **Mask sensitive variables**: Enable "Mask variable" for API keys and passwords
2. **Protect production variables**: Enable "Protect variable" for production-only variables
3. **Use environment scopes**: Limit variables to specific branches when possible
4. **Never commit secrets**: Keep all sensitive data in GitLab CI/CD variables, not in code

## Additional Resources

- [GitLab CI/CD Variables Documentation](https://docs.gitlab.com/ee/ci/variables/)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [Environment Variables in app.config.js](https://docs.expo.dev/workflow/configuration/#environment-variables)
