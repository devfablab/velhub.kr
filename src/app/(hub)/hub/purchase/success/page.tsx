'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Content from '../tab';
import Container from '../../menu';
import styles from '@/app/hub.module.sass';

type BillingMethodSuccessResponse =
  | {
      ok: true;
    }
  | {
      error: string;
    };

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('결제 수단을 추가하고 있습니다.');

  useEffect(() => {
    async function completeBillingMethod() {
      try {
        const authKey = searchParams.get('authKey');
        const customerKey = searchParams.get('customerKey');
        const orderNo = searchParams.get('orderNo');

        const response = await fetch('/api/payments/toss/billing-method/success', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            authKey,
            customerKey,
            orderNo,
          }),
        });

        const result = (await response.json()) as BillingMethodSuccessResponse;

        if (!response.ok || 'error' in result) {
          throw new Error('error' in result ? result.error : '결제 수단을 추가하지 못했습니다.');
        }

        router.replace('/hub/purchase');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setMessage(unknownError.message || '결제 수단을 추가하지 못했습니다.');
        } else {
          setMessage('결제 수단을 추가하지 못했습니다.');
        }
      }
    }

    void completeBillingMethod();
  }, [router, searchParams]);

  return (
    <Container pageTitle="결제 수단 추가" pageBack="/hub/purchase">
      <div className="container">
        <Content>
          <section className={`paper ${styles.paper}`}>
            <p>{message}</p>
          </section>
        </Content>
      </div>
    </Container>
  );
}
