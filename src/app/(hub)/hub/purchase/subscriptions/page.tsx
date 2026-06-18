import { cookies, headers } from 'next/headers';
import Content from '../tab';
import Container from '../../menu';
import styles from '@/app/hub.module.sass';

type SubscriptionPayment = {
  id: string;
  paymentType: string;
  paymentTypeLabel: string;
  targetType: string;
  targetId: string | null;
  siteId: string | null;
  siteName: string | null;
  siteLabel: string | null;
  siteType: string | null;
  boardId: string | null;
  boardName: string | null;
  boardLabel: string | null;
  seriesId: string | null;
  seriesName: string | null;
  seriesLabel: string | null;
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

type SubscriptionsResponse = {
  summary: {
    totalAmount: number;
    totalRefundedAmount: number;
    netAmount: number;
    count: number;
  };
  payments: SubscriptionPayment[];
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

function getTargetLabel(payment: SubscriptionPayment) {
  if (payment.seriesLabel) {
    return payment.seriesLabel;
  }

  if (payment.boardLabel) {
    return payment.boardLabel;
  }

  return '구독 대상 정보 없음';
}

function getSiteLabel(payment: SubscriptionPayment) {
  return payment.siteLabel ?? payment.siteName ?? '';
}

async function getSubscriptionsPurchase() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/hub/purchase/subscriptions`, {
    method: 'GET',
    headers: {
      cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  const result = (await response.json()) as SubscriptionsResponse;

  if (!response.ok) {
    throw new Error(result.error || '구독 구입내역을 불러오지 못했습니다.');
  }

  return result;
}

export default async function Page() {
  let result: SubscriptionsResponse;

  try {
    result = await getSubscriptionsPurchase();
  } catch (unknownError) {
    const errorMessage =
      unknownError instanceof Error
        ? unknownError.message || '구독 구입내역을 불러오지 못했습니다.'
        : '구독 구입내역을 불러오지 못했습니다.';

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
            <h2>구독 결제 요약</h2>
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
            <h2>구독 결제내역</h2>

            {result.payments.length ? (
              <div className={styles.items}>
                <ol>
                  {result.payments.map((payment) => {
                    const siteLabel = getSiteLabel(payment);

                    return (
                      <li key={payment.id}>
                        <strong>{getTargetLabel(payment)}</strong>
                        <p>
                          {payment.paymentTypeLabel} · {payment.statusLabel} · {formatAmount(payment.netAmount)}
                        </p>
                        {siteLabel ? <p>{siteLabel}</p> : null}
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
                    );
                  })}
                </ol>
              </div>
            ) : (
              <p>구독 결제내역이 없습니다.</p>
            )}
          </section>
        </Content>
      </div>
    </Container>
  );
}
