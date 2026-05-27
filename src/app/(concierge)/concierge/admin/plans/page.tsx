import { Box, Container, Stack, Typography } from '@mui/material';
import Opt from './opt';

export default function Page() {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Stack gap={3}>
          <Typography variant="h5" component="h1">
            요금제
          </Typography>

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
