import { Box, Container, Stack, Typography } from '@mui/material';
import PasswordChange from './passwordChange';
import TotpSetup from './totpSetup';
import LogoutActions from './logoutActions';
import PasswordSetup from './passwordSetup';
import LoginMethod from './loginMethod';
import UserInfo from './info';

export default async function Page() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={4}>
          <Typography variant="h4" component="h1">
            설정
          </Typography>

          <UserInfo />
          <PasswordChange />
          <PasswordSetup />
          <LoginMethod />
          <TotpSetup />
          <LogoutActions />
        </Stack>
      </Box>
    </Container>
  );
}
