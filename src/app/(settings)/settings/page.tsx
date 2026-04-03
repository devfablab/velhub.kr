import { redirect } from 'next/navigation';
import { getSessionClaims } from '@/lib/session';
import PasswordChange from './passwordChange';
import TotpSetup from './totpSetup';
import LogoutActions from './logoutActions';
import PasswordSetup from './passwordSetup';
import LoginMethod from './loginMethod';

export default async function Page() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    redirect('/sign-in');
  }

  return (
    <main>
      <h1>설정</h1>
      <PasswordChange />
      <PasswordSetup />
      <LoginMethod />
      <TotpSetup />
      <LogoutActions />
    </main>
  );
}
