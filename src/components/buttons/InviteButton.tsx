'use client';

import Anchor from '@/components/Anchor';
import { useSiteInitialData } from '@/app/(site)/[siteName]/SiteInitialDataContext';

type InviteResponse = {
  status?: string;
  inviteHref?: string;
};

export default function InviteButton() {
  const initialData = useSiteInitialData();
  const invite = initialData?.communityUserInfo as InviteResponse | null;
  const inviteHref = invite?.status === 'pending_invite' ? (invite.inviteHref ?? '') : '';

  if (!inviteHref) {
    return null;
  }

  return (
    <Anchor href={inviteHref} className="button medium submit">
      가입하기
    </Anchor>
  );
}
