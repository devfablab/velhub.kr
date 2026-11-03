'use client';

import { SyntheticEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { LABS_CATEGORIES, LABS_STATUSES, LabsCategory, LabsStatus } from '@/lib/service/concierge/githubLabs';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import MarkdownEditor, { IMAGE_INPUT_ID } from '@/components/editor/MarkdownEditor';
import MarkdownPreview from '@/components/editor/MarkdownPreview';
import FormErrorDialog from '@/components/FormErrorDialog';
import ScreenState from '@/components/service/ScreenState';
import type { LabsIssueRow } from '../page';
import styles from '@/app/concierge.module.sass';

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

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB

type CommentItem = {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    login: string;
    avatarUrl: string;
  };
};

type Props = {
  issueNumber: number;
  initialDbIssue: LabsIssueRow;
  initialGitHubIssue?: {
    number: number;
    htmlUrl: string;
    title: string;
    body: string;
    state: 'open' | 'closed';
    createdAt: string;
    closedAt?: string | null;
  };
  initialComments: CommentItem[];
  isAuthor: boolean;
  isAdmin: boolean;
  authorAvatar?: string | null;
};

export default function Opt({
  issueNumber,
  initialDbIssue,
  initialGitHubIssue,
  initialComments,
  isAuthor,
  isAdmin,
  authorAvatar,
}: Props) {
  const router = useRouter();
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dbIssue, setDbIssue] = useState<LabsIssueRow>(initialDbIssue);
  const [issueBody, setIssueBody] = useState(initialGitHubIssue?.body || '');
  const [comments, setComments] = useState<CommentItem[]>(initialComments);

  // Issue inline edit state
  const [isEditingIssue, setIsEditingIssue] = useState(false);
  const [editIssueContent, setEditIssueContent] = useState(initialGitHubIssue?.body || '');
  const [isSavingIssue, setIsSavingIssue] = useState(false);

  // Title & category inline edit state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(initialDbIssue.title);
  const [editCategory, setEditCategory] = useState<LabsCategory>(initialDbIssue.category);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Comment inline edit state
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentBody, setEditCommentBody] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  // New comment state
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Upload target: determines which state gets the uploaded image from the toolbar button
  const [activeUploadTarget, setActiveUploadTarget] = useState<'issue' | 'newComment' | 'editComment'>('newComment');

  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentStatus = dbIssue.status;
  const isClosed = currentStatus === '반영 완료' || currentStatus === '반려됨';

  async function handleUploadImageForTarget(file: File, target: 'issue' | 'newComment' | 'editComment') {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage(`지원하지 않는 이미지 형식입니다: ${file.name}`);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setErrorMessage(`이미지 하나당 최대 1MB 이하여야 합니다: ${file.name}`);
      return;
    }

    const formData = new FormData();
    formData.append('images', file);
    formData.set('issueNumber', String(issueNumber));

    const placeholder = `![${file.name}](업로드 중...)`;

    if (target === 'issue') {
      setEditIssueContent((previousContent) => (previousContent || '') + `\n${placeholder}\n`);
    } else if (target === 'editComment') {
      setEditCommentBody((previousBody) => (previousBody || '') + `\n${placeholder}\n`);
    } else {
      setNewComment((previousNew) => (previousNew || '') + `\n${placeholder}\n`);
    }

    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}/images`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '이미지 업로드에 실패했습니다.');

      const realMarkdown = `![${file.name}](${result.rawUrl})`;

      if (target === 'issue') {
        setEditIssueContent((previousContent) => (previousContent || '').replace(placeholder, realMarkdown));
      } else if (target === 'editComment') {
        setEditCommentBody((previousBody) => (previousBody || '').replace(placeholder, realMarkdown));
      } else {
        setNewComment((previousNew) => (previousNew || '').replace(placeholder, realMarkdown));
      }
    } catch (error) {
      if (target === 'issue') {
        setEditIssueContent((previousContent) => (previousContent || '').replace(placeholder, ''));
      } else if (target === 'editComment') {
        setEditCommentBody((previousBody) => (previousBody || '').replace(placeholder, ''));
      } else {
        setNewComment((previousNew) => (previousNew || '').replace(placeholder, ''));
      }
      setErrorMessage(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.');
    }
  }

  function handleIssuePaste(event: React.ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) void handleUploadImageForTarget(file, 'issue');
      }
    }
  }

  function handleIssueDrop(event: React.DragEvent) {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        event.preventDefault();
        void handleUploadImageForTarget(file, 'issue');
      }
    }
  }

  function handleCommentEditPaste(event: React.ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) void handleUploadImageForTarget(file, 'editComment');
      }
    }
  }

  function handleCommentEditDrop(event: React.DragEvent) {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        event.preventDefault();
        void handleUploadImageForTarget(file, 'editComment');
      }
    }
  }

  function handleNewCommentPaste(event: React.ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) void handleUploadImageForTarget(file, 'newComment');
      }
    }
  }

  function handleNewCommentDrop(event: React.DragEvent) {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        event.preventDefault();
        void handleUploadImageForTarget(file, 'newComment');
      }
    }
  }

  async function handleAdminStatusChange(event: SelectChangeEvent<string>) {
    const nextStatus = event.target.value as LabsStatus;
    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '상태 변경에 실패했습니다.');

      setDbIssue((prev) => ({ ...prev, status: nextStatus }));
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.');
    }
  }

  async function handleSaveTitle() {
    if (!editTitle.trim()) return;

    setIsSavingTitle(true);
    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          category: editCategory,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '제목 수정에 실패했습니다.');

      setDbIssue((prev) => ({
        ...prev,
        title: editTitle.trim(),
        category: editCategory,
      }));
      setIsEditingTitle(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '제목 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function handleSaveIssue() {
    if (!editIssueContent.trim()) return;

    setIsSavingIssue(true);
    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editIssueContent.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '이슈 수정에 실패했습니다.');

      setIssueBody(editIssueContent.trim());
      setIsEditingIssue(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '이슈 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingIssue(false);
    }
  }

  async function handleSaveComment(commentId: number) {
    if (!editCommentBody.trim()) return;

    setIsSavingComment(true);
    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          body: editCommentBody.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '댓글 수정에 실패했습니다.');

      setComments((prev) =>
        prev.map((commentItem) =>
          commentItem.id === commentId
            ? {
                ...commentItem,
                body: result.comment.body,
                updatedAt: result.comment.updatedAt || new Date().toISOString(),
              }
            : commentItem,
        ),
      );
      setEditingCommentId(null);
      setEditCommentBody('');
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '댓글 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingComment(false);
    }
  }

  async function handleCancelIssue() {
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '제안 취소에 실패했습니다.');

      setDbIssue((prev) => ({ ...prev, status: '반려됨' }));
      setIsCancelConfirmOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '취소 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleCommentSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newComment.trim() }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '댓글 등록에 실패했습니다.');

      setComments((prev) => [
        ...prev,
        {
          id: result.comment.id,
          body: result.comment.body,
          createdAt: result.comment.createdAt,
          updatedAt: result.comment.updatedAt || result.comment.createdAt,
          author: result.comment.author || { login: 'admin', avatarUrl: '' },
        },
      ]);
      setNewComment('');
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '댓글 작성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  }

  return (
    <div className={styles.labs}>
      <VisuallyHiddenInput
        id={IMAGE_INPUT_ID}
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        multiple
        onChange={(event) => {
          if (event.target.files) {
            Array.from(event.target.files).forEach((file) => void handleUploadImageForTarget(file, activeUploadTarget));
            event.target.value = '';
          }
        }}
      />

      <div className={styles.headlines}>
        {isEditingTitle ? (
          <Stack direction="row" alignItems="center" gap={1} sx={{ my: 1, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select value={editCategory} onChange={(event) => setEditCategory(event.target.value as LabsCategory)}>
                {LABS_CATEGORIES.map((categoryItem) => (
                  <MenuItem key={categoryItem} value={categoryItem}>
                    {categoryItem}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="제목을 입력하세요"
              sx={{ flex: 1, minWidth: 200 }}
            />
            <button
              type="button"
              className="button small submit"
              onClick={() => void handleSaveTitle()}
              disabled={isSavingTitle || !editTitle.trim()}
            >
              {isSavingTitle ? '저장 중...' : '저장'}
            </button>
            <button
              type="button"
              className="button small close"
              onClick={() => {
                setIsEditingTitle(false);
                setEditTitle(dbIssue.title);
                setEditCategory(dbIssue.category);
              }}
              disabled={isSavingTitle}
            >
              취소
            </button>
          </Stack>
        ) : (
          <h1>
            {dbIssue.title} <span>#{issueNumber}</span>
            {(isAuthor || isAdmin) && currentStatus !== '반려됨' ? (
              <IconButton
                size="small"
                onClick={() => setIsEditingTitle(true)}
                title="제목 수정"
                sx={{ ml: 1, verticalAlign: 'middle' }}
              >
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            ) : null}
          </h1>
        )}
        <div className={styles.chips}>
          <Chip label={currentStatus} className="chip outlined warning" />
          <Chip label={dbIssue.category} className="chip outlined success" />
        </div>
      </div>

      <div className="paper">
        <div className={styles['issue-header']}>
          <div className={styles['issue-header-profile']}>
            <div className={styles.avatar}>
              <Avatar
                src={authorAvatar || '/broken-image.jpg'}
                alt={dbIssue.user_name || ''}
                sx={{ width: 24, height: 24 }}
              />
              <span>{dbIssue.user_name}</span>
            </div>
            {isClosed ? (
              <time>{formatTimeAgo(initialGitHubIssue?.closedAt || dbIssue.updated_at)}에 닫힘</time>
            ) : (
              <time>{formatTimeAgo(dbIssue.created_at)}에 등록됨</time>
            )}
          </div>
          <div className={styles['issue-header-actions']}>
            {isAdmin ? (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={currentStatus} onChange={(event) => void handleAdminStatusChange(event)} displayEmpty>
                  {LABS_STATUSES.map((statusItem) => (
                    <MenuItem key={statusItem} value={statusItem}>
                      {statusItem}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}

            {(isAuthor || isAdmin) && currentStatus !== '반려됨' && !isEditingIssue ? (
              <button
                type="button"
                className="button small normal"
                onClick={() => {
                  setActiveUploadTarget('issue');
                  setEditIssueContent(issueBody);
                  setIsEditingIssue(true);
                }}
              >
                수정
              </button>
            ) : null}

            {isAuthor && currentStatus !== '반려됨' ? (
              <button type="button" className="button small danger" onClick={() => setIsCancelConfirmOpen(true)}>
                제안 취소
              </button>
            ) : null}
          </div>
        </div>

        {isEditingIssue ? (
          <div
            style={{ marginTop: '0.75rem' }}
            onClickCapture={() => setActiveUploadTarget('issue')}
            onFocusCapture={() => setActiveUploadTarget('issue')}
          >
            <MarkdownEditor
              value={editIssueContent}
              onChange={setEditIssueContent}
              placeholder="제안 상세 내용을 작성해 주세요."
              themeMode={theme.palette.mode}
              onPaste={handleIssuePaste}
              onDrop={handleIssueDrop}
            />
            <FormHelperText>이미지는 하나당 최대 1MB (PNG, JPG, WEBP, GIF) 지원됩니다.</FormHelperText>
            <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mt: 1.5 }}>
              <button
                type="button"
                className="button small close"
                onClick={() => {
                  setIsEditingIssue(false);
                  setEditIssueContent(issueBody);
                }}
                disabled={isSavingIssue}
              >
                취소
              </button>
              <button
                type="button"
                className="button small submit"
                onClick={() => void handleSaveIssue()}
                disabled={isSavingIssue || !editIssueContent.trim()}
              >
                {isSavingIssue ? '저장 중...' : '저장'}
              </button>
            </Stack>
          </div>
        ) : (
          <MarkdownPreview source={issueBody || '내용이 없습니다.'} themeMode={theme.palette.mode} />
        )}
      </div>

      <div className="paper">
        <h2>응답하라! 💃</h2>

        {comments.length === 0 ? (
          <ScreenState>아직 등록된 답변이나 진행 내역이 없습니다.</ScreenState>
        ) : (
          <Stack gap={2}>
            {comments.map((comment) => (
              <div key={comment.id} className="paper">
                <div className={styles['issue-header']}>
                  <div className={styles['issue-header-profile']}>
                    <div className={styles.avatar}>
                      <Avatar
                        src={comment.author.avatarUrl || '/broken-image.jpg'}
                        alt={comment.author.login || ''}
                        sx={{ width: 24, height: 24 }}
                      />
                      <span>{comment.author.login}</span>
                    </div>
                    <time>{formatTimeAgo(comment.createdAt)}</time>
                  </div>
                  {isAdmin && editingCommentId !== comment.id ? (
                    <div className={styles['issue-header-actions']}>
                      <button
                        type="button"
                        className="button small normal"
                        onClick={() => {
                          setActiveUploadTarget('editComment');
                          setEditingCommentId(comment.id);
                          setEditCommentBody(comment.body);
                        }}
                      >
                        수정
                      </button>
                    </div>
                  ) : null}
                </div>

                {editingCommentId === comment.id ? (
                  <div
                    style={{ marginTop: '0.75rem' }}
                    onClickCapture={() => setActiveUploadTarget('editComment')}
                    onFocusCapture={() => setActiveUploadTarget('editComment')}
                  >
                    <MarkdownEditor
                      value={editCommentBody}
                      onChange={setEditCommentBody}
                      placeholder="답변 내용을 입력해 주세요."
                      themeMode={theme.palette.mode}
                      onPaste={handleCommentEditPaste}
                      onDrop={handleCommentEditDrop}
                    />
                    <FormHelperText>이미지는 하나당 최대 1MB (PNG, JPG, WEBP, GIF) 지원됩니다.</FormHelperText>
                    <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mt: 1.5 }}>
                      <button
                        type="button"
                        className="button small close"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditCommentBody('');
                        }}
                        disabled={isSavingComment}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="button small submit"
                        onClick={() => void handleSaveComment(comment.id)}
                        disabled={isSavingComment || !editCommentBody.trim()}
                      >
                        {isSavingComment ? '저장 중...' : '저장'}
                      </button>
                    </Stack>
                  </div>
                ) : (
                  <MarkdownPreview source={comment.body} themeMode={theme.palette.mode} />
                )}
              </div>
            ))}
          </Stack>
        )}

        {isAdmin ? (
          <form
            onSubmit={(event) => void handleCommentSubmit(event)}
            style={{ marginTop: '1rem' }}
            onClickCapture={() => setActiveUploadTarget('newComment')}
            onFocusCapture={() => setActiveUploadTarget('newComment')}
          >
            <Stack gap={1.5}>
              <Typography variant="subtitle2">관리자 답변 작성</Typography>
              <MarkdownEditor
                value={newComment}
                onChange={setNewComment}
                placeholder="답변 및 진행 상황을 작성해 주세요. 이미지를 복사/붙여넣기하거나 드래그하여 첨부할 수 있습니다."
                themeMode={theme.palette.mode}
                onPaste={handleNewCommentPaste}
                onDrop={handleNewCommentDrop}
              />
              <FormHelperText>이미지는 하나당 최대 1MB (PNG, JPG, WEBP, GIF) 지원됩니다.</FormHelperText>
              <Stack direction="row" justifyContent="flex-end">
                <button
                  type="submit"
                  disabled={isSubmittingComment || !newComment.trim()}
                  className="button small submit"
                >
                  {isSubmittingComment ? '등록 중' : '답변 등록'}
                </button>
              </Stack>
            </Stack>
          </form>
        ) : null}
      </div>

      <Stack direction="row" justifyContent="flex-end">
        <Anchor href="/concierge/labs" className="button medium close">
          목록으로
        </Anchor>
      </Stack>

      <Dialog open={isCancelConfirmOpen} onClose={() => setIsCancelConfirmOpen(false)}>
        <DialogTitle>제안 취소</DialogTitle>
        <DialogContent>
          <DialogContentText>
            이 제안을 취소하시겠습니까? 취소된 제안은 반려 상태로 변경되며 종료됩니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCancelConfirmOpen(false)}>닫기</Button>
          <Button onClick={() => void handleCancelIssue()} color="error" disabled={isCancelling}>
            {isCancelling ? '처리 중...' : '취소하기'}
          </Button>
        </DialogActions>
      </Dialog>

      <FormErrorDialog
        open={Boolean(errorMessage)}
        title="오류"
        messages={[errorMessage]}
        onClose={() => setErrorMessage('')}
      />
    </div>
  );
}
