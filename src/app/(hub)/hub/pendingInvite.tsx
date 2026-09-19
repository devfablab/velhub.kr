'use client';

import { formatDateTimeFull } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import ScreenState from '@/components/service/ScreenState';
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
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
};

export type PendingInviteResponse = {
  invites?: PendingInviteRow[];
  error?: string;
};

export default function PendingInvite({
  initialData,
  initialError,
}: {
  initialData: PendingInviteResponse | null;
  initialError: string;
}) {
  const invites = Array.isArray(initialData?.invites) ? initialData.invites : [];

  if (initialError) {
    return (
      <section className={`paper ${styles.paper} ${styles.pending}`}>
        <ScreenState kind="error">{initialError}</ScreenState>
      </section>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper} ${styles.pending}`}>
      <h2>초대장이 날라왔어요 😎</h2>
      <div className={`paper ${styles['pending-sites']}`}>
        {invites.map((invite) => (
          <div key={invite.id} className={styles['pending-site']}>
            <div className={styles['pending-header']}>
              <div className={styles['site-name']}>
                {invite.profileLogoUrl ? (
                  <img src={invite.profileLogoUrl} alt="" />
                ) : (
                  <>
                    <AppIconAvatar src={invite.profilePictureUrl || null} alt="" size={52} />
                    <strong>{invite.siteLabel}</strong>
                  </>
                )}
                <em>{invite.siteTypeLabel} </em>
              </div>
              <Anchor className="button action small" href={invite.href}>
                가입하러 가기
              </Anchor>
            </div>
            {invite.expiresAt ? <p>{formatDateTimeFull(invite.expiresAt)}까지 초대에 응하실 수 있어요!</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
