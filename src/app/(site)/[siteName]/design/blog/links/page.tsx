import { Box, Container, Stack } from '@mui/material';
import BlogDesignBreadcrumb from '../breadcrumb';
import Opt from './opt';
import StaffTabs from '../../../tabs';

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
          <StaffTabs pageTitle="소셜 링크 관리" />

          <BlogDesignBreadcrumb siteName={siteName} current="links" />

          <Opt siteName={siteName} />
        </Stack>
      </Box>
    </Container>
  );
}
