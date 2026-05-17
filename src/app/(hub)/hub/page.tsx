import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Personal from './personal';
import PendingInvite from './pendingInvite';
import PendingJoin from './pendingJoin';
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
    return '';
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
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

  return (
    <main>
      <div className="container">
        <div className={`content ${styles.content} ${styles['home-content']}`}>
          <Personal
            avatarUrl={getAvatarUrl(account.avatar)}
            email={decryptValue(account.email)}
            userName={decryptValue(account.user_name)}
            bio={decryptValue(account.bio)}
          />
          <PendingInvite />
          <PendingJoin />
        </div>
      </div>
    </main>
  );
}
