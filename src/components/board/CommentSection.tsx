'use client';

import { useEffect, useState } from 'react';
import CommentForm from '@/components/board/CommentForm';
import CommentItem, { type CommentData } from '@/components/board/CommentItem';

type Props = {
  siteName: string;
  boardName: string;
  contentId: string;
  postAuthorId: string;
  isCommentEnabled: boolean;
};

type CommentsResponse = {
  comments?: CommentData[];
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

export default function CommentSection({ siteName, boardName, contentId, isCommentEnabled }: Props) {
  const [comments, setComments] = useState<CommentData[]>([]);
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
      <section className="comment-section">
        <h3>댓글</h3>
        <div className="loading-container">댓글을 불러오는 중입니다.</div>
      </section>
    );
  }

  return (
    <section className="comment-section">
      <h3>댓글</h3>

      {errorMessage ? <div className="paper paper-error">{errorMessage}</div> : null}

      {!isCommentEnabled ? <p>댓글이 허용되지 않은 글입니다.</p> : null}

      {isCommentEnabled && canWrite ? (
        <CommentForm isSubmitting={isSubmitting} onSubmit={(content) => createComment(content, null)} />
      ) : null}

      {isCommentEnabled && !canWrite ? <p>댓글을 작성하려면 로그인이 필요합니다.</p> : null}

      {canManageComment ? <p>매니저 권한으로 삭제/숨김 처리된 댓글 원문을 볼 수 있습니다.</p> : null}

      <div className="comment-list">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
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
          <p>등록된 댓글이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
