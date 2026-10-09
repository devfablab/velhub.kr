'use client';

import { type FormEvent, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import DrawEventFields, { type BlogCommunityDrawState } from '@/components/service/blog-community/DrawEventFields';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../../menu';
import styles from '@/app/board.module.sass';

const MAX_CONTENT_LENGTH = 10_000;

export type BlogCommunityEditResponse = {
  post?: {
    content: string;
    isAuthor: boolean;
    isOperator: boolean;
    draw?: {
      drawType: 'first_come' | 'random';
      drawLimit: number | null;
      drawEndsAt: string | null;
    } | null;
  };
  error?: string;
};

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: BlogCommunityEditResponse | null;
  initialError: string;
}) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);
  const post = initialData?.post;
  const initialContent = post?.content ?? '';
  const [content, setContent] = useState(initialContent);
  const [draw, setDraw] = useState<BlogCommunityDrawState>(() => ({
    type: post?.draw?.drawType ?? '',
    limit: post?.draw?.drawLimit ?? 1,
    endsAt: post?.draw?.drawEndsAt ? new Date(post.draw.drawEndsAt) : null,
  }));
  const [fieldError, setFieldError] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(initialError || initialData?.error || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingReference = useRef(false);
  const normalizedContent = normalizeText(content);
  const isOverLimit = content.length > MAX_CONTENT_LENGTH;
  const initialDraw = post?.draw ?? null;
  const hasDrawChanged =
    draw.type !== (initialDraw?.drawType ?? '') ||
    draw.limit !== (initialDraw?.drawLimit ?? 1) ||
    (draw.endsAt?.getTime() ?? null) !== (initialDraw?.drawEndsAt ? new Date(initialDraw.drawEndsAt).getTime() : null);
  const hasChanged = normalizedContent !== initialContent || hasDrawChanged;
  const cancelHref =
    searchParams.get('from') === 'list'
      ? `/${siteName}/community-on-blog`
      : `/${siteName}/community-on-blog/${contentId}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingReference.current) return;

    const error = !normalizedContent
      ? '내용을 입력해주세요.'
      : isOverLimit
        ? '내용은 10,000자 이하로 입력해주세요.'
        : !hasChanged
          ? '변경된 내용이 없습니다.'
          : '';
    setFieldError(error);
    if (error) {
      setDialogError(error);
      return;
    }

    submittingReference.current = true;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/site/${siteName}/community-on-blog/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: normalizedContent,
          drawType: draw.type,
          drawLimit: draw.limit,
          drawEndsAt: draw.endsAt?.toISOString() ?? null,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || '글을 수정하지 못했습니다.');
      router.replace(`/${siteName}/community-on-blog/${contentId}`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : '글을 수정하지 못했습니다.';
      setFieldError(message);
      setDialogError(message);
      submittingReference.current = false;
      setIsSubmitting(false);
    }
  }

  if (initialError || initialData?.error || !post)
    return <ScreenState kind="error">{initialError || initialData?.error || '글을 찾을 수 없습니다.'}</ScreenState>;
  if (!post.isAuthor) return <ScreenState kind="error">작성자만 수정할 수 있습니다.</ScreenState>;

  return (
    <Container pageBack={cancelHref} pageTitle="글 수정" pageFin>
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']}`}>
          <form onSubmit={handleSubmit} className={`${styles.form} form`} noValidate>
            <fieldset>
              <legend>글 수정 폼</legend>
              <div className="paper paper-p0">
                <textarea
                  className={`${styles['content-simple']} ${styles['content-simple-feed']}`}
                  required
                  value={content}
                  disabled={isSubmitting}
                  maxLength={MAX_CONTENT_LENGTH + 1}
                  aria-label="커뮤니티 글 내용"
                  placeholder="무슨 일이 일어나고 있나요??"
                  onChange={(event) => {
                    setContent(event.currentTarget.value);
                    setFieldError('');
                  }}
                />
              </div>
              {post.isOperator ? (
                <div className="paper">
                  <div className={styles['post-options']}>
                    <DrawEventFields value={draw} onChange={setDraw} disabled={isSubmitting} classes={styles} />
                  </div>
                </div>
              ) : null}
              {fieldError ? <div className="paper paper-error">{fieldError}</div> : null}
              <div className={styles['button-group']}>
                <Anchor href={cancelHref} className={`${styles.link} link`}>
                  취소
                </Anchor>
                <button
                  type="submit"
                  className={`${styles.submit} button`}
                  disabled={!hasChanged || isOverLimit || isSubmitting}
                >
                  {isSubmitting ? '수정 중' : '수정'}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
      <FormErrorDialog
        open={Boolean(dialogError)}
        title="글 수정 오류"
        messages={dialogError ? [dialogError] : []}
        onClose={() => setDialogError(null)}
      />
    </Container>
  );
}
