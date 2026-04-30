'use client';

import { useState, type FormEvent } from 'react';

type Props = {
  placeholder?: string;
  submitLabel?: string;
  defaultValue?: string;
  replyTargetName?: string;
  isSubmitting?: boolean;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
};

export default function CommentForm({
  placeholder = '댓글을 입력해주세요.',
  submitLabel = '등록',
  defaultValue = '',
  replyTargetName,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: Props) {
  const [content, setContent] = useState(defaultValue);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedContent = content.trim();

    if (!normalizedContent) {
      setErrorMessage('댓글 내용을 입력해주세요.');
      return;
    }

    setErrorMessage('');
    await onSubmit(normalizedContent);
    setContent('');
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="comment-form">
      {replyTargetName ? (
        <p className="comment-reply-target">
          <strong>{replyTargetName}</strong>
          <span>님에게 답글 작성 중</span>
        </p>
      ) : null}

      {errorMessage ? <p className="comment-form-error">{errorMessage}</p> : null}

      <textarea
        value={content}
        placeholder={placeholder}
        disabled={isSubmitting}
        onChange={(event) => setContent(event.currentTarget.value)}
      />

      <div className="comment-form-actions">
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={isSubmitting}>
            취소
          </button>
        ) : null}

        <button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
