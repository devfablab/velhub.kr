'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import { MenuItem, Select, useMediaQuery, useTheme } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ToastEditor from '@/components/editor/ToastEditor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import styles from '@/app/board.module.sass';

type Category = { id: string; label: string };
type Post = { category_id: string; content_html: string; subject: string };
type BoardResponse = { categories?: Category[]; error?: string };
type PostResponse = { post?: Post; error?: string };

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const postId = normalizeText(params.postId);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [subject, setSubject] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const categorySelectReference = useRef<HTMLDivElement | null>(null);
  const [subjectPaddingLeft, setSubjectPaddingLeft] = useState(12);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const width = categorySelectReference.current?.getBoundingClientRect().width ?? 0;
      setSubjectPaddingLeft(Math.ceil(width) + 12);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [categories, categoryId]);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/private-board?siteName=${siteName}`, { credentials: 'include' }),
      fetch(`/api/private-board/${postId}?siteName=${siteName}`, { credentials: 'include' }),
    ])
      .then(async ([boardResponse, postResponse]) => {
        const boardResult = (await boardResponse.json()) as BoardResponse;
        const postResult = (await postResponse.json()) as PostResponse;

        if (boardResponse.status === 401 || postResponse.status === 401) {
          router.replace(`/auth/sign-in?next=/${siteName}/private/${postId}/edit`);
          return;
        }

        if (!boardResponse.ok || !postResponse.ok || !postResult.post) {
          setErrorMessage(postResult.error ?? boardResult.error ?? '글 수정 정보를 불러오지 못했습니다.');
          return;
        }

        setCategories(boardResult.categories ?? []);
        setCategoryId(postResult.post.category_id);
        setSubject(postResult.post.subject);
        setContentHtml(postResult.post.content_html);
      })
      .catch(() => setErrorMessage('글 수정 정보를 불러오지 못했습니다.'))
      .finally(() => setIsLoading(false));
  }, [postId, router, siteName]);

  async function handleSubmit() {
    if (isSaving) return;

    setErrorMessage('');
    setIsSaving(true);

    try {
      const response = await fetch(`/api/private-board/${postId}?siteName=${siteName}`, {
        body: JSON.stringify({ categoryId, contentHtml, subject }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      });
      const result = (await response.json()) as PostResponse;

      if (!response.ok) throw new Error(result.error ?? '글 수정에 실패했습니다.');

      router.replace(`/${siteName}/private/${postId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '글 수정에 실패했습니다.');
      setIsSaving(false);
    }
  }

  return (
    <div className="container">
      {!isMobile ? (
        <aside>
          <SiteInfo />
          <TableList writeHref={`/${siteName}/private/new`} />
        </aside>
      ) : null}
      <div className={`${styles.content} content`}>
        {isMobile ? null : (
          <h2>
            <ListAltOutlinedIcon />
            <span>글 수정</span>
          </h2>
        )}
        {isLoading ? (
          <div className="paper">
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        ) : (
          <>
            {errorMessage ? <div className="paper paper-error">{errorMessage}</div> : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
              className={`${styles.form} form`}
            >
              <fieldset>
                <legend>비공개 게시판 글 수정 폼</legend>
                <div className="paper">
                  <div className={styles['post-info']}>
                    <div className={styles['form-group']}>
                      <div ref={categorySelectReference} className={styles['form-select']}>
                        <Select
                          displayEmpty
                          value={categoryId}
                          onChange={(event) => setCategoryId(event.target.value)}
                          className={styles['MuiInputBase-root']}
                        >
                          {categories.map((category) => (
                            <MenuItem key={category.id} value={category.id}>
                              {category.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </div>
                      <div className={styles['form-control']}>
                        <input
                          type="text"
                          value={subject}
                          onChange={(event) => setSubject(event.currentTarget.value)}
                          placeholder="제목을 입력해 주세요 (필수)"
                          style={{ paddingLeft: subjectPaddingLeft }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`${styles.editor} ${styles['editor-basic']} service-editor`}>
                  <ToastEditor
                    initialValue={contentHtml}
                    initialMarkdown=""
                    initialEditType="wysiwyg"
                    hideModeSwitch
                    markdownStatus="markdown_off"
                    onHtmlChange={setContentHtml}
                    onMarkdownChange={() => {}}
                  />
                </div>
                <div className={styles['button-group']}>
                  <Anchor href={`/${siteName}/private/${postId}`} className={`${styles.link} link`}>
                    취소
                  </Anchor>
                  <button type="submit" className={`${styles.submit} button`} disabled={isSaving}>
                    수정 완료
                  </button>
                </div>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
