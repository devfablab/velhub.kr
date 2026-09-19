'use client';

import { formatDateTimeFull } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import ScreenState from '@/components/service/ScreenState';
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

export type PendingJoinResponse = {
  joins?: PendingJoinRow[];
  error?: string;
};

export default function PendingJoin({
  initialData,
  initialError,
}: {
  initialData: PendingJoinResponse | null;
  initialError: string;
}) {
  const joins = Array.isArray(initialData?.joins) ? initialData.joins : [];

  if (initialError) {
    return (
      <section className={`paper ${styles.paper} ${styles.pending}`}>
        <ScreenState kind="error">{initialError}</ScreenState>
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
                <em>{join.siteTypeLabel}</em>
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
