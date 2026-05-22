import { redirect } from 'next/navigation';
import { Box, Stack } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import StaffTabs from '../../tabs';
import Opt from './opt';
import SiteContentsBreadcrumb from '../breadcrumb';
import Container from '../../menu';

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

  if (!siteInfo.data?.site_type) {
    redirect('/');
  }

  return (
    <Container pageTitle={siteInfo.data.site_type === 'blog' ? '글 목록' : '게시판 목록'} menu="contents">
      <Opt />
    </Container>
  );
}
