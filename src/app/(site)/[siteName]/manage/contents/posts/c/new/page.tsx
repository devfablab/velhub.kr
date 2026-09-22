import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { BoardsResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  const supabaseAdmin = getSupabaseAdmin();

  const siteInfo = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteInfo.data?.site_type !== 'community') {
    redirect(`/${normalizedSiteName}/manage/contents/posts`);
  }

  const initial = await getSiteApiData<BoardsResponse>(
    `/api/boards?siteName=${normalizedSiteName}`,
    '게시판 정보를 불러오지 못했습니다.',
  );

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
