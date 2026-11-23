import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session/server';
import { normalizeText } from '@/lib/utils';
import { getHubApiData } from '@/lib/service/hub/getData';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import Container from './menu';
import PendingInvite, { PendingInviteResponse } from './pendingInvite';
import PendingJoin, { PendingJoinResponse } from './pendingJoin';
import Personal from './personal';
import MemberStatusSites, { type MemberStatusSiteRow } from './shared/memberStatusSites';
import styles from '@/app/hub.module.sass';

type AccountRow = {
  email: string | null;
  user_name: string | null;
  bio: string | null;
  avatar: string | null;
};

export const metadata: Metadata = {
  title: '마이허브 - 데브허브',
  description: '마이허브',
};

function decryptValue(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    const decryptedValue = decrypt(normalizedValue);

    if (decryptedValue.startsWith('naver_')) {
      return null;
    }

    return decryptedValue;
  } catch {
    return null;
  }
}

function getAvatarUrl(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  const publicUrlResult = r2Storage.from('avatars').getPublicUrl(normalizedValue);

  return publicUrlResult.data.publicUrl ?? '';
}

async function getMemberStatusSites() {
  try {
    const response = await fetchApiRoute('/api/hub/user-join-sites');

    if (!response.ok) {
      return [];
    }

    const result = (await response.json()) as { statusSites?: MemberStatusSiteRow[] };
    return Array.isArray(result.statusSites) ? result.statusSites : [];
  } catch {
    return [];
  }
}

export default async function Page() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    redirect('/auth/sign-in');
  }

  const supabaseAdmin = getSupabaseAdmin();

  const [accountResult, statusSites, pendingInvites, pendingJoins] = await Promise.all([
    supabaseAdmin.from('stigmas').select('email, user_name, bio, avatar').eq('user_id', sessionClaims.userId).maybeSingle(),
    getMemberStatusSites(),
    getHubApiData<PendingInviteResponse>('/api/hub/pending-invites', '초대 정보를 불러오지 못했습니다.'),
    getHubApiData<PendingJoinResponse>('/api/hub/pending-join', '가입 신청 정보를 불러오지 못했습니다.'),
  ]);

  if (accountResult.error || !accountResult.data) {
    throw new Error('마이허브 정보를 불러오지 못했습니다.');
  }

  const account = accountResult.data as AccountRow;

  return (
    <Container pageTitle="마이허브" pageBack="/">
      <div className="container">
        <div className={`content ${styles.content} ${styles['home-content']}`}>
          <Personal
            avatarUrl={getAvatarUrl(account.avatar)}
            email={decryptValue(account.email)}
            userName={decryptValue(account.user_name)}
            bio={decryptValue(account.bio)}
          />
          <MemberStatusSites statusSites={statusSites} rejoinOnly />
          <PendingInvite initialData={pendingInvites.data} initialError={pendingInvites.error} />
          <PendingJoin initialData={pendingJoins.data} initialError={pendingJoins.error} />
        </div>
      </div>
    </Container>
  );
}
