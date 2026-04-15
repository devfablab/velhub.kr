import { redirect } from 'next/navigation';
import { Box, Container, Stack, Typography } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    contentId: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName, contentId } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedContentId = normalizeText(contentId);

  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizome.data?.site_type !== 'blog') {
    redirect(`/${normalizedSiteName}/contents/posts`);
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            블로그 글 수정
          </Typography>

          <Opt siteName={normalizedSiteName} contentId={normalizedContentId} />
        </Stack>
      </Box>
    </Container>
  );
}
