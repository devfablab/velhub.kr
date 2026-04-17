import { Box, Container, Stack, Typography } from '@mui/material';
import Opt from './opt';

export default async function Page() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={4}>
          <Typography variant="h5" component="h1">
            커뮤니티 개설
          </Typography>

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
