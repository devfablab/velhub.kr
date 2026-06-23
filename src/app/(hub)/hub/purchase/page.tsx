import { cookies, headers } from 'next/headers';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import Anchor from '@/components/Anchor';
import Content from './tab';
import Container from '../menu';
import BillingMethods from './billingMethods';
import styles from '@/app/hub.module.sass';

type PurchaseSummaryItem = {
  paymentType: string;
  label: string;
  amount: number;
};

type BillingMethod = {
  id: string;
  provider: string;
  cardCompany: string | null;
  cardNumberLabel: string;
  cardType: string | null;
  ownerType: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type PurchasePayment = {
  id: string;
  siteLabel: string;
  siteHref: string;
  targetLabel: string;
  targetHref: string;
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
  billingMethods: BillingMethod[];
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
            <dl className={styles.summary}>
              <div className="paper">
                <dt>총 결제금액</dt>
                <dd>{formatAmount(result.summary.totalAmount)}</dd>
              </div>
              <div className="paper">
                <dt>총 환불금액</dt>
                <dd>{formatAmount(result.summary.totalRefundedAmount)}</dd>
              </div>
              <div className="paper">
                <dt>실결제금액</dt>
                <dd>{formatAmount(result.summary.netAmount)}</dd>
              </div>
            </dl>
          </section>

          <section className={`paper ${styles.paper}`}>
            <h2>결제 유형별 지출 요약</h2>
            <div>
              <p>포스팅 소장, 구독, 후원 등 결제 유형별 누적 결제 금액입니다.</p>
            </div>
            <dl className={`paper ${styles['type-summary']}`}>
              {result.summary.amountByType.map((item) => (
                <div key={item.paymentType}>
                  <dt>{item.label}</dt>
                  <dd>{formatAmount(item.amount)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={`paper ${styles.paper}`}>
            <h2>결제수단</h2>
            <BillingMethods billingMethods={result.billingMethods} />
          </section>

          <section className={`paper ${styles.paper} ${styles.history}`}>
            <h2>최근 결제내역</h2>

            {result.recentPayments.length ? (
              <TableContainer className={styles.items}>
                <Table size="small" aria-label="최근 결제내역">
                  <TableHead>
                    <TableRow>
                      <TableCell component="th" scope="col">
                        사이트
                      </TableCell>
                      <TableCell component="th" scope="col">
                        콘텐츠
                      </TableCell>
                      <TableCell component="th" scope="col">
                        결제유형
                      </TableCell>
                      <TableCell component="th" scope="col">
                        상태
                      </TableCell>
                      <TableCell component="th" scope="col">
                        금액
                      </TableCell>
                      <TableCell component="th" scope="col">
                        일시
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.recentPayments.map((payment) => {
                      const isRefunded = payment.status === 'refunded';
                      const isPartiallyRefunded = payment.status === 'partially_refunded';
                      const displayAmount = isRefunded || isPartiallyRefunded ? payment.refundedAmount : payment.amount;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Anchor href={payment.siteHref}>{payment.siteLabel}</Anchor>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Anchor href={payment.targetHref}>{payment.targetLabel}</Anchor>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{payment.statusLabel}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{payment.statusLabel}</TableCell>
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
              <p>결제내역이 없습니다.</p>
            )}
          </section>
        </Content>
      </div>
    </Container>
  );
}
