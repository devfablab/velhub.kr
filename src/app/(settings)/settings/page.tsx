import { Box, Container, Grid, Stack, Typography } from '@mui/material';
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
        <Typography variant="h4" component="h1">
          개인정보 설정
        </Typography>

        <Grid container spacing={2} sx={{ marginTop: 3 }}>
          <UserInfo />
          <PasswordChange />
          <PasswordSetup />
          <LoginMethod />
          <TotpSetup />
          <LogoutActions />
        </Grid>
      </Box>
    </Container>
  );
}
