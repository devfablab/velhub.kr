import { redirect } from 'next/navigation';
import { Box, Container, Stack } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import StaffTabs from '../../../tabs';
import SiteContentsBreadcrumb from '../../breadcrumb';
import Opt from './opt';

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

  if (siteInfo.data?.site_type !== 'blog') {
    redirect(`/${normalizedSiteName}/contents/posts`);
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="글 보기" />

          <SiteContentsBreadcrumb />

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
