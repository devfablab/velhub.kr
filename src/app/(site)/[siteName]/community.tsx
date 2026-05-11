'use client';

import { useState } from 'react';
import Image from 'next/image';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Anchor from '@/components/Anchor';
import SiteInfo from '@/components/service/community/SiteInfo';
import UserInfo from '@/components/service/community/UserInfo';
import TableList from '@/components/service/community/TableList';
import PostCountTableList from '@/components/service/community/PostCountTableList';
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

type CommunityInfo = {
  created_at: RowValue;
  join_type: RowValue;
  policy_post: RowValue;
  policy_comment: RowValue;
};

type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';

type HomeContent = {
  id: string;
  slug: string;
  subject: string;
  summary: string;
  content_simple: string | null;
  edited_at: string;
  created_at: string;
  idx: number;
  board_id: string;
  site_id: string;
  user_id: string;
  author_name: string;
  is_closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
  closed_message: string | null;
  closed_by_name: string;
  prefix_id: string | null;
  prefix_label: string | null;
  series_id: string | null;
  series_label: string | null;
  is_poll: boolean;
  comment_count: number;
  search_title_matched: boolean;
  search_content_matched: boolean;
  search_content: string;
  published_at: string | null;
  published_status: 'draft' | 'published';
  post_count: number;
  is_pin: boolean;
  board_key: string;
  board_label: string;
  thumbnail_image_url: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  images:
    | {
        path: string;
        url: string;
        width: number | null;
        height: number | null;
      }[]
    | null;
  youtube_id: string | null;
};

type HomeBoard = {
  board: {
    id: string;
    board_key: string;
    board_label: string;
    board_type: BoardType;
    markdown_status: string | null;
    post_type: 'none' | 'prefix' | 'series' | null;
    is_active: boolean;
    sort_order: number | null;
  };
  contents: HomeContent[];
};

type Props = {
  siteName: string;
  sitesInfo: SitesInfo;
  communityInfo: CommunityInfo;
  homeBoards: HomeBoard[];
};

const YOUTUBE_THUMBNAIL_QUALITIES = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];

function getYoutubeThumbnailUrl(videoId: string, quality: string) {
  return `https://i.ytimg.com/vi_webp/${videoId}/${quality}.webp`;
}

function YoutubeThumbnailImage({ content }: { content: HomeContent }) {
  const [qualityIndex, setQualityIndex] = useState(0);
  const thumbnailUrl = content.thumbnail_image_url
    ? content.thumbnail_image_url
    : content.youtube_id
      ? getYoutubeThumbnailUrl(content.youtube_id, YOUTUBE_THUMBNAIL_QUALITIES[qualityIndex])
      : '';

  if (!thumbnailUrl) {
    return null;
  }

  return (
    <Image
      src={thumbnailUrl}
      width={content.thumbnail_width ?? 1280}
      height={content.thumbnail_height ?? 720}
      alt=""
      onError={() => {
        if (content.thumbnail_image_url) {
          return;
        }

        setQualityIndex((previousIndex) =>
          previousIndex < YOUTUBE_THUMBNAIL_QUALITIES.length - 1 ? previousIndex + 1 : previousIndex,
        );
      }}
    />
  );
}

function getBoardTypeClassName(boardType: BoardType) {
  if (boardType === 'gallery') {
    return styles['gallery-board'];
  }

  if (boardType === 'youtube') {
    return styles['youtube-board'];
  }

  if (boardType === 'feed') {
    return styles['feed-board'];
  }

  return styles['basic-board'];
}

function renderBasicBoard(siteName: string, homeBoard: HomeBoard) {
  return (
    <ol className={styles.basic}>
      {homeBoard.contents.map((content) => (
        <li key={content.id}>
          <Anchor href={`/${siteName}/${homeBoard.board.board_key}/${content.slug}`}>{content.subject}</Anchor>
          {content.comment_count > 0 ? <em>({content.comment_count.toLocaleString()})</em> : null}
        </li>
      ))}
    </ol>
  );
}

function renderGalleryBoard(siteName: string, homeBoard: HomeBoard) {
  return (
    <div className={styles['content-images']}>
      {homeBoard.contents.map((content) => {
        const imageUrl = content.thumbnail_image_url || content.images?.[0]?.url || '';

        return (
          <Anchor
            key={content.id}
            href={`/${siteName}/${homeBoard.board.board_key}/${content.slug}`}
            className={styles['content-thumbnail-image']}
          >
            {imageUrl ? <img src={imageUrl} alt="" /> : null}
            <strong>{content.subject}</strong>
          </Anchor>
        );
      })}
    </div>
  );
}

function renderYoutubeBoard(siteName: string, homeBoard: HomeBoard) {
  return (
    <div className={styles.youtube}>
      {homeBoard.contents.map((content) => (
        <div key={content.id}>
          <Anchor href={`/${siteName}/${homeBoard.board.board_key}/${content.slug}`}>
            {content.youtube_id ? <YoutubeThumbnailImage content={content} /> : null}
            <strong>{content.subject}</strong>
          </Anchor>
        </div>
      ))}
    </div>
  );
}

function renderFeedBoard(siteName: string, homeBoard: HomeBoard) {
  return (
    <>
      {homeBoard.contents.map((content) => (
        <div key={content.id} className="paper">
          {content.content_simple ? <div className={styles['content-simple']}>{content.content_simple}</div> : null}
          <div className={styles.button}>
            <Anchor href={`/${siteName}/${homeBoard.board.board_key}/${content.slug}`}>
              <span>더보기</span>
              <ChevronRightRoundedIcon />
            </Anchor>
          </div>
        </div>
      ))}
    </>
  );
}

function renderBoardContents(siteName: string, homeBoard: HomeBoard) {
  if (homeBoard.board.board_type === 'gallery') {
    return renderGalleryBoard(siteName, homeBoard);
  }

  if (homeBoard.board.board_type === 'youtube') {
    return renderYoutubeBoard(siteName, homeBoard);
  }

  if (homeBoard.board.board_type === 'feed') {
    return renderFeedBoard(siteName, homeBoard);
  }

  return renderBasicBoard(siteName, homeBoard);
}

export default function Community({ siteName, homeBoards }: Props) {
  return (
    <main>
      <div className="container">
        <aside>
          <SiteInfo />
          <TableList />
        </aside>

        <div className={`content ${styles.content} ${styles['home-content']} `}>
          {homeBoards.length === 0 ? (
            <div className="paper">
              <p>매니저가 홈을 꾸미기 전입니다. 😭</p>
            </div>
          ) : (
            homeBoards.map((homeBoard) => (
              <div key={homeBoard.board.id} className={`paper ${getBoardTypeClassName(homeBoard.board.board_type)}`}>
                <div className={styles.headline}>
                  <h2>
                    {homeBoard.board.board_label} {homeBoard.board.board_type === 'basic' ? '최신글' : null}
                    {homeBoard.board.board_type === 'gallery' ? '이미지보기' : null}
                    {homeBoard.board.board_type === 'youtube' ? '영상보기' : null}
                  </h2>
                  <Anchor href={`/${siteName}/${homeBoard.board.board_key}`}>
                    <span>더보기</span>
                    <ChevronRightRoundedIcon />
                  </Anchor>
                </div>

                {homeBoard.contents.length > 0 ? (
                  renderBoardContents(siteName, homeBoard)
                ) : (
                  <p>등록된 글이 없습니다.</p>
                )}
              </div>
            ))
          )}
        </div>

        <aside>
          <UserInfo />
          <PostCountTableList />
        </aside>
      </div>
    </main>
  );
}
