import { Box, Container, Stack, Typography } from '@mui/material';
import BlogTeamBreadcrumb from '../breadcrumb';
import Opt from './opt';

type PageProps = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { siteName } = await params;

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            팀원 목록
          </Typography>

          <BlogTeamBreadcrumb siteName={siteName} />

          <Opt siteName={siteName} />
        </Stack>
      </Box>
    </Container>
  );
}
