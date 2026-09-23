import { type ReactNode } from 'react';
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

export default function TotpGuard({ children, needsTotp }: { children: ReactNode; needsTotp: boolean }) {
  if (needsTotp) {
    return <TotpLayout />;
  }

  return children;
}
