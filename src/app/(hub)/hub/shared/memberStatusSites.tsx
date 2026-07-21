import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';
type MembershipStatus = 'block' | 'kick' | 'ban' | 'rejoin';

export type MemberStatusSiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
  role: string;
  membershipStatus: MembershipStatus;
  statusAt: string | null;
  rejoinAt: string | null;
  canRejoin: boolean;
  daysUntilRejoin: number | null;
  operationalStatus: 'normal' | 'payment_failed' | 'shutdown' | 'blocked' | 'closed';
  operationalStatusLabel: string;
  latestPosts: [];
};

function getMembershipStatusLabel(status: MembershipStatus) {
  if (status === 'block') {
    return '활동 정지';
  }

  if (status === 'kick') {
    return '강제 탈퇴';
  }

  if (status === 'ban') {
    return '가입 불가';
  }

  return '재가입 가능';
}

function getStatusMessage(site: MemberStatusSiteRow) {
  if (site.membershipStatus === 'block') {
    return '사이트 활동이 정지된 상태입니다.';
  }

  if (site.membershipStatus === 'rejoin' || site.canRejoin) {
    return '지금 재가입할 수 있습니다.';
  }

  if (site.daysUntilRejoin !== null) {
    return `${site.daysUntilRejoin}일 뒤 재가입할 수 있습니다.`;
  }

  return '현재 재가입할 수 없습니다.';
}

function getStatusHref(site: MemberStatusSiteRow) {
  if (site.membershipStatus === 'rejoin') {
    return `/${site.site_key}/rejoin`;
  }

  return `/${site.site_key}/${site.membershipStatus}`;
}

export default function MemberStatusSites({
  siteType,
  statusSites,
  rejoinOnly = false,
}: {
  siteType?: SiteType;
  statusSites: MemberStatusSiteRow[];
  rejoinOnly?: boolean;
}) {
  const filteredSites = statusSites.filter((site) => {
    if (siteType && site.site_type !== siteType) {
      return false;
    }

    return !rejoinOnly || site.membershipStatus === 'rejoin';
  });

  if (filteredSites.length === 0) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper} ${styles.join} ${styles['member-status-sites']}`}>
      <h2>{rejoinOnly ? '재가입 가능' : '확인 필요'}</h2>
      <div className={`paper ${styles['join-sites']}`}>
        {filteredSites.map((site) => (
          <div key={`${site.id}-${site.membershipStatus}`} className={styles['join-site']}>
            <div className={styles['join-site-info']}>
              <div className={styles['site-name']}>
                {site.profileLogoUrl ? (
                  <img src={site.profileLogoUrl} alt="" />
                ) : (
                  <>
                    <AppIconAvatar src={site.profilePictureUrl || null} alt={site.site_label} size={52} />
                    <strong>{site.site_label}</strong>
                  </>
                )}
                <em className={styles[`member-${site.membershipStatus}`]}>
                  {getMembershipStatusLabel(site.membershipStatus)}
                </em>
                <small className={styles[`operation-${site.operationalStatus}`]}>{site.operationalStatusLabel}</small>
              </div>
              <Anchor href={getStatusHref(site)} className="button action small">
                {site.membershipStatus === 'rejoin' || site.canRejoin ? '재가입' : '상태 확인'}
              </Anchor>
            </div>
            <p className={styles['member-status-message']}>{getStatusMessage(site)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
