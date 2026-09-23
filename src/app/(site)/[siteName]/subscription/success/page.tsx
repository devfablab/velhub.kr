import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type Props = {
  params: Promise<{ siteName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Response = { ok?: boolean; subscriptionId?: string | null; error?: string };

export default async function Page({ params, searchParams }: Props) {
  const route = await params;
  const query = await searchParams;
  const siteName = normalizeText(route.siteName).toLowerCase();
  const value = (key: string) => normalizeText(typeof query[key] === 'string' ? query[key] : '');
  const billingKey = value('billingKey');
  const customerKey = value('customerKey');
  const orderNo = value('orderNo');
  let errorMessage = '';
  if (!billingKey || !customerKey || !siteName || !orderNo) errorMessage = '블로그 구독 가입 정보가 올바르지 않습니다.';
  else {
    const result = await getSiteApiData<Response>(
      '/api/payments/portone/subscriptions/success',
      '블로그 구독 가입을 완료하지 못했습니다.',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingKey,
          customerKey,
          siteName,
          orderNo,
          targetType: 'site',
          guardianIdentityVerificationId: value('guardianIdentityVerificationId'),
        }),
      },
    );
    errorMessage = result.error;
  }
  return <Opt {...{ siteName, errorMessage }} />;
}
