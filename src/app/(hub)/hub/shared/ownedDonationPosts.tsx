'use client';

import { useRef, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Chip, useTheme } from '@mui/material';
import { getLinkPreview, type LinkPreviewData } from '@/lib/service/getLinkPreview';
import { formatDateSimple, formatDateTimeDetail, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import EmbeddedContentHtml from '@/components/service/EmbeddedContentHtml';
import LinkPreview from '@/components/service/LinkPreview';
import ScreenState from '@/components/service/ScreenState';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import ResponsivePopup from './ResponsivePopup';
import boardStyles from '@/app/board.module.sass';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';
type PostKind = 'owned' | 'donated';
type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed' | 'page' | 'blog';

type PostRow = {
  id: string;
  siteName: string;
  siteLabel: string;
  siteType: SiteType;
  boardName: string;
  contentId: string;
  title: string;
  authorName: string;
  createdAt: string;
  isClosed: boolean;
  kinds: PostKind[];
};

export type PostsResponse = {
  posts?: PostRow[];
  error?: string;
};

type PostImage = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type BoardInfo = {
  board_type: BoardType;
  markdown_status: string;
};

type PostContent = {
  id: string;
  subject: string;
  summary: string | null;
  content_html: string | null;
  content_markdown: string | null;
  content_simple: string | null;
  thumbnail_image: string | null;
  thumbnail_image_url: string;
  youtube_id: string | null;
  youtube_created_at: string | null;
  images: PostImage[] | null;
  hashtags: unknown;
  created_at: string;
  published_at: string | null;
  edited_at: string | null;
  author_name: string;
};

type ContentResponse = {
  board?: BoardInfo;
  content?: PostContent;
  linkPreviews?: Record<string, LinkPreviewData | null>;
  error?: string;
};

type Props = {
  siteType: SiteType;
  initialData: PostsResponse | null;
  initialError: string;
};

function getKindLabel(kind: PostKind) {
  return kind === 'owned' ? '소장' : '후원';
}

function normalizeHashtags(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && Boolean(normalizeText(item)));
  }

  if (typeof value !== 'string') {
    return [];
  }

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

function extractUrls(value: string) {
  const matchedUrls = value.match(/https?:\/\/[^\s<>"']+/g) ?? [];

  return Array.from(new Set(matchedUrls.map((url) => url.replace(/[),.!?]+$/g, '').trim()).filter(Boolean)));
}

function ContentBody({
  board,
  content,
  linkPreviews,
}: {
  board: BoardInfo;
  content: PostContent;
  linkPreviews: Record<string, LinkPreviewData | null>;
}) {
  const theme = useTheme();
  const hashtags = normalizeHashtags(content.hashtags);
  const feedLinkPreviewUrls =
    board.board_type === 'feed' && content.content_simple ? extractUrls(content.content_simple) : [];
  const embeddedContent = content.content_html ? (
    <EmbeddedContentHtml
      contentHtml={content.content_html}
      contentMarkdown={content.content_markdown}
      markdownStatus={board.markdown_status}
      themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
      className="viewer"
    />
  ) : null;
  const images = content.images?.length ? (
    <div className={boardStyles['content-images']}>
      {content.images.map((image) => (
        <div key={image.path} className={boardStyles['content-thumbnail-image']}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" />
        </div>
      ))}
    </div>
  ) : null;
  const tags = hashtags.length ? (
    <div className={boardStyles['content-tags']}>
      {hashtags.map((hashtag) => (
        <span key={hashtag}>{`#${hashtag}`}</span>
      ))}
    </div>
  ) : null;

  if (board.board_type === 'gallery') {
    return (
      <div className={`${boardStyles['board-container']} ${boardStyles['gallery-board']}`}>
        <div className="paper">
          {content.summary ? <p className={boardStyles['content-summary']}>{content.summary}</p> : null}
          {embeddedContent}
          {images}
          {tags}
        </div>
      </div>
    );
  }

  if (board.board_type === 'youtube') {
    return (
      <div className={`${boardStyles['board-container']} ${boardStyles['youtube-board']}`}>
        {content.youtube_id ? (
          <div className="paper paper-p0">
            <YoutubeEmbed
              videoId={content.youtube_id}
              thumbnailImage={content.thumbnail_image ? content.thumbnail_image_url : undefined}
            />
          </div>
        ) : null}
        <div className="paper">
          {content.youtube_created_at ? (
            <strong>{`유튜브 공개: ${formatDateSimple(content.youtube_created_at)}`}</strong>
          ) : null}
          {content.summary ? <div className={boardStyles['content-simple']}>{content.summary}</div> : null}
          {tags}
        </div>
      </div>
    );
  }

  if (board.board_type === 'feed') {
    return (
      <div className={`${boardStyles['board-container']} ${boardStyles['feed-board']}`}>
        <div className="paper">
          {content.content_simple ? (
            <div className={boardStyles['content-simple']}>{content.content_simple}</div>
          ) : null}
          {feedLinkPreviewUrls.length ? (
            <div className={boardStyles['link-previews']}>
              {feedLinkPreviewUrls.map((url) => (
                <LinkPreview key={url} href={url} preview={linkPreviews[url] ?? null} />
              ))}
            </div>
          ) : null}
          {images}
          {tags}
        </div>
      </div>
    );
  }

  return (
    <div className={`${boardStyles['board-container']} ${boardStyles['basic-board']}`}>
      <div className="paper">
        {embeddedContent}
        {tags}
      </div>
    </div>
  );
}

function PostPreview({ response, errorMessage }: { response: ContentResponse | null; errorMessage: string }) {
  if (errorMessage) {
    return (
      <p className="alert error">
        <ErrorOutlineRoundedIcon />
        <span>{errorMessage}</span>
      </p>
    );
  }

  if (!response?.board || !response.content) {
    return (
      <div className="loading-container">
        <LoadingIndicator />
      </div>
    );
  }

  const { board, content } = response;

  return (
    <div className={`${boardStyles.content} ${styles['owned-post-preview']}`}>
      <article>
        <div className="paper">
          <header className={boardStyles['content-header']}>
            <h3>
              <strong>{content.subject}</strong>
            </h3>
            <div className={boardStyles['author-profile']}>
              <div className={boardStyles.info}>
                <div className={boardStyles.name}>
                  <cite>{content.author_name}</cite>
                </div>
                <div className={boardStyles.datetime}>
                  <span aria-label="작성일">{formatDateTimeDetail(content.published_at || content.created_at)}</span>
                  {content.edited_at ? <span>(수정됨)</span> : null}
                </div>
              </div>
            </div>
          </header>
        </div>
        <ContentBody board={board} content={content} linkPreviews={response.linkPreviews ?? {}} />
      </article>
    </div>
  );
}

export default function OwnedDonationPosts({ initialData, initialError }: Props) {
  const posts = Array.isArray(initialData?.posts) ? initialData.posts : [];
  const contentRequestIdReference = useRef(0);
  const [selectedPost, setSelectedPost] = useState<PostRow | null>(null);
  const [contentResponse, setContentResponse] = useState<ContentResponse | null>(null);
  const [contentErrorMessage, setContentErrorMessage] = useState('');

  async function openPreview(post: PostRow) {
    const requestId = contentRequestIdReference.current + 1;
    contentRequestIdReference.current = requestId;
    setSelectedPost(post);
    setContentResponse(null);
    setContentErrorMessage('');

    try {
      const response = await fetch(`/api/boards/${post.boardName}/${post.contentId}?siteName=${post.siteName}`, {
        method: 'GET',
        credentials: 'include',
      });
      const result = (await response.json()) as ContentResponse;

      if (!response.ok) {
        throw new Error(result.error || '글 내용을 불러오지 못했습니다.');
      }

      const previewEntries = await Promise.all(
        result.board?.board_type === 'feed' && result.content?.content_simple
          ? extractUrls(result.content.content_simple).map(async (url) => {
              const previewResult = await getLinkPreview(url);
              return [url, previewResult.ok ? previewResult.data : null] as const;
            })
          : [],
      );
      result.linkPreviews = Object.fromEntries(previewEntries);

      if (contentRequestIdReference.current === requestId) {
        setContentResponse(result);
      }
    } catch (unknownError) {
      if (contentRequestIdReference.current === requestId) {
        setContentErrorMessage(unknownError instanceof Error ? unknownError.message : '글 내용을 불러오지 못했습니다.');
      }
    }
  }

  function closePreview() {
    contentRequestIdReference.current += 1;
    setSelectedPost(null);
    setContentResponse(null);
    setContentErrorMessage('');
  }

  if (initialError) {
    return (
      <section className={`paper ${styles.paper}`}>
        <ScreenState kind="error">{initialError}</ScreenState>
      </section>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  const preview = <PostPreview response={contentResponse} errorMessage={contentErrorMessage} />;

  return (
    <section className={`paper ${styles.paper} ${styles.history} ${styles['owned-posts']}`}>
      <h2>소장/후원글</h2>
      <div className={styles.items}>
        <ol>
          {posts.map((post) => (
            <li key={post.id}>
              <button type="button" onClick={() => void openPreview(post)}>
                <span className={styles['owned-post-title']}>
                  <strong aria-label="글 제목">{post.title}</strong>
                  {post.isClosed ? <em>삭제된 연재글</em> : null}
                  <span className={styles['owned-post-chips']}>
                    {post.kinds.map((kind) => (
                      <Chip key={kind} label={getKindLabel(kind)} size="small" />
                    ))}
                  </span>
                </span>
                <cite aria-label="작성자">{post.authorName}</cite>
                <div className={styles.tail}>
                  <em aria-label="사이트명">{post.siteLabel}</em>
                  <time aria-label="작성일">{formatDateSimple(post.createdAt)}</time>
                </div>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <ResponsivePopup
        open={Boolean(selectedPost)}
        onClose={closePreview}
        title="글 보기"
        maxWidth="lg"
        variant="content"
        dialogClassName={styles['owned-post-dialog']}
        drawerClassName={styles['owned-post-drawer']}
        actions={[{ label: '닫기', intent: 'cancel', onClick: closePreview }]}
      >
        {preview}
      </ResponsivePopup>
    </section>
  );
}
