'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { Stack, TextField, Typography, useTheme } from '@mui/material';
import {
  ACCEPTED_EDITOR_IMAGE_TYPES,
  convertImageToWebpFile,
  MAX_EDITOR_IMAGE_FILE_SIZE,
} from '@/lib/editor/convertImageToWebpFile.client';
import Anchor from '@/components/Anchor';
import ToastEditor from '@/components/editor/ToastEditor';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../../../menu';
import CoPostChanges from './coPostChanges';
import CoPostChat from './coPostChat';
import CoPostRequests from './coPostRequests';
import styles from '@/app/manage.module.sass';

export type CoPostEditorData = {
  id: string;
  role: 'inviter' | 'partner';
  status: 'invited' | 'active';
  otherName: string;
  post: { subject: string; slug: string; publishedStatus: string; publishedAt: string | null };
  working: {
    revisionId: string | null;
    subject: string;
    summary: string;
    contentHtml: string;
    contentMarkdown: string;
  };
  lock: { isLockedByOther: boolean; holderName: string };
};

type LockState = 'held' | 'locked' | 'ended';

const HEARTBEAT_INTERVAL = 60 * 1000;
const IDLE_CHECK_INTERVAL = 30 * 1000;
const IDLE_TIMEOUT = 30 * 60 * 1000;
const ACTIVITY_REPORT_INTERVAL = 60 * 1000;

type BlobImage = { file: File; previewUrl: string };

export default function CoPostEditor({ siteName, coPost }: { siteName: string; coPost: CoPostEditorData }) {
  const router = useRouter();
  const theme = useTheme();
  const listHref = `/${siteName}/manage/contents/posts`;
  const [lockState, setLockState] = useState<LockState>(coPost.lock.isLockedByOther ? 'locked' : 'held');
  const [holderName, setHolderName] = useState(coPost.lock.holderName);
  const [endedMessage, setEndedMessage] = useState('');
  const [subject, setSubject] = useState(coPost.working.subject);
  const [summary, setSummary] = useState(coPost.working.summary);
  const [contentHtml, setContentHtml] = useState(coPost.working.contentHtml);
  const [contentMarkdown, setContentMarkdown] = useState(coPost.working.contentMarkdown);
  const [isDirty, setIsDirty] = useState(false);
  const [changesReloadKey, setChangesReloadKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const blobImagesRef = useRef<BlobImage[]>([]);
  const lastActivityRef = useRef(0);
  const lastActivityReportRef = useRef(0);
  const latestRef = useRef({ subject, summary, contentHtml, contentMarkdown, isDirty });
  const lockApi = `/api/co-posts/${coPost.id}/lock`;

  useEffect(() => {
    latestRef.current = { subject, summary, contentHtml, contentMarkdown, isDirty };
  }, [subject, summary, contentHtml, contentMarkdown, isDirty]);

  const callLock = useCallback(
    async (action: 'acquire' | 'heartbeat' | 'activity' | 'release') => {
      const response = await fetch(lockApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => ({}))) as { status?: string; holderName?: string };

      return result;
    },
    [lockApi],
  );

  const acquireLock = useCallback(async () => {
    const result = await callLock('acquire');

    if (result.status === 'acquired') {
      window.location.reload();
      return;
    }

    setHolderName(result.holderName ?? '');
    setLockState('locked');
  }, [callLock]);

  useEffect(() => {
    let isActive = true;
    lastActivityRef.current = Date.now();

    callLock('acquire')
      .then((result) => {
        if (!isActive) return;

        if (result.status === 'acquired') {
          lastActivityRef.current = Date.now();
          setLockState('held');
          return;
        }

        setHolderName(result.holderName ?? '');
        setLockState('locked');
      })
      .catch(() => {
        if (isActive) setLockState('locked');
      });

    return () => {
      isActive = false;
    };
  }, [callLock]);

  async function uploadImagesIfNeeded() {
    let nextHtml = latestRef.current.contentHtml;
    let nextMarkdown = latestRef.current.contentMarkdown;
    const remaining: BlobImage[] = [];

    for (const image of blobImagesRef.current) {
      if (!nextHtml.includes(image.previewUrl) && !nextMarkdown.includes(image.previewUrl)) {
        URL.revokeObjectURL(image.previewUrl);
        continue;
      }

      const formData = new FormData();
      formData.append('file', await convertImageToWebpFile(image.file));
      formData.append('folder', 'editor');
      formData.append('siteName', siteName);

      const response = await fetch('/api/attachment/add/post', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !result.url) {
        remaining.push(image);
        throw new Error(result.error ?? '이미지 업로드에 실패했습니다.');
      }

      nextHtml = nextHtml.split(image.previewUrl).join(result.url);
      nextMarkdown = nextMarkdown.split(image.previewUrl).join(result.url);
      URL.revokeObjectURL(image.previewUrl);
    }

    blobImagesRef.current = remaining;
    setContentHtml(nextHtml);
    setContentMarkdown(nextMarkdown);

    return { contentHtml: nextHtml, contentMarkdown: nextMarkdown };
  }

  async function save(options: { silent?: boolean } = {}) {
    setIsSaving(true);
    setErrorMessage('');

    try {
      const content = await uploadImagesIfNeeded();
      const response = await fetch(`/api/co-posts/${coPost.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: latestRef.current.subject,
          summary: latestRef.current.summary,
          contentHtml: content.contentHtml,
          contentMarkdown: content.contentMarkdown,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(result.error ?? '저장하지 못했습니다.');

      setIsDirty(false);
      setChangesReloadKey((value) => value + 1);
      lastActivityRef.current = Date.now();

      if (!options.silent) setNoticeMessage('저장했습니다.');

      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '저장하지 못했습니다.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function endEditing(message: string, shouldSave: boolean) {
    if (shouldSave && latestRef.current.isDirty) {
      await save({ silent: true });
    }

    await callLock('release').catch(() => undefined);
    setEndedMessage(message);
    setLockState('ended');
  }

  const endEditingRef = useRef(endEditing);

  useEffect(() => {
    endEditingRef.current = endEditing;
  });

  useEffect(() => {
    if (lockState !== 'held') return;

    const heartbeatTimer = setInterval(() => {
      callLock('heartbeat')
        .then((result) => {
          if (result.status === 'lost') {
            setEndedMessage('수정 권한이 상대에게 넘어갔습니다. 채팅으로 상의해 주세요.');
            setLockState('ended');
          }

          if (result.status === 'expired') {
            void endEditingRef.current('30분 동안 활동이 없어 수정을 마쳤습니다. 작성 중인 내용은 저장했습니다.', true);
          }
        })
        .catch(() => undefined);
    }, HEARTBEAT_INTERVAL);

    const idleTimer = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT) {
        void endEditingRef.current('30분 동안 활동이 없어 수정을 마쳤습니다. 작성 중인 내용은 저장했습니다.', true);
      }
    }, IDLE_CHECK_INTERVAL);

    function releaseOnLeave() {
      navigator.sendBeacon(lockApi, new Blob([JSON.stringify({ action: 'release' })], { type: 'application/json' }));
    }

    function warnUnsaved(event: BeforeUnloadEvent) {
      if (latestRef.current.isDirty) event.preventDefault();
    }

    window.addEventListener('pagehide', releaseOnLeave);
    window.addEventListener('beforeunload', warnUnsaved);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(idleTimer);
      window.removeEventListener('pagehide', releaseOnLeave);
      window.removeEventListener('beforeunload', warnUnsaved);
      releaseOnLeave();
    };
  }, [callLock, lockApi, lockState]);

  function markActivity() {
    const now = Date.now();
    lastActivityRef.current = now;
    setIsDirty(true);
    setNoticeMessage('');

    if (now - lastActivityReportRef.current >= ACTIVITY_REPORT_INTERVAL) {
      lastActivityReportRef.current = now;
      void callLock('activity').catch(() => undefined);
    }
  }

  async function handleUploadEditorImage(file: Blob | File) {
    const editorFile =
      file instanceof File ? file : new File([file], `editor-${Date.now()}.png`, { type: file.type || 'image/png' });

    if (!ACCEPTED_EDITOR_IMAGE_TYPES.includes(editorFile.type)) {
      throw new Error('png, jpeg, webp 이미지만 등록할 수 있습니다.');
    }

    if (editorFile.size > MAX_EDITOR_IMAGE_FILE_SIZE) {
      throw new Error('이미지는 1MB 이하로 등록해주세요.');
    }

    const previewUrl = URL.createObjectURL(editorFile);
    blobImagesRef.current = [...blobImagesRef.current, { file: editorFile, previewUrl }];

    return previewUrl;
  }

  async function finishEditing() {
    if (isDirty && !(await save({ silent: true }))) return;

    await callLock('release').catch(() => undefined);
    router.push(listHref);
  }

  const pageBack = listHref;
  const requests =
    coPost.status === 'active' ? (
      <CoPostRequests
        coPostId={coPost.id}
        otherName={coPost.otherName}
        reloadKey={changesReloadKey}
        listHref={listHref}
      />
    ) : null;
  const chat =
    coPost.status === 'active' ? (
      <CoPostChat
        coPostId={coPost.id}
        onSent={() => {
          lastActivityRef.current = Date.now();
        }}
      />
    ) : null;

  if (lockState === 'locked' || lockState === 'ended') {
    return (
      <Container pageTitle="공동 집필" pageBack={pageBack} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']} ${styles.Content}`}>
            <ScreenState
              kind="warning"
              action={
                <Stack direction="row" gap={1}>
                  <Anchor href={listHref} className="button small cancel">
                    목록으로
                  </Anchor>
                  <button type="button" className="button small action" onClick={() => void acquireLock()}>
                    다시 수정하기
                  </button>
                </Stack>
              }
            >
              {lockState === 'locked'
                ? `${holderName || coPost.otherName || '상대'} 님이 수정 중입니다. 채팅으로 상의하세요.`
                : endedMessage}
            </ScreenState>
            {requests}
            {chat}
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="공동 집필" pageBack={pageBack} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']} ${styles.Content}`}>
          <div className={`paper ${styles.paper}`}>
            <Stack gap={2}>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>
                  {`${coPost.otherName || '상대'} 님과 함께 쓰는 글입니다. 수정하는 동안 상대는 수정할 수 없고, 30분 동안 활동이 없으면 저장 후 수정이 끝납니다.`}
                </span>
              </p>

              {requests}

              <CoPostChanges coPostId={coPost.id} reloadKey={changesReloadKey} />

              <Stack gap={1}>
                <Typography variant="subtitle2">제목 *</Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="제목"
                  value={subject}
                  onChange={(event) => {
                    setSubject(event.target.value);
                    markActivity();
                  }}
                />
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">부제목</Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="부제목"
                  value={summary}
                  onChange={(event) => {
                    setSummary(event.target.value);
                    markActivity();
                  }}
                />
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">내용 *</Typography>
                <ToastEditor
                  initialValue={coPost.working.contentHtml}
                  initialMarkdown={coPost.working.contentMarkdown}
                  initialEditType="wysiwyg"
                  themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                  markdownStatus="markdown_default"
                  hideModeSwitch
                  onHtmlChange={(value) => {
                    if (value !== latestRef.current.contentHtml) markActivity();
                    setContentHtml(value);
                  }}
                  onMarkdownChange={setContentMarkdown}
                  onUploadImage={handleUploadEditorImage}
                />
              </Stack>

              {errorMessage ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{errorMessage}</span>
                </p>
              ) : null}

              {noticeMessage ? (
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>{noticeMessage}</span>
                </p>
              ) : null}

              <Stack direction="row" gap={1.5} justifyContent="space-between">
                <button
                  type="button"
                  className="button medium close"
                  disabled={isSaving}
                  onClick={() => void finishEditing()}
                >
                  수정 마치기
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  disabled={isSaving || !isDirty}
                  onClick={() => void save()}
                >
                  저장
                </button>
              </Stack>
            </Stack>
          </div>
          {chat}
        </div>
      </div>
    </Container>
  );
}
