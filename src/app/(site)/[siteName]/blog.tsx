import Image from 'next/image';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import type { PostListItem } from '@/lib/board/getPostList';
import Anchor from '@/components/Anchor';
import Container from './menu';
import styles from '@/app/board.module.sass';

type RowValue = string | number | boolean | null;

type SitesInfo = {
  rhizomes: {
    created_at: RowValue;
    site_label: RowValue;
    profile_picture: RowValue;
    summary: RowValue;
    site_type: RowValue;
    plan_type: RowValue;
    visibility_type: RowValue;
    theme_type: RowValue;
    is_shutdown: RowValue;
  };
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
  board: BoardRow;
  sitesInfo: SitesInfo;
  blogInfo: BlogInfo;
  blogContents: PostListItem[];
};

function getThumbnailImageUrl(content: PostListItem) {
  return content.thumbnail_image_url || '';
}

export default function Blog(props: Props) {
  return (
    <Container>
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']} `}>
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
                      <Anchor href={`/${props.siteName}/${props.board.board_key}/${content.slug}`}>
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
                        <span>{content.subject}</span>
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
