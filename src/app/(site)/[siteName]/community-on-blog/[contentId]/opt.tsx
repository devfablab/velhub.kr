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
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import CommentList, { type CommentsResponse } from '@/components/comments/CommentList';
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
    authorBadgeUrl: string | null;
    isAuthor: boolean;
    isOwner: boolean;
    isOperator: boolean;
    images: string[];
    draw: {
      drawType: 'first_come' | 'random';
      drawLimit: number | null;
      drawEndsAt: string | null;
      isCompleted: boolean;
      canViewDraws: boolean;
      winners: { id: string; drawOrder: number; authorName: string; authorAvatarUrl: string | null }[];
    } | null;
  };
  previousPost?: { slug: string } | null;
  nextPost?: { slug: string } | null;
  error?: string;
};

export default function Opt({
  initialData,
  initialError,
  initialCommentsData,
}: {
  initialData: BlogCommunityPostResponse | null;
  initialError: string;
  initialCommentsData: CommentsResponse | null;
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
                      {post.authorBadgeUrl ? (
                        <em>
                          <img
                            className={styles['membership-fan-badge']}
                            src={post.authorBadgeUrl}
                            alt="멤버십팬 배지"
                          />
                        </em>
                      ) : null}
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
            {post.draw ? (
              <div className="paper">
                <div className={styles['content-draw']}>
                  {post.draw.isCompleted ? (
                    <p className={styles.warning}>추첨 이벤트가 완료되었습니다.</p>
                  ) : post.draw.drawType === 'first_come' ? (
                    <p className={styles.info}>{`선착순 ${post.draw.drawLimit ?? 0}명 추첨 이벤트가 진행중입니다.`}</p>
                  ) : (
                    <p
                      className={styles.info}
                    >{`${post.draw.drawEndsAt ? formatDateTimeDetail(post.draw.drawEndsAt) : ''}까지 댓글을 남긴 회원 중 ${post.draw.drawLimit ?? 0}명을 무작위 추첨합니다.`}</p>
                  )}
                  {!post.draw.isCompleted ? (
                    <p className={styles.warning}>
                      하나의 계정으로 여러번 댓글을 작성하셔도 단 하나의 댓글로만 추첨됩니다. (확률에 영향 없음)
                    </p>
                  ) : null}
                  {post.draw.canViewDraws && post.draw.winners.length ? (
                    <>
                      <p className={styles.info}>당첨자 목록은 글 작성자와 매니저만 보실 수 있어요.</p>
                      <table>
                        <colgroup>
                          <col style={{ width: 100 }} />
                          <col />
                        </colgroup>
                        <thead>
                          <tr>
                            <th scope="col">당첨 번호</th>
                            <th scope="col">당첨자</th>
                          </tr>
                        </thead>
                        <tbody>
                          {post.draw.winners.map((winner) => (
                            <tr key={winner.id}>
                              <td>{winner.drawOrder}</td>
                              <td>
                                <div>
                                  <Avatar src={winner.authorAvatarUrl ?? undefined} alt={winner.authorName} />
                                  <cite>{winner.authorName}</cite>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className={styles.options}>
              <div className={styles.buttons}>
                <div className={styles['button-basics']}>
                  {post.isAuthor ? (
                    <Anchor
                      href={`/${siteName}/community-on-blog/${contentId}/edit?from=detail`}
                      className={styles.button}
                    >
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
            initialData={initialCommentsData}
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
            isMobile ? (
              <Drawer
                anchor="bottom"
                open={isImageViewerOpen}
                onClose={() => setIsImageViewerOpen(false)}
                className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['gallery-viewer-dialog']}`}
              >
                <h2>{`${imageIndex + 1}번째 이미지`}</h2>
                <button
                  type="button"
                  className={styles['close-button']}
                  onClick={() => setIsImageViewerOpen(false)}
                  aria-label="이미지 닫기"
                >
                  <CloseRoundedIcon />
                </button>
                <div className={styles['dialog-content']}>
                  <img src={post.images[imageIndex]} alt="" />
                </div>
                <div className={styles['dialog-actions']}>
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
                </div>
              </Drawer>
            ) : (
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
            )
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
