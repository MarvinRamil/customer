import { useCallback, useEffect, useRef, useState } from 'react';
import type { Href } from 'expo-router';
import { WELCOME_SCREEN_ENABLED } from '@/constants/features';
import { welcomeStorage } from '@/shared/services/welcomeStorage';

/**
 * Where an authenticated, KYC-verified user should land: the one-time
 * `/welcome` screen (first time only, per account) or straight into
 * `/(tabs)` afterward. Replaces the old static POST_AUTH_ROUTE constant,
 * which always pointed at `/welcome` and never let users past it.
 */
export function usePostAuthDestination(userId: string | null | undefined) {
  const [destination, setDestination] = useState<Href | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const autoMarkedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setDestination(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    (async () => {
      if (!WELCOME_SCREEN_ENABLED) {
        // Users never get a chance to tap "Got it" while the screen is
        // disabled — mark them seen so re-enabling the flag later doesn't
        // suddenly surface welcome to existing accounts.
        if (autoMarkedRef.current !== userId) {
          autoMarkedRef.current = userId;
          await welcomeStorage.setWelcomeSeen(userId);
        }
        if (!cancelled) {
          setDestination('/(tabs)' as Href);
          setIsLoading(false);
        }
        return;
      }

      const hasSeen = await welcomeStorage.hasSeenWelcome(userId);
      if (!cancelled) {
        setDestination((hasSeen ? '/(tabs)' : '/welcome') as Href);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markWelcomeSeen = useCallback(async () => {
    if (!userId) return;
    await welcomeStorage.setWelcomeSeen(userId);
    setDestination('/(tabs)' as Href);
  }, [userId]);

  return { destination, isLoading, markWelcomeSeen };
}
