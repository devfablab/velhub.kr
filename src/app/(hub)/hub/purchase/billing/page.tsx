import { cookies, headers } from 'next/headers';
import Content from '../tab';
import Container from '../../menu';
import styles from '@/app/hub.module.sass';

type BillingPayment = {
  id: string;
  siteId: string | null;
  siteName: string | null;
  siteLabel: string | null;
  planLabel: string | null;
  orderNo: string | null;
  amount: number;
  refundedAmount: number;
  netAmount: number;
  currency: string;
  status: string;
  statusLabel: string;
  paymentMethod: string | null;
  approvedAt: string | null;
  createdAt: string;
  refundableUntil: string | null;
  failureMessage: string | null;
  subscription: {
    id: string;
    status: string;
    statusLabel: string;
    price: number;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    nextBillingAt: string | null;
    canceledAt: string | null;
    expiredAt: string | null;
  } | null;
};

type BillingResponse = {
  summary: {
    totalAmount: number;
    totalRefundedAmount: number;
    netAmount: number;
    count: number;
  };
  payments: BillingPayment[];
  error?: string;
};

function formatAmount(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function getBillingPurchase() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/hub/purchase/billing`, {
    method: 'GET',
    headers: {
      cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  const result = (await response.json()) as BillingResponse;

  if (!response.ok) {
    throw new Error(result.error || '요금제 구입내역을 불러오지 못했습니다.');
  }

  return result;
}

export default async function Page() {
  let result: BillingResponse;

  try {
    result = await getBillingPurchase();
  } catch (unknownError) {
    const errorMessage =
      unknownError instanceof Error
        ? unknownError.message || '요금제 구입내역을 불러오지 못했습니다.'
        : '요금제 구입내역을 불러오지 못했습니다.';

    return (
      <Container pageTitle="구입내역" pageBack="/hub">
        <div className="container">
          <Content>
            <section className={`paper ${styles.paper}`}>
              <p>{errorMessage}</p>
            </section>
          </Content>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="구입내역" pageBack="/hub">
      <div className="container">
        <Content>
          <section className={`paper ${styles.paper}`}>
            <h2>요금제 결제 요약</h2>
            <p>
              총 결제금액
              <br />
              {formatAmount(result.summary.totalAmount)}
            </p>
            <p>
              총 환불금액
              <br />
              {formatAmount(result.summary.totalRefundedAmount)}
            </p>
            <p>
              실결제금액
              <br />
              {formatAmount(result.summary.netAmount)}
            </p>
            <p>
              결제 건수
              <br />
              {result.summary.count.toLocaleString('ko-KR')}건
            </p>
          </section>

          <section className={`paper ${styles.paper} ${styles.history}`}>
            <h2>요금제 결제내역</h2>

            {result.payments.length ? (
              <div className={styles.items}>
                <ol>
                  {result.payments.map((payment) => (
                    <li key={payment.id}>
                      <strong>{payment.siteLabel ?? payment.siteName ?? '사이트 정보 없음'}</strong>
                      <p>
                        {payment.planLabel ?? '요금제 정보 없음'} · {payment.statusLabel} ·{' '}
                        {formatAmount(payment.netAmount)}
                      </p>
                      {payment.subscription ? (
                        <p>
                          구독 상태: {payment.subscription.statusLabel}
                          <br />
                          다음 결제일: {formatDateTime(payment.subscription.nextBillingAt)}
                        </p>
                      ) : null}
                      <div className={styles.tail}>
                        <time>{formatDateTime(payment.approvedAt ?? payment.createdAt)}</time>
                        {payment.refundedAmount > 0 ? <em>환불 {formatAmount(payment.refundedAmount)}</em> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>요금제 결제내역이 없습니다.</p>
            )}
          </section>
        </Content>
      </div>
    </Container>
  );
}
