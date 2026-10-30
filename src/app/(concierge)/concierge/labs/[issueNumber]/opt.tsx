'use client';

import { SyntheticEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LABS_STATUSES, LabsStatus } from '@/lib/github/labs';
import { formatDateTimeDetail } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import LabsMarkdownPreview from '@/components/editor/LabsMarkdownPreview';
import FormErrorDialog from '@/components/FormErrorDialog';
import { getStatusColor } from '../opt';
import type { LabsIssueRow } from '../page';

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
  };
  initialComments: CommentItem[];
  isAuthor: boolean;
  isAdmin: boolean;
};

export default function Opt({
  issueNumber,
  initialDbIssue,
  initialGitHubIssue,
  initialComments,
  isAuthor,
  isAdmin,
}: Props) {
  const router = useRouter();
  const theme = useTheme();

  const [dbIssue, setDbIssue] = useState<LabsIssueRow>(initialDbIssue);
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentStatus = dbIssue.status;

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
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '상태 변경 중 오류가 발생했습니다.');
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
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '취소 처리 중 오류가 발생했습니다.');
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
          updatedAt: result.comment.createdAt,
          author: { login: 'admin', avatarUrl: '' },
        },
      ]);
      setNewComment('');
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '댓글 작성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  }

  return (
    <Stack gap={3}>
      <div className="paper">
        <Stack gap={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Chip label={dbIssue.category} size="small" variant="outlined" />
              <Chip label={currentStatus} size="small" color={getStatusColor(currentStatus)} />
              <Typography variant="body2" sx={{ opacity: 0.6 }}>
                #{issueNumber}
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" gap={1}>
              {isAdmin ? (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select value={currentStatus} onChange={(e) => void handleAdminStatusChange(e)} displayEmpty>
                    {LABS_STATUSES.map((st) => (
                      <MenuItem key={st} value={st}>
                        {st}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}

              {isAuthor && currentStatus !== '반려됨' ? (
                <>
                  <Anchor href={`/concierge/labs/${issueNumber}/edit`} className="button small close">
                    수정하기
                  </Anchor>
                  <Button size="small" color="error" variant="outlined" onClick={() => setIsCancelConfirmOpen(true)}>
                    제안 취소
                  </Button>
                </>
              ) : null}
            </Stack>
          </Stack>

          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            {dbIssue.title}
          </Typography>

          <Stack direction="row" alignItems="center" gap={2} sx={{ fontSize: '0.85rem', opacity: 0.7 }}>
            <span>작성자: {dbIssue.user_name}</span>
            <span>등록일: {formatDateTimeDetail(dbIssue.created_at)}</span>
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Box sx={{ minHeight: 120, py: 1 }}>
            <LabsMarkdownPreview
              source={initialGitHubIssue?.body || '내용이 없습니다.'}
              themeMode={theme.palette.mode}
            />
          </Box>

          {initialGitHubIssue?.htmlUrl ? (
            <Stack direction="row" justifyContent="flex-end">
              <a
                href={initialGitHubIssue.htmlUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}
              >
                <span>GitHub에서 보기</span>
                <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
              </a>
            </Stack>
          ) : null}
        </Stack>
      </div>

      {/* Comments Section */}
      <div className="paper">
        <Stack gap={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            답변 및 진행 내역 ({comments.length})
          </Typography>

          {comments.length === 0 ? (
            <Typography variant="body2" sx={{ opacity: 0.6, py: 2 }}>
              아직 등록된 답변이나 진행 내역이 없습니다.
            </Typography>
          ) : (
            <Stack gap={2}>
              {comments.map((comment) => (
                <div key={comment.id} className="paper" style={{ padding: '1rem', background: 'rgba(0,0,0,0.02)' }}>
                  <Stack gap={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Avatar src={comment.author.avatarUrl} sx={{ width: 24, height: 24 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {comment.author.login}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ opacity: 0.6 }}>
                        {formatDateTimeDetail(comment.createdAt)}
                      </Typography>
                    </Stack>
                    <Box sx={{ pt: 0.5 }}>
                      <LabsMarkdownPreview source={comment.body} themeMode={theme.palette.mode} />
                    </Box>
                  </Stack>
                </div>
              ))}
            </Stack>
          )}

          {isAdmin ? (
            <form onSubmit={(e) => void handleCommentSubmit(e)} style={{ marginTop: '1rem' }}>
              <Stack gap={1.5}>
                <Typography variant="subtitle2">관리자 답변 작성</Typography>
                <TextField
                  size="small"
                  multiline
                  minRows={3}
                  placeholder="답변 및 진행 상황을 작성해 주세요 (GitHub 이슈에 코멘트로 등록됩니다)"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  fullWidth
                />
                <Stack direction="row" justifyContent="flex-end">
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="button small submit"
                  >
                    {isSubmittingComment ? '작성 중...' : '답변 등록'}
                  </button>
                </Stack>
              </Stack>
            </form>
          ) : (
            <Typography variant="caption" sx={{ opacity: 0.5, textAlign: 'center', py: 1 }}>
              답변 및 댓글 작성은 관리자만 가능합니다.
            </Typography>
          )}
        </Stack>
      </div>

      <Stack direction="row" justifyContent="flex-end">
        <Anchor href="/concierge/labs" className="button medium close">
          목록으로
        </Anchor>
      </Stack>

      {/* Cancel Confirmation Dialog */}
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
    </Stack>
  );
}
