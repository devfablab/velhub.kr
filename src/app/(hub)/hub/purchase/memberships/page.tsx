import { cookies, headers } from 'next/headers';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ServiceNoDataIcon } from '@/components/Svgs';
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
  return (
    <Container pageTitle="구입내역" pageBack="/hub">
      <div className="container">
        <Content>
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
            {result.payments.length ? (
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
                    {result.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.membershipType}</TableCell>
                        <TableCell>{payment.features.join(' / ')}</TableCell>
                        <TableCell>{payment.statusLabel}</TableCell>
                        <TableCell>
                          {money(payment.status === 'refunded' ? (payment.refunded_amount ?? 0) : payment.amount)}
                        </TableCell>
                        <TableCell>{dateTime(payment.approved_at ?? payment.created_at)}</TableCell>
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
