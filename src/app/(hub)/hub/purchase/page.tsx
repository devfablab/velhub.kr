import { cookies, headers } from 'next/headers';
import Content from './tab';
import Container from '../menu';
import styles from '@/app/hub.module.sass';

type PurchaseSummaryItem = {
  paymentType: string;
  label: string;
  amount: number;
};

type DefaultBillingMethod = {
  id: string;
  provider: string;
  cardCompany: string | null;
  cardNumberLabel: string;
  cardType: string | null;
  ownerType: string | null;
  updatedAt: string | null;
};

type PurchasePayment = {
  id: string;
  paymentType: string;
  paymentTypeLabel: string;
  targetType: string;
  targetId: string | null;
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
};

type PurchaseResponse = {
  summary: {
    totalAmount: number;
    totalRefundedAmount: number;
    netAmount: number;
    amountByType: PurchaseSummaryItem[];
  };
  defaultBillingMethod: DefaultBillingMethod | null;
  recentPayments: PurchasePayment[];
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

async function getPurchase() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/hub/purchase`, {
    method: 'GET',
    headers: {
      cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  const result = (await response.json()) as PurchaseResponse;

  if (!response.ok) {
    throw new Error(result.error || '구입내역을 불러오지 못했습니다.');
  }

  return result;
}

export default async function Page() {
  let result: PurchaseResponse;

  try {
    result = await getPurchase();
  } catch (unknownError) {
    const errorMessage =
      unknownError instanceof Error
        ? unknownError.message || '구입내역을 불러오지 못했습니다.'
        : '구입내역을 불러오지 못했습니다.';

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
            <h2>결제 요약</h2>
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

            {result.summary.amountByType.map((item) => (
              <p key={item.paymentType}>
                {item.label}
                <br />
                {formatAmount(item.amount)}
              </p>
            ))}
          </section>

          <section className={`paper ${styles.paper}`}>
            <h2>결제수단</h2>

            {result.defaultBillingMethod ? (
              <>
                <p>
                  {result.defaultBillingMethod.cardCompany ?? '카드사 확인 필요'}{' '}
                  {result.defaultBillingMethod.cardNumberLabel}
                </p>
                <p>
                  최근 변경일
                  <br />
                  {formatDateTime(result.defaultBillingMethod.updatedAt)}
                </p>
              </>
            ) : (
              <p>등록된 기본 결제수단이 없습니다.</p>
            )}

            <div className={styles.buttons}>
              <button type="button" className="button small action">
                결제수단 변경
              </button>
            </div>
          </section>

          <section className={`paper ${styles.paper} ${styles.history}`}>
            <h2>최근 결제내역</h2>

            {result.recentPayments.length ? (
              <div className={styles.items}>
                <ol>
                  {result.recentPayments.map((payment) => (
                    <li key={payment.id}>
                      <strong>{payment.paymentTypeLabel}</strong>
                      <p>
                        {payment.statusLabel} · {formatAmount(payment.netAmount)}
                      </p>
                      <div className={styles.tail}>
                        <time>{formatDateTime(payment.approvedAt ?? payment.createdAt)}</time>
                        {payment.refundedAmount > 0 ? <em>환불 {formatAmount(payment.refundedAmount)}</em> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>결제내역이 없습니다.</p>
            )}
          </section>
        </Content>
      </div>
    </Container>
  );
}
