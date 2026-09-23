import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type Props = {
  params: Promise<{ siteName: string; boardName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Response = { ok?: boolean; subscriptionId?: string | null; paymentId?: string | null; error?: string };

export default async function Page({ params, searchParams }: Props) {
  const route = await params;
  const query = await searchParams;
  const siteName = normalizeText(route.siteName).toLowerCase();
  const boardName = normalizeText(route.boardName).toLowerCase();
  const value = (key: string) => normalizeText(typeof query[key] === 'string' ? query[key] : '');
  const billingKey = value('billingKey');
  const customerKey = value('customerKey');
  const paymentId = value('paymentId');
  const orderNo = value('orderNo');
  const seriesName = value('seriesName').toLowerCase();
  let errorMessage = '';
  if ((!billingKey || !customerKey) && !paymentId) errorMessage = '구독 정보가 올바르지 않습니다.';
  else if (!orderNo || value('targetType') !== 'series') errorMessage = '구독 대상 정보가 올바르지 않습니다.';
  else if (!seriesName) errorMessage = '연재 구독 정보가 올바르지 않습니다.';
  else {
    const result = await getSiteApiData<Response>(
      '/api/payments/portone/subscriptions/success',
      '구독을 완료하지 못했습니다.',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingKey,
          customerKey,
          paymentId,
          orderNo,
          siteName,
          boardName,
          targetType: 'series',
          seriesName,
          guardianIdentityVerificationId: value('guardianIdentityVerificationId'),
        }),
      },
    );
    errorMessage = result.error;
  }
  return <Opt {...{ siteName, boardName, errorMessage }} />;
}
