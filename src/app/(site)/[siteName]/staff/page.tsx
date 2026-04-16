import { Box, Container, Stack } from '@mui/material';
import Opt from './opt';
import StaffTabs from '../tabs';

export default function Page() {
  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs />

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
