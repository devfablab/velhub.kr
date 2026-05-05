'use client';

import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import CommentForm from '@/components/board/CommentForm';
import styles from '@/app/comments.module.sass';

type AuthorRole =
  | 'owner'
  | 'community-manager'
  | 'board-manager'
  | 'board-general-manager'
  | 'board-assistant-manager'
  | 'member';

type AuthorManageRole = {
  role: Exclude<AuthorRole, 'owner' | 'member'>;
  boardId: string | null;
};

type AuthorLevel = {
  id: string;
  lv: number;
  name: string;
  icon: string | null;
  iconUrl: string;
};

type ConfirmAction = 'delete' | 'blind' | 'unblind' | null;

type PollChoice = {
  option_index: number;
  label: string;
};

export type CommentData = {
  id: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  reply_to_id: string | null;
  reply_to_author_name: string;
  content: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  is_blinded: boolean;
  blinded_at: string | null;
  blinded_by: string | null;
  blinded_message: string | null;
  author_name: string;
  author_avatar_url: string;
  author_level: AuthorLevel | null;
  author_role: AuthorRole;
  author_manage_roles: AuthorManageRole[];
  is_author: boolean;
  is_me: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_blind: boolean;
  can_unblind: boolean;
  poll_choice: PollChoice | null;
  replies: CommentData[];
};

type Props = {
  comment: CommentData;
  depth?: 0 | 1;
  activeReplyTargetId: string;
  isSubmitting: boolean;
  avatarUrl: string;
  myPollChoiceLabel: string;
  onReplyClick: (comment: CommentData) => void;
  onCancelReply: () => void;
  onCreateReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onBlind: (commentId: string) => Promise<void>;
  onUnblind: (commentId: string) => Promise<void>;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function getAuthorRoleLabel(role: AuthorRole) {
  if (role === 'owner') {
    return '운영자';
  }

  if (role === 'community-manager') {
    return '커뮤니티 매니저';
  }

  if (role === 'board-manager') {
    return '전체 게시판 매니저';
  }

  if (role === 'board-general-manager') {
    return '개별 게시판 총괄 매니저';
  }

  if (role === 'board-assistant-manager') {
    return '개별 게시판 부 매니저';
  }

  return '';
}

export default function CommentItem({
  comment,
  depth = 0,
  activeReplyTargetId,
  isSubmitting,
  avatarUrl,
  myPollChoiceLabel,
  onReplyClick,
  onCancelReply,
  onCreateReply,
  onEdit,
  onDelete,
  onBlind,
  onUnblind,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const roleLabel = getAuthorRoleLabel(comment.author_role);
  const isReplyFormOpen = activeReplyTargetId === comment.id;

  const confirmDialog = (() => {
    if (confirmAction === 'delete') {
      return {
        title: '댓글 삭제',
        content: '정말로 댓글을 삭제하시겠습니까?\n삭제된 댓글은 복구할 수 없습니다.',
        confirmLabel: '삭제',
        confirmClassName: 'delete-button',
        onConfirm: async () => {
          setConfirmAction(null);
          await onDelete(comment.id);
        },
      };
    }

    if (confirmAction === 'blind') {
      return {
        title: '댓글 숨김',
        content: '정말로 댓글을 숨김 처리하시겠습니까?',
        confirmLabel: '숨김',
        confirmClassName: '',
        onConfirm: async () => {
          setConfirmAction(null);
          await onBlind(comment.id);
        },
      };
    }

    if (confirmAction === 'unblind') {
      return {
        title: '댓글 숨김 취소',
        content: '정말로 댓글 숨김을 취소하시겠습니까?',
        confirmLabel: '숨김 취소',
        confirmClassName: '',
        onConfirm: async () => {
          setConfirmAction(null);
          await onUnblind(comment.id);
        },
      };
    }

    return {
      title: '',
      content: '',
      confirmLabel: '',
      confirmClassName: '',
      onConfirm: async () => undefined,
    };
  })();

  async function handleEdit(content: string) {
    await onEdit(comment.id, content);
    setIsEditing(false);
  }

  async function handleReplySubmit(content: string) {
    await onCreateReply(comment.id, content);
  }

  return (
    <div className={depth === 1 ? `${styles['comment-item']} ${styles['comment-reply-item']}` : styles['comment-item']}>
      <Avatar src={comment.author_avatar_url} alt={comment.author_name} sx={{ width: 28, height: 28 }} />
      <div className={styles['comment-detail']}>
        <div className={styles['comment-author-info']}>
          <cite>{comment.author_name}</cite>

          {roleLabel ? (
            <span className={styles['author-manager']}>{roleLabel}</span>
          ) : comment.author_level ? (
            <span className={styles['author-lv']}>
              <span>{comment.author_level.name}</span>
              {comment.author_level.iconUrl ? (
                <img src={comment.author_level.iconUrl} alt={comment.author_level.name} />
              ) : null}
            </span>
          ) : null}

          {comment.is_author ? <span className={styles['author-type']}>글 작성자</span> : null}
          {comment.is_me ? <span className={styles['author-type']}>본인</span> : null}

          {comment.is_deleted ? <span className={styles['comment-status']}>삭제된 댓글</span> : null}
          {comment.is_blinded ? <span className={styles['comment-status']}>숨겨진 댓글</span> : null}
        </div>

        {isEditing ? (
          <CommentForm
            defaultValue={comment.content}
            submitLabel="수정"
            isSubmitting={isSubmitting}
            onSubmit={handleEdit}
            onCancel={() => setIsEditing(false)}
            avatarUrl={avatarUrl}
            pollChoiceLabel={comment.poll_choice?.label}
          />
        ) : (
          <div className={styles['comment-content']}>
            {depth === 1 && comment.reply_to_author_name ? <strong>{comment.reply_to_author_name} </strong> : null}
            <p>{comment.content}</p>
            {comment.poll_choice ? <blockquote>선택한 항목: {comment.poll_choice.label}</blockquote> : null}
          </div>
        )}

        {comment.blinded_message ? (
          <p className={styles['comment-blinded-message']}>{comment.blinded_message}</p>
        ) : null}

        <div className={styles.options}>
          <time>{formatDateTime(comment.created_at)}</time>
          {!comment.is_deleted && !comment.is_blinded ? (
            <button type="button" onClick={() => onReplyClick(comment)} disabled={isSubmitting}>
              답글 달기
            </button>
          ) : null}

          {comment.can_edit ? (
            <button type="button" onClick={() => setIsEditing(true)} disabled={isSubmitting || isEditing}>
              수정
            </button>
          ) : null}

          {comment.can_delete ? (
            <button type="button" onClick={() => setConfirmAction('delete')} disabled={isSubmitting}>
              삭제
            </button>
          ) : null}

          {comment.can_blind ? (
            <button type="button" onClick={() => setConfirmAction('blind')} disabled={isSubmitting}>
              댓글 숨김
            </button>
          ) : null}

          {comment.can_unblind ? (
            <button type="button" onClick={() => setConfirmAction('unblind')} disabled={isSubmitting}>
              댓글 숨김 취소
            </button>
          ) : null}
        </div>

        {isReplyFormOpen ? (
          <CommentForm
            replyTargetName={comment.author_name}
            submitLabel="답글 등록"
            isSubmitting={isSubmitting}
            onSubmit={handleReplySubmit}
            onCancel={onCancelReply}
            avatarUrl={avatarUrl}
            pollChoiceLabel={myPollChoiceLabel}
          />
        ) : null}

        {depth === 0 && comment.replies.length > 0 ? (
          <div className={styles['comment-replies']}>
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                depth={1}
                activeReplyTargetId={activeReplyTargetId}
                isSubmitting={isSubmitting}
                onReplyClick={onReplyClick}
                onCancelReply={onCancelReply}
                onCreateReply={onCreateReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onBlind={onBlind}
                onUnblind={onUnblind}
                avatarUrl={avatarUrl}
                myPollChoiceLabel={myPollChoiceLabel}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)} className="vh-dialog">
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{confirmDialog.content}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <button type="button" onClick={() => setConfirmAction(null)} className="cancel-button">
            취소
          </button>
          <button
            type="button"
            onClick={() => void confirmDialog.onConfirm()}
            disabled={isSubmitting}
            className={confirmDialog.confirmClassName}
          >
            {confirmDialog.confirmLabel}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
