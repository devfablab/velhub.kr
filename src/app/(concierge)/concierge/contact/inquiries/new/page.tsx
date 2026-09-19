import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Container from '../../../menu';
import Opt, { PaymentRow } from './opt';
import { Contact1, Contact2, Contact3, Contact4, Contact5, Contact6 } from './svgs';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '문의하기 - 데브허브',
  description: '데브허브 문의 접수',
};

export default async function Page() {
  let initialPayments: PaymentRow[] = [];
  let initialCancellationPayments: PaymentRow[] = [];
  let initialCancellationAvailableAt: string | null = null;
  let initialPaymentError = '';
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const baseUrl = `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}`;
    const requestHeaders = { cookie: cookieStore.toString() };
    const [cancellationResponse, paymentResponse] = await Promise.all([
      fetch(`${baseUrl}/api/concierge/contact/inquiries?payments=true`, { headers: requestHeaders, cache: 'no-store' }),
      fetch(`${baseUrl}/api/concierge/contact/inquiries?payments=all`, { headers: requestHeaders, cache: 'no-store' }),
    ]);
    const cancellation = (await cancellationResponse.json()) as {
      payments?: PaymentRow[];
      cancellationAvailableAt?: string | null;
      error?: string;
    };
    const payments = (await paymentResponse.json()) as { payments?: PaymentRow[]; error?: string };
    if (!cancellationResponse.ok || !paymentResponse.ok)
      throw new Error(cancellation.error ?? payments.error ?? '결제 내역을 불러오지 못했습니다.');
    initialCancellationPayments = cancellation.payments ?? [];
    initialCancellationAvailableAt = cancellation.cancellationAvailableAt ?? null;
    initialPayments = payments.payments ?? [];
  } catch (error) {
    initialPaymentError = error instanceof Error ? error.message : '결제 내역을 불러오지 못했습니다.';
  }
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>문의하기</h1>
          <Opt
            initialPayments={initialPayments}
            initialCancellationPayments={initialCancellationPayments}
            initialCancellationAvailableAt={initialCancellationAvailableAt}
            initialPaymentError={initialPaymentError}
          />
          <div className={`paper ${styles['help-paper']}`}>
            <div className="paper">
              <Contact1 />
            </div>
            <div className="paper">
              <Contact2 />
            </div>
            <div className="paper">
              <Contact3 />
            </div>
            <div className="paper">
              <Contact4 />
            </div>
            <div className="paper">
              <Contact5 />
            </div>
            <div className="paper">
              <Contact6 />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
