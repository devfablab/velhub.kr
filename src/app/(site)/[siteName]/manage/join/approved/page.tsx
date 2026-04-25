import { Box, Container, Stack } from '@mui/material';
import StaffTabs from '../../../tabs';
import SiteJoinBreadcrumb from '../breadcrumb';
import Opt from './opt';

export default async function Page() {
  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="가입 신청 관리" />

          <SiteJoinBreadcrumb />

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
