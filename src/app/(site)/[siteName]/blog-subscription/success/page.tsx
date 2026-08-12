import { Suspense } from 'react';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Opt from './opt';

export default function Page() {
  return (
    <Suspense fallback={<LoadingIndicator />}>
      <Opt />
    </Suspense>
  );
}
