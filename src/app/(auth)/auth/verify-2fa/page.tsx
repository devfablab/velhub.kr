'use client';

import Verify2fa from '@/components/auth/Verify2fa';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export default function Page() {
  return (
    <>
      <Verify2fa />
      <main>
        <div className="container">
          <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingIndicator />
          </div>
        </div>
      </main>
    </>
  );
}
