import { Grid } from '@mui/material';
import Headline from './headline';
import PasswordChange from './passwordChange';
import TotpSetup from './totpSetup';
import LogoutActions from './logoutActions';
import PasswordSetup from './passwordSetup';
import LoginMethod from './loginMethod';
import UserInfo from './info';
import styles from '@/app/settings.module.sass';

export default async function Page() {
  return (
    <main>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Headline />

          <Grid container gap={2}>
            <UserInfo />
            <PasswordChange />
            <PasswordSetup />
            <LoginMethod />
            <TotpSetup />
            <LogoutActions />
          </Grid>
        </div>
      </div>
    </main>
  );
}
