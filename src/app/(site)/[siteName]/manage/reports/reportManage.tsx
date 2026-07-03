'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { ReportManageTargetType, ReportStatus } from '@/lib/reports/manage';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/manage.module.sass';

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
  createdAt: string;
  handledAt: string | null;
  reporterName: string;
  handlerName: string | null;
  reportCategory: string;
  reportCategoryLabel: string;
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

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR');
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

  const statusOptions = useMemo(() => getStatusOptions(targetType), [targetType]);

  async function loadReports() {
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
  }

  useEffect(() => {
    if (!siteName) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReports();
  }, [siteName, targetType, showPast]);

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
          <Typography variant="body2">{statusLabels[selectedReport.status]}</Typography>
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
          <Typography variant="h6">신고 괸리 내역</Typography>
          <Box>
            <Typography variant="subtitle2">처리자</Typography>
            <Typography variant="body2">{selectedReport.handlerName ?? '-'}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">처리일</Typography>
            <Typography variant="body2">{formatDate(selectedReport.handledAt)}</Typography>
          </Box>
        </Stack>
      ) : (
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{statusLabels[report.status]}</TableCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{statusLabels[report.status]}</TableCell>
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
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{statusLabels[report.status]}</TableCell>
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

                {!showPast ? (
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

              {!showPast ? (
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
      </div>
    </div>
  );
}
