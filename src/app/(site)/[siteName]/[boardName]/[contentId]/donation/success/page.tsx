import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type Props = {
  params: Promise<{ siteName: string; boardName: string; contentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Response = { ok?: boolean; paymentId?: string; error?: string };

export default async function Page({ params, searchParams }: Props) {
  const route = await params;
  const query = await searchParams;
  const siteName = normalizeText(route.siteName).toLowerCase();
  const boardName = normalizeText(route.boardName).toLowerCase();
  const contentId = normalizeText(route.contentId);
  const value = (key: string) => normalizeText(typeof query[key] === 'string' ? query[key] : '');
  const paymentKey = value('paymentKey') || value('paymentId');
  const orderId = value('orderId') || value('orderNo');
  const amount = Number(value('amount'));
  let errorMessage = '';
  if (
    !paymentKey ||
    !orderId ||
    !Number.isFinite(amount) ||
    !value('siteId') ||
    !value('targetType') ||
    !value('postId')
  ) {
    errorMessage = '후원 결제 정보가 올바르지 않습니다.';
  } else {
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
          postId: value('postId'),
          guardianIdentityVerificationId: value('guardianIdentityVerificationId'),
        }),
      },
    );
    errorMessage = result.error;
  }
  return <Opt {...{ siteName, boardName, contentId, errorMessage }} />;
}
