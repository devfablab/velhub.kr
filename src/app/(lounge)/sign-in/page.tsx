import { Box, Container, Stack, Typography } from '@mui/material';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import EmailSignIn from './email';

export default function Page() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={4}>
          <Typography variant="h4" component="h1">
            로그인
          </Typography>

          <EmailSignIn />

          <SocialLoginButtons />
        </Stack>
      </Box>
    </Container>
  );
}
