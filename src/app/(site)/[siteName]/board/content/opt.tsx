'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/board.module.sass';
import CommentSection from '@/components/board/CommentSection';

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
  subject: string | null;
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
  images: PostImage[];
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

type CategoryItem = {
  id: string;
  category_key: string;
  category_label: string;
};

type SeriesItem = {
  id: string;
  series_key: string;
  series_label: string;
};

type ContentResponse = {
  board?: BoardInfo;
  content?: PostContent;
  categories?: CategoryItem[];
  series?: SeriesItem | null;
  isAuthor?: boolean;
  isStaff?: boolean;
  error?: string;
};

type CountResponse = {
  ok?: boolean;
  postCount?: number;
  error?: string;
};

function formatDateTime(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function formatDate(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

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

function renderYoutubeEmbed(youtubeId: string | null) {
  const normalizedYoutubeId = normalizeText(youtubeId);

  if (!normalizedYoutubeId) {
    return null;
  }

  return (
    <div className={styles['youtube-embed']}>
      <iframe
        src={`https://www.youtube.com/embed/${normalizedYoutubeId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();

  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(searchParams.get('boardName')).toLowerCase();
  const contentId = normalizeText(searchParams.get('contentId'));

  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [content, setContent] = useState<PostContent | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
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
        setCategories(Array.isArray(result.categories) ? result.categories : []);
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
        <span>{board.board_label}</span>
      </h2>

      <article className="paper">
        <header className={styles['content-header']}>
          <div>
            <p>
              <Anchor href={`/${siteName}/board`}>최신글 보기</Anchor>
              <span> / </span>
              <span>{board.board_label}</span>
              {content.prefix_label ? (
                <>
                  <span> / </span>
                  <span>{content.prefix_label}</span>
                </>
              ) : null}
              {series ? (
                <>
                  <span> / </span>
                  <span>{series.series_label}</span>
                </>
              ) : null}
            </p>

            <h3>
              {content.is_pin ? <PushPinRoundedIcon /> : null}
              <span>{content.subject || '제목 없음'}</span>
            </h3>
          </div>

          {canEdit ? (
            <Anchor href={`/${siteName}/board/content/edit?boardName=${boardName}&contentId=${content.id}`}>
              <EditOutlinedIcon />
              <span>수정</span>
            </Anchor>
          ) : null}
        </header>

        <div className={styles['content-meta']}>
          <div>
            <Avatar src={content.author_avatar_url} alt={content.author_name || '작성자'} />
            <span>{content.author_name || '작성자'}</span>

            {authorRoleLabel ? (
              <span>{authorRoleLabel}</span>
            ) : content.author_level ? (
              <span>
                {content.author_level.iconUrl ? (
                  <img src={content.author_level.iconUrl} alt={content.author_level.name} />
                ) : null}
                <span>{content.author_level.name}</span>
              </span>
            ) : null}
          </div>

          <span>{formatDateTime(content.published_at || content.created_at)}</span>
          <span>{`조회 ${content.post_count}`}</span>
          {content.edited_at ? <span>{`수정 ${formatDateTime(content.edited_at)}`}</span> : null}
        </div>

        {categories.length > 0 ? (
          <div className={styles['content-categories']}>
            {categories.map((category) => (
              <span key={category.id}>{category.category_label}</span>
            ))}
          </div>
        ) : null}

        {content.thumbnail_image_url ? (
          <div className={styles['content-thumbnail']}>
            <img src={content.thumbnail_image_url} alt="" />
          </div>
        ) : null}

        {isGalleryBoard && content.summary ? <p className={styles['content-summary']}>{content.summary}</p> : null}

        {isYoutubeBoard ? (
          <>
            {renderYoutubeEmbed(content.youtube_id)}
            {content.youtube_created_at ? (
              <p className={styles['content-meta-text']}>
                {`유튜브 업로드 날짜 ${formatDate(content.youtube_created_at)}`}
              </p>
            ) : null}
            {content.summary ? <div className={styles['content-simple']}>{content.summary}</div> : null}
          </>
        ) : null}

        {isFeedBoard && content.content_simple ? (
          <div className={styles['content-simple']}>{content.content_simple}</div>
        ) : null}

        {(isBasicBoard || isGalleryBoard) && content.content_html ? (
          <div
            className="service-editor-view"
            dangerouslySetInnerHTML={{
              __html: content.content_html,
            }}
          />
        ) : null}

        {(isGalleryBoard || isFeedBoard) && content.images.length > 0 ? (
          <div className={styles['content-images']}>
            {content.images.map((image) => (
              <img key={image.path} src={image.url} alt="" />
            ))}
          </div>
        ) : null}

        {isBasicBoard && content.poll ? (
          <div className={styles['content-poll']}>
            <h4>{content.poll.question}</h4>
            <p>{`종료 ${formatDateTime(content.poll.endsAt)}`}</p>
            <ol>
              {content.poll.options.map((option) => (
                <li key={option.id}>
                  {option.image ? <img src={option.image.url} alt="" /> : null}
                  <span>{option.label}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {hashtags.length > 0 ? (
          <div className={styles['content-tags']}>
            {hashtags.map((hashtag) => (
              <span key={hashtag}>{`#${hashtag}`}</span>
            ))}
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
