'use client';

import Image from 'next/image';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Chip, useMediaQuery, useTheme } from '@mui/material';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import SiteProfile from '@/components/service/blog/SiteProfile';
import DonationButton, { type DonationStatusResponse } from '@/components/service/common/DonationButton';
import SubscriptionButton, { type SubscriptionStatusResponse } from '@/components/service/common/SubscriptionButton';
import PostCountTableList from '@/components/service/community/PostCountTableList';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import UserInfo from '@/components/service/community/UserInfo';
import { ServiceNoDataIcon } from '@/components/Svgs';
import styles from '@/app/board.module.sass';

type PostImage = {
  url: string;
  width: number | null;
  height: number | null;
};

export type SeriesContentItem = {
  id: string;
  slug: string;
  subject: string;
  summary: string;
  created_at: string;
  published_at: string | null;
  published_status: 'draft' | 'published';
  post_count: number;
  series_idx: number | null;
  is_pin: boolean;
  is_closed: boolean;
  author_name: string;
  comment_count: number;
  thumbnail_image_url: string | null;
  thumbnail_width: number;
  thumbnail_height: number;
  images: PostImage[];
};

type SeriesPostListProps = {
  siteName: string;
  boardName: string;
  boardType: 'basic' | 'gallery' | 'blog';
  seriesName: string;
  isCommunity: boolean;
  contents: SeriesContentItem[];
  isMobile: boolean;
};

type Props = Omit<SeriesPostListProps, 'isMobile'> & {
  boardId: string;
  boardLabel: string;
  seriesLabel: string;
  summary: string | null;
  isCompleted: boolean;
  isSubscriptionEnabled: boolean;
  initialSubscriptionStatus: SubscriptionStatusResponse | null;
  initialDonationStatus: DonationStatusResponse | null;
  currentPage: number;
  totalPage: number;
};

function getContentHref(siteName: string, boardName: string, slug: string, seriesName: string) {
  return `/${siteName}/${boardName}/${slug}?${new URLSearchParams({ seriesName }).toString()}`;
}

function getGalleryThumbnail(content: SeriesContentItem) {
  const firstImage = content.images[0] ?? null;

  if (content.thumbnail_image_url) {
    return {
      url: content.thumbnail_image_url,
      width: content.thumbnail_width || firstImage?.width || 1200,
      height: content.thumbnail_height || firstImage?.height || 675,
    };
  }

  return firstImage;
}

function SeriesPostList({
  siteName,
  boardName,
  boardType,
  seriesName,
  isCommunity,
  contents,
  isMobile,
}: SeriesPostListProps) {
  if (boardType === 'gallery') {
    return (
      <div className={styles['gallery-items']}>
        {contents.map((content) => {
          const thumbnail = getGalleryThumbnail(content);

          return (
            <Anchor href={getContentHref(siteName, boardName, content.slug, seriesName)} key={content.id}>
              <div className={styles.thumbnail}>
                <span>
                  {content.is_pin ? (
                    <i className={styles['pin-icon']} aria-label="상단고정글">
                      <PushPinRoundedIcon />
                    </i>
                  ) : (
                    <i className={styles.number}>{content.series_idx}</i>
                  )}
                </span>
                <small>{`${content.images.length}개 이미지`}</small>
                {thumbnail ? (
                  <img src={thumbnail.url} width={thumbnail.width ?? 1200} height={thumbnail.height ?? 675} alt="" />
                ) : null}
              </div>
              <div className={styles.info}>
                <div className={styles.subject}>
                  <strong>{content.subject}</strong>
                  {content.is_closed ? <em>삭제된 연재글</em> : null}
                </div>
                <div className={styles.author}>
                  <cite>{content.author_name}</cite>
                </div>
                <div className={styles.tail}>
                  <time>{formatTimeAgo(content.published_at ?? content.created_at)}</time>
                  {content.comment_count > 0 ? <span>댓글 {content.comment_count}</span> : null}
                  <span>조회 {content.post_count}</span>
                </div>
              </div>
            </Anchor>
          );
        })}
      </div>
    );
  }

  if (boardType === 'blog') {
    return (
      <div className={styles['blog-items']}>
        {contents.map((content) => (
          <Anchor href={getContentHref(siteName, boardName, content.slug, seriesName)} key={content.id}>
            <div className={styles.thumbnail}>
              {content.thumbnail_image_url ? (
                <Image
                  src={content.thumbnail_image_url}
                  alt=""
                  width={content.thumbnail_width}
                  height={content.thumbnail_height}
                />
              ) : (
                <div className={styles.dummy}>
                  <MenuBookRoundedIcon />
                </div>
              )}
            </div>
            <div className={styles.info}>
              <div className={styles.subject}>
                <strong>{content.subject}</strong>
                {content.is_closed ? <em>삭제된 연재글</em> : null}
                <span>{content.summary}</span>
              </div>
              <div className={styles.author}>
                <cite>{content.author_name}</cite>
              </div>
              <div className={styles.tail}>
                <time>{formatTimeAgo(content.published_at ?? content.created_at)}</time>
                {content.comment_count > 0 ? <span>댓글 {content.comment_count}</span> : null}
                <span>조회 {content.post_count}</span>
              </div>
            </div>
          </Anchor>
        ))}
      </div>
    );
  }

  if (isMobile) {
    return (
      <ol className="list">
        {contents.map((content) => (
          <li key={content.id}>
            <Anchor
              className={content.is_pin ? 'pinned' : undefined}
              href={getContentHref(siteName, boardName, content.slug, seriesName)}
            >
              <div className="subject">
                <div className="board-subject">
                  {content.is_pin ? (
                    <i className="pin-icon" aria-label="상단고정글">
                      <PushPinRoundedIcon />
                    </i>
                  ) : null}
                  <span>{content.subject}</span>
                  {content.is_closed ? <em>삭제된 연재글</em> : null}
                  {content.comment_count > 0 ? (
                    <strong aria-label="댓글 수">{`(${content.comment_count})`}</strong>
                  ) : null}
                </div>
              </div>
              <div className="tail">
                <cite aria-label="작성자">{content.author_name}</cite>
                <time aria-label={isCommunity ? '작성일' : '게시일'}>
                  {formatTimeAgo(content.published_at ?? content.created_at)}
                </time>
                <span>
                  <VisibilityOutlinedIcon aria-label="조회수" sx={{ width: 14, height: 14 }} />
                  {content.post_count}
                </span>
              </div>
            </Anchor>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <table>
      <caption>게시글 목록</caption>
      <colgroup>
        <col />
        <col style={{ width: 127 }} />
        <col style={{ width: 77 }} />
        <col style={{ width: 67 }} />
      </colgroup>
      <thead>
        <tr>
          <th className="long-cell">제목</th>
          <th className="long-cell">작성자</th>
          <th>{isCommunity ? '작성일' : '게시일'}</th>
          <th>조회수</th>
        </tr>
      </thead>
      <tbody>
        {contents.map((content) => (
          <tr key={content.id} className={content.is_pin ? 'pinned' : undefined}>
            <td className="long-cell">
              <div className="board-subject">
                {content.is_pin ? (
                  <i className="pin-icon" aria-label="상단고정글">
                    <PushPinRoundedIcon />
                  </i>
                ) : (
                  <i className="number">{content.series_idx}</i>
                )}
                <Anchor href={getContentHref(siteName, boardName, content.slug, seriesName)}>{content.subject}</Anchor>
                {content.is_closed ? <em>삭제된 연재글</em> : null}
                {content.comment_count > 0 ? (
                  <strong aria-label="댓글 수">{`(${content.comment_count})`}</strong>
                ) : null}
              </div>
            </td>
            <td className="long-cell">
              <cite>{content.author_name}</cite>
            </td>
            <td>{formatTimeAgo(content.published_at ?? content.created_at)}</td>
            <td>{content.post_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Opt({
  siteName,
  boardId,
  boardName,
  boardLabel,
  boardType,
  seriesName,
  seriesLabel,
  summary,
  isCompleted,
  isCommunity,
  isSubscriptionEnabled,
  initialSubscriptionStatus,
  initialDonationStatus,
  contents,
  currentPage,
  totalPage,
}: Props) {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isNotTablet = useMediaQuery(theme.breakpoints.up('xl'));
  const isMobile = !isNotMobile;
  const isTablet = !isNotTablet;

  return (
    <div className="container">
      {isCommunity && !isMobile ? (
        <aside>
          <SiteInfo />
          <TableList />
        </aside>
      ) : null}

      <div className={`content ${styles['blog-list']} ${styles.content}`}>
        {isCommunity ? (
          <h2>
            <LibraryBooksOutlinedIcon fontSize="small" />
            {isCommunity ? <Chip label={boardLabel} size="small" className="chip success" /> : null}
            <span>{seriesLabel}</span>
            {isCompleted ? <Chip label="완결" size="small" className={styles.em} /> : null}
          </h2>
        ) : (
          <SiteProfile />
        )}
        <div className={styles.headline}>
          {isCommunity ? null : (
            <div className={styles['series-info']}>
              <h2>{seriesLabel}</h2>
              {isCompleted ? <Chip label="완결" size="small" className={styles.em} /> : null}
            </div>
          )}
          {summary ? <p>{summary}</p> : null}
          <div className={styles['series-actions']}>
            <SubscriptionButton
              siteName={siteName}
              boardName={boardName}
              board={{
                id: boardId,
                board_key: boardName,
                board_label: boardLabel,
              }}
              selectedSeries={{
                series_key: seriesName,
                series_label: seriesLabel,
              }}
              selectedBoard
              isEnabledByServer={isSubscriptionEnabled}
              initialStatus={initialSubscriptionStatus}
            />
            <DonationButton
              siteName={siteName}
              targetType="series"
              boardName={boardName}
              seriesName={seriesName}
              buttonText="연재 후원"
              initialStatus={initialDonationStatus}
            />
          </div>
        </div>

        <div className="paper">
          {contents.length > 0 ? (
            <SeriesPostList
              siteName={siteName}
              boardName={boardName}
              boardType={boardType}
              seriesName={seriesName}
              isCommunity={isCommunity}
              contents={contents}
              isMobile={isMobile}
            />
          ) : (
            <div className="paper page-info">
              <ServiceNoDataIcon />
              <p>등록된 글이 없습니다.</p>
            </div>
          )}

          {totalPage > 1 ? (
            <nav>
              {currentPage > 1 ? (
                <Anchor href={`/${siteName}/s/${seriesName}?page=${currentPage - 1}`}>이전</Anchor>
              ) : null}

              <span>
                {currentPage} / {totalPage}
              </span>

              {currentPage < totalPage ? (
                <Anchor href={`/${siteName}/s/${seriesName}?page=${currentPage + 1}`}>다음</Anchor>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>

      {isCommunity && !isTablet ? (
        <aside>
          <UserInfo />
          <PostCountTableList />
        </aside>
      ) : null}
    </div>
  );
}
