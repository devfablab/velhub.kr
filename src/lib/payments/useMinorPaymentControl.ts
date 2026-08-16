'use client';

import { useEffect, useState } from 'react';

export function useMinorPaymentControl() {
  const [mode, setMode] = useState<'blocked_until_adult' | 'guardian_auth_required' | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/payments/minor-control', { cache: 'no-store', credentials: 'include' })
      .then((response) => response.json())
      .then((result: { mode?: 'blocked_until_adult' | 'guardian_auth_required' | null }) => {
        if (active) setMode(result.mode ?? null);
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return { mode, isLoaded, isBlocked: mode === 'blocked_until_adult' };
}
