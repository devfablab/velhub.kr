import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type Props = {
  params: Promise<{ siteName: string; boardName: string; contentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type FailResponse = { ok?: boolean; error?: string };

export default async function Page({ params, searchParams }: Props) {
  const route = await params;
  const query = await searchParams;
  const siteName = normalizeText(route.siteName).toLowerCase();
  const boardName = normalizeText(route.boardName).toLowerCase();
  const contentId = normalizeText(route.contentId);
  const value = (key: string) => normalizeText(typeof query[key] === 'string' ? query[key] : '');
  const message = value('message') || '후원이 취소되었거나 실패했습니다.';
  const orderNo = value('orderNo');
  const paymentType = value('paymentType');
  const targetType = value('targetType');
  const siteId = value('siteId');
  const postId = value('postId');
  let logErrorMessage = '';
  if (orderNo && paymentType && targetType && siteId && postId) {
    const amount = Number(value('amount'));
    const result = await getSiteApiData<FailResponse>(
      '/api/payments/portone/fail',
      '실패 내역을 저장하지 못했습니다.',
      {
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
          postId,
          boardName,
          contentId,
        }),
      },
    );
    logErrorMessage = result.error;
  }
  return <Opt {...{ siteName, boardName, contentId, message, logErrorMessage }} />;
}
