import { redirect } from 'next/navigation';
import { Box, Stack, Typography } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import Opt from './opt';
import Container from '../menu';

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

  if (rhizome.data?.site_type !== 'community') {
    redirect(`/${normalizedSiteName}`);
  }

  return (
    <Container pageBack={`/${siteName}`} pageTitle="가입하기">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h5" component="h1">
            커뮤니티 가입
          </Typography>

          <Opt siteName={normalizedSiteName} />
        </Stack>
      </Box>
    </Container>
  );
}
