import { Box, Container, Link, Stack, Typography } from '@mui/material';
import Opt from './opt';

export default function Page() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Typography variant="h5" component="h1">
            추가 설정
          </Typography>
          <Link href="/settings" color="primary" variant="subtitle2" underline="always">
            뒤로가기
          </Link>
        </Stack>
        <Opt />
      </Box>
    </Container>
  );
}
