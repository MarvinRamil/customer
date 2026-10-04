/**
 * Profile feature public API
 * This file exports all public components, hooks, services, and types from the profile feature
 * Other features should import from this file, not from internal paths
 */

// Export hooks
export { useProfile } from './hooks/useProfile';

// Export services
export { profileService } from './services/profileService';

// Export types
export type {
  ProfileStats,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from './types';

