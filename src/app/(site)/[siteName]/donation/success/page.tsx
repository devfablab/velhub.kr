import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type Props = {
  params: Promise<{ siteName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Response = { ok?: boolean; paymentId?: string; error?: string };

export default async function Page({ params, searchParams }: Props) {
  const route = await params;
  const query = await searchParams;
  const siteName = normalizeText(route.siteName).toLowerCase();
  const value = (key: string) => normalizeText(typeof query[key] === 'string' ? query[key] : '');
  const boardName = value('boardName');
  const seriesName = value('seriesName');
  const paymentKey = value('paymentKey') || value('paymentId');
  const orderId = value('orderId') || value('orderNo');
  const amountText = value('amount');
  const amount = Number(amountText);
  let errorMessage = '';
  if (!paymentKey || !orderId || !amountText || !value('siteId')) errorMessage = '후원 결제 승인 정보가 없습니다.';
  else if (!Number.isInteger(amount)) errorMessage = '후원 결제 금액이 올바르지 않습니다.';
  else {
    const result = await getSiteApiData<Response>(
      '/api/payments/portone/donation/success',
      '후원 결제를 완료하지 못했습니다.',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentKey,
          orderId,
          txId: value('txId'),
          amount,
          siteId: value('siteId'),
          targetType: value('targetType'),
          boardId: value('boardId'),
          seriesId: value('seriesId'),
          guardianIdentityVerificationId: value('guardianIdentityVerificationId'),
        }),
      },
    );
    errorMessage = result.error;
  }
  return <Opt {...{ siteName, boardName, seriesName, errorMessage }} />;
}
