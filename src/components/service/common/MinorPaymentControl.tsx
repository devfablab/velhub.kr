'use client';

import { type ReactNode, useState } from 'react';

export type MinorPaymentControlMode = 'blocked_until_adult' | 'guardian_auth_required' | null;

export type MinorPaymentControlResponse = {
  mode?: MinorPaymentControlMode;
  effectiveUntil?: string | null;
  error?: string;
};

export type MinorPaymentControlResult = {
  mode: MinorPaymentControlMode;
  isBlocked: boolean;
};

type Props = {
  children: (control: { check: () => void; isChecking: boolean }) => ReactNode;
  onResolved: (result: MinorPaymentControlResult) => void | Promise<void>;
  onError: (message: string) => void;
};

export default function MinorPaymentControl({ children, onResolved, onError }: Props) {
  const [isChecking, setIsChecking] = useState(false);

  async function check() {
    if (isChecking) {
      return;
    }

    try {
      setIsChecking(true);

      const response = await fetch('/api/payments/minor-control', {
        cache: 'no-store',
        credentials: 'include',
      });
      const result = (await response.json()) as MinorPaymentControlResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '결제 가능 여부를 확인하지 못했습니다.');
      }

      const mode = result.mode ?? null;
      await onResolved({ mode, isBlocked: mode === 'blocked_until_adult' });
    } catch (error) {
      onError(error instanceof Error ? error.message : '결제 가능 여부를 확인하지 못했습니다.');
    } finally {
      setIsChecking(false);
    }
  }

  return children({ check: () => void check(), isChecking });
}
