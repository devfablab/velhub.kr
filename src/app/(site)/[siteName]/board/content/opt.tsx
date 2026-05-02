'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { formatDateSimple, formatDateTimeDetail, formatDateTimeFull, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import CommentSection from '@/components/board/CommentSection';
import styles from '@/app/board.module.sass';

type BoardInfo = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';
  markdown_status: string | null;
  site_id: string;
  post_type: 'none' | 'prefix' | 'series' | null;
};

type PostImage = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type AuthorRole =
  | 'owner'
  | 'community-manager'
  | 'board-manager'
  | 'board-general-manager'
  | 'board-assistant-manager'
  | 'member';

type AuthorManageRole = {
  role: Exclude<AuthorRole, 'owner' | 'member'>;
  boardId: string | null;
};

type AuthorLevel = {
  id: string;
  lv: number;
  name: string;
  icon: string | null;
  iconUrl: string;
};

type PollOption = {
  id: number;
  label: string;
  image: {
    path: string;
    url: string;
    width: number | null;
    height: number | null;
  } | null;
};

type PollData = {
  question: string;
  creator_id: string;
  endType: 'absolute' | 'relative';
  endsAt: string;
  options: PollOption[];
};

type PostContent = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  content_html: string | null;
  content_markdown: string | null;
  content_simple: string | null;
  edited_at: string | null;
  thumbnail_image: string | null;
  thumbnail_image_url: string;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  youtube_url: string | null;
  youtube_id: string | null;
  youtube_created_at: string | null;
  images: PostImage[] | null;
  poll: PollData | null;
  hashtags: unknown;
  idx: number;
  user_id: string;
  created_at: string;
  is_closed: boolean;
  closed_message: string | null;
  published_status: 'draft' | 'published';
  published_at: string | null;
  is_comment: boolean;
  post_count: number;
  is_pin: boolean;
  author_name: string;
  author_avatar_url: string;
  author_level: AuthorLevel | null;
  author_role: AuthorRole;
  author_manage_roles: AuthorManageRole[];
  closed_by_name: string;
  prefix_label: string | null;
};

type SeriesItem = {
  id: string;
  series_key: string;
  series_label: string;
  is_completed: boolean;
};

type ContentResponse = {
  board: BoardInfo;
  content?: PostContent;
  series?: SeriesItem | null;
  isAuthor: boolean;
  isStaff: boolean;
  error?: string;
};

type CountResponse = {
  ok?: boolean;
  postCount?: number;
  error?: string;
};

function normalizeHashtags(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && Boolean(normalizeText(item)));
  }

  if (typeof value === 'string') {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(normalizedValue);

      if (Array.isArray(parsedValue)) {
        return parsedValue.filter((item): item is string => typeof item === 'string' && Boolean(normalizeText(item)));
      }
    } catch {
      return [normalizedValue];
    }

    return [normalizedValue];
  }

  return [];
}

function getAuthorRoleLabel(role: AuthorRole) {
  if (role === 'owner') {
    return '운영자';
  }

  if (role === 'community-manager') {
    return '커뮤니티 매니저';
  }

  if (role === 'board-manager') {
    return '전체 게시판 매니저';
  }

  if (role === 'board-general-manager') {
    return '개별 게시판 총괄 매니저';
  }

  if (role === 'board-assistant-manager') {
    return '개별 게시판 부 매니저';
  }

  return '';
}

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();

  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(searchParams.get('boardName')).toLowerCase();
  const contentId = normalizeText(searchParams.get('contentId'));

  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [content, setContent] = useState<PostContent | null>(null);
  const [series, setSeries] = useState<SeriesItem | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  function updatePostCount(nextPostCount: number) {
    setContent((previousContent) =>
      previousContent
        ? {
            ...previousContent,
            post_count: nextPostCount,
          }
        : previousContent,
    );
  }

  async function increasePostCount(nextBoardName: string, nextContentId: string) {
    try {
      const response = await fetch(`/api/boards/${nextBoardName}/${nextContentId}/count?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
      });

      const result = (await response.json()) as CountResponse;

      if (!response.ok) {
        return;
      }

      if (typeof result.postCount === 'number') {
        updatePostCount(result.postCount);
      }
    } catch {
      return;
    }
  }

  useEffect(() => {
    async function loadContent() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards/${boardName}/${contentId}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as ContentResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '게시글 정보를 불러오지 못했습니다.');
        }

        setBoard(result.board ?? null);
        setContent(result.content ?? null);
        setSeries(result.series ?? null);
        setIsAuthor(result.isAuthor === true);
        setIsStaff(result.isStaff === true);

        if (result.content?.published_status === 'published') {
          void increasePostCount(boardName, contentId);
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시글 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시글 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (!siteName || !boardName || !contentId) {
      setErrorMessage('게시글 정보를 불러오지 못했습니다.');
      setIsLoading(false);
      return;
    }

    void loadContent();
  }, [siteName, boardName, contentId]);

  if (isLoading) {
    return (
      <div className={`${styles.content} content`}>
        <h2>
          <ListAltOutlinedIcon />
          <span>글 보기</span>
        </h2>
        <div className="paper">
          <div className="loading-container">
            <LoadingIndicator />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage || !board || !content) {
    return (
      <div className={`${styles.content} content`}>
        <h2>
          <ListAltOutlinedIcon />
          <span>글 보기</span>
        </h2>
        <div className="paper paper-error">{errorMessage || '게시글 정보를 불러오지 못했습니다.'}</div>
      </div>
    );
  }

  const canEdit = isAuthor || isStaff;
  const isBasicBoard = board.board_type === 'basic';
  const isGalleryBoard = board.board_type === 'gallery';
  const isYoutubeBoard = board.board_type === 'youtube';
  const isFeedBoard = board.board_type === 'feed';
  const hashtags = normalizeHashtags(content.hashtags);
  const authorRoleLabel = getAuthorRoleLabel(content.author_role);

  return (
    <div className={`${styles.content} content`}>
      <h2>
        <ListAltOutlinedIcon />
        <span>최신글 보기</span>
      </h2>

      <div className={styles['top-buttons']}>
        <Anchor href={`/${siteName}/board`} className="button">
          <ArrowBackIosRoundedIcon />
          <span>목록</span>
        </Anchor>
        <Anchor href="" className="button">
          <span>다음글</span>
          <ArrowForwardIosRoundedIcon />
        </Anchor>
      </div>

      <article>
        <div className="paper">
          <header className={styles['content-header']}>
            <div className={styles['content-board-name']}>
              <Anchor href={`/${siteName}/${board.board_key}`} className={styles['board-link']}>
                <span>{board.board_label}</span>
                <ArrowForwardIosRoundedIcon />
              </Anchor>
              {canEdit ? (
                <Anchor
                  href={`/${siteName}/board/content/edit?boardName=${boardName}&contentId=${content.id}`}
                  className={styles['edit-link']}
                >
                  <span>글 수정</span>
                  <EditNoteRoundedIcon />
                </Anchor>
              ) : null}
            </div>
            <h3>
              {content.is_pin ? (
                <i className={styles['pin-icon']} aria-label="상단고정글">
                  <PushPinRoundedIcon />
                </i>
              ) : null}
              {content.prefix_label ? <small>[{content.prefix_label}]</small> : null}
              {series ? (
                <small>
                  [{series.series_label}
                  {series.is_completed ? ' (완결)' : null}]
                </small>
              ) : null}
              <strong>{content.subject}</strong>
            </h3>

            <div className={styles['author-profile']}>
              <div className={styles.avatar}>
                <Avatar src={content.author_avatar_url} alt={content.author_name} />
              </div>
              <div className={styles.info}>
                <div className={styles.name}>
                  <cite>{content.author_name}</cite>
                  {authorRoleLabel ? (
                    <span>{authorRoleLabel}</span>
                  ) : content.author_level ? (
                    <em>
                      {content.author_level.iconUrl ? (
                        <img src={content.author_level.iconUrl} alt={content.author_level.name} />
                      ) : null}
                      <span>{content.author_level.name}</span>
                    </em>
                  ) : null}
                </div>
                <div className={styles.datetime}>
                  <span aria-label="작성일">{formatDateTimeDetail(content.published_at || content.created_at)}</span>
                  {content.edited_at ? <span>{`(수정됨)`}</span> : null}
                  <span aria-label="조회수">
                    <VisibilityOutlinedIcon /> {content.post_count}
                  </span>
                </div>
              </div>
            </div>
          </header>
        </div>
        {isGalleryBoard ? (
          <div className={`${styles['board-container']} ${styles['gallery-board']}`}>
            <div className="paper">
              {content.summary ? <p className={styles['content-summary']}>{content.summary}</p> : null}
              {content.content_html ? (
                <div
                  className="viewer"
                  dangerouslySetInnerHTML={{
                    __html: content.content_html,
                  }}
                />
              ) : null}
              {content.images && content.images.length > 0 ? (
                <div className={styles['content-images']}>
                  {content.images.map((image) => (
                    <div key={image.path} className={styles['content-thumbnail-image']}>
                      <img src={image.url} alt="" />
                    </div>
                  ))}
                </div>
              ) : null}
              {hashtags.length > 0 ? (
                <div className={styles['content-tags']}>
                  {hashtags.map((hashtag) => (
                    <span key={hashtag}>{`#${hashtag}`}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {isYoutubeBoard && content.youtube_id ? (
          <div className={`${styles['board-container']} ${styles['youtube-board']}`}>
            <div className="paper paper-p0">
              <YoutubeEmbed
                videoId={content.youtube_id}
                thumbnailImage={content.thumbnail_image ? content.thumbnail_image_url : undefined}
              />
            </div>
            <div className="paper">
              <strong>{`유튜브 공개: ${formatDateSimple(content.youtube_created_at)}`}</strong>
              {content.summary ? <div className={styles['content-simple']}>{content.summary}</div> : null}
              {hashtags.length > 0 ? (
                <div className={styles['content-tags']}>
                  {hashtags.map((hashtag) => (
                    <span key={hashtag}>{`#${hashtag}`}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {isFeedBoard ? (
          <div className={`${styles['board-container']} ${styles['feed-board']}`}>
            <div className="paper">
              {content.content_simple ? <div className={styles['content-simple']}>{content.content_simple}</div> : null}
              {content.images && content.images.length > 0 ? (
                <div className={styles['content-images']}>
                  {content.images.map((image) => (
                    <div key={image.path} className={styles['content-thumbnail-image']}>
                      <img src={image.url} alt="" />
                    </div>
                  ))}
                </div>
              ) : null}
              {hashtags.length > 0 ? (
                <div className={styles['content-tags']}>
                  {hashtags.map((hashtag) => (
                    <span key={hashtag}>{`#${hashtag}`}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {isBasicBoard ? (
          <div className={`${styles['board-container']} ${styles['basic-board']}`}>
            <div className="paper">
              {content.content_html ? (
                <div
                  className="viewer"
                  dangerouslySetInnerHTML={{
                    __html: content.content_html,
                  }}
                />
              ) : null}
              {hashtags.length > 0 ? (
                <div className={styles['content-tags']}>
                  {hashtags.map((hashtag) => (
                    <span key={hashtag}>{`#${hashtag}`}</span>
                  ))}
                </div>
              ) : null}
            </div>
            {content.poll ? (
              <div className="paper">
                <div className={styles['content-poll']}>
                  <h4>{content.poll.question}</h4>
                  <p>{`종료 ${formatDateTimeDetail(content.poll.endsAt)}`}</p>
                  <ol>
                    {content.poll.options.map((option) => (
                      <li key={option.id}>
                        {option.image ? <img src={option.image.url} alt="" /> : null}
                        <span>{option.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
      <CommentSection
        siteName={siteName}
        boardName={boardName}
        contentId={content.id}
        postAuthorId={content.user_id}
        isCommentEnabled={content.is_comment}
      />
    </div>
  );
}
