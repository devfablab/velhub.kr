'use client';

import { useEffect, useState } from 'react';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import { Avatar } from '@mui/material';
import CommentForm from '@/components/comments/CommentForm';
import CommentItem, { type CommentData } from '@/components/comments/CommentItem';
import Anchor from '../Anchor';
import { LoadingIndicator } from '../LoadingIndicator';
import styles from '@/app/comments.module.sass';

type Props = {
  siteName: string;
  boardName: string;
  contentId: string;
  postAuthorId: string;
  isCommentEnabled: boolean;
};

type PollChoice = {
  option_index: number;
  label: string;
};

type CommentsResponse = {
  comments?: CommentData[];
  mySelfAvatarUrl?: string;
  myPollChoice?: PollChoice | null;
  isStaff: string;
  actions?: {
    canWrite?: boolean;
    canManageComment?: boolean;
    canWriteReason?: 'guest' | 'policy' | 'hidden' | null;
  };
  error?: string;
};

type CommentActionResponse = {
  ok?: boolean;
  comment?: CommentData;
  error?: string;
};

type CommentLikeResponse = {
  ok?: boolean;
  isLiked?: boolean;
  likeCount?: number;
  error?: string;
};

type CommentWithReplies = CommentData & {
  replies?: CommentData[];
  children?: CommentData[];
};

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

function updateCommentLikeState({
  comments,
  commentId,
  isLiked,
  likeCount,
}: {
  comments: CommentData[];
  commentId: string;
  isLiked: boolean;
  likeCount: number;
}): CommentData[] {
  return comments.map((comment) => ({
    ...comment,
    is_liked: comment.id === commentId ? isLiked : comment.is_liked,
    like_count: comment.id === commentId ? likeCount : comment.like_count,
    replies: updateCommentLikeState({
      comments: comment.replies,
      commentId,
      isLiked,
      likeCount,
    }),
  }));
}

export default function CommentList({ siteName, boardName, contentId, isCommentEnabled }: Props) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [mySelfAvatarUrl, setMySelfAvatarUrl] = useState('');
  const [myPollChoice, setMyPollChoice] = useState<PollChoice | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [canWriteReason, setCanWriteReason] = useState<'guest' | 'policy' | 'hidden' | null>(null);
  const [canManageComment, setCanManageComment] = useState(false);
  const [isStaff, setIsStaff] = useState('');
  const [activeReplyTargetId, setActiveReplyTargetId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadComments() {
    try {
      setErrorMessage('');

      const response = await fetch(`/api/boards/${boardName}/${contentId}/comments?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as CommentsResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 목록을 불러오지 못했습니다.');
      }

      setIsStaff(result.isStaff);

      setComments(Array.isArray(result.comments) ? result.comments : []);
      setMySelfAvatarUrl(result.mySelfAvatarUrl ?? '');
      setMyPollChoice(result.myPollChoice ?? null);
      setCanWrite(result.actions?.canWrite === true);
      setCanWriteReason(result.actions?.canWriteReason ?? null);
      setCanManageComment(result.actions?.canManageComment === true);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 목록을 불러오지 못했습니다.');
      } else {
        setErrorMessage('댓글 목록을 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteName, boardName, contentId]);

  async function createComment(content: string, parentId: string | null) {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(`/api/boards/${boardName}/${contentId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          content,
          parentId,
        }),
      });

      const result = (await response.json()) as CommentActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 작성에 실패했습니다.');
      }

      await loadComments();
      setActiveReplyTargetId('');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 작성에 실패했습니다.');
      } else {
        setErrorMessage('댓글 작성에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function editComment(commentId: string, content: string) {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(`/api/boards/${boardName}/${contentId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          content,
        }),
      });

      const result = (await response.json()) as CommentActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 수정에 실패했습니다.');
      }

      await loadComments();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 수정에 실패했습니다.');
      } else {
        setErrorMessage('댓글 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(`/api/boards/${boardName}/${contentId}/comments/${commentId}?siteName=${siteName}`, {
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

      const response = await fetch(`/api/boards/${boardName}/${contentId}/comments/${commentId}`, {
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

      const response = await fetch(`/api/boards/${boardName}/${contentId}/comments/${commentId}`, {
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

      const response = await fetch(
        `/api/boards/${boardName}/${contentId}/comments/${commentId}/like?siteName=${siteName}`,
        {
          method: 'PATCH',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as CommentLikeResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '댓글 좋아요를 처리하지 못했습니다.');
      }

      setComments((previousComments) =>
        updateCommentLikeState({
          comments: previousComments,
          commentId,
          isLiked: result.isLiked === true,
          likeCount: typeof result.likeCount === 'number' ? result.likeCount : 0,
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

  if (isLoading) {
    return (
      <section className="comment-section paper">
        <h3>댓글</h3>
        <div className="loading-container">
          <LoadingIndicator />
        </div>
      </section>
    );
  }

  const commentCount = getCommentCount(comments);

  return (
    <section className={`${styles['comment-section']} paper`}>
      {errorMessage ? <div className="paper paper-error">{errorMessage}</div> : null}

      <div className={styles['comment-headline']}>
        <strong>
          <span>댓글</span>
          <span aria-label="댓글 갯수">{commentCount}</span>
        </strong>
        <button type="button" aria-label="댓글 새로고침" onClick={() => void loadComments()} disabled={isSubmitting}>
          <RefreshRoundedIcon />
        </button>
      </div>

      {isCommentEnabled && canWrite ? (
        <CommentForm
          avatarUrl={mySelfAvatarUrl}
          pollChoiceLabel={myPollChoice?.label}
          isSubmitting={isSubmitting}
          onSubmit={(content) => createComment(content, null)}
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
        {comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              siteName={siteName}
              boardName={boardName}
              contentId={contentId}
              isStaff={isStaff}
              comment={comment}
              avatarUrl={mySelfAvatarUrl}
              myPollChoiceLabel={myPollChoice?.label ?? ''}
              activeReplyTargetId={activeReplyTargetId}
              isSubmitting={isSubmitting}
              onReplyClick={(targetComment) => setActiveReplyTargetId(targetComment.id)}
              onCancelReply={() => setActiveReplyTargetId('')}
              onCreateReply={(parentId, content) => createComment(content, parentId)}
              onEdit={editComment}
              onDelete={deleteComment}
              onBlind={blindComment}
              onUnblind={unblindComment}
              onLike={likeComment}
            />
          ))
        ) : (
          <p className={styles['comment-0']}>
            <SmsOutlinedIcon sx={{ width: 57, height: 57 }} />
            <span>이 글의 첫 댓글을 달아보세요!</span>
          </p>
        )}
      </div>
    </section>
  );
}
