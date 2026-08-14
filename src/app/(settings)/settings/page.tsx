import { Metadata } from 'next';
import { Grid } from '@mui/material';
import Headline from './headline';
import UserInfo from './info';
import LoginMethod from './loginMethod';
import LogoutActions from './logoutActions';
import PasswordChange from './passwordChange';
import PasswordSetup from './passwordSetup';
import TotpSetup from './totpSetup';
import WithdrawalActions from './withdrawalActions';
import styles from '@/app/settings.module.sass';

export const metadata: Metadata = {
  title: '개인 설정',
  description: '개인 설정 페이지',
};

export default async function Page() {
  return (
    <main>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Headline page="general" />
          <Grid container gap={2}>
            <UserInfo />
            <PasswordChange />
            <PasswordSetup />
            <LoginMethod />
            <TotpSetup />
            <LogoutActions />
            <WithdrawalActions />
          </Grid>
        </div>
      </div>
    </main>
  );
}
