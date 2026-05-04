'use client';

import { useEffect, useState } from 'react';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import { Avatar } from '@mui/material';
import CommentForm from '@/components/board/CommentForm';
import CommentItem, { type CommentData } from '@/components/board/CommentItem';
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

type CommentsResponse = {
  comments?: CommentData[];
  mySelfAvatarUrl?: string;
  actions?: {
    canWrite?: boolean;
    canManageComment?: boolean;
  };
  error?: string;
};

type CommentActionResponse = {
  ok?: boolean;
  comment?: CommentData;
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

export default function CommentSection({ siteName, boardName, contentId, isCommentEnabled }: Props) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [mySelfAvatarUrl, setMySelfAvatarUrl] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [canManageComment, setCanManageComment] = useState(false);
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

      setComments(Array.isArray(result.comments) ? result.comments : []);
      setMySelfAvatarUrl(result.mySelfAvatarUrl ?? '');
      setCanWrite(result.actions?.canWrite === true);
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
          action: 'edit',
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
          isSubmitting={isSubmitting}
          onSubmit={(content) => createComment(content, null)}
        />
      ) : null}

      {isCommentEnabled && !canWrite ? (
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

      <div className={styles['comment-items']}>
        {comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              avatarUrl={mySelfAvatarUrl}
              activeReplyTargetId={activeReplyTargetId}
              isSubmitting={isSubmitting}
              onReplyClick={(targetComment) => setActiveReplyTargetId(targetComment.id)}
              onCancelReply={() => setActiveReplyTargetId('')}
              onCreateReply={(parentId, content) => createComment(content, parentId)}
              onEdit={editComment}
              onDelete={deleteComment}
              onBlind={blindComment}
              onUnblind={unblindComment}
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
