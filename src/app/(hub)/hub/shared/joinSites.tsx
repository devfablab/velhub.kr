import { formatTimeAgo } from '@/lib/utils';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';

type LatestPostRow = {
  id: string;
  subject: string;
  href: string;
  authorName: string;
  commentCount: number;
  publishedAt: string;
};

export type JoinSiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
  role: string;
  latestPosts: LatestPostRow[];
};

type Props = {
  siteType: SiteType;
  joinSites: JoinSiteRow[];
};

function getSectionTitle(siteType: SiteType) {
  return siteType === 'blog' ? '블로그' : '커뮤니티';
}

function getRoleLabel(role: string) {
  if (role === 'owner') {
    return '운영자';
  }

  if (role === 'manager') {
    return '매니저';
  }

  if (role === 'member') {
    return '멤버';
  }

  return role;
}

export default function JoinSites({ siteType, joinSites }: Props) {
  const filteredSites = joinSites.filter((site) => site.site_type === siteType);

  if (filteredSites.length === 0) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper} ${styles.join}`}>
      <h2>{siteType === 'blog' ? '팀블로그' : '가입 커뮤니티'}</h2>
      <div className={`paper ${styles['join-sites']}`}>
        {filteredSites.map((site) => (
          <div key={site.id} className={styles['join-site']}>
            <div className={styles['join-site-info']}>
              <div className={styles['site-name']}>
                {site.profileLogoUrl ? (
                  <img src={site.profileLogoUrl} alt="" />
                ) : (
                  <>
                    <AppIconAvatar src={site.profilePictureUrl} alt={site.site_label || ''} size={52} />
                    <strong>{site.site_label}</strong>
                  </>
                )}
                <em>{getRoleLabel(site.role)}</em>
              </div>
              <Anchor href={`/${site.site_key}`} className="button action small">
                {getSectionTitle(siteType)} 이동
              </Anchor>
            </div>

            {site.latestPosts.length > 0 ? (
              <div className={styles['join-site-list']}>
                <ol>
                  {site.latestPosts.map((post) => (
                    <li key={post.id}>
                      <Anchor href={`/${site.site_key}${post.href}`}>
                        <span>
                          <strong aria-label="제목">{post.subject}</strong>
                          {post.commentCount > 0 ? <small aria-label="댓글 개수">({post.commentCount})</small> : null}
                        </span>
                        <cite aria-label="작성자">{post.authorName}</cite>
                        <time aria-label="작성일">{formatTimeAgo(post.publishedAt)}</time>
                      </Anchor>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
