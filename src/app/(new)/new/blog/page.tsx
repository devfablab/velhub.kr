import { Box, Container, Stack, Typography } from '@mui/material';
import Opt from './opt';

export default async function Page() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack gap={4}>
          <Typography variant="h5" component="h1">
            블로그 개설
          </Typography>

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
