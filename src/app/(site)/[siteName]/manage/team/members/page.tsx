import { Box, Container, Stack } from '@mui/material';
import StaffTabs from '../../tabs';
import BlogTeamBreadcrumb from '../breadcrumb';
import Opt from './opt';

export default async function Page() {
  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="팀원 목록" />

          <BlogTeamBreadcrumb />

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
