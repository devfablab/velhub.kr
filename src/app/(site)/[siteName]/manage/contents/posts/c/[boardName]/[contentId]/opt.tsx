'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Box, Chip, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import Container from '../../../../../menu';
import styles from '@/app/manage.module.sass';

type CategoryRow = {
  id: string;
  category_key: string;
  category_label: string;
};

type PrefixRow = {
  id: string;
  prefix_label: string;
};

type SeriesRow = {
  id: string;
  series_key: string;
  series_label: string;
};

type PollRow = {
  question: string;
  options: Array<{
    id: number;
    label: string;
  }>;
};

type ImageRow = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type ContentResponse = {
  board?: {
    id: string;
    board_key: string;
    board_label: string;
    board_type: 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';
    markdown_status: string;
    site_id: string;
    post_type: 'none' | 'prefix' | 'series';
  };
  content?: {
    id: string;
    slug: string;
    subject: string | null;
    summary: string | null;
    content_html: string | null;
    content_markdown: string | null;
    content_simple?: string | null;
    edited_at: string | null;
    thumbnail_image: string | null;
    thumbnail_image_url?: string;
    thumbnail_width: number | null;
    thumbnail_height: number | null;
    youtube_url?: string | null;
    youtube_id?: string | null;
    youtube_created_at?: string | null;
    images?: ImageRow[];
    poll?: PollRow | null;
    hashtags?: string[] | null;
    idx?: number | null;
    series_idx?: number | null;
    created_at: string;
    author_name: string;
    is_closed?: boolean;
    closed_at?: string | null;
    closed_message?: string | null;
    closed_by_name?: string;
    published_status?: 'draft' | 'published';
    published_at?: string | null;
    prefix_label?: string | null;
    og_image?: string | null;
    og_image_url?: string | null;
    sort_order?: number | null;
    attachment_slug?: string | null;
    attachment_origin?: string | null;
    is_comment?: boolean | null;
    post_count?: number | null;
  };
  categories?: CategoryRow[];
  prefixes?: PrefixRow[];
  series?: SeriesRow | null;
  isAuthor?: boolean;
  isStaff?: boolean;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName).toLowerCase();
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const viewTimerReference = useRef<number | null>(null);
  const hasRequestedViewReference = useRef(false);

  const [board, setBoard] = useState<ContentResponse['board'] | null>(null);
  const [content, setContent] = useState<ContentResponse['content'] | null>(null);
  const [series, setSeries] = useState<SeriesRow | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadContent() {
      try {
        setErrorMessage('');
        hasRequestedViewReference.current = false;

        const response = await fetch(`/api/boards/${boardName}/${contentId}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as ContentResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '글 정보를 불러오지 못했습니다.');
        }

        if (!result.board || !result.content) {
          throw new Error('글 정보를 불러오지 못했습니다.');
        }

        setBoard(result.board);
        setContent(result.content);
        setSeries(result.series ?? null);
        setIsAuthor(result.isAuthor === true);
        setIsStaff(result.isStaff === true);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '글 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('글 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadContent();

    return () => {
      if (viewTimerReference.current) {
        window.clearTimeout(viewTimerReference.current);
      }
    };
  }, [boardName, contentId, siteName]);

  useEffect(() => {
    if (!board || !content || board.board_type === 'page' || isAuthor) {
      return;
    }

    if (content.published_status !== 'published') {
      return;
    }

    if (content.is_closed) {
      return;
    }

    if (hasRequestedViewReference.current) {
      return;
    }

    viewTimerReference.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/boards/${boardName}/${contentId}?siteName=${siteName}&countView=1`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as ContentResponse;

        if (!response.ok || !result.content) {
          return;
        }

        hasRequestedViewReference.current = true;
        setContent((previousContent) => {
          if (!previousContent) {
            return previousContent;
          }

          return {
            ...previousContent,
            post_count: result.content?.post_count ?? previousContent.post_count,
          };
        });
      } catch {
        return;
      }
    }, 5000);

    return () => {
      if (viewTimerReference.current) {
        window.clearTimeout(viewTimerReference.current);
      }
    };
  }, [board, boardName, content, contentId, isAuthor, siteName]);

  if (isLoading) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (!board || !content) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper paper-error ${styles.paper}`}>콘텐츠를 찾을 수 없습니다.</div>
            <Stack direction="row" justifyContent="space-between" gap={1} sx={{ p: 2 }}>
              <Anchor href={`/${siteName}/manage/contents/posts/c/${boardName}`} className="button medium cancel">
                목록
              </Anchor>
            </Stack>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          {content.is_closed ? <div className={`paper paper-error ${styles.paper}`}>삭제된 글입니다.</div> : null}

          <div className={`paper ${styles.paper}`}>
            <Stack gap={1}>
              {board.board_type !== 'feed' ? (
                <Stack direction="row" gap={2} alignItems="center">
                  <Typography variant="h6" component="h3">
                    {content.prefix_label ? `[${content.prefix_label}] ` : null}
                    {typeof content.series_idx === 'number' ? `{content.series_idx}. ` : null}

                    {series?.series_label ? `[${series.series_label}] ` : null}
                    {content.subject}
                  </Typography>
                  {content.published_status === 'draft' ? (
                    <Chip label="임시저장글" color="warning" size="small" />
                  ) : null}
                </Stack>
              ) : null}
              {content.summary ? <Typography variant="subtitle2">{content.summary}</Typography> : null}

              <Typography variant="subtitle2">{content.author_name}</Typography>

              <Stack direction="row" gap={3}>
                <Stack direction="row" gap={1}>
                  <Typography variant="subtitle2">작성</Typography>
                  <Typography variant="body2">{formatDateTimeDetail(content.created_at)}</Typography>
                </Stack>

                {content.published_at ? (
                  <Stack direction="row" gap={1}>
                    <Typography variant="subtitle2">게시</Typography>
                    <Typography variant="body2">{formatDateTimeDetail(content.published_at)}</Typography>
                  </Stack>
                ) : null}

                {content.edited_at ? (
                  <Stack direction="row" gap={1}>
                    <Typography variant="subtitle2">수정</Typography>
                    <Typography variant="body2">{formatDateTimeDetail(content.edited_at)}</Typography>
                  </Stack>
                ) : null}
              </Stack>

              {board.board_type === 'youtube' ? (
                <>
                  {content.youtube_id ? (
                    <YoutubeEmbed videoId={content.youtube_id} thumbnailImage={content.thumbnail_image_url} />
                  ) : null}
                </>
              ) : null}
              {board.board_type === 'youtube' && content.youtube_created_at ? (
                <Stack gap={0.75}>
                  <Typography variant="subtitle2">유튜브 공개</Typography>
                  <Typography variant="body2">{formatDateTimeDetail(content.youtube_created_at)}</Typography>
                </Stack>
              ) : null}

              {typeof content.is_comment === 'boolean' ? (
                <Typography variant="body2">{content.is_comment ? '댓글 가능한 글' : '댓글 차단글'}</Typography>
              ) : null}

              {board.board_type !== 'feed' && board.board_type !== 'youtube' && content.thumbnail_image_url ? (
                <Stack gap={0.75}>
                  <Typography variant="subtitle2">
                    {board.board_type === 'basic' ? '썸네일 이미지' : '오픈 그래프 이미지'}
                  </Typography>
                  <Box
                    component="img"
                    src={content.thumbnail_image_url}
                    alt="썸네일 이미지"
                    sx={{ width: '100%', maxWidth: 520, display: 'block' }}
                  />
                </Stack>
              ) : null}

              {Array.isArray(content.images) && content.images.length > 0 ? (
                <Stack gap={1}>
                  <Typography variant="subtitle2">이미지</Typography>
                  <Stack gap={1.5}>
                    {content.images.map((image, index) => (
                      <Box
                        key={`${image.path}-${index}`}
                        component="img"
                        src={image.url}
                        alt={`이미지 ${index + 1}`}
                        sx={{ width: '100%', maxWidth: 520, display: 'block' }}
                      />
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              {board.board_type === 'feed' && content.content_simple ? (
                <Stack gap={0.75}>
                  <Typography variant="subtitle2">내용</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {content.content_simple}
                  </Typography>
                </Stack>
              ) : null}

              {(board.board_type === 'basic' || board.board_type === 'gallery') && content.content_html ? (
                <Stack gap={0.75}>
                  <Typography variant="subtitle2">내용</Typography>
                  <Box
                    sx={{
                      '& img': {
                        maxWidth: '100%',
                        height: 'auto',
                      },
                    }}
                    dangerouslySetInnerHTML={{ __html: content.content_html }}
                  />
                </Stack>
              ) : null}

              {Array.isArray(content.hashtags) && content.hashtags.length > 0 ? (
                <Stack gap={0.75}>
                  <Typography variant="subtitle2">해시태그</Typography>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {content.hashtags.map((hashtag) => (
                      <Chip key={hashtag} label={`#${hashtag}`} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              {content.is_closed && content.closed_at ? (
                <Stack gap={0.75}>
                  <Typography variant="subtitle2">삭제일</Typography>
                  <Typography variant="body2">{formatDateTimeDetail(content.closed_at)}</Typography>
                </Stack>
              ) : null}

              {content.is_closed && content.closed_by_name ? (
                <Stack gap={0.75}>
                  <Typography variant="subtitle2">삭제자</Typography>
                  <Typography variant="body2">{content.closed_by_name}</Typography>
                </Stack>
              ) : null}

              {content.is_closed && content.closed_message ? (
                <Stack gap={0.75}>
                  <Typography variant="subtitle2">삭제 사유</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {content.closed_message}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>기본 기능만 제공됩니다. 실제 적용 화면과 다를 수 있습니다.</span>
            </p>
          </div>
          <Stack direction="row" justifyContent="space-between" gap={1} sx={{ p: 2 }}>
            <Anchor href={`/${siteName}/manage/contents/posts/c/${boardName}`} className="button medium cancel">
              목록
            </Anchor>
            {isAuthor || isStaff ? (
              <Anchor
                href={`/${siteName}/manage/contents/posts/c/${boardName}/${contentId}/edit`}
                className="button medium action"
              >
                수정
              </Anchor>
            ) : null}
          </Stack>
        </div>
      </div>
    </Container>
  );
}
