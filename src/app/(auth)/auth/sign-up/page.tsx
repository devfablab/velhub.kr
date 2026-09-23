import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Container from '../container';
import EmailSignUp from './email';

export const metadata: Metadata = {
  title: '회원가입 - 데브허브',
  description: '회원가입 페이지',
};

type InviteResponse = {
  invite?: { email?: string };
  error?: string;
};

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const inviteToken = getSearchParam(query.inviteToken);
  const inviteSiteName = getSearchParam(query.siteName).toLowerCase();
  const inviteType = getSearchParam(query.inviteType).toLowerCase();
  let initialInviteEmail = '';
  let initialInviteError = '';

  if (inviteToken) {
    try {
      const headerList = await headers();
      const cookieStore = await cookies();
      const host = headerList.get('host');

      if (!host) {
        throw new Error('초대 정보를 불러오지 못했습니다.');
      }

      const protocol = headerList.get('x-forwarded-proto') || 'http';
      const path =
        inviteType === 'community'
          ? `/api/manage/join/invite/${encodeURIComponent(inviteToken)}?siteName=${encodeURIComponent(inviteSiteName)}`
          : `/api/manage/design/blog/team/invite/${encodeURIComponent(inviteToken)}`;
      const response = await fetch(`${protocol}://${host}${path}`, {
        headers: { cookie: cookieStore.toString() },
        cache: 'no-store',
      });
      const result = (await response.json().catch(() => null)) as InviteResponse | null;

      if (!response.ok || !result?.invite?.email) {
        throw new Error(result?.error || '초대 정보를 불러오지 못했습니다.');
      }

      initialInviteEmail = result.invite.email;
    } catch (error) {
      initialInviteError = error instanceof Error ? error.message : '초대 정보를 불러오지 못했습니다.';
    }
  }

  return (
    <Container>
      <EmailSignUp initialInviteEmail={initialInviteEmail} initialInviteError={initialInviteError} />
    </Container>
  );
}
