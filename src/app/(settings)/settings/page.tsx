import { Box, Container, Grid, Link, Stack, Typography } from '@mui/material';
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
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Typography variant="h5" component="h1">
            개인정보 설정
          </Typography>
          <Link href="/settings/advanced" color="primary" variant="subtitle2" underline="always">
            추가설정
          </Link>
        </Stack>

        <Grid container gap={2} sx={{ marginTop: 3 }}>
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
