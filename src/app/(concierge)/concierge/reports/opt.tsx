'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import EmbeddedContentHtml from '@/components/service/EmbeddedContentHtml';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import type { ConciergeReportItem, ConciergeReportType } from '@/lib/reports/concierge';
import type { ReportTargetType } from '@/lib/reports/guidelines';
import {
  getAppealTreatmentMessage,
  reportAppealContentRequestLabels,
  reportAppealDeletionReasonOptions,
} from '@/lib/reports/appeals';
import {
  appealOpinionFields,
  appealOpinionPositionOptions,
  getAppealOpinionValueLabel,
} from '@/lib/reports/appealOpinion';
import { formatDateTimeDetail } from '@/lib/utils';

type ReportsResponse = {
  items?: ConciergeReportItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
};

type SiteAction = 'block' | 'unblock' | 'close';

type SiteActionDialogState = {
  report: ConciergeReportItem;
  action: SiteAction;
} | null;

type StatusChangeDialogState = {
  report: ConciergeReportItem;
  status: 'dismissed' | 'completed';
} | null;

type AppealDecision = 'restore' | 'reject';

type AppealTargetContentResponse = {
  targetType: 'post' | 'comment';
  board: {
    type: 'basic' | 'gallery' | 'youtube' | 'feed';
    markdownStatus: string | null;
  };
  post: {
    subject: string | null;
    summary: string | null;
    content_html: string | null;
    content_markdown: string | null;
    content_simple: string | null;
    thumbnail_image_url: string;
    youtube_url: string | null;
    images: {
      path: string;
      url: string;
    }[];
    poll: {
      question: string;
      anonymity: 'anonymous' | 'named';
      endsAt: string;
      options: {
        id: number;
        label: string;
        image: {
          url: string;
        } | null;
      }[];
    } | null;
  };
  comment: {
    content: string | null;
  } | null;
  error?: string;
};

const cellSx = { whiteSpace: 'nowrap' } as const;

const targetOptions: { value: ReportTargetType; label: string }[] = [
  { value: 'site', label: '사이트 신고' },
  { value: 'board', label: '게시판 신고' },
  { value: 'post', label: '게시물 신고' },
  { value: 'comment', label: '댓글 신고' },
];

const reportTypeOptions: { value: ConciergeReportType; label: string }[] = [
  { value: 'guideline', label: '가이드라인 위반' },
  { value: 'legal', label: '법률 위반' },
  { value: 'rights', label: '권리침해 위반' },
];

function truncate(value: string, maximumLength: number) {
  const characters = Array.from(value);

  if (characters.length <= maximumLength) {
    return value;
  }

  return `${characters.slice(0, maximumLength).join('')}…`;
}

function getYoutubeId(value: string | null) {
  const normalizedValue = value?.trim() ?? '';
  const match = normalizedValue.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );

  return match?.[1] ?? '';
}

function AppealTargetContent({ response }: { response: AppealTargetContentResponse }) {
  const theme = useTheme();

  if (response.targetType === 'comment') {
    return (
      <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {response.comment?.content || '댓글 내용이 없습니다.'}
      </Typography>
    );
  }

  return (
    <Stack gap={2}>
      <Typography variant="h6">{response.post.subject || '제목 없음'}</Typography>
      {response.board.type === 'youtube' && getYoutubeId(response.post.youtube_url) ? (
        <YoutubeEmbed videoId={getYoutubeId(response.post.youtube_url)} />
      ) : null}
      {response.post.summary ? (
        <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{response.post.summary}</Typography>
      ) : null}
      {response.board.type === 'feed' && response.post.content_simple ? (
        <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{response.post.content_simple}</Typography>
      ) : null}
      {response.post.content_html ? (
        <EmbeddedContentHtml
          contentHtml={response.post.content_html}
          contentMarkdown={response.post.content_markdown}
          markdownStatus={response.board.markdownStatus}
          themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
          className="viewer"
        />
      ) : null}
      {response.post.thumbnail_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={response.post.thumbnail_image_url} alt="" style={{ maxWidth: '100%', height: 'auto' }} />
      ) : null}
      {response.post.images.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={image.path} src={image.url} alt="" style={{ maxWidth: '100%', height: 'auto' }} />
      ))}
      {response.post.poll ? (
        <div className="paper">
          <Stack gap={1.5}>
            <Typography variant="h6">투표</Typography>
            <Typography variant="subtitle1">{response.post.poll.question}</Typography>
            <Stack component="ol" gap={1} sx={{ m: 0, pl: 3 }}>
              {response.post.poll.options.map((option) => (
                <li key={option.id}>
                  <Stack direction="row" gap={1} alignItems="center">
                    {option.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={option.image.url} alt="" style={{ width: 80, height: 80, objectFit: 'cover' }} />
                    ) : null}
                    <Typography>{option.label}</Typography>
                  </Stack>
                </li>
              ))}
            </Stack>
          </Stack>
        </div>
      ) : null}
    </Stack>
  );
}

function renderTargetLinks(report: ConciergeReportItem) {
  return (
    <Stack direction="row" gap={1} flexWrap="wrap">
      {report.site ? (
        <Anchor href={report.site.href} className="link">
          {report.site.name}
        </Anchor>
      ) : null}
      {report.board ? (
        <Anchor href={report.board.href} className="link">
          {report.board.name}
        </Anchor>
      ) : null}
      {report.post ? (
        <Anchor href={report.post.href} className="link">
          {report.post.title}
        </Anchor>
      ) : null}
    </Stack>
  );
}

function ReportDetails({ report }: { report: ConciergeReportItem }) {
  return (
    <Stack gap={2}>
      {renderTargetLinks(report)}

      {report.comment?.content ? (
        <Stack gap={0.5}>
          <Typography variant="subtitle2">댓글</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {report.comment.content}
          </Typography>
        </Stack>
      ) : null}

      {report.details.map((detail) => {
        if (!detail.value && !detail.links?.length) {
          return null;
        }

        return (
          <Stack key={detail.label} gap={0.5}>
            <Typography variant="subtitle2">{detail.label}</Typography>
            {detail.value ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {detail.value}
              </Typography>
            ) : null}
            {detail.links?.map((link) => (
              <Anchor key={`${detail.label}-${link.href}`} href={link.href} className="link" target="_blank">
                {link.label}
              </Anchor>
            ))}
          </Stack>
        );
      })}

      {report.messages.length > 0 ? (
        <Stack gap={1}>
          <Typography variant="subtitle2">메모 이력</Typography>
          {report.messages.map((message) => (
            <div className="paper" key={message.id}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {message.message}
              </Typography>
              <Typography variant="caption">
                {message.senderName} → {message.recipientName} · {formatDateTimeDetail(message.createdAt)}
              </Typography>
            </div>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

export default function Opt() {
  const [reports, setReports] = useState<ConciergeReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [targetType, setTargetType] = useState<ReportTargetType | ''>('');
  const [reportType, setReportType] = useState<ConciergeReportType | ''>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [reporterDialogOpen, setReporterDialogOpen] = useState(false);
  const [reporterLoading, setReporterLoading] = useState(false);
  const [reporterName, setReporterName] = useState('');
  const [reporterReports, setReporterReports] = useState<ConciergeReportItem[]>([]);

  const [detailDialogReport, setDetailDialogReport] = useState<ConciergeReportItem | null>(null);
  const [appealDialogReport, setAppealDialogReport] = useState<ConciergeReportItem | null>(null);
  const [appealTargetContent, setAppealTargetContent] = useState<AppealTargetContentResponse | null>(null);
  const [appealTargetContentLoading, setAppealTargetContentLoading] = useState(false);
  const [appealTargetContentError, setAppealTargetContentError] = useState('');
  const [submissionSummary, setSubmissionSummary] = useState('');
  const [deletionReason, setDeletionReason] = useState('');
  const [appealRequest, setAppealRequest] = useState('');
  const [messageDialogReport, setMessageDialogReport] = useState<ConciergeReportItem | null>(null);
  const [message, setMessage] = useState('');
  const [siteActionDialog, setSiteActionDialog] = useState<SiteActionDialogState>(null);
  const [statusChangeDialog, setStatusChangeDialog] = useState<StatusChangeDialogState>(null);
  const [appealDecisionDialog, setAppealDecisionDialog] = useState<AppealDecision | null>(null);

  const loadReports = useCallback(
    async function loadReports() {
      try {
        setLoading(true);
        setErrorMessage('');

        const searchParams = new URLSearchParams({ page: String(page) });

        if (targetType) {
          searchParams.set('targetType', targetType);
        }

        if (reportType) {
          searchParams.set('reportType', reportType);
        }

        const response = await fetch(`/api/concierge/reports?${searchParams.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });
        const result = (await response
          .json()
          .catch(() => ({ error: '신고 목록 응답을 확인하지 못했습니다.' }))) as ReportsResponse;

        if (!response.ok || result.error) {
          setReports([]);
          setTotal(0);
          setErrorMessage(result.error ?? '신고 목록을 불러오지 못했습니다.');
          return;
        }

        setReports(result.items ?? []);
        setTotal(result.total ?? 0);
      } catch {
        setReports([]);
        setTotal(0);
        setErrorMessage('신고 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [page, reportType, targetType],
  );

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  function handleTargetTypeChange(event: SelectChangeEvent) {
    setTargetType(event.target.value as ReportTargetType | '');
    setPage(0);
  }

  function handleReportTypeChange(event: SelectChangeEvent) {
    setReportType(event.target.value as ConciergeReportType | '');
    setPage(0);
  }

  async function handleOpenReporterDialog(report: ConciergeReportItem) {
    setReporterDialogOpen(true);
    setReporterLoading(true);
    setReporterName(report.reporterName);
    setReporterReports([]);

    try {
      const searchParams = new URLSearchParams({ reporterUserId: report.reporterUserId });
      const response = await fetch(`/api/concierge/reports?${searchParams.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });
      const result = (await response
        .json()
        .catch(() => ({ error: '신고 이력 응답을 확인하지 못했습니다.' }))) as ReportsResponse;

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '신고자 신고 이력을 불러오지 못했습니다.');
        return;
      }

      setReporterReports(result.items ?? []);
    } catch {
      setErrorMessage('신고자 신고 이력을 불러오지 못했습니다.');
    } finally {
      setReporterLoading(false);
    }
  }

  async function handleStatusChange(report: ConciergeReportItem, status: 'dismissed' | 'completed') {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/concierge/reports/${report.reportType}/${report.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json().catch(() => ({ error: '처리 응답을 확인하지 못했습니다.' }))) as {
        error?: string;
      };

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '신고를 처리하지 못했습니다.');
        return;
      }

      setSnackbarMessage(status === 'completed' ? '처리완료로 변경했습니다.' : '이상 없음으로 변경했습니다.');
      setStatusChangeDialog(null);
      await loadReports();
    } catch {
      setErrorMessage('신고를 처리하지 못했습니다.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenMessageDialog(report: ConciergeReportItem) {
    setMessageDialogReport(report);
    setMessage('');
  }

  async function handleOpenAppealDialog(report: ConciergeReportItem) {
    setAppealDialogReport(report);
    setSubmissionSummary(report.appeal?.submissionSummary ?? '');
    setDeletionReason(report.appeal?.deletionReason ?? '');
    setAppealRequest(report.appeal?.appealRequest ?? '');
    setAppealTargetContent(null);
    setAppealTargetContentError('');

    if (report.targetType !== 'post') {
      return;
    }

    try {
      setAppealTargetContentLoading(true);
      const response = await fetch(`/api/concierge/appeals/content/${report.reportType}/${report.id}`, {
        credentials: 'include',
      });
      const result = (await response
        .json()
        .catch(() => ({ error: '게시물 응답을 확인하지 못했습니다.' }))) as AppealTargetContentResponse;

      if (!response.ok || result.error) {
        setAppealTargetContentError(result.error ?? '게시물 내용을 불러오지 못했습니다.');
        return;
      }

      setAppealTargetContent(result);
    } catch {
      setAppealTargetContentError('게시물 내용을 불러오지 못했습니다.');
    } finally {
      setAppealTargetContentLoading(false);
    }
  }

  function handleCloseAppealDialog() {
    setAppealDialogReport(null);
    setAppealTargetContent(null);
    setAppealTargetContentLoading(false);
    setAppealTargetContentError('');
    setSubmissionSummary('');
    setDeletionReason('');
    setAppealRequest('');
  }

  async function handleSubmitAppealRequest() {
    if (!appealDialogReport || appealDialogReport.appeal) {
      return;
    }

    if (!submissionSummary.trim()) {
      setErrorMessage('제출 자료 요지를 입력해 주세요.');
      return;
    }

    if (!deletionReason) {
      setErrorMessage('삭제 사유를 선택해 주세요.');
      return;
    }

    if (!appealRequest.trim()) {
      setErrorMessage('소명 요청사항을 입력해 주세요.');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(
        `/api/concierge/reports/${appealDialogReport.reportType}/${appealDialogReport.id}/appeal`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionSummary: submissionSummary.trim(),
            deletionReason,
            appealRequest: appealRequest.trim(),
          }),
        },
      );
      const result = (await response.json().catch(() => ({ error: '소명 요청서 응답을 확인하지 못했습니다.' }))) as {
        error?: string;
      };

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '소명 요청서를 제출하지 못했습니다.');
        return;
      }

      handleCloseAppealDialog();
      setSnackbarMessage('소명 요청서를 제출했습니다.');
      await loadReports();
    } catch {
      setErrorMessage('소명 요청서를 제출하지 못했습니다.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAppealDecision(action: 'restore' | 'reject') {
    if (!appealDialogReport?.appeal) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(
        `/api/concierge/reports/${appealDialogReport.reportType}/${appealDialogReport.id}/appeal`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      const result = (await response.json().catch(() => ({ error: '소명 처리 응답을 확인하지 못했습니다.' }))) as {
        error?: string;
      };

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '소명을 처리하지 못했습니다.');
        return;
      }

      handleCloseAppealDialog();
      setAppealDecisionDialog(null);
      setSnackbarMessage(action === 'restore' ? '콘텐츠를 복구했습니다.' : '소명을 반려했습니다.');
      await loadReports();
    } catch {
      setErrorMessage('소명을 처리하지 못했습니다.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!messageDialogReport || !message.trim()) {
      setErrorMessage('메모 내용을 입력해 주세요.');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(
        `/api/concierge/reports/${messageDialogReport.reportType}/${messageDialogReport.id}/messages`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message.trim() }),
        },
      );
      const result = (await response.json().catch(() => ({ error: '메시지 응답을 확인하지 못했습니다.' }))) as {
        error?: string;
      };

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '메모를 보내지 못했습니다.');
        return;
      }

      setMessageDialogReport(null);
      setMessage('');
      setSnackbarMessage('운영자에게 메시지를 보냈습니다.');
      await loadReports();
    } catch {
      setErrorMessage('메모를 보내지 못했습니다.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSiteAction(report: ConciergeReportItem, action: SiteAction) {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/concierge/reports/${report.reportType}/${report.id}/site`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => ({ error: '사이트 처리 응답을 확인하지 못했습니다.' }))) as {
        error?: string;
      };

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '사이트를 처리하지 못했습니다.');
        return;
      }

      setSnackbarMessage(
        action === 'block'
          ? '사이트를 차단했습니다.'
          : action === 'unblock'
            ? '사이트 차단을 해제했습니다.'
            : '사이트를 폐쇄했습니다.',
      );
      setSiteActionDialog(null);
      await loadReports();
    } catch {
      setErrorMessage('사이트를 처리하지 못했습니다.');
    } finally {
      setActionLoading(false);
    }
  }

  const appealDeletionOptions = appealDialogReport?.appealCategory
    ? reportAppealDeletionReasonOptions[appealDialogReport.appealCategory]
    : [];
  const appealTreatmentMessage =
    appealDialogReport?.appealCategory &&
    deletionReason &&
    (appealDialogReport.targetType === 'post' || appealDialogReport.targetType === 'comment')
      ? getAppealTreatmentMessage({
          category: appealDialogReport.appealCategory,
          deletionReason,
          targetType: appealDialogReport.targetType,
        })
      : '';
  const appealOpinionFieldList = appealDialogReport?.appealCategory
    ? appealOpinionFields[appealDialogReport.appealCategory]
    : [];
  const appealOpinionPositionLabel =
    appealDialogReport?.appealCategory && appealDialogReport.appeal?.opinionPosition
      ? (appealOpinionPositionOptions[appealDialogReport.appealCategory].find(
          (option) => option.value === appealDialogReport.appeal?.opinionPosition,
        )?.label ?? appealDialogReport.appeal.opinionPosition)
      : '';
  const canHandleAppeal = Boolean(
    appealDialogReport?.appeal &&
    ((appealDialogReport.appeal.adminStatus === 'opinion_received' &&
      appealDialogReport.appeal.contentRequest === 'restore_original') ||
      (appealDialogReport.appeal.adminStatus === 'edit_review_requested' &&
        appealDialogReport.appeal.contentRequest === 'edit_and_review')),
  );

  return (
    <Stack gap={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
        <FormControl size="small" fullWidth>
          <Select displayEmpty value={targetType} onChange={handleTargetTypeChange}>
            <MenuItem value="">전체 타깃</MenuItem>
            {targetOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <Select displayEmpty value={reportType} onChange={handleReportTypeChange}>
            <MenuItem value="">전체 카테고리</MenuItem>
            {reportTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {errorMessage ? (
        <p className="alert warning">
          <WarningAmberRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
          <LoadingIndicator />
        </Stack>
      ) : (
        <>
          <div className="paper">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={cellSx}>사이트명</TableCell>
                  <TableCell sx={cellSx}>게시판명</TableCell>
                  <TableCell sx={cellSx}>게시물 제목</TableCell>
                  <TableCell sx={cellSx}>댓글</TableCell>
                  <TableCell sx={cellSx}>신고 주소</TableCell>
                  <TableCell sx={cellSx}>신고명(위반내용)</TableCell>
                  <TableCell sx={cellSx}>신고 내용</TableCell>
                  <TableCell sx={cellSx}>신고자(이름)</TableCell>
                  <TableCell sx={cellSx}>메모 횟수</TableCell>
                  <TableCell sx={cellSx}>처리상태</TableCell>
                  <TableCell sx={cellSx}>소명 상태</TableCell>
                  <TableCell sx={cellSx}>처리상태 변경</TableCell>
                  <TableCell sx={cellSx}>신고일</TableCell>
                  <TableCell sx={cellSx}>처리일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={`${report.reportType}-${report.id}`}>
                    <TableCell sx={cellSx}>
                      {report.site ? (
                        <Anchor href={report.site.href} className="link">
                          {report.site.name}
                        </Anchor>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {report.board ? (
                        <Anchor href={report.board.href} className="link">
                          {report.board.name}
                        </Anchor>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {report.post ? (
                        <Anchor href={report.post.href} className="link">
                          {truncate(report.post.title, 50)}
                        </Anchor>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>{report.comment ? truncate(report.comment.content, 150) : '-'}</TableCell>
                    <TableCell sx={cellSx}>{report.reportUrl ?? '-'}</TableCell>
                    <TableCell sx={cellSx}>
                      <Stack direction="row" gap={1} alignItems="center">
                        <Chip label={report.reportTypeLabel} size="small" />
                        <span>{report.reportName}</span>
                      </Stack>
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {report.reportType === 'legal' || report.reportType === 'rights' ? (
                        <button
                          type="button"
                          className="button small action"
                          onClick={() => setDetailDialogReport(report)}
                        >
                          보기
                        </button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <button
                        type="button"
                        className="button small action"
                        onClick={() => handleOpenReporterDialog(report)}
                      >
                        {report.reporterName}님의 신고내역
                      </button>
                    </TableCell>
                    <TableCell sx={cellSx}>{report.messageCount.toLocaleString('ko-KR')}회</TableCell>
                    <TableCell sx={cellSx}>{report.statusLabel}</TableCell>
                    <TableCell sx={cellSx}>
                      {report.appeal
                        ? report.appeal.adminStatusLabel
                        : report.appealCategory && (report.targetType === 'post' || report.targetType === 'comment')
                          ? '소명 요청서 제출 전'
                          : '-'}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <Stack direction="row" gap={1}>
                        {report.canDismiss ? (
                          <button
                            type="button"
                            className="button small action"
                            disabled={actionLoading}
                            onClick={() => setStatusChangeDialog({ report, status: 'dismissed' })}
                          >
                            이상 없음
                          </button>
                        ) : null}
                        {report.canComplete ? (
                          <button
                            type="button"
                            className="button small danger"
                            disabled={actionLoading}
                            onClick={() => setStatusChangeDialog({ report, status: 'completed' })}
                          >
                            처리완료
                          </button>
                        ) : null}
                        {report.canCreateAppealRequest ? (
                          <button
                            type="button"
                            className="button small action"
                            disabled={actionLoading}
                            onClick={() => handleOpenAppealDialog(report)}
                          >
                            소명 요청서 작성
                          </button>
                        ) : null}
                        {report.appeal ? (
                          <button
                            type="button"
                            className="button small action"
                            disabled={actionLoading}
                            onClick={() => handleOpenAppealDialog(report)}
                          >
                            {report.appeal.opinionSubmittedAt ? '소명 의견서' : '소명 요청서'}
                          </button>
                        ) : null}
                        {report.canSendMessage ? (
                          <button
                            type="button"
                            className="button small action"
                            disabled={actionLoading}
                            onClick={() => handleOpenMessageDialog(report)}
                          >
                            메모 보내기
                          </button>
                        ) : null}
                        {report.reportType === 'rights' &&
                        report.canSendMessage &&
                        report.site &&
                        report.messageCount >= 3 &&
                        !report.site.isBlocked ? (
                          <button
                            type="button"
                            className="button small danger"
                            disabled={actionLoading}
                            onClick={() => setSiteActionDialog({ report, action: 'block' })}
                          >
                            사이트 차단
                          </button>
                        ) : null}
                        {report.reportType === 'rights' && report.canSendMessage && report.site?.isBlocked ? (
                          <button
                            type="button"
                            className="button small action"
                            disabled={actionLoading}
                            onClick={() => setSiteActionDialog({ report, action: 'unblock' })}
                          >
                            차단 해제
                          </button>
                        ) : null}
                        {report.reportType === 'rights' &&
                        report.canSendMessage &&
                        report.site?.isBlocked &&
                        !report.site.isPlanTerminated ? (
                          <button
                            type="button"
                            className="button small danger"
                            disabled={actionLoading}
                            onClick={() => setSiteActionDialog({ report, action: 'close' })}
                          >
                            사이트 폐쇄
                          </button>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell sx={cellSx}>{formatDateTimeDetail(report.createdAt)}</TableCell>
                    <TableCell sx={cellSx}>{report.handledAt ? formatDateTimeDetail(report.handledAt) : '-'}</TableCell>
                  </TableRow>
                ))}
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell sx={cellSx} colSpan={14} align="center">
                      신고 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={50}
            rowsPerPageOptions={[50]}
            onPageChange={(_, nextPage) => setPage(nextPage)}
          />
        </>
      )}

      <Dialog
        open={reporterDialogOpen}
        onClose={() => setReporterDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        className="VhiDialog"
      >
        <DialogTitle>{reporterName} 님의 신고 내역</DialogTitle>
        <button className="close-button" onClick={() => setReporterDialogOpen(false)}>
          <CloseRoundedIcon />
        </button>

        <DialogContent>
          {reporterLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
              <LoadingIndicator />
            </Stack>
          ) : (
            <Stack gap={2}>
              <Typography variant="subtitle2">
                총 {reporterReports.length.toLocaleString('ko-KR')}건 신고했습니다.
              </Typography>
              <Box>
                {reporterReports.map((report) => (
                  <Accordion key={`${report.reportType}-${report.id}`}>
                    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                      <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
                        <Chip label={report.reportTypeLabel} size="small" />
                        <Typography variant="subtitle2">{report.reportName}</Typography>
                        <Typography variant="body2">
                          {report.targetTypeLabel} / {report.statusLabel} / {formatDateTimeDetail(report.createdAt)}
                        </Typography>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <ReportDetails report={report} />
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <button type="button" className="button medium close" onClick={() => setReporterDialogOpen(false)}>
            닫기
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(detailDialogReport)}
        onClose={() => setDetailDialogReport(null)}
        maxWidth="lg"
        fullWidth
        className="VhiDialog"
      >
        <DialogTitle>
          {detailDialogReport ? `${detailDialogReport.reportTypeLabel} 신고 내용` : '신고 내용'}
        </DialogTitle>
        <button className="close-button" onClick={() => setDetailDialogReport(null)}>
          <CloseRoundedIcon />
        </button>
        <DialogContent>{detailDialogReport ? <ReportDetails report={detailDialogReport} /> : null}</DialogContent>
        <DialogActions>
          <button type="button" className="button medium close" onClick={() => setDetailDialogReport(null)}>
            닫기
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(appealDialogReport)}
        onClose={handleCloseAppealDialog}
        maxWidth="lg"
        fullWidth
        className="VhiDialog"
      >
        <DialogTitle>{appealDialogReport?.appeal ? '소명 요청서' : '소명 요청서 작성'}</DialogTitle>
        <button className="close-button" onClick={handleCloseAppealDialog}>
          <CloseRoundedIcon />
        </button>
        <DialogContent>
          <Stack gap={2}>
            {appealDialogReport ? (
              <Stack gap={1}>
                <Typography variant="h6">신고 내용</Typography>
                <div className="paper">
                  <ReportDetails report={appealDialogReport} />
                </div>
              </Stack>
            ) : null}
            {appealDialogReport?.targetType === 'post' ? (
              <Stack gap={1}>
                <Typography variant="h6">신고 대상 게시물</Typography>
                <div className="paper">
                  {appealTargetContentLoading ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 160 }}>
                      <LoadingIndicator />
                    </Stack>
                  ) : appealTargetContentError ? (
                    <p className="alert danger">{appealTargetContentError}</p>
                  ) : appealTargetContent ? (
                    <AppealTargetContent response={appealTargetContent} />
                  ) : null}
                </div>
              </Stack>
            ) : null}
            <Stack gap={1}>
              <Typography variant="h6">소명 요청서 작성 내용</Typography>
              <div className="paper">
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">제출 자료 요지 *</Typography>
                  <TextField
                    aria-label="제출 자료 요지"
                    helperText="신고자가 제출한 자료가 어떤 사실을 뒷받침하기 위한 자료인지 개인정보를 제외하고 작성해 주세요."
                    value={submissionSummary}
                    onChange={(event) => setSubmissionSummary(event.currentTarget.value)}
                    multiline
                    minRows={4}
                    fullWidth
                    required
                    size="small"
                    slotProps={{ input: { readOnly: Boolean(appealDialogReport?.appeal) } }}
                  />
                </Stack>
                <FormControl fullWidth required>
                  <Select
                    displayEmpty
                    value={deletionReason}
                    disabled={Boolean(appealDialogReport?.appeal)}
                    size="small"
                    onChange={(event) => setDeletionReason(event.target.value)}
                  >
                    <MenuItem value="" disabled>
                      삭제 사유 선택
                    </MenuItem>
                    {appealDeletionOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {appealTreatmentMessage ? (
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>{appealTreatmentMessage}</span>
                  </p>
                ) : null}
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">소명 요청사항 *</Typography>
                  <TextField
                    aria-label="소명 요청사항"
                    helperText="신고 내용 중 소명인이 설명하거나 자료를 제출해야 하는 사항을 구체적으로 작성해 주세요."
                    value={appealRequest}
                    onChange={(event) => setAppealRequest(event.currentTarget.value)}
                    multiline
                    minRows={4}
                    fullWidth
                    required
                    size="small"
                    slotProps={{ input: { readOnly: Boolean(appealDialogReport?.appeal) } }}
                  />
                </Stack>
                {appealDialogReport?.appeal?.opinionSubmittedAt ? (
                  <Stack gap={2}>
                    <Typography variant="h6">소명 의견서</Typography>
                    <Stack gap={0.5}>
                      <Typography variant="subtitle2">소명 입장</Typography>
                      <Typography variant="body2">{appealOpinionPositionLabel}</Typography>
                    </Stack>
                    <Stack gap={0.5}>
                      <Typography variant="subtitle2">인정하거나 이의를 제기하는 부분</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {appealDialogReport.appeal.disputedParts}
                      </Typography>
                    </Stack>
                    {appealOpinionFieldList.map((field) => {
                      const value = appealDialogReport.appeal?.opinionData?.[field.key];

                      if (typeof value !== 'string' || !value) {
                        return null;
                      }

                      return (
                        <Stack key={field.key} gap={0.5}>
                          <Typography variant="subtitle2">{field.label}</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {getAppealOpinionValueLabel(field, value)}
                          </Typography>
                        </Stack>
                      );
                    })}
                    {appealDialogReport.appeal.contentRequest ? (
                      <Stack gap={0.5}>
                        <Typography variant="subtitle2">게시물·댓글 처리 요청</Typography>
                        <Typography variant="body2">
                          {reportAppealContentRequestLabels[appealDialogReport.appeal.contentRequest]}
                        </Typography>
                      </Stack>
                    ) : null}
                    {appealDialogReport.appeal.modificationContent ? (
                      <Stack gap={0.5}>
                        <Typography variant="subtitle2">수정 예정 내용</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {appealDialogReport.appeal.modificationContent}
                        </Typography>
                      </Stack>
                    ) : null}
                    {appealDialogReport.appeal.opinionFile ? (
                      <Stack gap={0.5}>
                        <Typography variant="subtitle2">첨부자료</Typography>
                        <Anchor
                          href={`/api/concierge/reports/file?${new URLSearchParams({
                            bucket: appealDialogReport.appeal.opinionFile.bucket,
                            path: appealDialogReport.appeal.opinionFile.path,
                          }).toString()}`}
                          className="link"
                          target="_blank"
                        >
                          {appealDialogReport.appeal.opinionFile.name}
                        </Anchor>
                      </Stack>
                    ) : null}
                  </Stack>
                ) : null}
              </div>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className="button medium close"
            disabled={actionLoading}
            onClick={handleCloseAppealDialog}
          >
            {appealDialogReport?.appeal ? '닫기' : '취소'}
          </button>
          {!appealDialogReport?.appeal ? (
            <button
              type="button"
              className="button medium submit"
              disabled={actionLoading}
              onClick={handleSubmitAppealRequest}
            >
              제출
            </button>
          ) : null}
          {canHandleAppeal ? (
            <>
              <button
                type="button"
                className="button medium danger"
                disabled={actionLoading}
                onClick={() => setAppealDecisionDialog('reject')}
              >
                삭제 유지
              </button>
              <button
                type="button"
                className="button medium action"
                disabled={actionLoading}
                onClick={() => setAppealDecisionDialog('restore')}
              >
                복구
              </button>
            </>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(messageDialogReport)}
        onClose={() => setMessageDialogReport(null)}
        maxWidth="sm"
        fullWidth
        className="VhiDialog"
      >
        <DialogTitle>메모 보내기</DialogTitle>
        <button className="close-button" onClick={() => setMessageDialogReport(null)}>
          <CloseRoundedIcon />
        </button>
        <DialogContent>
          <Stack gap={2}>
            {messageDialogReport?.reportType === 'rights' &&
            (messageDialogReport.targetType === 'site' || messageDialogReport.targetType === 'board') ? (
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>
                  현재까지 메모를 {messageDialogReport.messageCount.toLocaleString('ko-KR')}회 보냈습니다. 메모를 3회
                  이상 보낸 뒤에도 문제가 해결되지 않으면 사이트를 차단할 수 있으며, 3회 이후에도 메시지는 계속 보낼 수
                  있습니다.
                </span>
              </p>
            ) : null}
            {messageDialogReport?.messages.length ? (
              <Stack gap={1}>
                <Typography variant="subtitle2">메모 이력</Typography>
                {messageDialogReport.messages.map((historyItem) => (
                  <div className="paper" key={historyItem.id}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {historyItem.message}
                    </Typography>
                    <Typography variant="caption">
                      {historyItem.senderName} → {historyItem.recipientName} ·{' '}
                      {formatDateTimeDetail(historyItem.createdAt)}
                    </Typography>
                  </div>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2">아직 보낸 메모가 없습니다.</Typography>
            )}
            <Stack gap={0.5}>
              <Typography variant="subtitle2">메모 내용</Typography>
              <TextField
                aria-label="메모 내용"
                value={message}
                onChange={(event) => setMessage(event.currentTarget.value)}
                multiline
                minRows={4}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className="button medium close"
            disabled={actionLoading}
            onClick={() => setMessageDialogReport(null)}
          >
            취소
          </button>
          <button type="button" className="button medium submit" disabled={actionLoading} onClick={handleSendMessage}>
            보내기
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(statusChangeDialog)}
        onClose={() => setStatusChangeDialog(null)}
        maxWidth="sm"
        fullWidth
        className="VhiDialog"
      >
        <DialogTitle>{statusChangeDialog?.status === 'completed' ? '처리완료' : '이상 없음'}</DialogTitle>
        <button className="close-button" onClick={() => setStatusChangeDialog(null)}>
          <CloseRoundedIcon />
        </button>
        <DialogContent>
          <Typography variant="body2">
            {statusChangeDialog?.status === 'completed'
              ? '처리완료로 변경하고 신고 대상에 제재를 적용하시겠습니까?'
              : statusChangeDialog?.report.reportType === 'rights'
                ? '이상 없음으로 처리하고 삭제 상태를 해제하시겠습니까?'
                : '이상 없음으로 처리하시겠습니까?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className="button medium close"
            disabled={actionLoading}
            onClick={() => setStatusChangeDialog(null)}
          >
            취소
          </button>
          <button
            type="button"
            className={`button medium ${statusChangeDialog?.status === 'completed' ? 'warning' : 'submit'}`}
            disabled={actionLoading || !statusChangeDialog}
            onClick={() => {
              if (statusChangeDialog) {
                void handleStatusChange(statusChangeDialog.report, statusChangeDialog.status);
              }
            }}
          >
            {statusChangeDialog?.status === 'completed' ? '처리완료' : '이상 없음'}
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(appealDecisionDialog)}
        onClose={() => setAppealDecisionDialog(null)}
        maxWidth="sm"
        fullWidth
        className="VhiDialog"
      >
        <DialogTitle>{appealDecisionDialog === 'restore' ? '복구' : '삭제 유지'}</DialogTitle>
        <button className="close-button" onClick={() => setAppealDecisionDialog(null)}>
          <CloseRoundedIcon />
        </button>
        <DialogContent>
          <Typography variant="body2">
            {appealDecisionDialog === 'restore'
              ? '게시물 또는 댓글을 복구하시겠습니까?'
              : '소명을 반려하고 삭제 상태를 유지하시겠습니까?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className="button medium close"
            disabled={actionLoading}
            onClick={() => setAppealDecisionDialog(null)}
          >
            취소
          </button>
          <button
            type="button"
            className={`button medium ${appealDecisionDialog === 'restore' ? 'submit' : 'warning'}`}
            disabled={actionLoading || !appealDecisionDialog}
            onClick={() => {
              if (appealDecisionDialog) {
                void handleAppealDecision(appealDecisionDialog);
              }
            }}
          >
            {appealDecisionDialog === 'restore' ? '복구' : '삭제 유지'}
          </button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(siteActionDialog)} onClose={() => setSiteActionDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {siteActionDialog?.action === 'block'
            ? '사이트 차단'
            : siteActionDialog?.action === 'unblock'
              ? '사이트 차단 해제'
              : '사이트 폐쇄'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {siteActionDialog?.action === 'block'
              ? '진짜 사이트를 차단하시겠습니까?'
              : siteActionDialog?.action === 'unblock'
                ? '진짜 사이트 차단을 해제하시겠습니까?'
                : '진짜 사이트를 폐쇄하시겠습니까? 환불 가능한 요금제는 환불 후 취소되며, 환불할 수 없으면 다음 결제가 취소됩니다.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className="button medium close"
            disabled={actionLoading}
            onClick={() => setSiteActionDialog(null)}
          >
            취소
          </button>
          <button
            type="button"
            className={`button medium ${siteActionDialog?.action === 'unblock' ? 'submit' : 'warning'}`}
            disabled={actionLoading || !siteActionDialog}
            onClick={() => {
              if (siteActionDialog) {
                void handleSiteAction(siteActionDialog.report, siteActionDialog.action);
              }
            }}
          >
            {siteActionDialog?.action === 'block'
              ? '차단하기'
              : siteActionDialog?.action === 'unblock'
                ? '차단 해제'
                : '사이트 폐쇄'}
          </button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbarMessage)}
        message={snackbarMessage}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        autoHideDuration={2700}
        onClose={() => setSnackbarMessage('')}
      />
    </Stack>
  );
}
