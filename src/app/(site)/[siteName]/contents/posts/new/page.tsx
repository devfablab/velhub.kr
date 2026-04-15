import { redirect } from 'next/navigation';
import { Box, Container, Stack, Typography } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

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
            블로그 글쓰기
          </Typography>

          <Opt siteName={normalizedSiteName} />
        </Stack>
      </Box>
    </Container>
  );
}
