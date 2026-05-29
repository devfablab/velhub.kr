'use client';

import { useEffect, useState } from 'react';
import { formatDateTimeFull } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import styles from '@/app/hub.module.sass';

type PendingJoinRow = {
  id: string;
  siteName: string;
  siteLabel: string;
  siteType: string;
  siteTypeLabel: string;
  nickname: string;
  requestedAt: string;
  href: string;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
};

type PendingJoinResponse = {
  joins?: PendingJoinRow[];
  error?: string;
};

export default function PendingJoin() {
  const [joins, setJoins] = useState<PendingJoinRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadPendingJoin() {
      try {
        setErrorMessage('');

        const response = await fetch('/api/hub/pending-join', {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as PendingJoinResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '가입 신청 정보를 불러오지 못했습니다.');
        }

        setJoins(Array.isArray(result.joins) ? result.joins : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '가입 신청 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('가입 신청 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPendingJoin();
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

  if (joins.length === 0) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper} ${styles.pending}`}>
      <h2>가입 승인을 기다리고 있어요 💁‍♀️</h2>
      <div className={`paper ${styles['pending-sites']}`}>
        {joins.map((join) => (
          <div key={join.id} className={styles['pending-site']}>
            <div className={styles['pending-header']}>
              <div className={styles['site-name']}>
                <em>{join.siteTypeLabel} </em>
                {join.profileLogoUrl ? (
                  <img src={join.profileLogoUrl} alt="" />
                ) : (
                  <>
                    {join.profilePictureUrl ? (
                      <AppIconAvatar src={join.profilePictureUrl || null} alt="" size={52} />
                    ) : null}
                    <strong>{join.siteLabel}</strong>
                  </>
                )}
              </div>
              <Anchor className="button action small" href={join.href}>
                커뮤니티 이동
              </Anchor>
            </div>
            <p>
              {formatDateTimeFull(join.requestedAt)}에 가입을 신청했어요. (별명: {join.nickname})
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
