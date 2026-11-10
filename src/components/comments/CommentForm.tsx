'use client';

import { type ChangeEvent, JSX, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { styled } from '@mui/material';
import Avatar from '@mui/material/Avatar';
import styles from '@/app/comments.module.sass';

export type CommentImageChange = {
  file: File | null;
  shouldRemove: boolean;
};

const MAX_COMMENT_IMAGE_FILE_SIZE = 1024 * 1024;
const ACCEPTED_COMMENT_IMAGE_TYPES = ['image/webp', 'image/png', 'image/jpeg'];

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

type Props = {
  placeholder?: string;
  submitLabel?: string;
  defaultValue?: string;
  replyTargetName?: string;
  avatarUrl: string;
  pollChoiceLabel?: string;
  isSubmitting?: boolean;
  externalErrorMessage?: string;
  getYoutubeCurrentTime?: () => number | null;
  renderDonationAction?: (formId: string) => ReactNode;
  canUploadImage?: boolean;
  defaultImageUrl?: string;
  onSubmit: (content: string, image: CommentImageChange) => Promise<string | void>;
  onCancel?: () => void;
};

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

export default function CommentForm({
  placeholder = '댓글을 달아보세요.',
  submitLabel = '댓글 달기',
  defaultValue = '',
  replyTargetName,
  avatarUrl,
  isSubmitting = false,
  externalErrorMessage = '',
  getYoutubeCurrentTime,
  renderDonationAction,
  canUploadImage = false,
  defaultImageUrl = '',
  onSubmit,
  onCancel,
}: Props) {
  const textareaReference = useRef<HTMLTextAreaElement | null>(null);
  const imageInputReference = useRef<HTMLInputElement | null>(null);
  const formId = useId();

  const [content, setContent] = useState(defaultValue);
  const [errorMessage, setErrorMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [isDefaultImageRemoved, setIsDefaultImageRemoved] = useState(false);
  const shownImageUrl = imagePreviewUrl || (isDefaultImageRemoved ? '' : defaultImageUrl);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    if (!ACCEPTED_COMMENT_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage('webp, png, jpg 이미지만 올릴 수 있습니다.');
      return;
    }

    if (file.size >= MAX_COMMENT_IMAGE_FILE_SIZE) {
      setErrorMessage('댓글 이미지는 1MB 미만으로 올려주세요.');
      return;
    }

    setErrorMessage('');
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleImageRemove() {
    setImageFile(null);
    setImagePreviewUrl('');
    setIsDefaultImageRemoved(true);
  }

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

    const submitError = await onSubmit(normalizedContent, {
      file: imageFile,
      shouldRemove: !imageFile && isDefaultImageRemoved && Boolean(defaultImageUrl),
    });

    if (submitError) {
      setErrorMessage(submitError);
      return;
    }

    setErrorMessage('');
    setContent('');
    setImageFile(null);
    setImagePreviewUrl('');

    window.requestAnimationFrame(() => {
      resizeTextarea();
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="form">
      <fieldset>
        <legend>댓글쓰기 폼</legend>
        {errorMessage || externalErrorMessage ? (
          <p className="alert error" style={{ marginBottom: '0.5rem' }}>
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage || externalErrorMessage}</span>
          </p>
        ) : null}
        <div className={styles.textarea}>
          <Avatar
            src={avatarUrl || '/broken-image.jpg'}
            alt=""
            sx={{ width: 28, height: 28, position: 'absolute', top: 12, left: 12 }}
          />

          {replyTargetName ? <strong>{replyTargetName}</strong> : null}

          <textarea
            ref={textareaReference}
            name="content"
            value={content}
            placeholder={placeholder}
            disabled={isSubmitting}
            rows={1}
            required
            aria-invalid={Boolean(errorMessage || externalErrorMessage)}
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

            {canUploadImage ? (
              <>
                <VisuallyHiddenInput
                  ref={imageInputReference}
                  type="file"
                  accept="image/webp,image/png,image/jpeg"
                  onChange={handleImageChange}
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  className={styles['submit-button']}
                  onClick={() => imageInputReference.current?.click()}
                >
                  {shownImageUrl ? '이미지 변경' : '이미지 추가'}
                </button>
              </>
            ) : null}

            {renderDonationAction?.(formId)}

            <button type="submit" disabled={isSubmitting} className={styles['submit-button']}>
              {submitLabel}
            </button>
          </div>
        </div>
        {shownImageUrl ? (
          <div className={styles['comment-image-preview']}>
            <img src={shownImageUrl} alt="댓글에 첨부할 이미지" />
            <button type="button" disabled={isSubmitting} onClick={handleImageRemove}>
              이미지 삭제
            </button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
