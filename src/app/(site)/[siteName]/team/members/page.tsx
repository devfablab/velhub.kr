import { Box, Container, Stack, Typography } from '@mui/material';
import BlogTeamBreadcrumb from '../breadcrumb';
import Opt from './opt';
import StaffTabs from '../../tabs';

type PageProps = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { siteName } = await params;

  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="팀원 목록" />

          <BlogTeamBreadcrumb siteName={siteName} />

          <Opt siteName={siteName} />
        </Stack>
      </Box>
    </Container>
  );
}
