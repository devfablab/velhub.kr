'use client';

import { useParams } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';

export default function BillingButton() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  return (
    <Anchor href={`/${siteName}/manage/payments/billing`} className="button medium submit">
      결제하기
    </Anchor>
  );
}
