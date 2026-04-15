import { Box, Container, Stack } from '@mui/material';
import StaffTabs from '../../../tabs';
import BlogDesignBreadcrumb from '../breadcrumb';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;

  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="기본 서체 설정" />

          <BlogDesignBreadcrumb siteName={siteName} current="fonts" />

          <Opt siteName={siteName} />
        </Stack>
      </Box>
    </Container>
  );
}
