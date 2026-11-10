'use client';

import { useCallback, useEffect, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import { Avatar } from '@mui/material';
import type { ReportTargetType } from '@/lib/reports/guidelines';
import type { SiteGuidelineDialogData } from '@/lib/site/siteGuidelines.server';
import DonationButton from '@/components/buttons/DonationButton';
import SiteGuidelineActions from '@/components/buttons/SiteGuidelineActions';
import CommentForm, { type CommentImageChange } from '@/components/comments/CommentForm';
import CommentItem, { type CommentData } from '@/components/comments/CommentItem';
import FormErrorDialog from '@/components/FormErrorDialog';
import Anchor from '../Anchor';
import styles from '@/app/comments.module.sass';

type Props = {
  siteName: string;
  boardName: string;
  contentId: string;
  contentSlug?: string;
  isCommentEnabled: boolean;
  apiBasePath?: string;
  includeSiteNameInApiPath?: boolean;
  reportTargetType?: ReportTargetType;
  isCommentLikeEnabled?: boolean;
  getYoutubeCurrentTime?: () => number | null;
  onYoutubeTimestampClick?: (seconds: number) => void;
  initialData?: CommentsResponse | null;
  isPostDonationAvailable?: boolean;
  guidelineDialogData?: SiteGuidelineDialogData | null;
};

type PollChoice = {
  option_index: number;
  label: string;
};

export type CommentsResponse = {
  comments?: CommentData[];
  mySelfAvatarUrl?: string;
  myPollChoice?: PollChoice | null;
  isStaff: string;
  isCommunity?: boolean;
  boardLabel?: string;
  actions?: {
    canWrite?: boolean;
    canManageComment?: boolean;
    canWriteReason?: 'guest' | 'policy' | 'hidden' | null;
    canUploadImage?: boolean;
  };
  error?: string;
};

type CommentActionResponse = {
  ok?: boolean;
  comment?: CommentData;
  error?: string;
};

type CommentPinResponse = {
  ok?: boolean;
  isPinned?: boolean;
  error?: string;
};

type CommentReactionResponse = {
  ok?: boolean;
  isLiked?: boolean;
  likeCount?: number;
  isDisliked?: boolean;
  dislikeCount?: number;
  error?: string;
};

type CommentWithReplies = CommentData & {
  replies?: CommentData[];
  children?: CommentData[];
};

type CommentSort = 'popular' | 'latest';

const EMPTY_IMAGE_CHANGE: CommentImageChange = { file: null, shouldRemove: false };

function createCommentRequestBody(fields: Record<string, string | null>, image: CommentImageChange) {
  if (!image.file && !image.shouldRemove) {
    return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) };
  }

  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null) formData.append(key, value);
  });

  if (image.file) formData.append('image', image.file);
  if (image.shouldRemove) formData.append('removeImage', 'true');

  return { headers: undefined, body: formData };
}

function getCommentCount(nextComments: CommentData[]): number {
  return nextComments.reduce<number>((totalCount, comment) => {
    const nextComment = comment as CommentWithReplies;
    const replies = Array.isArray(nextComment.replies)
      ? nextComment.replies
      : Array.isArray(nextComment.children)
        ? nextComment.children
        : [];

    return totalCount + 1 + getCommentCount(replies);
  }, 0);
}

function updateCommentReactionState({
  comments,
  commentId,
  isLiked,
  likeCount,
  isDisliked,
  dislikeCount,
}: {
  comments: CommentData[];
  commentId: string;
  isLiked: boolean;
  likeCount: number;
  isDisliked: boolean;
  dislikeCount: number;
}): CommentData[] {
  return comments.map((comment) => ({
    ...comment,
    is_liked: comment.id === commentId ? isLiked : comment.is_liked,
    like_count: comment.id === commentId ? likeCount : comment.like_count,
    is_disliked: comment.id === commentId ? isDisliked : comment.is_disliked,
    dislike_count: comment.id === commentId ? dislikeCount : comment.dislike_count,
    replies: updateCommentReactionState({
      comments: comment.replies,
      commentId,
      isLiked,
      likeCount,
      isDisliked,
      dislikeCount,
    }),
  }));
}

function addComment(comments: CommentData[], nextComment: CommentData): CommentData[] {
  if (!nextComment.parent_id) {
    return [nextComment, ...comments];
  }

  return comments.map((comment) => {
    if (comment.id !== nextComment.parent_id) {
      return comment;
    }

    return {
      ...comment,
      replies: [...comment.replies, nextComment],
    };
  });
}

function sortComments(comments: CommentData[], sort: CommentSort, newestCommentId: string) {
  return [...comments].sort((firstComment, secondComment) => {
    if (firstComment.is_pinned !== secondComment.is_pinned) {
      return firstComment.is_pinned ? -1 : 1;
    }

    if (firstComment.id === newestCommentId || secondComment.id === newestCommentId) {
      return firstComment.id === newestCommentId ? -1 : 1;
    }

    if (sort === 'popular') {
      const firstPopularity = firstComment.like_count - firstComment.dislike_count;
      const secondPopularity = secondComment.like_count - secondComment.dislike_count;

      if (firstPopularity !== secondPopularity) {
        return secondPopularity - firstPopularity;
      }

      if (firstComment.dislike_count !== secondComment.dislike_count) {
        return firstComment.dislike_count - secondComment.dislike_count;
      }
    }

    return new Date(secondComment.created_at).getTime() - new Date(firstComment.created_at).getTime();
  });
}

export default function CommentList({
  siteName,
  boardName,
  contentId,
  contentSlug = contentId,
  isCommentEnabled,
  apiBasePath = `/api/boards/${boardName}/${contentId}/comments`,
  includeSiteNameInApiPath = true,
  reportTargetType = 'comment',
  isCommentLikeEnabled = true,
  getYoutubeCurrentTime,
  onYoutubeTimestampClick,
  initialData,
  isPostDonationAvailable = false,
  guidelineDialogData,
}: Props) {
  const [comments, setComments] = useState<CommentData[]>(initialData?.comments ?? []);
  const [mySelfAvatarUrl, setMySelfAvatarUrl] = useState(initialData?.mySelfAvatarUrl ?? '');
  const [myPollChoice, setMyPollChoice] = useState<PollChoice | null>(initialData?.myPollChoice ?? null);
  const [canWrite, setCanWrite] = useState(initialData?.actions?.canWrite === true);
  const [canWriteReason, setCanWriteReason] = useState<'guest' | 'policy' | 'hidden' | null>(
    initialData?.actions?.canWriteReason ?? null,
  );
  const [canUploadImage, setCanUploadImage] = useState(initialData?.actions?.canUploadImage === true);
  const [isStaff, setIsStaff] = useState(initialData?.isStaff ?? '');
  const [isCommunity, setIsCommunity] = useState(initialData?.isCommunity === true);
  const [boardLabel, setBoardLabel] = useState(initialData?.boardLabel ?? '');
  const [commentSort, setCommentSort] = useState<CommentSort>('popular');
  const [newestCommentId, setNewestCommentId] = useState('');
  const [activeReplyTargetId, setActiveReplyTargetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function getApiUrl(path = '') {
    const url = `${apiBasePath}${path}`;

    if (!includeSiteNameInApiPath) {
      return url;
    }

    return `${url}${url.includes('?') ? '&' : '?'}siteName=${encodeURIComponent(siteName)}`;
  }

  const loadComments = useCallback(async () => {
    try {
      setErrorMessage('');

      const response = await fetch(getApiUrl(), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const result = (await response.json()) as CommentsResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 목록을 불러오지 못했습니다.');
      }

      setIsStaff(result.isStaff);
      setIsCommunity(result.isCommunity === true);
      setBoardLabel(result.boardLabel ?? '');

      setComments(Array.isArray(result.comments) ? result.comments : []);
      setNewestCommentId('');
      setMySelfAvatarUrl(result.mySelfAvatarUrl ?? '');
      setMyPollChoice(result.myPollChoice ?? null);
      setCanWrite(result.actions?.canWrite === true);
      setCanWriteReason(result.actions?.canWriteReason ?? null);
      setCanUploadImage(result.actions?.canUploadImage === true);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 목록을 불러오지 못했습니다.');
      } else {
        setErrorMessage('댓글 목록을 불러오지 못했습니다.');
      }
    }
  }, [apiBasePath, includeSiteNameInApiPath, siteName]);

  useEffect(() => {
    if (initialData) return;

    queueMicrotask(() => {
      void loadComments();
    });
  }, [initialData, loadComments]);

  async function createComment(
    content: string,
    parentId: string | null,
    image: CommentImageChange = EMPTY_IMAGE_CHANGE,
  ): Promise<string | void> {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(getApiUrl(), {
        method: 'POST',
        credentials: 'include',
        ...createCommentRequestBody({ siteName, content, parentId, replyToId: parentId }, image),
      });

      const result = (await response.json()) as CommentActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 작성에 실패했습니다.');
      }

      if (result.ok && !result.comment) {
        await loadComments();
        setActiveReplyTargetId('');
        return;
      }

      if (!result.comment) {
        throw new Error('작성한 댓글을 불러오지 못했습니다.');
      }

      const createdComment = result.comment;

      setComments((previousComments) => addComment(previousComments, createdComment));

      if (!createdComment.parent_id) {
        setNewestCommentId(createdComment.id);
      }

      setActiveReplyTargetId('');
    } catch (unknownError) {
      const nextErrorMessage =
        unknownError instanceof Error
          ? unknownError.message || '댓글 작성에 실패했습니다.'
          : '댓글 작성에 실패했습니다.';

      setErrorMessage(nextErrorMessage);
      return nextErrorMessage;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function editComment(
    commentId: string,
    content: string,
    image: CommentImageChange = EMPTY_IMAGE_CHANGE,
  ): Promise<string | void> {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(getApiUrl(`/${commentId}`), {
        method: 'PATCH',
        credentials: 'include',
        ...createCommentRequestBody({ siteName, content }, image),
      });

      const result = (await response.json()) as CommentActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 수정에 실패했습니다.');
      }

      await loadComments();
    } catch (unknownError) {
      const nextErrorMessage =
        unknownError instanceof Error
          ? unknownError.message || '댓글 수정에 실패했습니다.'
          : '댓글 수정에 실패했습니다.';

      setErrorMessage(nextErrorMessage);
      return nextErrorMessage;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(getApiUrl(`/${commentId}`), {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = (await response.json()) as CommentActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 삭제에 실패했습니다.');
      }

      await loadComments();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 삭제에 실패했습니다.');
      } else {
        setErrorMessage('댓글 삭제에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function blindComment(commentId: string) {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(getApiUrl(`/${commentId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          action: 'blind',
        }),
      });

      const result = (await response.json()) as CommentActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 숨김에 실패했습니다.');
      }

      await loadComments();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 숨김에 실패했습니다.');
      } else {
        setErrorMessage('댓글 숨김에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function unblindComment(commentId: string) {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(getApiUrl(`/${commentId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          action: 'unblind',
        }),
      });

      const result = (await response.json()) as CommentActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 숨김 취소에 실패했습니다.');
      }

      await loadComments();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 숨김 취소에 실패했습니다.');
      } else {
        setErrorMessage('댓글 숨김 취소에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function likeComment(commentId: string) {
    try {
      setErrorMessage('');

      const response = await fetch(getApiUrl(`/${commentId}/like`), {
        method: 'PATCH',
        credentials: 'include',
      });

      const result = (await response.json()) as CommentReactionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 좋아요를 처리하지 못했습니다.');
      }

      setComments((previousComments) =>
        updateCommentReactionState({
          comments: previousComments,
          commentId,
          isLiked: result.isLiked === true,
          likeCount: typeof result.likeCount === 'number' ? result.likeCount : 0,
          isDisliked: result.isDisliked === true,
          dislikeCount: typeof result.dislikeCount === 'number' ? result.dislikeCount : 0,
        }),
      );
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 좋아요를 처리하지 못했습니다.');
      } else {
        setErrorMessage('댓글 좋아요를 처리하지 못했습니다.');
      }
    }
  }

  async function dislikeComment(commentId: string) {
    try {
      setErrorMessage('');

      const response = await fetch(getApiUrl(`/${commentId}/dislike`), {
        method: 'PATCH',
        credentials: 'include',
      });

      const result = (await response.json()) as CommentReactionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 싫어요를 처리하지 못했습니다.');
      }

      setComments((previousComments) =>
        updateCommentReactionState({
          comments: previousComments,
          commentId,
          isLiked: result.isLiked === true,
          likeCount: typeof result.likeCount === 'number' ? result.likeCount : 0,
          isDisliked: result.isDisliked === true,
          dislikeCount: typeof result.dislikeCount === 'number' ? result.dislikeCount : 0,
        }),
      );
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 싫어요를 처리하지 못했습니다.');
      } else {
        setErrorMessage('댓글 싫어요를 처리하지 못했습니다.');
      }
    }
  }

  async function pinComment(commentId: string, isPinned: boolean) {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(getApiUrl(`/${commentId}/pin`), {
        method: isPinned ? 'PATCH' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ siteName }),
      });
      const result = (await response.json()) as CommentPinResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 고정 상태를 변경하지 못했습니다.');
      }

      await loadComments();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 고정 상태를 변경하지 못했습니다.');
      } else {
        setErrorMessage('댓글 고정 상태를 변경하지 못했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const commentCount = getCommentCount(comments);
  const pinnedCommentId = comments.find((comment) => comment.is_pinned)?.id ?? '';
  const sortedComments = sortComments(comments, commentSort, newestCommentId);

  return (
    <section className={`${styles['comment-section']} paper`}>
      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      <div className={styles['comment-headline']}>
        <strong>
          <span>댓글</span>
          <span aria-label="댓글 갯수">{commentCount}</span>
        </strong>
        <button type="button" aria-label="댓글 새로고침" onClick={() => void loadComments()} disabled={isSubmitting}>
          <RefreshRoundedIcon />
        </button>
      </div>

      <SiteGuidelineActions siteName={siteName} data={guidelineDialogData} />

      {isCommentEnabled && canWrite ? (
        <CommentForm
          avatarUrl={mySelfAvatarUrl}
          pollChoiceLabel={myPollChoice?.label}
          isSubmitting={isSubmitting}
          externalErrorMessage={errorMessage}
          getYoutubeCurrentTime={getYoutubeCurrentTime}
          renderDonationAction={
            isPostDonationAvailable
              ? (commentFormId) => (
                  <DonationButton
                    siteName={siteName}
                    targetType="post"
                    boardName={boardName}
                    contentId={contentId}
                    commentFormId={commentFormId}
                    successUrl={`/${siteName}/${boardName}/${contentSlug}/donation/success`}
                    failUrl={`/${siteName}/${boardName}/${contentSlug}/donation/fail`}
                    buttonText="후원 댓글"
                    triggerClassName={styles['submit-button']}
                    disabled={isSubmitting}
                  />
                )
              : undefined
          }
          canUploadImage={canUploadImage}
          onSubmit={(content, image) => createComment(content, null, image)}
        />
      ) : null}

      {isCommentEnabled && !canWrite && canWriteReason === 'guest' ? (
        <div className={styles.textarea}>
          <Avatar
            src="/broken-image.jpg"
            alt=""
            sx={{ width: 28, height: 28, position: 'absolute', top: 12, left: 12 }}
          />
          <Anchor href={`/auth/sign-in`}>로그인 하시면 댓글을 다실 수 있어요</Anchor>
          <div className={styles.options}>
            <div className={styles.submit}>등록</div>
          </div>
        </div>
      ) : null}

      {isCommentEnabled && !canWrite && canWriteReason === 'policy' ? (
        <div className={styles.textarea}>
          <Avatar
            src="/broken-image.jpg"
            alt=""
            sx={{ width: 28, height: 28, position: 'absolute', top: 12, left: 12 }}
          />
          <p>댓글 작성 요건에 충족하지 않습니다. 매니저에게 문의하세요.</p>
          <div className={styles.options}>
            <div className={styles.submit}>등록</div>
          </div>
        </div>
      ) : null}

      <div className={styles['comment-items']}>
        <div className={styles['comment-items-sorting']}>
          <button
            type="button"
            className={`button small ${commentSort === 'popular' ? 'submit' : 'action'}`}
            onClick={() => setCommentSort('popular')}
          >
            인기순
          </button>
          <button
            type="button"
            className={`button small ${commentSort === 'latest' ? 'submit' : 'action'}`}
            onClick={() => setCommentSort('latest')}
          >
            최신순
          </button>
        </div>
        {sortedComments.length > 0 ? (
          sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              siteName={siteName}
              boardName={boardName}
              contentId={contentId}
              isStaff={isStaff}
              isCommunity={isCommunity}
              boardLabel={boardLabel}
              reportTargetType={reportTargetType}
              isCommentLikeEnabled={isCommentLikeEnabled}
              isCommentDislikeEnabled={isCommentLikeEnabled}
              comment={comment}
              avatarUrl={mySelfAvatarUrl}
              myPollChoiceLabel={myPollChoice?.label ?? ''}
              activeReplyTargetId={activeReplyTargetId}
              isSubmitting={isSubmitting}
              getYoutubeCurrentTime={getYoutubeCurrentTime}
              onYoutubeTimestampClick={onYoutubeTimestampClick}
              onReplyClick={(targetComment) => setActiveReplyTargetId(targetComment.id)}
              onCancelReply={() => setActiveReplyTargetId('')}
              canUploadImage={canUploadImage}
              onCreateReply={(parentId, content, image) => createComment(content, parentId, image)}
              onEdit={editComment}
              onDelete={deleteComment}
              onBlind={blindComment}
              onUnblind={unblindComment}
              onLike={likeComment}
              onDislike={dislikeComment}
              pinnedCommentId={pinnedCommentId}
              onPin={pinComment}
            />
          ))
        ) : (
          <p className={styles['comment-0']}>
            <SmsOutlinedIcon sx={{ width: 57, height: 57 }} />
            <span>이 글의 첫 댓글을 달아보세요!</span>
          </p>
        )}
      </div>
      <FormErrorDialog
        open={Boolean(errorMessage)}
        title={null}
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => setErrorMessage('')}
      />
    </section>
  );
}
