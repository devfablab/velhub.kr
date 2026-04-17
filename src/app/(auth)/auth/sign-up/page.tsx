import { Box, Container, Stack, Typography } from '@mui/material';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import EmailSignUp from './email';

export default function Page() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={4}>
          <Typography variant="h5" component="h1">
            가입하기
          </Typography>

          <EmailSignUp />

          <SocialLoginButtons />
        </Stack>
      </Box>
    </Container>
  );
}
