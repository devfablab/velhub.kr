import { cookies, headers } from 'next/headers';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ServiceNoDataIcon } from '@/components/Svgs';
import Container from '../../menu';
import BillingPopup, { BillingPopupDetail } from '../../shared/billingPopup';
import Content from '../tab';
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
  refundedAt: string | null;
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
  detail: BillingPopupDetail;
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
  return `${value.toLocaleString('ko-KR')} 원`;
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

function getPaymentTypeLabel(payment: SubscriptionPayment) {
  if (payment.subscription?.canceledAt && payment.subscription.nextBillingAt === null && payment.status === 'paid') {
    return `1개월 ${payment.paymentTypeLabel} 단건 결제`;
  }

  return payment.paymentTypeLabel;
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

  const paymentHistory = result.payments.flatMap((payment) => {
    const isRefunded = payment.refundedAmount > 0;
    const paymentHistoryItem = {
      ...payment,
      historyKey: `${payment.id}:payment`,
      historyStatusLabel: isRefunded ? '결제 완료' : payment.statusLabel,
      historyAmount: payment.amount,
      historyAt: payment.approvedAt ?? payment.createdAt,
      historyDetail: {
        ...payment.detail,
        status: isRefunded ? 'paid' : payment.detail.status,
        statusLabel: isRefunded ? '결제 완료' : payment.detail.statusLabel,
        refundedAmount: isRefunded ? 0 : payment.detail.refundedAmount,
        refundedAt: isRefunded ? null : payment.detail.refundedAt,
        historyKind: isRefunded ? 'payment' : payment.status === 'failed' ? 'failed' : undefined,
      } satisfies BillingPopupDetail,
    };

    if (!isRefunded) {
      return [paymentHistoryItem];
    }

    return [
      {
        ...payment,
        historyKey: `${payment.id}:refund`,
        historyStatusLabel: payment.statusLabel,
        historyAmount: payment.refundedAmount,
        historyAt: payment.refundedAt ?? payment.approvedAt ?? payment.createdAt,
        historyDetail: {
          ...payment.detail,
          historyKind: 'refund',
        } satisfies BillingPopupDetail,
      },
      paymentHistoryItem,
    ];
  });

  return (
    <Container pageTitle="구입내역" pageBack="/hub">
      <div className="container">
        <Content>
          <section className={`paper ${styles.paper}`}>
            <h2>구독 결제 요약</h2>
            <dl className={styles.summary}>
              <div className="paper">
                <dt>결제 총액</dt>
                <dd>{formatAmount(result.summary.totalAmount)}</dd>
              </div>
              <div className="paper">
                <dt>환불금액</dt>
                <dd>{formatAmount(result.summary.totalRefundedAmount)}</dd>
              </div>
              <div className="paper">
                <dt>실제 결제금액</dt>
                <dd>{formatAmount(result.summary.netAmount)}</dd>
              </div>
              <div className="paper">
                <dt>결제 건수</dt>
                <dd>{result.summary.count.toLocaleString('ko-KR')} 건</dd>
              </div>
            </dl>
          </section>

          <section className={`paper ${styles.paper} ${styles.history}`}>
            <h2>구독 결제내역</h2>

            {paymentHistory.length ? (
              <TableContainer className={styles.items}>
                <Table size="small" aria-label="구독 결제내역">
                  <TableHead>
                    <TableRow>
                      <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                        사이트
                      </TableCell>
                      <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                        대상
                      </TableCell>
                      <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                        결제유형
                      </TableCell>
                      <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                        상태
                      </TableCell>
                      <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                        금액
                      </TableCell>
                      <TableCell component="th" scope="col" sx={{ whiteSpace: 'nowrap' }}>
                        일시
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paymentHistory.map((payment) => {
                      return (
                        <TableRow key={payment.historyKey}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{payment.detail.siteLabel}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{payment.detail.targetLabel || '-'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{getPaymentTypeLabel(payment)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <BillingPopup paymentId={payment.id} detail={payment.historyDetail}>
                              {payment.historyStatusLabel}
                            </BillingPopup>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatAmount(payment.historyAmount)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(payment.historyAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <div className="paper page-info">
                <ServiceNoDataIcon />
                <p>구독 결제내역이 없습니다.</p>
              </div>
            )}
          </section>
        </Content>
      </div>
    </Container>
  );
}
