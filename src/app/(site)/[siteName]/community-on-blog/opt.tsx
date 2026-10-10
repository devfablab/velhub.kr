'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import {
  Avatar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Fab,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import ContentWithInlineLinks from '@/components/service/blog-community/ContentWithInlineLinks';
import SiteProfile from '@/components/service/blog/SiteProfile';
import ReportButton from '@/components/service/common/ReportButton';
import ScreenState from '@/components/service/ScreenState';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type BlogCommunityPost = {
  slug: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  authorBadgeUrl: string | null;
  isAuthor: boolean;
  canDelete: boolean;
  commentCount: number;
  images: string[];
};

export type BlogCommunityResponse = {
  feature?: {
    isPersonalBlog: boolean;
    isEligible: boolean;
    isEnabled: boolean;
    isOwner: boolean;
    isManager: boolean;
    isOperator: boolean;
    isSubscriber: boolean;
    canUse: boolean;
  };
  page?: number;
  pageSize?: number;
  totalCount?: number;
  posts?: BlogCommunityPost[];
  error?: string;
};

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: BlogCommunityResponse | null;
  initialError: string;
}) {
  const siteName = normalizeText(useParams().siteName);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [imageViewer, setImageViewer] = useState<{ images: string[]; index: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogCommunityPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const feature = initialData?.feature;
  const [posts, setPosts] = useState<BlogCommunityPost[]>(initialData?.posts ?? []);
  const page = initialData?.page ?? 1;
  const pageSize = initialData?.pageSize ?? 50;
  const totalCount = initialData?.totalCount ?? 0;
  const totalPage = Math.max(1, Math.ceil(totalCount / pageSize));
  function togglePost(id: string) {
    setExpandedPostIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openImageViewer(images: string[], index: number) {
    setImageViewer({ images, index });
  }

  function closeImageViewer() {
    setImageViewer(null);
  }

  function showPreviousImage() {
    setImageViewer((previous) =>
      previous ? { ...previous, index: previous.index === 0 ? previous.images.length - 1 : previous.index - 1 } : null,
    );
  }

  function showNextImage() {
    setImageViewer((previous) =>
      previous ? { ...previous, index: (previous.index + 1) % previous.images.length } : null,
    );
  }

  async function deletePost() {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/site/${siteName}/community-on-blog/${deleteTarget.slug}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || '글을 삭제하지 못했습니다.');
      setPosts((previous) => previous.filter((post) => post.slug !== deleteTarget.slug));
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '글을 삭제하지 못했습니다.');
    } finally {
      setIsDeleting(false);
    }
  }
  if (initialError || initialData?.error)
    return <ScreenState kind="error">{initialError || initialData?.error}</ScreenState>;
  if (!feature?.isPersonalBlog || !feature.isEnabled)
    return <ScreenState kind="error">현재 사용할 수 없는 메뉴입니다.</ScreenState>;
  if (!feature.canUse) return <ScreenState kind="error">블로그 구독자만 이용할 수 있습니다.</ScreenState>;
  return (
    <Container pageTitle="커뮤니티">
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']}`}>
          <SiteProfile />
          {posts.length ? (
            <div className={styles['blog-community-items']}>
              {posts.map((post) => (
                <div className="paper" key={post.slug}>
                  <article className={styles['feed-item']}>
                    <header className={styles['content-header']}>
                      <div className={styles['author-profile']}>
                        <div className={styles.avatar}>
                          <Avatar src={post.authorAvatarUrl || '/broken-image.jpg'} alt={post.authorName} />
                        </div>
                        <div className={styles.info}>
                          <div className={styles.name}>
                            <cite>
                              <span>{post.authorName}</span>
                            </cite>

                            {post.authorBadgeUrl ? (
                              <em>
                                <img src={post.authorBadgeUrl} alt="멤버십팬 배지" />
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
                    <div className={styles['content-simple']}>
                      <p>
                        <ContentWithInlineLinks
                          content={post.content}
                          limit={expandedPostIds.has(post.slug) ? undefined : 127}
                        />
                        {post.content.length > 127 ? (
                          <>
                            ...{' '}
                            <button type="button" onClick={() => togglePost(post.slug)}>
                              {expandedPostIds.has(post.slug) ? '숨기기' : '더보기'}
                            </button>
                          </>
                        ) : null}
                      </p>
                      {post.images.length ? (
                        <div className={styles['content-images']}>
                          {post.images.map((image, imageIndex) => (
                            <div key={image} className={styles['content-thumbnail-image']}>
                              <button type="button" onClick={() => openImageViewer(post.images, imageIndex)}>
                                <img src={image} alt="" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.options}>
                      <div className={styles.buttons}>
                        <div className={styles['button-basics']}>
                          <Anchor href={`/${siteName}/community-on-blog/${post.slug}`} className={styles.button}>
                            <ChatBubbleOutlineRoundedIcon />
                            <strong>댓글 {post.commentCount}</strong>
                          </Anchor>
                          {post.isAuthor ? (
                            <Anchor
                              href={`/${siteName}/community-on-blog/${post.slug}/edit?from=list`}
                              className={styles.button}
                            >
                              <EditNoteRoundedIcon />
                              <strong>수정</strong>
                            </Anchor>
                          ) : null}
                          {post.canDelete ? (
                            <button type="button" className={styles.button} onClick={() => setDeleteTarget(post)}>
                              <DeleteForeverRoundedIcon />
                              <strong>삭제</strong>
                            </button>
                          ) : null}
                        </div>
                        <div className={styles['button-purchase']}>
                          <ReportButton targetType="blog_community_post" siteName={siteName} contentId={post.slug} />
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          ) : (
            <ScreenState>등록된 글이 없습니다.</ScreenState>
          )}
          {totalPage > 1 ? (
            <nav className={styles.pagination}>
              {page > 1 ? <Anchor href={`/${siteName}/community-on-blog?page=${page - 1}`}>이전</Anchor> : null}
              <span>
                {page} / {totalPage}
              </span>
              {page < totalPage ? <Anchor href={`/${siteName}/community-on-blog?page=${page + 1}`}>다음</Anchor> : null}
            </nav>
          ) : null}
          {isMobile ? (
            <div className="fab">
              <Fab aria-label="새글 쓰기" href={`/${siteName}/community-on-blog/new`} size="medium">
                <EditRoundedIcon />
              </Fab>
            </div>
          ) : (
            <div className={styles['button-group']}>
              <Anchor href={`/${siteName}/community-on-blog/new`} className={`${styles.submit} button`}>
                글쓰기
              </Anchor>
            </div>
          )}
        </div>
      </div>
      {imageViewer ? (
        isMobile ? (
          <Drawer
            anchor="bottom"
            open
            onClose={closeImageViewer}
            className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['gallery-viewer-dialog']}`}
          >
            <h2>{`${imageViewer.index + 1}번째 이미지`}</h2>
            <button
              type="button"
              className={styles['close-button']}
              onClick={closeImageViewer}
              aria-label="이미지 닫기"
            >
              <CloseRoundedIcon />
            </button>
            <div className={styles['dialog-content']}>
              <img src={imageViewer.images[imageViewer.index]} alt="" />
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
          <Dialog open onClose={closeImageViewer} fullScreen className={`vh-dialog ${styles['gallery-viewer-dialog']}`}>
            <DialogTitle className={styles['dialog-title']}>{`${imageViewer.index + 1}번째 이미지`}</DialogTitle>
            <DialogContent className={styles['dialog-content']}>
              <img src={imageViewer.images[imageViewer.index]} alt="" />
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
                onClick={closeImageViewer}
                className={styles['close-button']}
                aria-label="이미지 닫기"
              >
                <CloseRoundedIcon />
              </button>
            </DialogActions>
          </Dialog>
        )
      ) : null}
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(deleteTarget)}
          onClose={() => !isDeleting && setDeleteTarget(null)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>글 삭제</h2>
          <button
            type="button"
            className="close-button"
            onClick={() => setDeleteTarget(null)}
            disabled={isDeleting}
            aria-label="닫기"
          >
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <p>정말로 글을 삭제하시겠습니까?</p>
          </div>
          <div className="drawer-dialog-actions">
            <button
              type="button"
              className="button medium close"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              취소
            </button>
            <button
              type="button"
              className="button medium danger"
              onClick={() => void deletePost()}
              disabled={isDeleting}
            >
              삭제
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(deleteTarget)}
          onClose={() => !isDeleting && setDeleteTarget(null)}
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>글 삭제</DialogTitle>
          <DialogContent>
            <p>정말로 글을 삭제하시겠습니까?</p>
          </DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              취소
            </button>
            <button type="button" className="danger-button" onClick={() => void deletePost()} disabled={isDeleting}>
              삭제
            </button>
          </DialogActions>
        </Dialog>
      )}
      <FormErrorDialog
        open={Boolean(actionError)}
        title="글 삭제 오류"
        messages={actionError ? [actionError] : []}
        onClose={() => setActionError(null)}
      />
    </Container>
  );
}
