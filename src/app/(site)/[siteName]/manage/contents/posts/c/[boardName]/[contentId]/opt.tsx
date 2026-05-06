'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from '@mui/material/Link';
import { Alert, Box, Button, Chip, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';

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
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const viewTimerReference = useRef<number | null>(null);
  const hasRequestedViewReference = useRef(false);

  const [board, setBoard] = useState<ContentResponse['board'] | null>(null);
  const [content, setContent] = useState<ContentResponse['content'] | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
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
        setCategories(Array.isArray(result.categories) ? result.categories : []);
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
    return null;
  }

  if (!board || !content) {
    return null;
  }

  if (board.board_type === 'page') {
    return (
      <Stack spacing={2.5}>
        {isNotMobile ? (
          <Typography variant="h5" component="h1">
            페이지 상세
          </Typography>
        ) : null}

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}

        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} flexWrap="wrap" />

          <Stack direction="row" spacing={1}>
            {isAuthor || isStaff ? (
              <Button
                component={Link}
                href={`/${siteName}/manage/contents/posts/c/${boardName}/${content.id}/edit`}
                underline="none"
                variant="contained"
              >
                수정
              </Button>
            ) : null}

            <Button
              component={Link}
              href={`/${siteName}/manage/contents/posts/c/${boardName}`}
              underline="none"
              variant="outlined"
            >
              목록
            </Button>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            {content.subject ? <Typography variant="h5">{content.subject}</Typography> : null}
            {content.summary ? <Typography variant="body1">{content.summary}</Typography> : null}

            <Stack spacing={0.75}>
              <Typography variant="subtitle2">작성일</Typography>
              <Typography variant="body2">{formatDateTimeDetail(content.created_at)}</Typography>
            </Stack>

            {content.edited_at ? (
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">수정일</Typography>
                <Typography variant="body2">{formatDateTimeDetail(content.edited_at)}</Typography>
              </Stack>
            ) : null}

            {content.author_name ? (
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">작성자</Typography>
                <Typography variant="body2">{content.author_name}</Typography>
              </Stack>
            ) : null}

            {content.og_image_url ? (
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">오픈 그래프 이미지</Typography>
                <Box
                  component="img"
                  src={content.og_image_url}
                  alt="오픈 그래프 이미지"
                  sx={{ width: '100%', maxWidth: 520, display: 'block' }}
                />
              </Stack>
            ) : null}

            {content.content_html ? (
              <Stack spacing={0.75}>
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

            {typeof content.sort_order === 'number' ? (
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">정렬 순서</Typography>
                <Typography variant="body2">{content.sort_order}</Typography>
              </Stack>
            ) : null}

            {content.attachment_slug ? (
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">첨부 식별자</Typography>
                <Typography variant="body2">{content.attachment_slug}</Typography>
              </Stack>
            ) : null}

            {content.attachment_origin ? (
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">첨부 원본명</Typography>
                <Typography variant="body2">{content.attachment_origin}</Typography>
              </Stack>
            ) : null}

            {typeof content.is_comment === 'boolean' ? (
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">댓글 허용</Typography>
                <Typography variant="body2">{content.is_comment ? '허용' : '비허용'}</Typography>
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      {isNotMobile ? (
        <Typography variant="h5" component="h1">
          글 상세
        </Typography>
      ) : null}

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      {content.is_closed ? (
        <Alert severity="error" variant="filled">
          삭제된 글입니다.
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {content.published_status === 'draft' ? <Chip label="임시저장글" color="warning" size="small" /> : null}
          {content.prefix_label ? <Chip label={content.prefix_label} variant="outlined" size="small" /> : null}
          {categories.map((category) => (
            <Chip key={category.id} label={category.category_label} variant="outlined" size="small" />
          ))}
        </Stack>

        <Stack direction="row" spacing={1}>
          {isAuthor || isStaff ? (
            <Button
              component={Link}
              href={`/${siteName}/manage/contents/posts/c/${boardName}/${content.id}/edit`}
              underline="none"
              variant="contained"
            >
              수정
            </Button>
          ) : null}

          <Button
            component={Link}
            href={`/${siteName}/manage/contents/posts/c/${boardName}`}
            underline="none"
            variant="outlined"
          >
            목록
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          {content.subject && board.board_type !== 'feed' ? (
            <Typography variant="h5">{content.subject}</Typography>
          ) : null}
          {content.summary ? <Typography variant="body1">{content.summary}</Typography> : null}

          {typeof content.idx === 'number' ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">번호</Typography>
              <Typography variant="body2">{content.idx}</Typography>
            </Stack>
          ) : null}

          <Stack spacing={0.75}>
            <Typography variant="subtitle2">조회수</Typography>
            <Typography variant="body2">{typeof content.post_count === 'number' ? content.post_count : 0}</Typography>
          </Stack>

          <Stack spacing={0.75}>
            <Typography variant="subtitle2">작성일</Typography>
            <Typography variant="body2">{formatDateTimeDetail(content.created_at)}</Typography>
          </Stack>

          {content.published_at ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">게시일</Typography>
              <Typography variant="body2">{formatDateTimeDetail(content.published_at)}</Typography>
            </Stack>
          ) : null}

          {content.edited_at ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">수정일</Typography>
              <Typography variant="body2">{formatDateTimeDetail(content.edited_at)}</Typography>
            </Stack>
          ) : null}

          {content.author_name ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">작성자</Typography>
              <Typography variant="body2">{content.author_name}</Typography>
            </Stack>
          ) : null}

          {series?.series_label ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">연재</Typography>
              <Typography variant="body2">{series.series_label}</Typography>
            </Stack>
          ) : null}

          {board.board_type === 'youtube' && content.youtube_url ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">유튜브 영상 주소</Typography>
              <Typography variant="body2">{content.youtube_url}</Typography>
            </Stack>
          ) : null}

          {board.board_type === 'youtube' && content.youtube_id ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">유튜브 영상 ID</Typography>
              <Typography variant="body2">{content.youtube_id}</Typography>
            </Stack>
          ) : null}

          {board.board_type === 'youtube' && content.youtube_created_at ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">유튜브 업로드 기준 날짜</Typography>
              <Typography variant="body2">{formatDateTimeDetail(content.youtube_created_at)}</Typography>
            </Stack>
          ) : null}

          {typeof content.is_comment === 'boolean' ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">댓글 허용</Typography>
              <Typography variant="body2">{content.is_comment ? '허용' : '비허용'}</Typography>
            </Stack>
          ) : null}

          {board.board_type !== 'feed' && content.thumbnail_image_url ? (
            <Stack spacing={0.75}>
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
            <Stack spacing={1}>
              <Typography variant="subtitle2">이미지</Typography>
              <Stack spacing={1.5}>
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
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">내용</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {content.content_simple}
              </Typography>
            </Stack>
          ) : null}

          {(board.board_type === 'basic' || board.board_type === 'gallery') && content.content_html ? (
            <Stack spacing={0.75}>
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

          {content.poll ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2">투표</Typography>
              <Typography variant="body2">{content.poll.question}</Typography>
              <Stack spacing={0.75}>
                {content.poll.options.map((option) => (
                  <Typography key={option.id} variant="body2">
                    {`${option.id}. ${option.label}`}
                  </Typography>
                ))}
              </Stack>
            </Stack>
          ) : null}

          {Array.isArray(content.hashtags) && content.hashtags.length > 0 ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">해시태그</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {content.hashtags.map((hashtag) => (
                  <Chip key={hashtag} label={`#${hashtag}`} size="small" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          ) : null}

          {content.is_closed && content.closed_at ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">삭제일</Typography>
              <Typography variant="body2">{formatDateTimeDetail(content.closed_at)}</Typography>
            </Stack>
          ) : null}

          {content.is_closed && content.closed_by_name ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">삭제자</Typography>
              <Typography variant="body2">{content.closed_by_name}</Typography>
            </Stack>
          ) : null}

          {content.is_closed && content.closed_message ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">삭제 사유</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {content.closed_message}
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}
