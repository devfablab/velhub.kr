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
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import type { ConciergeReportItem, ConciergeReportType } from '@/lib/reports/concierge';
import type { ReportTargetType } from '@/lib/reports/guidelines';
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

      {report.comment ? (
        <Stack gap={0.5}>
          <Typography variant="subtitle2">댓글</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {report.comment.content}
          </Typography>
        </Stack>
      ) : null}

      {report.details.map((detail) => (
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
      ))}

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
  const [messageDialogReport, setMessageDialogReport] = useState<ConciergeReportItem | null>(null);
  const [message, setMessage] = useState('');
  const [siteActionDialog, setSiteActionDialog] = useState<SiteActionDialogState>(null);

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
    const confirmationMessage =
      status === 'completed'
        ? '처리완료로 변경하고 신고 대상에 제재를 적용하시겠습니까?'
        : report.reportType === 'rights'
          ? '이상 없음으로 처리하고 숨김을 해제하시겠습니까?'
          : '이상 없음으로 처리하시겠습니까?';

    if (!window.confirm(confirmationMessage)) {
      return;
    }

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

      {errorMessage ? <p className="alert danger">{errorMessage}</p> : null}

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
                          className="button small"
                          onClick={() => setDetailDialogReport(report)}
                        >
                          신고 내용
                        </button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <button type="button" className="button small" onClick={() => handleOpenReporterDialog(report)}>
                        {report.reporterName}
                      </button>
                    </TableCell>
                    <TableCell sx={cellSx}>{report.messageCount.toLocaleString('ko-KR')}회</TableCell>
                    <TableCell sx={cellSx}>{report.statusLabel}</TableCell>
                    <TableCell sx={cellSx}>
                      <Stack direction="row" gap={1}>
                        {report.canDismiss ? (
                          <button
                            type="button"
                            className="button small"
                            disabled={actionLoading}
                            onClick={() => handleStatusChange(report, 'dismissed')}
                          >
                            이상 없음
                          </button>
                        ) : null}
                        {report.canComplete ? (
                          <button
                            type="button"
                            className="button small danger"
                            disabled={actionLoading}
                            onClick={() => handleStatusChange(report, 'completed')}
                          >
                            처리완료
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
                            className="button small warning"
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
                    <TableCell sx={cellSx} colSpan={13} align="center">
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

      <Dialog open={reporterDialogOpen} onClose={() => setReporterDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{reporterName} 님의 신고 내역</DialogTitle>
        <DialogContent dividers>
          {reporterLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
              <LoadingIndicator />
            </Stack>
          ) : (
            <Stack gap={2}>
              <Typography variant="subtitle1">
                총 {reporterReports.length.toLocaleString('ko-KR')}건 신고했습니다.
              </Typography>
              <Box>
                {reporterReports.map((report) => (
                  <Accordion key={`${report.reportType}-${report.id}`}>
                    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                      <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
                        <Chip label={report.reportTypeLabel} size="small" />
                        <Typography variant="subtitle2">{report.reportName}</Typography>
                        <Typography variant="caption">
                          {report.targetTypeLabel} · {report.statusLabel} · {formatDateTimeDetail(report.createdAt)}
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
      >
        <DialogTitle>
          {detailDialogReport ? `${detailDialogReport.reportTypeLabel} 신고 내용` : '신고 내용'}
        </DialogTitle>
        <DialogContent dividers>
          {detailDialogReport ? <ReportDetails report={detailDialogReport} /> : null}
        </DialogContent>
        <DialogActions>
          <button type="button" className="button medium close" onClick={() => setDetailDialogReport(null)}>
            닫기
          </button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(messageDialogReport)} onClose={() => setMessageDialogReport(null)} maxWidth="sm" fullWidth>
        <DialogTitle>메모 보내기</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2}>
            {messageDialogReport?.reportType === 'rights' &&
            (messageDialogReport.targetType === 'site' || messageDialogReport.targetType === 'board') ? (
              <p className="alert warning">
                현재까지 메모를 {messageDialogReport.messageCount.toLocaleString('ko-KR')}회 보냈습니다. 메모를 3회 이상
                보낸 뒤에도 문제가 해결되지 않으면 사이트를 차단할 수 있으며, 3회 이후에도 메시지는 계속 보낼 수
                있습니다.
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
            <TextField
              label="메모 내용"
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
              multiline
              minRows={4}
              fullWidth
            />
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
          <button type="button" className="button medium action" disabled={actionLoading} onClick={handleSendMessage}>
            보내기
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
        <DialogContent dividers>
          <Typography variant="body2">
            {siteActionDialog?.action === 'block'
              ? '진짜 사이트를 차단하시겠습니까?'
              : siteActionDialog?.action === 'unblock'
                ? '진짜 사이트 차단을 해제하시겠습니까?'
                : '진짜 사이트를 폐쇄하시겠습니까? 환불 가능한 요금제는 환불 후 취소되며, 환불할 수 없으면 다음 결제가 취소됩니다.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <button type="button" className="button" disabled={actionLoading} onClick={() => setSiteActionDialog(null)}>
            취소
          </button>
          <button
            type="button"
            className={`button ${siteActionDialog?.action === 'unblock' ? 'action' : 'danger'}`}
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
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage('')}
      />
    </Stack>
  );
}
