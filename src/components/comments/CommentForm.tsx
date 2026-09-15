'use client';

import { type ChangeEvent, JSX, useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import styles from '@/app/comments.module.sass';

type Props = {
  placeholder?: string;
  submitLabel?: string;
  defaultValue?: string;
  replyTargetName?: string;
  avatarUrl: string;
  pollChoiceLabel?: string;
  isSubmitting?: boolean;
  getYoutubeCurrentTime?: () => number | null;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
};

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

export default function CommentForm({
  placeholder = '댓글을 달아보세요.',
  submitLabel = '등록',
  defaultValue = '',
  replyTargetName,
  avatarUrl,
  isSubmitting = false,
  getYoutubeCurrentTime,
  onSubmit,
  onCancel,
}: Props) {
  const textareaReference = useRef<HTMLTextAreaElement | null>(null);

  const [content, setContent] = useState(defaultValue);
  const [errorMessage, setErrorMessage] = useState('');

  function resizeTextarea() {
    const textarea = textareaReference.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function handleContentChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setContent(event.currentTarget.value);

    window.requestAnimationFrame(() => {
      resizeTextarea();
    });
  }

  function handleTimestampAdd() {
    const currentTime = getYoutubeCurrentTime?.();
    const textarea = textareaReference.current;

    if (currentTime === null || currentTime === undefined || !textarea) {
      return;
    }

    const hours = Math.floor(currentTime / 3600);
    const minutes = Math.floor((currentTime % 3600) / 60);
    const seconds = currentTime % 60;
    const timestamp =
      hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const contentBeforeCursor = content.slice(0, selectionStart);
    const currentLineBeforeCursor = contentBeforeCursor.slice(contentBeforeCursor.lastIndexOf('\n') + 1);
    const insertValue = `${currentLineBeforeCursor.trim() ? ' ' : ''}${timestamp} `;
    const nextContent = `${contentBeforeCursor}${insertValue}${content.slice(selectionEnd)}`;
    const cursorPosition = selectionStart + insertValue.length;

    setContent(nextContent);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
      resizeTextarea();
    });
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const normalizedContent = content.trim();

    if (!normalizedContent) {
      setErrorMessage('댓글 내용을 입력해주세요.');
      return;
    }

    setErrorMessage('');
    await onSubmit(normalizedContent);
    setContent('');

    window.requestAnimationFrame(() => {
      resizeTextarea();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <fieldset>
        <legend>댓글쓰기 폼</legend>
        {errorMessage ? <p>{errorMessage}</p> : null}
        <div className={styles.textarea}>
          <Avatar src={avatarUrl} alt="" sx={{ width: 28, height: 28, position: 'absolute', top: 12, left: 12 }} />

          {replyTargetName ? <strong>{replyTargetName}</strong> : null}

          <textarea
            ref={textareaReference}
            value={content}
            placeholder={placeholder}
            disabled={isSubmitting}
            rows={1}
            className={replyTargetName ? styles['reply-textarea'] : undefined}
            onChange={handleContentChange}
          />

          <div className={styles.options}>
            {onCancel ? (
              <button type="button" onClick={onCancel} disabled={isSubmitting} className={styles['cancel-button']}>
                취소
              </button>
            ) : null}

            {getYoutubeCurrentTime ? (
              <button
                type="button"
                disabled={isSubmitting}
                className={styles['submit-button']}
                onClick={handleTimestampAdd}
              >
                타임스탬프 추가
              </button>
            ) : null}

            <button type="submit" disabled={isSubmitting} className={styles['submit-button']}>
              {submitLabel}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
