import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import Opt from './opt';
import type { InviteResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type PageProps = {
  params: Promise<{
    siteName: string;
    token: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { siteName, token } = await params;

  const initialData = await getSiteApiData<InviteResponse>(
    `/api/manage/design/blog/team/invite/${token}?siteName=${siteName}`,
    '초대장을 불러오지 못했습니다.',
  );

  const sessionClaims = await getSessionClaims();
  const inviteEmail = initialData.data?.invite.email.trim().toLowerCase() ?? '';
  let isRegisteredEmail = false;

  if (inviteEmail) {
    const accountResult = await getSupabaseAdmin()
      .from('particles')
      .select('id')
      .eq('email', inviteEmail)
      .maybeSingle();

    isRegisteredEmail = Boolean(accountResult.data);
  }

  return (
    <Opt
      siteName={siteName}
      token={token}
      initialData={initialData.data}
      initialError={initialData.error}
      currentUserEmail={sessionClaims?.email?.trim().toLowerCase() ?? ''}
      isLoggedIn={Boolean(sessionClaims)}
      isRegisteredEmail={isRegisteredEmail}
    />
  );
}
