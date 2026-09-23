import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type Props = {
  params: Promise<{ siteName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Response = { ok?: boolean; paymentId?: string; status?: string; error?: string };

export default async function Page({ params, searchParams }: Props) {
  const route = await params;
  const query = await searchParams;
  const siteName = normalizeText(route.siteName).toLowerCase();
  const value = (key: string) => normalizeText(typeof query[key] === 'string' ? query[key] : '');
  const orderNo = value('orderNo') || value('orderId');
  const amountText = value('amount');
  const amount = Number(amountText);
  let errorMessage = '';
  if (!orderNo || !value('paymentType') || !value('siteId') || !amountText || !Number.isInteger(amount))
    errorMessage = '후원 실패 정보를 저장하지 못했습니다.';
  else {
    const result = await getSiteApiData<Response>(
      '/api/payments/portone/fail',
      '후원 실패 정보를 저장하지 못했습니다.',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: value('paymentType'),
          orderNo,
          code: value('code'),
          message: value('message'),
          siteId: value('siteId'),
          targetType: value('targetType'),
          boardId: value('boardId'),
          boardName: value('boardName'),
          seriesId: value('seriesId'),
          seriesName: value('seriesName'),
          amount,
        }),
      },
    );
    errorMessage = result.error || value('message');
  }
  return <Opt {...{ siteName, errorMessage }} />;
}
