'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { formatDateTimeFull } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type PendingInviteRow = {
  id: string;
  siteName: string;
  siteLabel: string;
  siteType: string;
  siteTypeLabel: string;
  token: string;
  expiresAt: string | null;
  href: string;
};

type PendingInviteResponse = {
  invites?: PendingInviteRow[];
  error?: string;
};

export default function Pending() {
  const [invites, setInvites] = useState<PendingInviteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadPendingInvites() {
      try {
        setErrorMessage('');

        const response = await fetch('/api/home/pending-invites', {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as PendingInviteResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '초대 정보를 불러오지 못했습니다.');
        }

        setInvites(Array.isArray(result.invites) ? result.invites : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '초대 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('초대 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPendingInvites();
  }, []);

  if (isLoading) {
    return null;
  }

  if (errorMessage) {
    return (
      <section className={`paper ${styles.invite}`}>
        <p>{errorMessage}</p>
      </section>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <section className={`paper ${styles.invite}`}>
      <h2>초대장이 날라왔어요 😎</h2>
      {invites.map((invite) => (
        <div key={invite.id} className={`paper ${styles['invite-site']}`}>
          <div className={styles['invite-header']}>
            <div className={styles['site-name']}>
              <em>{invite.siteTypeLabel}</em> <strong>{invite.siteLabel}</strong>
            </div>
            <Anchor className="button action" href={invite.href}>
              가입하러 가기
            </Anchor>
          </div>
          {invite.expiresAt ? <p>{formatDateTimeFull(invite.expiresAt)}까지 초대에 응하실 수 있어요!</p> : null}
        </div>
      ))}
    </section>
  );
}
