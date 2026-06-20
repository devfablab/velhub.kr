import { Suspense } from 'react';
import Opt from './opt';

export default function Page() {
  return (
    <Suspense>
      <Opt />
    </Suspense>
  );
}
