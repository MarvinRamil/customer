import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_login_enabled';

export async function hasBiometricHardware(): Promise<boolean> {
  return await LocalAuthentication.hasHardwareAsync();
}

export async function isBiometricEnrolled(): Promise<boolean> {
  return await LocalAuthentication.isEnrolledAsync();
}

export async function authenticateAsync(options?: { promptMessage?: string }): Promise<boolean> {
  const { success } = await LocalAuthentication.authenticateAsync({
    promptMessage: options?.promptMessage ?? 'Sign in to BEE APP',
  });
  return success;
}

export async function getBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  }
}
