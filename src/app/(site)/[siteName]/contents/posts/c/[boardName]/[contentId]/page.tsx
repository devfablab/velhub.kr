import { redirect } from 'next/navigation';
import { Box, Container, Stack, Typography } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    boardName: string;
    contentId: string;
  }>;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export default async function Page(context: RouteContext) {
  const { siteName, boardName, contentId } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedBoardName = normalizeText(boardName).toLowerCase();
  const normalizedContentId = normalizeText(contentId);

  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizome.data?.site_type !== 'community') {
    redirect(`/${normalizedSiteName}/contents/posts`);
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            글 보기
          </Typography>

          <Opt siteName={normalizedSiteName} boardName={normalizedBoardName} contentId={normalizedContentId} />
        </Stack>
      </Box>
    </Container>
  );
}
