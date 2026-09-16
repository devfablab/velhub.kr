'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import {
  Avatar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ToastEditor from '@/components/editor/ToastEditor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PostCountTableList from '@/components/service/community/PostCountTableList';
import RecentTableList from '@/components/service/community/RecentTableList';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import UserInfo from '@/components/service/community/UserInfo';
import EmbeddedContentHtml from '@/components/service/EmbeddedContentHtml';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/board.module.sass';

type Reply = {
  id: string;
  author_type: 'user' | 'staff';
  author_stigma_id: string;
  author_name: string;
  author_avatar_url: string;
  can_edit: boolean;
  content_html: string;
  created_at: string;
  updated_at: string;
};
type Data = {
  canEditPost?: boolean;
  canDeletePost?: boolean;
  previousPost?: { id: string; subject: string } | null;
  nextPost?: { id: string; subject: string } | null;
  post?: {
    subject: string;
    content_html: string;
    author_stigma_id: string;
    author_name: string;
    author_avatar_url: string;
    created_at: string;
  };
  replies?: Reply[];
  isStaff?: boolean;
  currentStigmaId?: string;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const postId = normalizeText(params.postId);
  const [data, setData] = useState<Data>({});
  const [contentHtml, setContentHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState('');
  const [editingReplyHtml, setEditingReplyHtml] = useState('');
  const [isSavingReply, setIsSavingReply] = useState(false);
  const [readyReplyEditorKey, setReadyReplyEditorKey] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  async function load() {
    const response = await fetch(`/api/private-board/${postId}?siteName=${siteName}`, { credentials: 'include' });
    const result = (await response.json()) as Data;
    if (response.status === 401) {
      router.replace(`/auth/sign-in?next=/${siteName}/private/${postId}`);
      return;
    }
    setData(result);
  }

  useEffect(() => {
    let isActive = true;

    fetch(`/api/private-board/${postId}?siteName=${siteName}`, { credentials: 'include' })
      .then(async (response) => {
        const result = (await response.json()) as Data;

        if (response.status === 401) {
          router.replace(`/auth/sign-in?next=/${siteName}/private/${postId}`);
          return;
        }

        if (isActive) {
          setData(result);
        }
      })
      .catch(() => {
        if (isActive) {
          setData({ error: '글 정보를 불러오지 못했습니다.' });
        }
      });

    return () => {
      isActive = false;
    };
  }, [postId, router, siteName]);

  async function reply() {
    if (isSaving) return;
    setIsSaving(true);
    const response = await fetch(`/api/private-board/${postId}?siteName=${siteName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ contentHtml }),
    });
    if (response.ok) {
      setContentHtml('');
      await load();
    } else {
      const result = (await response.json()) as Data;
      setData((value) => ({ ...value, error: result.error }));
    }
    setIsSaving(false);
  }

  function startReplyEdit(reply: Reply) {
    setEditingReplyId(reply.id);
    setEditingReplyHtml(reply.content_html);
  }

  function cancelReplyEdit() {
    setEditingReplyId('');
    setEditingReplyHtml('');
  }

  async function updateReply(replyId: string) {
    if (isSavingReply) return;

    setIsSavingReply(true);
    setData((value) => ({ ...value, error: undefined }));

    try {
      const response = await fetch(`/api/private-board/${postId}/replies/${replyId}?siteName=${siteName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contentHtml: editingReplyHtml }),
      });
      const result = (await response.json()) as Data;

      if (!response.ok) throw new Error(result.error ?? '답변 수정에 실패했습니다.');

      await load();
      cancelReplyEdit();
      setIsSavingReply(false);
    } catch (error) {
      setData((value) => ({
        ...value,
        error: error instanceof Error ? error.message : '답변 수정에 실패했습니다.',
      }));
      setIsSavingReply(false);
    }
  }

  async function deletePost() {
    if (isDeletingPost) return;

    try {
      setIsDeletingPost(true);
      setDeleteErrorMessage('');
      const response = await fetch(`/api/private-board/${postId}?siteName=${siteName}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = (await response.json()) as Data;

      if (!response.ok) {
        throw new Error(result.error ?? '글 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/private`);
    } catch (error) {
      setDeleteErrorMessage(error instanceof Error ? error.message : '글 삭제에 실패했습니다.');
      setIsDeletingPost(false);
    }
  }
  if (data.error && !data.post)
    return (
      <div className="container">
        {!isMobile ? (
          <aside>
            <SiteInfo />
            <TableList writeHref={`/${siteName}/private/new`} />
          </aside>
        ) : null}
        <div className={`${styles.content} content`}>
          <ScreenState kind="error">{data.error}</ScreenState>
        </div>
      </div>
    );
  const last = data.replies?.at(-1);
  const canReply = data.isStaff
    ? last?.author_type === 'user' ||
      (!last &&
        Boolean(data.post?.created_at) &&
        Date.now() - new Date(data.post?.created_at ?? '').getTime() >= 5 * 60 * 1000)
    : last?.author_type === 'staff';
  const replyEditorKey = `${last?.id ?? 'post'}:${canReply ? 'ready' : 'waiting'}`;
  const isReplyEditorReady = readyReplyEditorKey === replyEditorKey;
  const replyWaitingMessage = data.isStaff
    ? !last
      ? '글 작성 5분 뒤에 답변할 수 있습니다.'
      : '작성자의 추가 문의를 기다리고 있습니다.'
    : '운영자 또는 매니저의 답변을 기다리고 있습니다.';
  const hasReplyEditor = canReply || Boolean(editingReplyId);
  const isLoadingPost = !data.post;

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
          <>
            <div className={styles['top-buttons']}>
              <Anchor href={`/${siteName}/private`} className="button">
                <ArrowBackIosRoundedIcon />
                <span>목록</span>
              </Anchor>
              {data.nextPost ? (
                <Anchor href={`/${siteName}/private/${data.nextPost.id}`} className="button">
                  <span>다음글</span>
                  <ArrowForwardIosRoundedIcon />
                </Anchor>
              ) : null}
            </div>
          </>
        )}
        {isLoadingPost ? (
          <div className="paper">
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        ) : (
          <>
            <article>
              <div className="paper">
                <header className={styles['content-header']}>
                  <div className={styles['content-board-name']}>
                    <Anchor href={`/${siteName}/private`} className={styles['board-link']}>
                      <span>비공개 게시판</span>
                      <ArrowForwardIosRoundedIcon />
                    </Anchor>
                    {data.canEditPost ? (
                      <Anchor href={`/${siteName}/private/${postId}/edit`} className={styles['edit-link']}>
                        <span>글 수정</span>
                        <EditNoteRoundedIcon />
                      </Anchor>
                    ) : null}
                  </div>
                  <h3>
                    <strong>{data.post?.subject}</strong>
                  </h3>
                  <div className={styles['author-profile']}>
                    <div className={styles.avatar}>
                      <Avatar src={data.post?.author_avatar_url} alt="" />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>
                        <cite>{data.post?.author_name}</cite>
                      </div>
                      <div className={styles.datetime}>
                        <span>{data.post?.created_at ? formatDateTimeDetail(data.post.created_at) : ''}</span>
                      </div>
                    </div>
                  </div>
                </header>
              </div>
              <div className={`${styles['board-container']} ${styles['basic-board']}`}>
                <div className="paper">
                  <EmbeddedContentHtml
                    contentHtml={data.post?.content_html ?? ''}
                    contentMarkdown={null}
                    markdownStatus="markdown_off"
                    themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                    className="viewer"
                  />
                </div>
              </div>
            </article>
            {data.canEditPost || data.canDeletePost ? (
              <div className={styles.options}>
                <div className={styles.buttons}>
                  <div className={styles['button-basics']}>
                    {data.canEditPost ? (
                      <Anchor href={`/${siteName}/private/${postId}/edit`} className={`${styles.button} button`}>
                        <EditNoteRoundedIcon />
                        <strong>수정</strong>
                      </Anchor>
                    ) : null}
                    {data.canDeletePost ? (
                      <button
                        type="button"
                        className={`${styles.button} button`}
                        onClick={() => {
                          setDeleteErrorMessage('');
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteForeverRoundedIcon />
                        <strong>삭제</strong>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {(data.replies ?? []).map((reply) => (
              <article key={reply.id}>
                <div className="paper">
                  <header className={styles['content-header']}>
                    <div className={styles['content-board-name']}>
                      <h3>
                        <strong>{reply.author_type === 'staff' ? '운영자 답변' : '추가 문의'}</strong>
                      </h3>
                      {reply.can_edit ? (
                        <button type="button" className={styles['edit-link']} onClick={() => startReplyEdit(reply)}>
                          <span>답변 수정</span>
                          <EditNoteRoundedIcon />
                        </button>
                      ) : null}
                    </div>
                    <div className={styles['author-profile']}>
                      <div className={styles.avatar}>
                        <Avatar src={reply.author_avatar_url} alt="" />
                      </div>
                      <div className={styles.info}>
                        <div className={styles.name}>
                          <cite>{reply.author_name}</cite>
                        </div>
                        <div className={styles.datetime}>
                          <span>
                            {formatDateTimeDetail(reply.created_at)}
                            {reply.updated_at !== reply.created_at ? ' / 수정됨' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </header>
                </div>
                <div className={`${styles['board-container']} ${styles['basic-board']}`}>
                  {editingReplyId === reply.id ? (
                    <form
                      className={`${styles.form} form`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void updateReply(reply.id);
                      }}
                    >
                      <fieldset>
                        <legend>운영자 답변 수정 폼</legend>
                        <div className={`${styles.editor} ${styles['editor-basic']} service-editor`}>
                          <ToastEditor
                            key={`reply-edit:${reply.id}`}
                            initialValue={editingReplyHtml}
                            initialMarkdown=""
                            initialEditType="wysiwyg"
                            themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                            hideModeSwitch
                            markdownStatus="markdown_off"
                            onHtmlChange={setEditingReplyHtml}
                            onMarkdownChange={() => {}}
                          />
                        </div>
                        <div className={styles['button-group']}>
                          <button type="button" className={styles.link} onClick={cancelReplyEdit}>
                            취소
                          </button>
                          <button type="submit" className={`${styles.submit} button`} disabled={isSavingReply}>
                            수정 완료
                          </button>
                        </div>
                      </fieldset>
                    </form>
                  ) : (
                    <div className="paper">
                      <EmbeddedContentHtml
                        contentHtml={reply.content_html}
                        contentMarkdown={null}
                        markdownStatus="markdown_off"
                        themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                        className="viewer"
                      />
                    </div>
                  )}
                </div>
              </article>
            ))}
            {data.error ? <p className="alert error">{data.error}</p> : null}

            {canReply ? (
              <>
                <div className="paper">
                  <header className={styles['content-header']}>
                    <h3>
                      <strong>{data.isStaff ? '답변 작성' : '추가 문의 작성'}</strong>
                    </h3>
                    <p>
                      {data.isStaff
                        ? '작성자의 글에 답변을 남겨주세요.'
                        : '답변 내용을 확인한 뒤 추가 문의를 남겨주세요.'}
                    </p>
                  </header>
                </div>
                <div className={styles.form}>
                  <fieldset>
                    <div className={`${styles.editor} service-editor`}>
                      <ToastEditor
                        key={replyEditorKey}
                        initialValue={contentHtml}
                        initialMarkdown=""
                        initialEditType="wysiwyg"
                        themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                        hideModeSwitch
                        markdownStatus="markdown_off"
                        onHtmlChange={setContentHtml}
                        onMarkdownChange={() => {}}
                        onReady={() => setReadyReplyEditorKey(replyEditorKey)}
                      />
                    </div>
                  </fieldset>
                </div>
                {isReplyEditorReady ? (
                  <div className={styles['button-group']}>
                    <Anchor href={`/${siteName}/private`} className={`${styles.link} link`}>
                      취소
                    </Anchor>
                    <button
                      type="button"
                      className={`${styles.submit} button`}
                      disabled={isSaving}
                      onClick={() => void reply()}
                    >
                      {data.isStaff ? '답변 등록' : '추가 문의 등록'}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <ScreenState>{replyWaitingMessage}</ScreenState>
            )}
          </>
        )}
        {data.canDeletePost ? (
          isMobile ? (
            <Drawer
              anchor="bottom"
              open={deleteDialogOpen}
              onClose={() => setDeleteDialogOpen(false)}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>글 삭제</h2>
              <button type="button" className="close-button" onClick={() => setDeleteDialogOpen(false)}>
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <p>정말로 글을 삭제하시겠습니까?</p>
                {deleteErrorMessage ? <p className="alert error">{deleteErrorMessage}</p> : null}
              </div>
              <div className="drawer-dialog-actions">
                <button type="button" className="cancel-button" onClick={() => setDeleteDialogOpen(false)}>
                  취소
                </button>
                <button
                  type="button"
                  className="delete-button"
                  disabled={isDeletingPost}
                  onClick={() => void deletePost()}
                >
                  {isDeletingPost ? '삭제 중' : '삭제'}
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={deleteDialogOpen}
              onClose={() => setDeleteDialogOpen(false)}
              className="VhiDialog VhiDialog-service"
            >
              <DialogTitle className={styles['dialog-title']}>글 삭제</DialogTitle>
              <button type="button" className="close-button" onClick={() => setDeleteDialogOpen(false)}>
                <CloseRoundedIcon />
              </button>
              <DialogContent className={styles['dialog-content']}>
                <p>정말로 글을 삭제하시겠습니까?</p>
                {deleteErrorMessage ? <p className="alert error">{deleteErrorMessage}</p> : null}
              </DialogContent>
              <DialogActions>
                <button type="button" className="button medium close" onClick={() => setDeleteDialogOpen(false)}>
                  취소
                </button>
                <button
                  type="button"
                  className="button medium delete"
                  disabled={isDeletingPost}
                  onClick={() => void deletePost()}
                >
                  {isDeletingPost ? '삭제 중' : '삭제'}
                </button>
              </DialogActions>
            </Dialog>
          )
        ) : null}
      </div>
      {!isMobile && !hasReplyEditor ? (
        <aside>
          <UserInfo />
          <PostCountTableList />
          <RecentTableList />
        </aside>
      ) : null}
    </div>
  );
}
