'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  reportHandlingResultLabels,
  type ReportHandlingResult,
  type ReportManageTargetType,
  type ReportStatus,
} from '@/lib/reports/manage';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/manage.module.sass';
import {
  getGuidelineInitialMessageCreatedAt,
  guidelineAppealMessageStatusLabels,
  type GuidelineAppealMessage,
  type GuidelineAppealMessageStatus,
} from '@/lib/reports/guidelineAppeals';
import { formatTimeAgo } from '@/lib/utils';

type PostImage = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type PollOption = {
  id: number;
  label: string;
  image: PostImage | null;
};

type PollData = {
  question: string;
  creator_id: string;
  endType: 'absolute' | 'relative';
  endsAt: string;
  options: PollOption[];
};

type ReportItem = {
  id: string;
  targetType: ReportManageTargetType;
  status: ReportStatus;
  handlingResult: ReportHandlingResult | null;
  createdAt: string;
  handledAt: string | null;
  reporterName: string;
  handlerName: string | null;
  reportCategory: string;
  reportCategoryLabel: string;
  canAppeal: boolean;
  appealMessageStatus: GuidelineAppealMessageStatus | null;
  board: {
    id: string;
    name: string;
    key: string;
    type: string | null;
    href: string;
  } | null;
  post: {
    id: string;
    title: string;
    slug: string;
    href: string;
    publishedAt: string | null;
    authorName: string;
    content: string;
    thumbnailImage: string | null;
    images: PostImage[] | null;
    poll: PollData | null;
    isClosed: boolean;
  } | null;
  comment: {
    id: string;
    content: string;
    createdAt: string;
    authorName: string;
    isDeleted: boolean;
  } | null;
};

type ReportListResponse = {
  reports?: ReportItem[];
  error?: string;
};

type ReportManageProps = {
  targetType: ReportManageTargetType;
};

type AppealMessagesResponse = {
  siteName?: string;
  deletionMessage?: string;
  messages?: GuidelineAppealMessage[];
  error?: string;
};

const statusLabels: Record<ReportStatus, string> = {
  received: '접수됨',
  reviewing: '확인 중',
  dismissed: '이상 없음',
  completed: '처리완료',
};

function getRouteParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function getStatusOptions(targetType: ReportManageTargetType) {
  if (targetType === 'board') {
    return [
      { value: 'reviewing', label: '확인 중' },
      { value: 'dismissed', label: '이상 없음' },
      { value: 'completed', label: '처리완료' },
    ] satisfies { value: ReportStatus; label: string }[];
  }

  return [
    { value: 'dismissed', label: '이상 없음' },
    { value: 'completed', label: '처리완료' },
  ] satisfies { value: ReportStatus; label: string }[];
}

function getSubmitLabel(targetType: ReportManageTargetType, status: ReportStatus | '') {
  if (status === 'completed') {
    if (targetType === 'post') {
      return '게시물 삭제';
    }

    if (targetType === 'comment') {
      return '댓글 삭제';
    }

    return '처리완료';
  }

  if (status === 'dismissed') {
    return '확인';
  }

  return '저장';
}

function getStatusLabel(report: ReportItem) {
  if (report.targetType !== 'board' && (report.status === 'dismissed' || report.status === 'completed')) {
    return '처리완료';
  }

  return statusLabels[report.status];
}

function getHandlingResultLabel(report: ReportItem) {
  if (report.handlingResult) {
    return reportHandlingResultLabels[report.handlingResult];
  }

  return report.status === 'dismissed' ? reportHandlingResultLabels.no_issue : null;
}

function canFinalize(report: ReportItem) {
  if (report.status !== 'completed' || report.handlingResult) {
    return false;
  }

  if (report.targetType === 'post') {
    return report.post?.isClosed === true;
  }

  if (report.targetType === 'comment') {
    return report.comment?.isDeleted === true;
  }

  return false;
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR');
}

function MessageBubble({
  senderName,
  createdAt,
  message,
  isOwn,
}: {
  senderName: string | undefined;
  createdAt: string;
  message: string | undefined;
  isOwn: boolean;
}) {
  return (
    <Stack alignItems={isOwn ? 'flex-end' : 'flex-start'}>
      <Stack
        gap={0.5}
        sx={{
          width: 'fit-content',
          maxWidth: { xs: '90%', md: '75%' },
          px: 2,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: isOwn ? 'action.selected' : 'action.hover',
          textAlign: isOwn ? 'right' : 'left',
        }}
      >
        <Typography variant="subtitle2">{senderName}</Typography>
        <Typography variant="body2">{formatTimeAgo(createdAt)}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message}
        </Typography>
      </Stack>
    </Stack>
  );
}

function renderImageList(images: PostImage[] | null) {
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        이미지
      </Typography>

      <Stack gap={1}>
        {images.map((image) => (
          <Box
            key={image.path}
            component="img"
            src={image.url}
            alt="게시물 이미지"
            sx={{
              maxWidth: '100%',
              maxHeight: 320,
              objectFit: 'contain',
              borderRadius: 1,
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}

function renderPoll(poll: PollData | null) {
  if (!poll) {
    return null;
  }

  return (
    <Stack gap={2}>
      <Typography variant="h6">투표 내용</Typography>
      <Box>
        <Typography variant="subtitle2">질문</Typography>
        <Typography variant="body2">{poll.question || '-'}</Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2">종료일</Typography>
        <Typography variant="body2">{formatDate(poll.endsAt)}</Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          선택지
        </Typography>

        <Stack gap={1.5}>
          {poll.options.map((option) => (
            <Stack key={option.id} gap={0.5} direction="row" alignItems="center" justifyContent="space-between">
              {option.image ? (
                <Box
                  component="img"
                  src={option.image.url}
                  alt="투표 선택지 이미지"
                  sx={{
                    width: 170,
                    height: 170,
                    objectFit: 'cover',
                    borderRadius: 1,
                    mb: 0.5,
                    aspectRatio: 1 / 1,
                  }}
                />
              ) : null}

              <Typography variant="body2">{option.label || '-'}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function renderPostDetail(post: NonNullable<ReportItem['post']>, boardType: string | null) {
  if (boardType === 'basic' || boardType === 'blog' || boardType === 'page') {
    return (
      <>
        <Box>
          <Typography variant="subtitle2">내용</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {post.content || '-'}
          </Typography>
        </Box>

        {renderPoll(post.poll)}
      </>
    );
  }

  if (boardType === 'gallery') {
    return (
      <>
        {post.content ? (
          <Box>
            <Typography variant="subtitle2">내용</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {post.content}
            </Typography>
          </Box>
        ) : null}

        {renderImageList(post.images)}
      </>
    );
  }

  if (boardType === 'feed') {
    return (
      <>
        <Box>
          <Typography variant="subtitle2">내용</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {post.content || '-'}
          </Typography>
        </Box>

        {renderImageList(post.images)}
      </>
    );
  }

  if (boardType === 'youtube') {
    return (
      <>
        {post.thumbnailImage ? (
          <Box>
            <Typography variant="subtitle2">유튜브 썸네일</Typography>

            <Box
              component="img"
              src={post.thumbnailImage}
              alt="유튜브 썸네일"
              sx={{
                width: '100%',
                maxWidth: 480,
                display: 'block',
                borderRadius: 1,
              }}
            />
          </Box>
        ) : null}

        <Box>
          <Typography variant="subtitle2">간단설명</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {post.content || '-'}
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2">내용</Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {post.content || '-'}
      </Typography>
    </Box>
  );
}

export default function ReportManage({ targetType }: ReportManageProps) {
  const params = useParams<{ siteName?: string | string[] }>();
  const siteName = getRouteParam(params.siteName);

  const theme = useTheme();
  const useDrawer = useMediaQuery(theme.breakpoints.down('md'));

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [nextStatus, setNextStatus] = useState<ReportStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [messageReport, setMessageReport] = useState<ReportItem | null>(null);
  const [messageData, setMessageData] = useState<AppealMessagesResponse | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageOpenedAt, setMessageOpenedAt] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageSaving, setMessageSaving] = useState(false);
  const [finalReport, setFinalReport] = useState<ReportItem | null>(null);
  const [finalSaving, setFinalSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const statusOptions = useMemo(() => getStatusOptions(targetType), [targetType]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const searchParams = new URLSearchParams({
      siteName,
      targetType,
      mode: showPast ? 'past' : 'current',
    });

    const response = await fetch(`/api/manage/reports?${searchParams.toString()}`, {
      credentials: 'include',
    });

    const result = (await response.json().catch(() => ({
      error: '신고 목록 응답을 확인하지 못했습니다.',
    }))) as ReportListResponse;

    setLoading(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '신고 목록을 불러오지 못했습니다.');
      setReports([]);
      return;
    }

    setReports(result.reports ?? []);
  }, [showPast, siteName, targetType]);

  useEffect(() => {
    if (!siteName) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReports();
  }, [loadReports, siteName]);

  function handleOpen(report: ReportItem) {
    setSelectedReport(report);
    setNextStatus('');
    setErrorMessage('');
  }

  function handleClose() {
    if (saving) {
      return;
    }

    setSelectedReport(null);
    setNextStatus('');
  }

  function handleModeChange() {
    setShowPast((currentValue) => !currentValue);
    setSelectedReport(null);
    setNextStatus('');
  }

  async function handleOpenMessages(report: ReportItem) {
    setMessageReport(report);
    setMessageData(null);
    setMessageText('');
    setMessageOpenedAt(new Date().toISOString());
    setMessageLoading(true);
    setErrorMessage('');

    const searchParams = new URLSearchParams({ siteName });
    const response = await fetch(
      `/api/manage/reports/${report.id}/appeal-messages?${searchParams.toString()}`,
      { credentials: 'include' },
    );
    const result = (await response.json().catch(() => ({
      error: '소명 메시지 응답을 확인하지 못했습니다.',
    }))) as AppealMessagesResponse;

    setMessageLoading(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '소명 메시지를 불러오지 못했습니다.');
      setMessageReport(null);
      return;
    }

    setMessageData(result);
  }

  function handleCloseMessages() {
    if (messageSaving) {
      return;
    }

    setMessageReport(null);
    setMessageData(null);
    setMessageText('');
  }

  async function handleSendReply() {
    const message = messageText.trim();

    if (!messageReport || !message) {
      setErrorMessage('답변 내용을 입력해 주세요.');
      return;
    }

    setMessageSaving(true);
    setErrorMessage('');

    const response = await fetch(`/api/manage/reports/${messageReport.id}/appeal-messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ siteName, message }),
    });
    const result = (await response.json().catch(() => ({
      error: '답변 전송 응답을 확인하지 못했습니다.',
    }))) as AppealMessagesResponse;

    setMessageSaving(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '답변을 보내지 못했습니다.');
      return;
    }

    setMessageData(result);
    setMessageText('');
    setReports((current) =>
      current.map((report) =>
        report.id === messageReport.id ? { ...report, appealMessageStatus: 'staff_replied' } : report,
      ),
    );
    setSnackbarMessage('답변을 보냈습니다.');
  }

  function handleStatusChange(changeEvent: SelectChangeEvent) {
    setNextStatus(changeEvent.target.value as ReportStatus);
  }

  async function handleSave() {
    if (!selectedReport || !nextStatus) {
      setErrorMessage('처리 상태를 선택해 주세요.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const response = await fetch(`/api/manage/reports/${selectedReport.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteName,
        status: nextStatus,
      }),
    });

    const result = (await response.json().catch(() => ({
      error: '신고 처리 응답을 확인하지 못했습니다.',
    }))) as { ok?: boolean; error?: string };

    setSaving(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '신고 처리 상태를 저장하지 못했습니다.');
      return;
    }

    setSelectedReport(null);
    setNextStatus('');
    await loadReports();
  }

  function handleOpenFinal(report: ReportItem) {
    setFinalReport(report);
    setErrorMessage('');
  }

  function handleCloseFinal() {
    if (finalSaving) {
      return;
    }

    setFinalReport(null);
  }

  async function handleFinalize(decision: 'keep_deleted' | 'restore') {
    if (!finalReport) {
      return;
    }

    setFinalSaving(true);
    setErrorMessage('');

    const response = await fetch(`/api/manage/reports/${finalReport.id}/finalize`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ siteName, decision }),
    });
    const result = (await response.json().catch(() => ({
      error: '최종 판단 응답을 확인하지 못했습니다.',
    }))) as { ok?: boolean; error?: string };

    setFinalSaving(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '최종 판단을 저장하지 못했습니다.');
      return;
    }

    setFinalReport(null);
    setSnackbarMessage(decision === 'restore' ? '콘텐츠를 복구했습니다.' : '삭제 상태를 유지합니다.');
    await loadReports();
  }

  const detailContent = selectedReport ? (
    <Stack gap={3}>
      <Stack gap={2}>
        <Typography variant="h6">신고 상세</Typography>
        <Box>
          <Typography variant="subtitle2">신고내용</Typography>
          <Typography variant="body2">{selectedReport.reportCategoryLabel}</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">신고자</Typography>
          <Typography variant="body2">{selectedReport.reporterName}</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">현재 처리상태</Typography>
          <Typography variant="body2">{getStatusLabel(selectedReport)}</Typography>
        </Box>
      </Stack>

      {selectedReport.targetType === 'post' && selectedReport.post ? (
        <Stack gap={2}>
          <Typography variant="h6">게시물 상세</Typography>

          <Box>
            <Typography variant="subtitle2">제목</Typography>
            <Typography variant="body2">{selectedReport.post.title}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">등록일</Typography>
            <Typography variant="body2">{formatDate(selectedReport.post.publishedAt)}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">작성자</Typography>
            <Typography variant="body2">{selectedReport.post.authorName}</Typography>
          </Box>

          {renderPostDetail(selectedReport.post, selectedReport.board?.type ?? null)}
        </Stack>
      ) : null}

      {selectedReport.targetType === 'comment' && selectedReport.comment ? (
        <Stack gap={2}>
          <Box>
            <Typography variant="subtitle2">게시물</Typography>
            <Typography variant="body2">{selectedReport.post?.title ?? '-'}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">댓글 작성자</Typography>
            <Typography variant="body2">{selectedReport.comment.authorName}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">댓글 내용</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {selectedReport.comment.content || '-'}
            </Typography>
          </Box>
        </Stack>
      ) : null}

      {showPast ? (
        <Stack gap={2}>
          <Typography variant="h6">신고 관리 내역</Typography>
          {getHandlingResultLabel(selectedReport) ? (
            <Box>
              <Typography variant="subtitle2">최종 판단</Typography>
              <Typography variant="body2">{getHandlingResultLabel(selectedReport)}</Typography>
            </Box>
          ) : null}
          <Box>
            <Typography variant="subtitle2">처리자</Typography>
            <Typography variant="body2">{selectedReport.handlerName ?? '-'}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">처리일</Typography>
            <Typography variant="body2">{formatDate(selectedReport.handledAt)}</Typography>
          </Box>
        </Stack>
      ) : canFinalize(selectedReport) ? null : (
        <FormControl fullWidth>
          <Select
            displayEmpty
            value={nextStatus}
            onChange={handleStatusChange}
            disabled={saving}
            size="small"
            renderValue={(selected) => {
              if (!selected) {
                return <span>처리상태 선택</span>;
              }
              return statusOptions.find((statusOption) => statusOption.value === selected)?.label ?? '';
            }}
          >
            <MenuItem value="" disabled>
              처리상태 선택
            </MenuItem>
            {statusOptions.map((statusOption) => (
              <MenuItem key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Stack>
  ) : null;

  const messageContent = (
    <Stack gap={2}>
      {messageLoading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 220 }}>
          <LoadingIndicator />
        </Stack>
      ) : messageData ? (
        <>
          <MessageBubble
            senderName={messageData.siteName}
            createdAt={getGuidelineInitialMessageCreatedAt(messageData.messages ?? [], messageOpenedAt)}
            message={messageData.deletionMessage}
            isOwn
          />

          {(messageData.messages ?? []).map((message) => (
            <MessageBubble
              key={message.id}
              senderName={message.senderName}
              createdAt={message.createdAt}
              message={message.message}
              isOwn={message.senderType === 'staff'}
            />
          ))}

          <TextField
            aria-label="답변 내용"
            placeholder="답변하세요"
            value={messageText}
            onChange={(event) => setMessageText(event.currentTarget.value)}
            multiline
            minRows={4}
            fullWidth
            size="small"
          />
        </>
      ) : null}
    </Stack>
  );

  return (
    <div className={`container ${styles.container}`}>
      <div className={`content ${styles.content} ${styles['content-manage']}`}>
        <Box>
          <button type="button" className="button small action" onClick={handleModeChange}>
            {showPast ? '이전으로 돌아가기' : '과거 신고내역 보기'}
          </button>
        </Box>

        {errorMessage ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}

        {loading ? (
          <div className={`paper ${styles.paper}`}>
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        ) : null}

        {!loading && reports.length === 0 ? (
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>신고 내역이 없습니다.</span>
          </p>
        ) : null}

        {!loading && reports.length > 0 ? (
          <div className={`paper ${styles.paper} paper-p0`}>
            <Table>
              <TableHead>
                {targetType === 'board' ? (
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>링크</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>게시판 이름</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>신고자</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>신고내용</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>처리상태</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>처리상태 변경</TableCell>
                  </TableRow>
                ) : null}

                {targetType === 'post' ? (
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>게시판 이름</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>제목</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>신고자</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>신고내용</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>처리상태</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>소명 상태</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>소명 메시지</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>최종 판단</TableCell>
                  </TableRow>
                ) : null}

                {targetType === 'comment' ? (
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>게시판 이름</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>게시물 제목</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>댓글보기</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>신고자</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>신고내용</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>처리상태</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>소명 상태</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>소명 메시지</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>최종 판단</TableCell>
                  </TableRow>
                ) : null}
              </TableHead>

              <TableBody>
                {reports.map((report) => {
                  if (targetType === 'board') {
                    return (
                      <TableRow key={report.id}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {report.board?.href ? <Link href={report.board.href}>바로가기</Link> : '-'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.board?.name ?? '-'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.reporterName}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.reportCategoryLabel}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{getStatusLabel(report)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <button type="button" className="button small action" onClick={() => handleOpen(report)}>
                            {showPast ? '보기' : '변경'}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (targetType === 'post') {
                    return (
                      <TableRow key={report.id}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.board?.name ?? '-'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Button type="button" variant="text" onClick={() => handleOpen(report)}>
                            {report.post?.title ?? '-'}
                          </Button>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.reporterName}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.reportCategoryLabel}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{getStatusLabel(report)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {report.canAppeal && report.appealMessageStatus
                            ? guidelineAppealMessageStatusLabels[report.appealMessageStatus]
                            : null}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {report.canAppeal ? (
                            <button
                              type="button"
                              className="button small action"
                              onClick={() => void handleOpenMessages(report)}
                            >
                              메시지 보기
                            </button>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {canFinalize(report) && !showPast ? (
                            <button
                              type="button"
                              className="button small action"
                              onClick={() => handleOpenFinal(report)}
                            >
                              최종 판단하기
                            </button>
                          ) : (getHandlingResultLabel(report) ?? '-')}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow key={report.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.board?.name ?? '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.post?.title ?? '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="button small action" onClick={() => handleOpen(report)}>
                          댓글보기
                        </button>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.reporterName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.reportCategoryLabel}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{getStatusLabel(report)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {report.canAppeal && report.appealMessageStatus
                          ? guidelineAppealMessageStatusLabels[report.appealMessageStatus]
                          : null}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {report.canAppeal ? (
                          <button
                            type="button"
                            className="button small action"
                            onClick={() => void handleOpenMessages(report)}
                          >
                            메시지 보기
                          </button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {canFinalize(report) && !showPast ? (
                          <button
                            type="button"
                            className="button small action"
                            onClick={() => handleOpenFinal(report)}
                          >
                            최종 판단하기
                          </button>
                        ) : (getHandlingResultLabel(report) ?? '-')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {useDrawer ? (
          <Drawer anchor="bottom" open={Boolean(selectedReport)} onClose={handleClose} className="VhiDrawer-bottom">
            <h2>신고 처리</h2>
            <button type="button" className="close-button" onClick={handleClose} disabled={saving}>
              <CloseRoundedIcon />
            </button>

            <Stack gap={3}>
              {detailContent}

              <Stack direction="column" spacing={1.5}>
                <button type="button" className="button medium cancel" onClick={handleClose} disabled={saving}>
                  닫기
                </button>

                {!showPast && selectedReport && !canFinalize(selectedReport) ? (
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleSave}
                    disabled={saving || !nextStatus}
                  >
                    {getSubmitLabel(targetType, nextStatus)}
                  </button>
                ) : null}
              </Stack>
            </Stack>
          </Drawer>
        ) : (
          <Dialog open={Boolean(selectedReport)} onClose={handleClose} fullWidth maxWidth="md" className="VhiDialog">
            <DialogTitle>신고 처리</DialogTitle>
            <button type="button" className="close-button" onClick={handleClose} disabled={saving}>
              <CloseRoundedIcon />
            </button>

            <DialogContent>{detailContent}</DialogContent>

            <DialogActions>
              <button type="button" className="button medium close" onClick={handleClose} disabled={saving}>
                닫기
              </button>

              {!showPast && selectedReport && !canFinalize(selectedReport) ? (
                <button
                  type="button"
                  className="button medium submit"
                  onClick={handleSave}
                  disabled={saving || !nextStatus}
                >
                  {getSubmitLabel(targetType, nextStatus)}
                </button>
              ) : null}
            </DialogActions>
          </Dialog>
        )}

        {useDrawer ? (
          <Drawer
            anchor="bottom"
            open={Boolean(messageReport)}
            onClose={handleCloseMessages}
            className="VhiDrawer-bottom"
          >
            <h2>소명 메시지</h2>
            <button
              type="button"
              className="close-button"
              onClick={handleCloseMessages}
              disabled={messageSaving}
            >
              <CloseRoundedIcon />
            </button>

            <Stack gap={3}>
              {messageContent}

              <Stack direction="column" spacing={1.5}>
                <button
                  type="button"
                  className="button medium cancel"
                  onClick={handleCloseMessages}
                  disabled={messageSaving}
                >
                  닫기
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={() => void handleSendReply()}
                  disabled={messageSaving || messageLoading || !messageText.trim()}
                >
                  보내기
                </button>
              </Stack>
            </Stack>
          </Drawer>
        ) : (
          <Dialog
            open={Boolean(messageReport)}
            onClose={handleCloseMessages}
            fullWidth
            maxWidth="lg"
            className="VhiDialog"
          >
            <DialogTitle>소명 메시지</DialogTitle>
            <button
              type="button"
              className="close-button"
              onClick={handleCloseMessages}
              disabled={messageSaving}
            >
              <CloseRoundedIcon />
            </button>
            <DialogContent>{messageContent}</DialogContent>
            <DialogActions>
              <button
                type="button"
                className="button medium close"
                onClick={handleCloseMessages}
                disabled={messageSaving}
              >
                닫기
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void handleSendReply()}
                disabled={messageSaving || messageLoading || !messageText.trim()}
              >
                보내기
              </button>
            </DialogActions>
          </Dialog>
        )}

        <Dialog
          open={Boolean(finalReport)}
          onClose={handleCloseFinal}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>최종 판단</DialogTitle>
          <button type="button" className="close-button" onClick={handleCloseFinal} disabled={finalSaving}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="body2">선택하세요.</Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={handleCloseFinal} disabled={finalSaving}>
              닫기
            </button>
            <button
              type="button"
              className="button medium warning"
              onClick={() => void handleFinalize('keep_deleted')}
              disabled={finalSaving}
            >
              삭제상태 유지
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleFinalize('restore')}
              disabled={finalSaving}
            >
              복구하기
            </button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(snackbarMessage)}
          autoHideDuration={2700}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          message={snackbarMessage}
          onClose={() => setSnackbarMessage('')}
        />
      </div>
    </div>
  );
}
