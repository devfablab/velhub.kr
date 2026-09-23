import { redirect } from 'next/navigation';
import Container from '../../menu';
import { getHubApiData } from '../../shared/getHubApiData';
import Content from '../tab';
import styles from '@/app/hub.module.sass';

type BillingMethodSuccessResponse =
  | {
      ok: true;
    }
  | {
      error: string;
    };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const result = await getHubApiData<BillingMethodSuccessResponse>(
    '/api/payments/portone/billing-method/success',
    '결제 수단을 추가하지 못했습니다.',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billingKey: typeof params.billingKey === 'string' ? params.billingKey : '',
        customerKey: typeof params.customerKey === 'string' ? params.customerKey : '',
        orderNo: typeof params.orderNo === 'string' ? params.orderNo : '',
      }),
    },
  );

  if (!result.error && result.data && 'ok' in result.data && result.data.ok) {
    redirect('/hub/purchase');
  }

  const responseError = result.data && 'error' in result.data ? result.data.error : '';
  const message = result.error || responseError || '결제 수단을 추가하지 못했습니다.';

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
