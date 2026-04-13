import { Box, Container, Stack, Typography } from '@mui/material';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    contentId: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName, contentId } = await context.params;

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            블로그 글 보기
          </Typography>

          <Opt siteName={siteName} contentId={contentId} />
        </Stack>
      </Box>
    </Container>
  );
}
