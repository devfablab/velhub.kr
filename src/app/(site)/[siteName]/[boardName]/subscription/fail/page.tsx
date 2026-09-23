import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type Props = {
  params: Promise<{ siteName: string; boardName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Response = { ok?: boolean; error?: string };

export default async function Page({ params, searchParams }: Props) {
  const route = await params;
  const query = await searchParams;
  const siteName = normalizeText(route.siteName).toLowerCase();
  const boardName = normalizeText(route.boardName).toLowerCase();
  const value = (key: string) => normalizeText(typeof query[key] === 'string' ? query[key] : '');
  const message = value('message') || '연재 구독이 취소되었거나 실패했습니다.';
  const targetType = value('targetType') === 'series' ? 'series' : '';
  const orderNo = value('orderNo');
  const paymentType = value('paymentType');
  const siteId = value('siteId');
  let logErrorMessage = '';
  if (orderNo && paymentType && targetType && siteId) {
    const amount = Number(value('amount'));
    const result = await getSiteApiData<Response>('/api/payments/portone/fail', '실패 내역을 저장하지 못했습니다.', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNo,
        amount: Number.isFinite(amount) ? amount : 0,
        code: value('code'),
        message,
        paymentType,
        targetType,
        siteId,
        boardId: value('boardId'),
        seriesId: value('seriesId'),
        boardName,
        seriesName: value('seriesName').toLowerCase(),
      }),
    });
    logErrorMessage = result.error;
  }
  return <Opt {...{ siteName, boardName, message, logErrorMessage }} />;
}
