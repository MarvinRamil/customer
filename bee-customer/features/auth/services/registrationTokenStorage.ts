import * as SecureStore from 'expo-secure-store';

const REGISTRATION_TOKEN_KEY = 'phone_registration_token';

export const registrationTokenStorage = {
  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REGISTRATION_TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REGISTRATION_TOKEN_KEY);
  },

  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(REGISTRATION_TOKEN_KEY);
  },
};
