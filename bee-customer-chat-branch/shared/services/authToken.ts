import { tokenStorage } from './tokenStorage';

/**
 * Single source of truth for "what bearer token should this request carry".
 *
 * Exists because non-HTTP transports (SignalR hubs) need the same token the API
 * client uses. Under Clerk the legacy `tokenStorage` is never populated — Clerk
 * keeps the session in its own store — so anything reading tokenStorage directly
 * silently gets null and authenticates as anonymous.
 */
let clerkTokenProvider: (() => Promise<string | null>) | null = null;

/** Register/clear the Clerk token provider. Called from a React effect inside ClerkProvider. */
export function setClerkTokenProvider(provider: (() => Promise<string | null>) | null): void {
  clerkTokenProvider = provider;
}

/** True once Clerk has wired up its provider. */
export function hasClerkTokenProvider(): boolean {
  return clerkTokenProvider !== null;
}

/**
 * Resolve a bearer token: Clerk first (it refreshes expired tokens internally),
 * falling back to legacy storage so pre-Clerk builds behave unchanged.
 * Returns null when no credential is available.
 */
export async function getAuthToken(): Promise<string | null> {
  if (clerkTokenProvider) {
    try {
      const token = await clerkTokenProvider();
      if (token) return token;
    } catch (err) {
      if (__DEV__) console.warn('[auth] Clerk token provider failed, falling back:', err);
    }
  }
  return await tokenStorage.getAccessToken();
}
