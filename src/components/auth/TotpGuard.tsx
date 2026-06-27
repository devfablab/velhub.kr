'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Verify2fa from '@/components/auth/Verify2fa';
import { LoadingIndicator } from '@/components/LoadingIndicator';

function TotpLayout() {
  return (
    <>
      <Verify2fa />
      <main>
        <div className="container">
          <div
            className="content"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LoadingIndicator />
          </div>
        </div>
      </main>
    </>
  );
}

export default function TotpGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [needsTotp, setNeedsTotp] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function checkTotpStatus() {
      const response = await fetch('/api/auth/2fa-status', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        if (isActive) {
          setNeedsTotp(false);
        }

        return;
      }

      const result = await response.json();

      if (isActive) {
        setNeedsTotp(Boolean(result.needsTotp));
      }
    }

    void checkTotpStatus();

    return () => {
      isActive = false;
    };
  }, [pathname]);

  if (needsTotp) {
    return <TotpLayout />;
  }

  return children;
}
