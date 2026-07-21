'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Anchor from '@/components/Anchor';
import { normalizeText } from '@/lib/utils';

type InviteResponse = {
  status?: string;
  inviteHref?: string;
};

export default function InviteButton() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [inviteHref, setInviteHref] = useState('');

  useEffect(() => {
    if (!siteName) {
      return;
    }

    let ignore = false;

    async function loadInvite() {
      try {
        const response = await fetch(`/api/users/${siteName}/me`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as InviteResponse;

        if (!ignore && response.ok && result.status === 'pending_invite' && result.inviteHref) {
          setInviteHref(result.inviteHref);
        }
      } catch {
        if (!ignore) {
          setInviteHref('');
        }
      }
    }

    void loadInvite();

    return () => {
      ignore = true;
    };
  }, [siteName]);

  if (!inviteHref) {
    return null;
  }

  return (
    <Anchor href={inviteHref} className="button medium submit">
      가입하기
    </Anchor>
  );
}
