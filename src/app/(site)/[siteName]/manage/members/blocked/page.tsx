import { Box, Container, Stack } from '@mui/material';
import StaffTabs from '../../../tabs';
import SiteMembersBreadcrumb from '../breadcrumb';
import Opt from './opt';

export default async function Page() {
  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="활동 멤버 관리" />

          <SiteMembersBreadcrumb />

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
