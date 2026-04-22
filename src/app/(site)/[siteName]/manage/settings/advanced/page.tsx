import { Box, Container, Stack } from '@mui/material';
import StaffTabs from '../../../tabs';
import SiteManageBreadcrumb from '../breadcrumb';
import Opt from './opt';

export default async function Page() {
  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="추가 설정" />

          <SiteManageBreadcrumb />

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
