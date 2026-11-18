import type { ReactNode } from 'react';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import type { FavoriteBlog } from '@/lib/service/hubFavoriteFolder.shared';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/customUI/AppIconAvatar';
import OptimizedImage, { getHeightBasedSizes } from '@/components/OptimizedImage';
import styles from '@/app/hub.module.sass';

type Props = {
  blog: FavoriteBlog;
  handle?: ReactNode;
  action?: ReactNode;
};

export default function FavoriteBlogCard({ blog, handle, action }: Props) {
  return (
    <div className={`paper ${styles.item} ${handle ? styles['favorite-site'] : ''}`}>
      {handle}
      <div className={styles['description-item']}>
        <div className={styles.description}>
          <div className={styles.info}>
            <span className={styles['favorite-site-name']}>
              {blog.profileLogoUrl ? (
                <OptimizedImage
                  src={blog.profileLogoUrl}
                  width={blog.profileLogoWidth}
                  height={blog.profileLogoHeight}
                  sizes={getHeightBasedSizes(24, blog.profileLogoWidth, blog.profileLogoHeight, 72)}
                />
              ) : (
                <AppIconAvatar src={blog.profilePictureUrl || null} alt={blog.siteLabel} size={24} />
              )}
              <strong>{blog.siteLabel}</strong>
            </span>
            <p>
              {blog.visibilityLabel} 블로그 {blog.isShutdown ? ' / 운영중지' : null}
            </p>
          </div>
          <div className={styles.tail}>
            <div className={styles['tail-container']}>
              <Anchor href={blog.href} className={`button small normal ${styles['setting-folder-button']}`}>
                블로그 이동
                <ArrowForwardRoundedIcon sx={{ width: 16, height: 16 }} />
              </Anchor>
              {action}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
