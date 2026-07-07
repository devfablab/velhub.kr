import Image from 'next/image';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import type { PostListItem } from '@/lib/board/getPostList';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import SiteProfile from '@/components/service/blog/SiteProfile';
import Container from './menu';
import styles from '@/app/board.module.sass';

type RowValue = string | number | boolean | null;

type SitesInfo = {
  sites: {
    updated_at: RowValue;
    updated_by: RowValue;
  };
};

type BlogInfo = {
  created_at: RowValue;
  comment_provider: RowValue;
};

type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: BoardType;
  markdown_status: string | null;
  post_type: 'none' | 'prefix' | 'series' | null;
  is_active: boolean;
  sort_order: number | null;
};

type Props = {
  siteName: string;
  board?: BoardRow | null;
  sitesInfo: SitesInfo;
  blogInfo: BlogInfo;
  blogContents?: PostListItem[] | null;
};

function getThumbnailImageUrl(content: PostListItem) {
  return content.thumbnail_image_url || '';
}

export default function Blog(props: Props) {
  if (
    props.board === null ||
    props.board === undefined ||
    props.blogContents === null ||
    props.blogContents === undefined
  ) {
    return (
      <Container>
        <div className="container">
          <div className={`content ${styles.content} ${styles['blog-content']} `}>
            <SiteProfile />
            <div className="paper">
              <p>출간된 글이 없습니다. 😭</p>
            </div>
          </div>
        </div>
      </Container>
    );
  }
  return (
    <Container>
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']} `}>
          <SiteProfile />
          {props.blogContents.length === 0 ? (
            <div className="paper">
              <p>출간된 글이 없습니다. 😭</p>
            </div>
          ) : (
            <div className={`paper ${styles.blog}`}>
              <ol>
                {props.blogContents.map((content) => {
                  const thumbnailImageUrl = getThumbnailImageUrl(content);
                  return (
                    <li key={content.id}>
                      <Anchor href={`/${props.siteName}/${props.board?.board_key}/${content.slug}`}>
                        {thumbnailImageUrl && content.thumbnail_width && content.thumbnail_height ? (
                          <Image
                            src={thumbnailImageUrl}
                            width={content.thumbnail_width}
                            height={content.thumbnail_height}
                            alt=""
                          />
                        ) : (
                          <div className={styles.dummy}>
                            <MenuBookRoundedIcon />
                          </div>
                        )}
                        <div className={styles.info}>
                          <strong>{content.subject}</strong>
                          {content.summary ? <span>{content.summary}</span> : null}
                          {content.published_at ? (
                            <time dateTime={content.published_at}>{formatTimeAgo(content.published_at)}</time>
                          ) : null}
                        </div>
                      </Anchor>
                    </li>
                  );
                })}
              </ol>
              <div className={styles.button}>
                <Anchor href={`/${props.siteName}/${props.board.board_key}`}>
                  <span>더보기</span>
                  <ArrowForwardRoundedIcon />
                </Anchor>
              </div>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
