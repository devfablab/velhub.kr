'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
};

export default function CommentForm({
  placeholder = '댓글을 달아보세요.',
  submitLabel = '등록',
  defaultValue = '',
  replyTargetName,
  avatarUrl,
  isSubmitting = false,
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

    window.requestAnimationFrame(() => {
      resizeTextarea();
    });
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="form">
      <fieldset>
        <legend>댓글쓰기 폼</legend>
        {errorMessage ? <p>{errorMessage}</p> : null}
        <div className={styles.textarea}>
          <Avatar src={avatarUrl} alt="" sx={{ width: 28, height: 28, position: 'absolute', top: 12, left: 12 }} />

          {replyTargetName ? <strong>{replyTargetName}</strong> : null}
          {/* {pollChoiceLabel ? <span className={styles['poll-choice']}>{pollChoiceLabel}</span> : null} */}

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

            <button type="submit" disabled={isSubmitting} className={styles['submit-button']}>
              {submitLabel}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
