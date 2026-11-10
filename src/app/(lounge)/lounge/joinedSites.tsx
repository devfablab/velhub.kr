import EastRoundedIcon from '@mui/icons-material/EastRounded';
import { Chip } from '@mui/material';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/customUI/AppIconAvatar';
import type { JoinedSite } from '@/app/api/home/joined-sites/route';
import styles from '@/app/page.module.sass';

function getRoleLabel(role: JoinedSite['role']) {
  if (role === 'owner') {
    return '운영자';
  }

  if (role === 'manager') {
    return '매니저';
  }

  return '';
}

export default function JoinedSites({ sites }: { sites: JoinedSite[] }) {
  if (sites.length === 0) {
    return null;
  }

  return (
    <section>
      <h2>가입한 사이트</h2>
      <div className={`paper ${styles['joined-sites']}`}>
        {sites.map((site) => {
          const roleLabel = getRoleLabel(site.role);
          return (
            <Anchor key={site.id} href={site.siteUrl} className={styles['joined-site']}>
              <AppIconAvatar src={site.profilePictureUrl} alt={site.siteLabel} site={site.siteType} size={52} />
              {roleLabel ? <Chip label={roleLabel} size="small" className="chip outlined success" /> : null}
              <strong>{site.siteLabel}</strong>
            </Anchor>
          );
        })}
        <strong className={styles['joined-site-more']}>
          <Anchor href="/hub">
            마이허브 이동하기 <EastRoundedIcon />
          </Anchor>
        </strong>
      </div>
    </section>
  );
}
