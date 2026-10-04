'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import {
  Avatar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import CommentList from '@/components/comments/CommentList';
import FormErrorDialog from '@/components/FormErrorDialog';
import ContentWithInlineLinks from '@/components/service/blog-community/ContentWithInlineLinks';
import SiteProfile from '@/components/service/blog/SiteProfile';
import ReportButton from '@/components/service/common/ReportButton';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/board.module.sass';

export type BlogCommunityPostResponse = {
  post?: {
    slug: string;
    content: string;
    createdAt: string;
    editedAt: string | null;
    authorName: string;
    authorAvatarUrl: string | null;
    isAuthor: boolean;
    isOwner: boolean;
    images: string[];
  };
  previousPost?: { slug: string } | null;
  nextPost?: { slug: string } | null;
  error?: string;
};

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: BlogCommunityPostResponse | null;
  initialError: string;
}) {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);
  const post = initialData?.post;
  const previousPost = initialData?.previousPost;
  const nextPost = initialData?.nextPost;
  const [error, setError] = useState<string | null>(initialError || initialData?.error || null);
  const [imageIndex, setImageIndex] = useState(0);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  function openImageViewer(index: number) {
    setImageIndex(index);
    setIsImageViewerOpen(true);
  }

  function showPreviousImage() {
    if (!post?.images.length) return;
    setImageIndex((previous) => (previous === 0 ? post.images.length - 1 : previous - 1));
  }

  function showNextImage() {
    if (!post?.images.length) return;
    setImageIndex((previous) => (previous + 1) % post.images.length);
  }

  async function deletePost() {
    try {
      const response = await fetch(`/api/site/${siteName}/community-on-blog/${contentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || '글을 삭제하지 못했습니다.');
      router.replace(`/${siteName}/community-on-blog`);
      router.refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '글을 삭제하지 못했습니다.');
    }
  }

  if (initialError || initialData?.error || !post)
    return <ScreenState kind="error">{initialError || initialData?.error || '글을 찾을 수 없습니다.'}</ScreenState>;
  return (
    <Container pageBack={`/${siteName}/community-on-blog`} pageTitle="글 보기" pageFin>
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']}`}>
          <SiteProfile />
          {isMobile ? null : (
            <div className={styles['top-buttons']}>
              <Anchor href={`/${siteName}/community-on-blog`} className={`${styles.button} button`}>
                <span>목록</span>
              </Anchor>
              <div className={styles.buttons}>
                {previousPost ? (
                  <Anchor href={`/${siteName}/community-on-blog/${previousPost.slug}`} className="button">
                    <ArrowBackIosRoundedIcon />
                    <span>이전글</span>
                  </Anchor>
                ) : null}
                {nextPost ? (
                  <Anchor href={`/${siteName}/community-on-blog/${nextPost.slug}`} className="button">
                    <span>다음글</span>
                    <ArrowForwardIosRoundedIcon />
                  </Anchor>
                ) : null}
              </div>
            </div>
          )}
          <article>
            <div className="paper">
              <header className={styles['content-header']}>
                <div className={styles['author-profile']}>
                  <div className={styles.avatar}>
                    <Avatar src={post.authorAvatarUrl ?? undefined} alt={post.authorName} />
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>
                      <cite>{post.authorName}</cite>
                    </div>
                    <div className={styles.datetime}>
                      <span aria-label="게시일">{formatDateTimeDetail(post.createdAt)}</span>
                      {post.editedAt ? <span>수정됨</span> : null}
                    </div>
                  </div>
                </div>
              </header>
            </div>
            <div className={`${styles['board-container']} ${styles['feed-board']}`}>
              <div className="paper">
                <p>
                  <ContentWithInlineLinks content={post.content} />
                </p>
                {post.images.length ? (
                  <div className={styles['content-images']}>
                    {post.images.map((image, index) => (
                      <div key={image} className={styles['content-thumbnail-image']}>
                        <button type="button" onClick={() => openImageViewer(index)}>
                          <img src={image} alt="" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className={styles.options}>
              <div className={styles.buttons}>
                <div className={styles['button-basics']}>
                  {post.isAuthor ? (
                    <Anchor href={`/${siteName}/community-on-blog/${contentId}/edit?from=detail`} className={styles.button}>
                      <EditNoteRoundedIcon />
                      <strong>수정</strong>
                    </Anchor>
                  ) : null}
                  {post.isAuthor || post.isOwner ? (
                    <button type="button" className={styles.button} onClick={() => void deletePost()}>
                      <DeleteForeverRoundedIcon />
                      <strong>삭제</strong>
                    </button>
                  ) : null}
                </div>
                <div className={styles['button-purchase']}>
                  <ReportButton targetType="blog_community_post" siteName={siteName} contentId={contentId} />
                </div>
              </div>
            </div>
          </article>
          <CommentList
            siteName={siteName}
            boardName="community-on-blog"
            contentId={contentId}
            isCommentEnabled
            apiBasePath={`/api/site/${siteName}/community-on-blog/${contentId}/comments`}
            includeSiteNameInApiPath={false}
            reportTargetType="blog_community_comment"
            isCommentLikeEnabled={false}
          />
          {isMobile ? null : (
            <div className={styles['top-buttons']}>
              <Anchor href={`/${siteName}/community-on-blog`} className={`${styles.button} button`}>
                <span>목록</span>
              </Anchor>
              <div className={styles.buttons}>
                {previousPost ? (
                  <Anchor href={`/${siteName}/community-on-blog/${previousPost.slug}`} className="button">
                    <ArrowBackIosRoundedIcon />
                    <span>이전글</span>
                  </Anchor>
                ) : null}
                {nextPost ? (
                  <Anchor href={`/${siteName}/community-on-blog/${nextPost.slug}`} className="button">
                    <span>다음글</span>
                    <ArrowForwardIosRoundedIcon />
                  </Anchor>
                ) : null}
              </div>
            </div>
          )}

          {post.images.length ? (
            <Dialog
              open={isImageViewerOpen}
              onClose={() => setIsImageViewerOpen(false)}
              fullScreen
              className={`vh-dialog ${styles['gallery-viewer-dialog']}`}
            >
              <DialogTitle className={styles['dialog-title']}>{`${imageIndex + 1}번째 이미지`}</DialogTitle>
              <DialogContent className={styles['dialog-content']}>
                <img src={post.images[imageIndex]} alt="" />
              </DialogContent>
              <DialogActions className={styles['dialog-actions']}>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className={`${styles['control-button']} ${styles['prev-button']}`}
                  aria-label="이전 이미지"
                >
                  <ArrowBackRoundedIcon />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className={`${styles['control-button']} ${styles['next-button']}`}
                  aria-label="다음 이미지"
                >
                  <ArrowForwardRoundedIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setIsImageViewerOpen(false)}
                  className={styles['close-button']}
                  aria-label="이미지 닫기"
                >
                  <CloseRoundedIcon />
                </button>
              </DialogActions>
            </Dialog>
          ) : null}
        </div>
      </div>
      <FormErrorDialog
        open={Boolean(error)}
        title="커뮤니티"
        messages={error ? [error] : []}
        onClose={() => setError(null)}
      />
    </Container>
  );
}
