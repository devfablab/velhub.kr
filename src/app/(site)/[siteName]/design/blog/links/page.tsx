import { Box, Container, Stack } from '@mui/material';
import StaffTabs from '../../../tabs';
import BlogDesignBreadcrumb from '../breadcrumb';
import Opt from './opt';

export default async function Page() {
  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="소셜 링크 관리" />

          <BlogDesignBreadcrumb />

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
