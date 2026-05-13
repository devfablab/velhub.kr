import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { formatDate, normalizeText } from '@/lib/utils';
import styles from '@/app/blogInfo.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type SiteInfo = {
  created_at: string;
  site_key: string;
  site_label: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  summary: string | null;
  site_type: string;
  visibility_type: string;
  theme_type: string;
  is_shutdown: boolean;
};

type BlogInfoResponse = {
  siteInfo?: SiteInfo;
  profilePictureUrl?: string;
  profileLogoUrl?: string;
  error?: string;
};

function getSiteTypeLabel(siteType: string) {
  if (siteType === 'blog') {
    return '블로그';
  }

  if (siteType === 'community') {
    return '커뮤니티';
  }

  return siteType;
}

function getVisibilityLabel(visibilityType: string) {
  if (visibilityType === 'public') {
    return '공개';
  }

  if (visibilityType === 'private') {
    return '비공개';
  }

  return visibilityType;
}

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const cookie = requestHeaders.get('cookie') ?? '';

  const response = await fetch(`${protocol}://${host}/api/info/general/site/${normalizedSiteName}/edit`, {
    method: 'GET',
    headers: {
      cookie,
    },
    cache: 'no-store',
  });

  const result = (await response.json()) as BlogInfoResponse;

  if (!response.ok || !result.siteInfo) {
    return (
      <main>
        <div className="container">
          <div className="content">
            <div className="paper paper-error">{result.error ?? '블로그 정보를 불러오지 못했습니다.'}</div>
          </div>
        </div>
      </main>
    );
  }

  if (result.siteInfo.site_type === 'community') {
    return redirect(`/${siteName}`);
  }

  const siteInfo = result.siteInfo;
  const siteLabel = siteInfo.site_label ?? siteInfo.site_key;

  return (
    <main>
      <div className="container">
        <div className="content">
          <div className={`${styles['site-info']} paper`}>
            <div className={styles['info-site-name']}>
              <em>{getSiteTypeLabel(siteInfo.site_type)}</em> <strong>{siteLabel}</strong>
            </div>
            <p className={styles['info-date']}>({formatDate(siteInfo.created_at)} 개설)</p>
            {siteInfo.summary ? <p className={styles['info-summary']}>{siteInfo.summary}</p> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
