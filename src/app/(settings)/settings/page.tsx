import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { Grid } from '@mui/material';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
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
  let userInfo: { userName?: string; avatar?: string; avatarUrl?: string; bio?: string } | null = null;
  let userInfoError = '';
  let loginMethod: {
    email?: string;
    defaultLoginMethod?: 'email' | 'social';
    canChangeDefaultLoginMethod?: boolean;
  } | null = null;
  let loginMethodError = '';
  let hasPassword = false;
  let passwordError = '';
  let totpCurrentLevel: 'aal1' | 'aal2' | null = null;
  let totpFactors: { id: string; status?: string; friendly_name?: string | null }[] = [];
  let totpError = '';
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/info/general/user`,
      { headers: { cookie: cookieStore.toString() }, cache: 'no-store' },
    );
    const result = (await response.json()) as {
      userName?: string;
      avatar?: string;
      avatarUrl?: string;
      bio?: string;
      error?: string;
    };
    if (!response.ok) throw new Error(result.error ?? '기본정보를 불러오지 못했습니다.');
    userInfo = result;
  } catch (error) {
    userInfoError = error instanceof Error ? error.message : '기본정보를 불러오지 못했습니다.';
  }
  try {
    const session = await getSessionClaims();
    if (!session?.userId) throw new Error('앱 기반 2단계 인증 상태를 불러오지 못했습니다.');
    const factorsResult = await getSupabaseAdmin().auth.admin.mfa.listFactors({ userId: session.userId });
    if (factorsResult.error) throw new Error(factorsResult.error.message);
    totpCurrentLevel = session.authenticationLevel === 'aal2' ? 'aal2' : 'aal1';
    totpFactors = (factorsResult.data?.factors ?? []).map((factor) => ({
      id: factor.id,
      status: factor.status,
      friendly_name: factor.friendly_name,
    }));
  } catch (error) {
    totpError = error instanceof Error ? error.message : '앱 기반 2단계 인증 상태를 불러오지 못했습니다.';
  }
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/auth/password/status`,
      { headers: { cookie: cookieStore.toString() }, cache: 'no-store' },
    );
    const result = (await response.json()) as { hasPassword?: boolean; error?: string };
    if (!response.ok) throw new Error(result.error ?? '비밀번호 상태를 확인하지 못했습니다.');
    hasPassword = Boolean(result.hasPassword);
  } catch (error) {
    passwordError = error instanceof Error ? error.message : '비밀번호 상태를 확인하지 못했습니다.';
  }
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/auth/default-login-method`,
      { headers: { cookie: cookieStore.toString() }, cache: 'no-store' },
    );
    const result = (await response.json()) as {
      email?: string;
      defaultLoginMethod?: 'email' | 'social';
      canChangeDefaultLoginMethod?: boolean;
      error?: string;
    };
    if (!response.ok) throw new Error(result.error ?? '기본 로그인 방식을 확인하지 못했습니다.');
    loginMethod = result;
  } catch (error) {
    loginMethodError = error instanceof Error ? error.message : '기본 로그인 방식을 확인하지 못했습니다.';
  }
  return (
    <main>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Headline page="general" />
          <Grid container gap={2}>
            <UserInfo initialData={userInfo} initialError={userInfoError} />
            <PasswordChange initialHasPassword={hasPassword} initialError={passwordError} />
            <PasswordSetup initialHasPassword={hasPassword} initialError={passwordError} />
            <LoginMethod initialData={loginMethod} initialError={loginMethodError} />
            <TotpSetup initialCurrentLevel={totpCurrentLevel} initialFactors={totpFactors} initialError={totpError} />
            <LogoutActions />
            <WithdrawalActions />
          </Grid>
        </div>
      </div>
    </main>
  );
}
