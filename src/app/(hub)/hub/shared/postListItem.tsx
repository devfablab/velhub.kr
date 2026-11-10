import type { ReactNode } from 'react';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { Avatar } from '@mui/material';
import type { HubPostDisplay } from '@/lib/service/hub/postDisplay';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/customUI/AppIconAvatar';
import OptimizedImage from '@/components/OptimizedImage';
import styles from '@/app/hub.module.sass';

type Props = {
  post: HubPostDisplay;
  date: string;
  dateLabel: string;
  description?: string | null;
  onClick?: () => void;
  badges?: ReactNode;
};

function getYoutubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function getDescriptionFromHtml(html: string | null) {
  return (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function getDescription(post: HubPostDisplay, description?: string | null) {
  if (description) return description;
  if (post.boardType === 'youtube') return post.summary;
  if (post.boardType === 'feed') return post.contentSimple;

  return getDescriptionFromHtml(post.contentHtml);
}

function getThumbnail(post: HubPostDisplay) {
  if (post.boardType === 'youtube') {
    if (post.thumbnailImage) {
      return { url: post.thumbnailImage, width: post.thumbnailWidth, height: post.thumbnailHeight };
    }

    return post.youtubeId ? { url: getYoutubeThumbnailUrl(post.youtubeId), width: null, height: null } : null;
  }

  if (post.boardType === 'gallery' || post.boardType === 'feed') {
    return post.image ? { url: post.image, width: post.imageWidth, height: post.imageHeight } : null;
  }

  return post.thumbnailImage
    ? { url: post.thumbnailImage, width: post.thumbnailWidth, height: post.thumbnailHeight }
    : null;
}

export default function HubPostListItem({ post, date, dateLabel, description, onClick, badges }: Props) {
  const thumbnail = getThumbnail(post);
  const content = getDescription(post, description);
  const authorName = post.authorName.trim();
  const authorImage = post.authorImage || '/broken-image.jpg';

  const item = (
    <>
      <div className={styles.description}>
        <div className={styles.info}>
          {post.boardType === 'feed' ? null : <strong>{post.subject}</strong>}
          {content ? <p>{content}</p> : null}
          {badges}
        </div>
        <div className={styles.tail}>
          <div className={styles['tail-author']}>
            <Avatar src={authorImage} alt={authorName || '알 수 없음'} sx={{ width: 24, height: 24 }} />
            <strong>{authorName}</strong>
            <ScheduleRoundedIcon />
            <time aria-label={dateLabel}>{formatTimeAgo(date)}</time>
          </div>
          <div className={styles['tail-site']}>
            <AppIconAvatar site={post.siteType} src={post.siteImage} alt="" size={24} />
            <strong>{post.siteName}</strong>
          </div>
        </div>
      </div>
      {thumbnail ? (
        <div className={styles.thumbnail}>
          <OptimizedImage src={thumbnail.url} width={thumbnail.width} height={thumbnail.height} sizes="96px" />
        </div>
      ) : null}
    </>
  );

  return (
    <li className={styles.item}>
      {onClick ? (
        <button
          type="button"
          className={`${styles['description-item']} ${styles['description-item-mini']}`}
          onClick={onClick}
        >
          {item}
        </button>
      ) : (
        <Anchor href={post.href} className={`${styles['description-item']} ${styles['description-item-mini']}`}>
          {item}
        </Anchor>
      )}
    </li>
  );
}
