import { apiClient } from '@/shared/services/apiClient';
import type { UpdateProfileRequest, UpdateProfileResponse } from '../types';

/**
 * Profile service
 * Handles API calls for user profile management
 */
class ProfileService {
  /**
   * Update user profile
   * @param data - Profile update data
   * @returns Promise resolving to UpdateProfileResponse
   * @throws Error if profile update fails
   */
  async updateProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    try {
      // TODO: Replace with actual API endpoint when available
      // const response = await apiClient.put<UpdateProfileResponse>('/profile', data, {
      //   requiresAuth: true,
      // });

      // Mock response for now
      const mockResponse: UpdateProfileResponse = {
        user: {
          id: 'mock-user-id',
          email: data.email || 'user@example.com',
          fullName: data.fullName || 'User',
          phoneNumber: data.phoneNumber,
          defaultPickupAddress: data.defaultPickupAddress,
        },
        message: 'Profile updated successfully',
      };

      return mockResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      throw new Error(errorMessage);
    }
  }

  /**
   * Change user password
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @returns Promise resolving when password is changed
   * @throws Error if password change fails
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // TODO: Replace with actual API endpoint when available
      // await apiClient.post('/profile/change-password', {
      //   currentPassword,
      //   newPassword,
      // }, {
      //   requiresAuth: true,
      // });

      // Mock success for now
      return Promise.resolve();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
      throw new Error(errorMessage);
    }
  }

  /**
   * Upload profile picture
   * @param imageUri - URI of the image to upload
   * @returns Promise resolving to image URL
   * @throws Error if upload fails
   */
  async uploadProfilePicture(imageUri: string): Promise<string> {
    try {
      // TODO: Replace with actual API endpoint when available
      // const formData = new FormData();
      // formData.append('image', {
      //   uri: imageUri,
      //   type: 'image/jpeg',
      //   name: 'profile.jpg',
      // });
      // const response = await apiClient.post<{ imageUrl: string }>('/profile/picture', formData, {
      //   requiresAuth: true,
      // });

      // Mock response for now
      return imageUri;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload profile picture';
      throw new Error(errorMessage);
    }
  }
}

export const profileService = new ProfileService();

