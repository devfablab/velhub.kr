import { Box, Container, Stack } from '@mui/material';
import StaffTabs from '../../tabs';
import SiteContentsBreadcrumb from '../breadcrumb';
import Opt from './opt';

export default async function Page() {
  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="페이지" />

          <SiteContentsBreadcrumb />

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
