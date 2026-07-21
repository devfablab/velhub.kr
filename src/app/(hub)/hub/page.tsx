import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Container from './menu';
import Personal from './personal';
import PendingInvite from './pendingInvite';
import PendingJoin from './pendingJoin';
import MemberStatusSites, { type MemberStatusSiteRow } from './shared/memberStatusSites';
import styles from '@/app/hub.module.sass';

type AccountRow = {
  email: string | null;
  user_name: string | null;
  bio: string | null;
  avatar: string | null;
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

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrlResult = supabaseAdmin.storage.from('avatar').getPublicUrl(normalizedValue);

  return publicUrlResult.data.publicUrl ?? '';
}

async function getMemberStatusSites() {
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const host = headerList.get('host');

    if (!host) {
      return [];
    }

    const protocol = headerList.get('x-forwarded-proto') || 'http';
    const response = await fetch(`${protocol}://${host}/api/hub/user-join-sites`, {
      method: 'GET',
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    });

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

  const accountResult = await supabaseAdmin
    .from('stigmas')
    .select('email, user_name, bio, avatar')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (accountResult.error || !accountResult.data) {
    throw new Error('마이허브 정보를 불러오지 못했습니다.');
  }

  const account = accountResult.data as AccountRow;
  const statusSites = await getMemberStatusSites();

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
          <PendingInvite />
          <PendingJoin />
        </div>
      </div>
    </Container>
  );
}
