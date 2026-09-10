import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ServiceNoDataIcon } from '@/components/Svgs';
import MembershipPlan from '../../memberships/opt';
import Container from '../../menu';
import Content from '../tab';
import styles from '@/app/hub.module.sass';

type Result = {
  summary: { totalAmount: number; refundedAmount: number; netAmount: number; count: number };
  payments: Array<{
    id: string;
    membershipType: string;
    features: string[];
    amount: number;
    refunded_amount: number | null;
    status: string;
    statusLabel: string;
    approved_at: string | null;
    created_at: string;
    refunded_at: string | null;
  }>;
};

const money = (value: number) => `${value.toLocaleString('ko-KR')} 원`;
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

async function getMemberships() {
  const cookieHeader = (await cookies()).toString();
  const headerList = await headers();
  const baseUrl = `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}`;
  const response = await fetch(`${baseUrl}/api/hub/purchase/memberships`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  const result = (await response.json()) as Result & { error?: string };
  if (!response.ok) throw new Error(result.error || '멤버십 결제내역을 불러오지 못했습니다.');
  return result;
}

export default async function Page() {
  const result = await getMemberships();
  const paymentHistory = result.payments.flatMap((payment) => {
    const isRefunded = (payment.refunded_amount ?? 0) > 0;
    const paymentHistoryItem = {
      ...payment,
      historyKey: `${payment.id}:payment`,
      historyStatusLabel: isRefunded ? '결제 완료' : payment.statusLabel,
      historyAmount: payment.amount,
      historyAt: payment.approved_at ?? payment.created_at,
    };

    if (!isRefunded) {
      return [paymentHistoryItem];
    }

    return [
      {
        ...payment,
        historyKey: `${payment.id}:refund`,
        historyStatusLabel: payment.statusLabel,
        historyAmount: payment.refunded_amount ?? 0,
        historyAt: payment.refunded_at ?? payment.approved_at ?? payment.created_at,
      },
      paymentHistoryItem,
    ];
  });

  return (
    <Container pageTitle="구입내역" pageBack="/hub">
      <div className="container">
        <Content>
          <Suspense fallback={null}>
            <MembershipPlan />
          </Suspense>
          <section className={`paper ${styles.paper}`}>
            <h2>멤버십 결제 요약</h2>
            <dl className={styles.summary}>
              <div className="paper">
                <dt>결제 총액</dt>
                <dd>{money(result.summary.totalAmount)}</dd>
              </div>
              <div className="paper">
                <dt>환불금액</dt>
                <dd>{money(result.summary.refundedAmount)}</dd>
              </div>
              <div className="paper">
                <dt>실제 결제금액</dt>
                <dd>{money(result.summary.netAmount)}</dd>
              </div>
              <div className="paper">
                <dt>결제 건수</dt>
                <dd>{result.summary.count.toLocaleString('ko-KR')} 건</dd>
              </div>
            </dl>
          </section>
          <section className={`paper ${styles.paper} ${styles.history}`}>
            <h2>멤버십 결제내역</h2>
            {paymentHistory.length ? (
              <TableContainer className={styles.items}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>멤버십</TableCell>
                      <TableCell>기능</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>금액</TableCell>
                      <TableCell>일시</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paymentHistory.map((payment) => (
                      <TableRow key={payment.historyKey}>
                        <TableCell>{payment.membershipType}</TableCell>
                        <TableCell>{payment.features.join(' / ')}</TableCell>
                        <TableCell>{payment.historyStatusLabel}</TableCell>
                        <TableCell>{money(payment.historyAmount)}</TableCell>
                        <TableCell>{dateTime(payment.historyAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <div className="paper page-info">
                <ServiceNoDataIcon />
                <p>멤버십 결제내역이 없습니다.</p>
              </div>
            )}
          </section>
        </Content>
      </div>
    </Container>
  );
}
