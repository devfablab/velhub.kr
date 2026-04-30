'use client';

import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import CommentForm from '@/components/board/CommentForm';

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
  replies: CommentData[];
};

type Props = {
  comment: CommentData;
  depth?: 0 | 1;
  activeReplyTargetId: string;
  isSubmitting: boolean;
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
    return '게시판 매니저';
  }

  if (role === 'board-general-manager') {
    return '게시판 일반 매니저';
  }

  if (role === 'board-assistant-manager') {
    return '게시판 보조 매니저';
  }

  return '';
}

export default function CommentItem({
  comment,
  depth = 0,
  activeReplyTargetId,
  isSubmitting,
  onReplyClick,
  onCancelReply,
  onCreateReply,
  onEdit,
  onDelete,
  onBlind,
  onUnblind,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const roleLabel = getAuthorRoleLabel(comment.author_role);
  const isReplyFormOpen = activeReplyTargetId === comment.id;

  async function handleEdit(content: string) {
    await onEdit(comment.id, content);
    setIsEditing(false);
  }

  async function handleReplySubmit(content: string) {
    await onCreateReply(comment.id, content);
  }

  return (
    <article className={depth === 1 ? 'comment-item comment-reply-item' : 'comment-item'}>
      <div className="comment-author">
        <Avatar src={comment.author_avatar_url} alt={comment.author_name || '작성자'} />

        <div>
          <div className="comment-author-info">
            <strong>{comment.author_name || '작성자'}</strong>

            {comment.is_author ? <span>글 작성자</span> : null}
            {comment.is_me ? <span>본인</span> : null}

            {roleLabel ? (
              <span>{roleLabel}</span>
            ) : comment.author_level ? (
              <span>
                {comment.author_level.iconUrl ? (
                  <img src={comment.author_level.iconUrl} alt={comment.author_level.name} />
                ) : null}
                <span>{comment.author_level.name}</span>
              </span>
            ) : null}

            {comment.is_deleted ? <span>삭제된 댓글</span> : null}
            {comment.is_blinded ? <span>숨겨진 댓글</span> : null}
          </div>

          <time>{formatDateTime(comment.created_at)}</time>
        </div>
      </div>

      {depth === 1 && comment.reply_to_author_name ? (
        <p className="comment-reply-to">
          <strong>{comment.reply_to_author_name}</strong>
          <span>님에게 답글</span>
        </p>
      ) : null}

      {isEditing ? (
        <CommentForm
          defaultValue={comment.content}
          submitLabel="수정"
          isSubmitting={isSubmitting}
          onSubmit={handleEdit}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <p className="comment-content">{comment.content}</p>
      )}

      {comment.blinded_message ? <p className="comment-blinded-message">{comment.blinded_message}</p> : null}

      <div className="comment-actions">
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
          <button type="button" onClick={() => void onDelete(comment.id)} disabled={isSubmitting}>
            삭제
          </button>
        ) : null}

        {comment.can_blind ? (
          <button type="button" onClick={() => void onBlind(comment.id)} disabled={isSubmitting}>
            댓글 숨김
          </button>
        ) : null}

        {comment.can_unblind ? (
          <button type="button" onClick={() => void onUnblind(comment.id)} disabled={isSubmitting}>
            댓글 숨김 취소
          </button>
        ) : null}
      </div>

      {isReplyFormOpen ? (
        <CommentForm
          replyTargetName={comment.author_name || '작성자'}
          submitLabel="답글 등록"
          isSubmitting={isSubmitting}
          onSubmit={handleReplySubmit}
          onCancel={onCancelReply}
        />
      ) : null}

      {depth === 0 && comment.replies.length > 0 ? (
        <div className="comment-replies">
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
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
