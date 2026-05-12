'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Dialog, DialogActions, DialogContent, DialogTitle, useTheme } from '@mui/material';
import { formatDateSimple, formatDateTimeDetail, formatDateTimeFull, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import CommentSection from '@/components/board/CommentSection';
import LinkPreview from '@/components/service/LinkPreview';
import styles from '@/app/board.module.sass';
import EmbeddedContentHtml from '@/components/service/EmbeddedContentHtml';

type Props = {
  isCommunity: boolean;
};

type BoardInfo = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'basic' | 'gallery' | 'youtube' | 'feed' | 'page' | 'blog';
  markdown_status: string;
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

type AuthorManageIcon = {
  role: Exclude<AuthorRole, 'member'>;
  icon: string | null;
  iconUrl: string;
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
  author_manage_icon: AuthorManageIcon | null;
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

type PollResultOption = {
  id: number;
  option_index: number;
  label: string;
  image: {
    path: string;
    url: string;
    width: number | null;
    height: number | null;
  } | null;
  count: number;
  percent: number;
  is_selected: boolean;
};

type PollResult = {
  total_count: number;
  selected_option_index: number | null;
  is_ended: boolean;
  options: PollResultOption[];
};

type PollResponse = {
  ok?: boolean;
  total_count?: number;
  selected_option_index?: number | null;
  is_ended?: boolean;
  options?: PollResultOption[];
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

function extractUrls(value: string) {
  const matchedUrls = value.match(/https?:\/\/[^\s<>"']+/g) ?? [];

  return Array.from(new Set(matchedUrls.map((url) => url.replace(/[),.!?]+$/g, '').trim()).filter(Boolean)));
}

export default function Opt({ isCommunity }: Props) {
  const theme = useTheme();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName).toLowerCase();
  const contentId = normalizeText(params.contentId);

  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [content, setContent] = useState<PostContent | null>(null);
  const [series, setSeries] = useState<SeriesItem | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [galleryViewerOpen, setGalleryViewerOpen] = useState(false);
  const [galleryViewerIndex, setGalleryViewerIndex] = useState(0);

  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [isSubmittingPoll, setIsSubmittingPoll] = useState(false);
  const [pollErrorMessage, setPollErrorMessage] = useState('');

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

  function isPastDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return date.getTime() <= Date.now();
  }

  function openGalleryViewer(index: number) {
    setGalleryViewerIndex(index);
    setGalleryViewerOpen(true);
  }

  function closeGalleryViewer() {
    setGalleryViewerOpen(false);
  }

  function showPreviousGalleryImage() {
    if (!content?.images || content.images.length === 0) {
      return;
    }

    setGalleryViewerIndex((previousIndex) => {
      const previousImageIndex = previousIndex - 1;

      return previousImageIndex < 0 ? content.images!.length - 1 : previousImageIndex;
    });
  }

  function showNextGalleryImage() {
    if (!content?.images || content.images.length === 0) {
      return;
    }

    setGalleryViewerIndex((previousIndex) => (previousIndex + 1) % content.images!.length);
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

        if (result.content?.poll) {
          void loadPollResult(boardName, result.content.id);
        }

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

  async function loadPollResult(nextBoardName: string, nextContentId: string) {
    try {
      setPollErrorMessage('');

      const response = await fetch(`/api/boards/${nextBoardName}/${nextContentId}/poll?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as PollResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '투표 정보를 불러오지 못했습니다.');
      }

      setPollResult({
        total_count: typeof result.total_count === 'number' ? result.total_count : 0,
        selected_option_index: typeof result.selected_option_index === 'number' ? result.selected_option_index : null,
        is_ended: result.is_ended === true,
        options: Array.isArray(result.options) ? result.options : [],
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setPollErrorMessage(unknownError.message || '투표 정보를 불러오지 못했습니다.');
      } else {
        setPollErrorMessage('투표 정보를 불러오지 못했습니다.');
      }
    }
  }

  async function submitPoll(optionIndex: number) {
    if (isSubmittingPoll) {
      return;
    }

    try {
      setIsSubmittingPoll(true);
      setPollErrorMessage('');

      const response = await fetch(`/api/boards/${boardName}/${content?.id}/poll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          optionIndex,
        }),
      });

      const result = (await response.json()) as PollResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '투표에 참여하지 못했습니다.');
      }

      setPollResult({
        total_count: typeof result.total_count === 'number' ? result.total_count : 0,
        selected_option_index: typeof result.selected_option_index === 'number' ? result.selected_option_index : null,
        is_ended: result.is_ended === true,
        options: Array.isArray(result.options) ? result.options : [],
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setPollErrorMessage(unknownError.message || '투표에 참여하지 못했습니다.');
      } else {
        setPollErrorMessage('투표에 참여하지 못했습니다.');
      }
    } finally {
      setIsSubmittingPoll(false);
    }
  }

  function getPollOptionResult(optionIndex: number) {
    return pollResult?.options.find((option) => option.option_index === optionIndex) ?? null;
  }

  if (isLoading) {
    return (
      <div className={`${styles.content} content`}>
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
        <div className="paper paper-error">{errorMessage || '게시글 정보를 불러오지 못했습니다.'}</div>
      </div>
    );
  }

  const canEdit = isAuthor || isStaff;
  const isBasicBoard = board.board_type === 'basic';
  const isBlogBoard = board.board_type === 'blog';
  const isGalleryBoard = board.board_type === 'gallery';
  const isYoutubeBoard = board.board_type === 'youtube';
  const isFeedBoard = board.board_type === 'feed';
  const hashtags = normalizeHashtags(content.hashtags);
  const authorRoleLabel = getAuthorRoleLabel(content.author_role);
  const feedLinkPreviewUrls = isFeedBoard && content.content_simple ? extractUrls(content.content_simple) : [];

  return (
    <div className={`${styles.content} content`} style={{ maxWidth: isCommunity ? undefined : 807 }}>
      <div className={styles['top-buttons']}>
        <Anchor href={`/${siteName}/${boardName}`} className="button">
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
                {board.board_type === 'blog' ? <span>글 목록</span> : <span>{board.board_label}</span>}
                <ArrowForwardIosRoundedIcon />
              </Anchor>
              {canEdit ? (
                <Anchor href={`/${siteName}/${boardName}/${content.slug}/edit`} className={styles['edit-link']}>
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
              {!isFeedBoard ? <strong>{content.subject}</strong> : null}
            </h3>

            <div className={styles['author-profile']}>
              <div className={styles.avatar}>
                <Avatar src={content.author_avatar_url} alt={content.author_name} />
              </div>
              <div className={styles.info}>
                <div className={styles.name}>
                  <cite>{content.author_name}</cite>
                  {isCommunity ? (
                    <>
                      {authorRoleLabel ? (
                        <em>
                          <span>{authorRoleLabel}</span>
                          {content.author_manage_icon?.iconUrl ? (
                            <img src={content.author_manage_icon.iconUrl} alt={authorRoleLabel} />
                          ) : null}
                        </em>
                      ) : content.author_level ? (
                        <em>
                          <span>{content.author_level.name}</span>
                          {content.author_level.iconUrl ? (
                            <img src={content.author_level.iconUrl} alt={content.author_level.name} />
                          ) : null}
                        </em>
                      ) : null}
                    </>
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
                <EmbeddedContentHtml
                  contentHtml={content.content_html}
                  contentMarkdown={content.content_markdown}
                  markdownStatus={board.markdown_status}
                  themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                  className="viewer"
                />
              ) : null}
              {content.images && content.images.length > 0 ? (
                <div className={styles['content-images']}>
                  {content.images.map((image, index) => (
                    <div key={image.path} className={styles['content-thumbnail-image']}>
                      <button type="button" onClick={() => openGalleryViewer(index)}>
                        <img src={image.url} alt="" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {content.images && content.images.length > 0 ? (
                <Dialog
                  open={galleryViewerOpen}
                  onClose={closeGalleryViewer}
                  fullScreen
                  className={`vh-dialog ${styles['gallery-viewer-dialog']}`}
                >
                  <DialogTitle className={styles['dialog-title']}>{`${galleryViewerIndex + 1}번째 이미지`}</DialogTitle>
                  <DialogContent className={styles['dialog-content']}>
                    <img src={content.images[galleryViewerIndex].url} alt="" />
                  </DialogContent>
                  <DialogActions className={styles['dialog-actions']}>
                    <button
                      type="button"
                      onClick={showPreviousGalleryImage}
                      className={`${styles['control-button']} ${styles['prev-button']}`}
                      aria-label="이전 이미지"
                    >
                      <ArrowBackRoundedIcon />
                    </button>
                    <button
                      type="button"
                      onClick={showNextGalleryImage}
                      className={`${styles['control-button']} ${styles['next-button']}`}
                      aria-label="다음 이미지"
                    >
                      <ArrowForwardRoundedIcon />
                    </button>
                    <button
                      type="button"
                      onClick={closeGalleryViewer}
                      className={styles['close-button']}
                      aria-label="갤러리 닫기"
                    >
                      <CloseRoundedIcon />
                    </button>
                  </DialogActions>
                </Dialog>
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
              {feedLinkPreviewUrls.length > 0 ? (
                <div className={styles['link-previews']}>
                  {feedLinkPreviewUrls.map((url) => (
                    <LinkPreview key={url} href={url} />
                  ))}
                </div>
              ) : null}

              {content.images && content.images.length > 0 ? (
                <div className={styles['content-images']}>
                  {content.images.map((image, index) => (
                    <div key={image.path} className={styles['content-thumbnail-image']}>
                      <button type="button" onClick={() => openGalleryViewer(index)}>
                        <img src={image.url} alt="" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {content.images && content.images.length > 0 ? (
                <Dialog
                  open={galleryViewerOpen}
                  onClose={closeGalleryViewer}
                  fullScreen
                  className={`vh-dialog ${styles['gallery-viewer-dialog']}`}
                >
                  <DialogTitle className={styles['dialog-title']}>{`${galleryViewerIndex + 1}번째 이미지`}</DialogTitle>
                  <DialogContent className={styles['dialog-content']}>
                    <img src={content.images[galleryViewerIndex].url} alt="" />
                  </DialogContent>
                  <DialogActions className={styles['dialog-actions']}>
                    <button
                      type="button"
                      onClick={showPreviousGalleryImage}
                      className={`${styles['control-button']} ${styles['prev-button']}`}
                      aria-label="이전 이미지"
                    >
                      <ArrowBackRoundedIcon />
                    </button>
                    <button
                      type="button"
                      onClick={showNextGalleryImage}
                      className={`${styles['control-button']} ${styles['next-button']}`}
                      aria-label="다음 이미지"
                    >
                      <ArrowForwardRoundedIcon />
                    </button>
                    <button
                      type="button"
                      onClick={closeGalleryViewer}
                      className={styles['close-button']}
                      aria-label="갤러리 닫기"
                    >
                      <CloseRoundedIcon />
                    </button>
                  </DialogActions>
                </Dialog>
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
        {isBasicBoard || isBlogBoard ? (
          <div className={`${styles['board-container']} ${styles['basic-board']}`}>
            <div className="paper">
              {content.content_html ? (
                <EmbeddedContentHtml
                  contentHtml={content.content_html}
                  contentMarkdown={content.content_markdown}
                  markdownStatus={board.markdown_status}
                  themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                  className="viewer"
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
                  {(() => {
                    const isPollEnded = isPastDateTime(content.poll.endsAt) || pollResult?.is_ended === true;

                    return (
                      <>
                        <strong>{content.poll.question}</strong>
                        <div className={styles.tail}>
                          <span className={styles.total}>{`${pollResult?.total_count ?? 0}명 투표`}</span>
                          {isPollEnded ? (
                            <span className={styles.end}>(종료됨)</span>
                          ) : (
                            <span className={styles.end}>({formatDateTimeFull(content.poll.endsAt)}에 종료)</span>
                          )}
                          {pollErrorMessage ? <p className={styles.fin}>{pollErrorMessage}</p> : null}
                        </div>

                        <ol>
                          {content.poll.options.map((option, optionIndex) => {
                            const optionResult = getPollOptionResult(optionIndex);

                            const selectedOptionIndex =
                              typeof pollResult?.selected_option_index === 'number' &&
                              pollResult.selected_option_index >= 0
                                ? pollResult.selected_option_index
                                : null;

                            const hasVoted = selectedOptionIndex !== null;
                            const shouldShowResult = hasVoted || isPollEnded;
                            const count = optionResult?.count ?? 0;
                            const percent = optionResult?.percent ?? 0;
                            const isSelected = selectedOptionIndex === optionIndex;

                            return (
                              <li key={option.id}>
                                {shouldShowResult ? (
                                  <div
                                    className={`${styles.option} ${isSelected ? styles.selected : styles['un-selected']}`}
                                  >
                                    <div
                                      className={`${styles.progress} ${option.image ? styles['stack-progress'] : ''}`}
                                    >
                                      <i style={{ width: `${percent}%` }} />
                                    </div>
                                    <div className={styles.label}>
                                      {option.image ? <img src={option.image.url} alt="" /> : null}
                                      <span>{option.label}</span>
                                    </div>
                                    <span>{`(${count}명) ${percent}%`}</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void submitPoll(optionIndex)}
                                    disabled={isSubmittingPoll}
                                  >
                                    <div className={styles.label}>
                                      {option.image ? <img src={option.image.url} alt="" /> : null}
                                      <span>{option.label}</span>
                                    </div>
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
      {content.published_status === 'published' ? (
        <CommentSection
          siteName={siteName}
          boardName={boardName}
          contentId={content.id}
          postAuthorId={content.user_id}
          isCommentEnabled={content.is_comment}
        />
      ) : null}
    </div>
  );
}
