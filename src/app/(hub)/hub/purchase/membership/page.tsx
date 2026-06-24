import { cookies, headers } from 'next/headers';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import Content from '../tab';
import Container from '../../menu';
import BillingPopup, { BillingPopupDetail } from '../../shared/billingPopup';
import styles from '@/app/hub.module.sass';

type MembershipPayment = {
  id: string;
  siteId: string | null;
  siteName: string | null;
  siteLabel: string | null;
  siteType: string | null;
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
  detail: BillingPopupDetail;
};

type MembershipResponse = {
  summary: {
    totalAmount: number;
    totalRefundedAmount: number;
    netAmount: number;
    count: number;
  };
  payments: MembershipPayment[];
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

async function getMembershipPurchase() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/hub/purchase/membership`, {
    method: 'GET',
    headers: {
      cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  const result = (await response.json()) as MembershipResponse;

  if (!response.ok) {
    throw new Error(result.error || '멤버십 구입내역을 불러오지 못했습니다.');
  }

  return result;
}

export default async function Page() {
  let result: MembershipResponse;

  try {
    result = await getMembershipPurchase();
  } catch (unknownError) {
    const errorMessage =
      unknownError instanceof Error
        ? unknownError.message || '멤버십 구입내역을 불러오지 못했습니다.'
        : '멤버십 구입내역을 불러오지 못했습니다.';

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
            <h2>멤버십 결제 요약</h2>
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
            <h2>멤버십 결제내역</h2>

            {result.payments.length ? (
              <TableContainer className={styles.items}>
                <Table size="small" aria-label="멤버십 결제내역">
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
                    {result.payments.map((payment) => {
                      const isRefunded = payment.status === 'refunded';
                      const isPartiallyRefunded = payment.status === 'partially_refunded';
                      const displayAmount = isRefunded || isPartiallyRefunded ? payment.refundedAmount : payment.amount;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{payment.detail.siteLabel}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{payment.detail.targetLabel ?? '-'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{payment.detail.paymentTypeLabel}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <BillingPopup paymentId={payment.id} detail={payment.detail}>
                              {payment.statusLabel}
                            </BillingPopup>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatAmount(displayAmount)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {formatDateTime(payment.approvedAt ?? payment.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <p>멤버십 결제내역이 없습니다.</p>
            )}
          </section>
        </Content>
      </div>
    </Container>
  );
}
