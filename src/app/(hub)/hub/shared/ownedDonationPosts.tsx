'use client';

import { useEffect, useState } from 'react';
import {
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { formatDateSimple, formatDateTimeDetail, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import EmbeddedContentHtml from '@/components/service/EmbeddedContentHtml';
import LinkPreview from '@/components/service/LinkPreview';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
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
  kinds: PostKind[];
};

type PostsResponse = {
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
  error?: string;
};

type Props = {
  siteType: SiteType;
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

function ContentBody({ board, content }: { board: BoardInfo; content: PostContent }) {
  const theme = useTheme();
  const hashtags = normalizeHashtags(content.hashtags);
  const feedLinkPreviewUrls = board.board_type === 'feed' && content.content_simple ? extractUrls(content.content_simple) : [];
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
          {content.content_simple ? <div className={boardStyles['content-simple']}>{content.content_simple}</div> : null}
          {feedLinkPreviewUrls.length ? (
            <div className={boardStyles['link-previews']}>
              {feedLinkPreviewUrls.map((url) => (
                <LinkPreview key={url} href={url} />
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
    return <p className="alert error">{errorMessage}</p>;
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
                  <span aria-label="작성일">
                    {formatDateTimeDetail(content.published_at || content.created_at)}
                  </span>
                  {content.edited_at ? <span>(수정됨)</span> : null}
                </div>
              </div>
            </div>
          </header>
        </div>
        <ContentBody board={board} content={content} />
      </article>
    </div>
  );
}

export default function OwnedDonationPosts({ siteType }: Props) {
  const theme = useTheme();
  const isDialog = useMediaQuery(theme.breakpoints.up('lg'));
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostRow | null>(null);
  const [contentResponse, setContentResponse] = useState<ContentResponse | null>(null);
  const [contentErrorMessage, setContentErrorMessage] = useState('');

  useEffect(() => {
    async function loadPosts() {
      try {
        const response = await fetch(`/api/hub/owned-donation-posts?siteType=${siteType}`, {
          method: 'GET',
          credentials: 'include',
        });
        const result = (await response.json()) as PostsResponse;

        if (!response.ok) {
          throw new Error(result.error || '소장/후원글 목록을 불러오지 못했습니다.');
        }

        setPosts(Array.isArray(result.posts) ? result.posts : []);
        setErrorMessage('');
      } catch (unknownError) {
        setErrorMessage(
          unknownError instanceof Error ? unknownError.message : '소장/후원글 목록을 불러오지 못했습니다.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPosts();
  }, [siteType]);

  useEffect(() => {
    if (!selectedPost) {
      return;
    }

    let ignore = false;

    async function loadContent() {
      try {
        setContentResponse(null);
        setContentErrorMessage('');

        const response = await fetch(
          `/api/boards/${encodeURIComponent(selectedPost!.boardName)}/${encodeURIComponent(selectedPost!.contentId)}?siteName=${encodeURIComponent(selectedPost!.siteName)}`,
          {
            method: 'GET',
            credentials: 'include',
          },
        );
        const result = (await response.json()) as ContentResponse;

        if (!response.ok) {
          throw new Error(result.error || '글 내용을 불러오지 못했습니다.');
        }

        if (!ignore) {
          setContentResponse(result);
        }
      } catch (unknownError) {
        if (!ignore) {
          setContentErrorMessage(unknownError instanceof Error ? unknownError.message : '글 내용을 불러오지 못했습니다.');
        }
      }
    }

    void loadContent();

    return () => {
      ignore = true;
    };
  }, [selectedPost]);

  function closePreview() {
    setSelectedPost(null);
    setContentResponse(null);
    setContentErrorMessage('');
  }

  if (isLoading) {
    return null;
  }

  if (errorMessage) {
    return (
      <section className={`paper ${styles.paper}`}>
        <p>{errorMessage}</p>
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
              <button type="button" onClick={() => setSelectedPost(post)}>
                <span className={styles['owned-post-title']}>
                  <strong aria-label="글 제목">{post.title}</strong>
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

      {isDialog ? (
        <Dialog
          open={Boolean(selectedPost)}
          onClose={closePreview}
          maxWidth="lg"
          fullWidth
          className={`VhiDialog ${styles['owned-post-dialog']}`}
        >
          <DialogTitle>글 보기</DialogTitle>
          <button type="button" className="close-button" onClick={closePreview} aria-label="글 닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>{preview}</DialogContent>
        </Dialog>
      ) : (
        <Drawer
          anchor="bottom"
          open={Boolean(selectedPost)}
          onClose={closePreview}
          className={`VhiDrawer-bottom ${styles['owned-post-drawer']}`}
        >
          <h2>글 보기</h2>
          <button type="button" className="close-button" onClick={closePreview} aria-label="글 닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{preview}</div>
        </Drawer>
      )}
    </section>
  );
}
