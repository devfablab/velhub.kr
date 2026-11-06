import { notFound } from 'next/navigation';
import Opt, { type NoticeResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteName: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { siteName } = await params;
  const { page } = await searchParams;
  const requestedPage = Number(page ?? '1');
  const safePage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const initial = await getSiteApiData<NoticeResponse>(
    `/api/site/${siteName}/notice?page=${safePage}`,
    '공지를 불러오지 못했습니다.',
  );

  // 팀 블로그 / 비활성 / 게시판 없음
  if (initial.status === 404) {
    notFound();
  }

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
