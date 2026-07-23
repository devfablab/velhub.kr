'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ko } from 'date-fns/locale';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import EmbeddedContentHtml from '@/components/service/EmbeddedContentHtml';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import ToastEditor from '@/components/editor/ToastEditor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import {
  getAppealTreatmentMessage,
  reportAppealContentRequestLabels,
  reportAppealDeletionReasonOptions,
  type AppealCenterItem,
  type ReportAppealContentRequest,
} from '@/lib/reports/appeals';
import {
  appealOpinionFields,
  appealOpinionPositionOptions,
  isAppealOpinionFieldVisible,
} from '@/lib/reports/appealOpinion';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';

type ItemsResponse = {
  items?: AppealCenterItem[];
  error?: string;
};

type PostImage = {
  path: string;
  url: string;
  width?: number | null;
  height?: number | null;
};

type ContentResponse = {
  targetType: 'post' | 'comment';
  canEdit: boolean;
  site: { name: string; label: string };
  board: {
    name: string;
    label: string;
    type: 'basic' | 'gallery' | 'youtube' | 'feed';
    markdownStatus: string | null;
  };
  post: {
    id: string;
    subject: string | null;
    summary: string | null;
    content_html: string | null;
    content_markdown: string | null;
    content_simple: string | null;
    thumbnail_image: string | null;
    thumbnail_image_url: string;
    youtube_url: string | null;
    youtube_created_at: string | null;
    images: PostImage[];
  };
  comment: {
    id: string;
    content: string | null;
  } | null;
  error?: string;
};

type ContentForm = {
  subject: string;
  summary: string;
  contentHtml: string;
  contentMarkdown: string;
  contentSimple: string;
  youtubeUrl: string;
  youtubeCreatedAt: string;
  thumbnailImage: string;
  images: PostImage[];
  commentContent: string;
};

const cellSx = { whiteSpace: 'nowrap' } as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function createContentForm(response: ContentResponse): ContentForm {
  return {
    subject: response.post.subject ?? '',
    summary: response.post.summary ?? '',
    contentHtml: response.post.content_html ?? '',
    contentMarkdown: response.post.content_markdown ?? '',
    contentSimple: response.post.content_simple ?? '',
    youtubeUrl: response.post.youtube_url ?? '',
    youtubeCreatedAt: response.post.youtube_created_at ?? '',
    thumbnailImage: response.post.thumbnail_image ?? '',
    images: Array.isArray(response.post.images) ? response.post.images : [],
    commentContent: response.comment?.content ?? '',
  };
}

function parseDateValue(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYoutubeId(value: string | null) {
  const normalizedValue = normalizeText(value);
  const match = normalizedValue.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match?.[1] ?? '';
}

function getDeletionReasonLabel(item: AppealCenterItem) {
  if (!item.appeal) {
    return '';
  }

  return (
    reportAppealDeletionReasonOptions[item.category].find((option) => option.value === item.appeal?.deletionReason)
      ?.label ?? item.appeal.deletionReason
  );
}

function ContentViewer({ response }: { response: ContentResponse }) {
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
    </Stack>
  );
}

function ContentEditor({
  response,
  form,
  setForm,
}: {
  response: ContentResponse;
  form: ContentForm;
  setForm: Dispatch<SetStateAction<ContentForm | null>>;
}) {
  const theme = useTheme();

  function update<K extends keyof ContentForm>(key: K, value: ContentForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  if (response.targetType === 'comment') {
    return (
      <Stack gap={0.5}>
        <Typography variant="subtitle2">댓글 내용</Typography>
        <TextField
          aria-label="댓글 내용"
          value={form.commentContent}
          onChange={(event) => update('commentContent', event.currentTarget.value)}
          multiline
          minRows={8}
          fullWidth
        />
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {response.board.type !== 'feed' ? (
        <Stack gap={0.5}>
          <Typography variant="subtitle2">제목</Typography>
          <TextField
            aria-label="제목"
            value={form.subject}
            onChange={(event) => update('subject', event.currentTarget.value)}
            fullWidth
          />
        </Stack>
      ) : null}
      {response.board.type === 'gallery' || response.board.type === 'youtube' ? (
        <Stack gap={0.5}>
          <Typography variant="subtitle2">{response.board.type === 'gallery' ? '부제목' : '영상 설명'}</Typography>
          <TextField
            aria-label={response.board.type === 'gallery' ? '부제목' : '영상 설명'}
            value={form.summary}
            onChange={(event) => update('summary', event.currentTarget.value)}
            multiline={response.board.type === 'youtube'}
            minRows={response.board.type === 'youtube' ? 4 : undefined}
            fullWidth
          />
        </Stack>
      ) : null}
      {response.board.type === 'youtube' ? (
        <>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">유튜브 영상 주소</Typography>
            <TextField
              aria-label="유튜브 영상 주소"
              value={form.youtubeUrl}
              onChange={(event) => update('youtubeUrl', event.currentTarget.value)}
              fullWidth
            />
          </Stack>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">유튜브 업로드 날짜</Typography>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <DatePicker
                value={parseDateValue(form.youtubeCreatedAt)}
                onChange={(value) => update('youtubeCreatedAt', formatDateValue(value))}
                format="yyyy년 MM월 dd일"
                slotProps={{ textField: { fullWidth: true, 'aria-label': '유튜브 업로드 날짜' } }}
              />
            </LocalizationProvider>
          </Stack>
        </>
      ) : null}
      {response.board.type === 'feed' ? (
        <Stack gap={0.5}>
          <Typography variant="subtitle2">내용</Typography>
          <TextField
            aria-label="내용"
            value={form.contentSimple}
            onChange={(event) => update('contentSimple', event.currentTarget.value)}
            multiline
            minRows={10}
            fullWidth
          />
        </Stack>
      ) : null}
      {response.board.type === 'basic' || response.board.type === 'gallery' ? (
        <Stack gap={0.5}>
          <Typography variant="subtitle2">내용</Typography>
          <ToastEditor
            initialValue={form.contentHtml}
            initialMarkdown={form.contentMarkdown}
            initialEditType="wysiwyg"
            themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
            markdownStatus={response.board.markdownStatus}
            hideModeSwitch
            onHtmlChange={(value) => update('contentHtml', value)}
            onMarkdownChange={(value) => update('contentMarkdown', value)}
          />
        </Stack>
      ) : null}
      {response.post.thumbnail_image_url && form.thumbnailImage ? (
        <Stack gap={1} alignItems="flex-start">
          <Typography variant="subtitle2">썸네일 이미지</Typography>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={response.post.thumbnail_image_url}
            alt=""
            style={{ maxWidth: 320, width: '100%', height: 'auto' }}
          />
          <button type="button" className="button small danger" onClick={() => update('thumbnailImage', '')}>
            썸네일 삭제
          </button>
        </Stack>
      ) : null}
      {form.images.map((image) => (
        <Stack key={image.path} gap={1} alignItems="flex-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" style={{ maxWidth: 320, width: '100%', height: 'auto' }} />
          <button
            type="button"
            className="button small danger"
            onClick={() =>
              update(
                'images',
                form.images.filter((item) => item.path !== image.path),
              )
            }
          >
            이미지 삭제
          </button>
        </Stack>
      ))}
    </Stack>
  );
}

export default function Opt() {
  const theme = useTheme();
  const isDialog = useMediaQuery(theme.breakpoints.up('lg'));
  const [items, setItems] = useState<AppealCenterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [opinionItem, setOpinionItem] = useState<AppealCenterItem | null>(null);
  const [opinionPosition, setOpinionPosition] = useState('');
  const [disputedParts, setDisputedParts] = useState('');
  const [opinionValues, setOpinionValues] = useState<Record<string, string>>({});
  const [contentRequest, setContentRequest] = useState<ReportAppealContentRequest | ''>('');
  const [modificationContent, setModificationContent] = useState('');
  const [opinionFile, setOpinionFile] = useState<File | null>(null);
  const [contentItem, setContentItem] = useState<AppealCenterItem | null>(null);
  const [contentResponse, setContentResponse] = useState<ContentResponse | null>(null);
  const [contentForm, setContentForm] = useState<ContentForm | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/concierge/appeals', { credentials: 'include' });
      const result = (await response
        .json()
        .catch(() => ({ error: '소명 내역 응답을 확인하지 못했습니다.' }))) as ItemsResponse;

      if (!response.ok || result.error) {
        setItems([]);
        setErrorMessage(result.error ?? '소명 내역을 불러오지 못했습니다.');
        return;
      }

      setItems(result.items ?? []);
      setErrorMessage('');
    } catch {
      setItems([]);
      setErrorMessage('소명 내역을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const visibleOpinionFields = useMemo(() => {
    if (!opinionItem) {
      return [];
    }

    return appealOpinionFields[opinionItem.category].filter((field) =>
      isAppealOpinionFieldVisible(field, opinionValues, opinionItem.opinionContext),
    );
  }, [opinionItem, opinionValues]);

  function openOpinion(item: AppealCenterItem) {
    setOpinionItem(item);
    setOpinionPosition('');
    setDisputedParts('');
    setOpinionValues({});
    setContentRequest('');
    setModificationContent('');
    setOpinionFile(null);
  }

  function closeOpinion() {
    setOpinionItem(null);
    setOpinionFile(null);
  }

  async function submitOpinion() {
    if (!opinionItem?.appeal) {
      return;
    }

    if (!opinionPosition || !disputedParts.trim()) {
      setErrorMessage('소명 입장과 인정하거나 이의를 제기하는 부분을 입력해 주세요.');
      return;
    }

    const missingField = visibleOpinionFields.find((field) => !normalizeText(opinionValues[field.key]));

    if (missingField) {
      setErrorMessage(`${missingField.label} 항목을 입력해 주세요.`);
      return;
    }

    if (!contentRequest) {
      setErrorMessage('게시물·댓글 처리 요청을 선택해 주세요.');
      return;
    }

    if (contentRequest === 'edit_and_review' && !modificationContent.trim()) {
      setErrorMessage('수정 예정 내용을 입력해 주세요.');
      return;
    }

    if (!opinionFile) {
      setErrorMessage('첨부자료 PDF를 선택해 주세요.');
      return;
    }

    if (opinionFile.type !== 'application/pdf' || !opinionFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('첨부자료는 PDF 파일만 등록할 수 있습니다.');
      return;
    }

    if (opinionFile.size >= MAX_FILE_SIZE) {
      setErrorMessage('첨부자료는 10MB 미만의 PDF 파일만 등록할 수 있습니다.');
      return;
    }

    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.set('opinionPosition', opinionPosition);
      formData.set('disputedParts', disputedParts.trim());
      formData.set('opinionData', JSON.stringify(opinionValues));
      formData.set('contentRequest', contentRequest);
      formData.set('modificationContent', modificationContent.trim());
      formData.set('file', opinionFile);
      const response = await fetch(`/api/concierge/appeals/${opinionItem.appeal.id}/opinion`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = (await response.json().catch(() => ({ error: '소명 의견서 응답을 확인하지 못했습니다.' }))) as {
        error?: string;
      };

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '소명 의견서를 제출하지 못했습니다.');
        return;
      }

      closeOpinion();
      setSnackbarMessage('소명 의견서를 제출했습니다.');
      await loadItems();
    } catch {
      setErrorMessage('소명 의견서를 제출하지 못했습니다.');
    } finally {
      setActionLoading(false);
    }
  }

  async function openContent(item: AppealCenterItem) {
    setContentItem(item);
    setContentResponse(null);
    setContentForm(null);
    setContentLoading(true);

    try {
      const response = await fetch(`/api/concierge/appeals/content/${item.reportType}/${item.reportId}`, {
        credentials: 'include',
      });
      const result = (await response
        .json()
        .catch(() => ({ error: '콘텐츠 응답을 확인하지 못했습니다.' }))) as ContentResponse;

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '콘텐츠를 불러오지 못했습니다.');
        return;
      }

      setContentResponse(result);
      setContentForm(createContentForm(result));
    } catch {
      setErrorMessage('콘텐츠를 불러오지 못했습니다.');
    } finally {
      setContentLoading(false);
    }
  }

  function closeContent() {
    setContentItem(null);
    setContentResponse(null);
    setContentForm(null);
  }

  async function saveContent() {
    if (!contentItem || !contentResponse || !contentForm || !contentResponse.canEdit) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`/api/concierge/appeals/content/${contentItem.reportType}/${contentItem.reportId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentForm),
      });
      const result = (await response.json().catch(() => ({ error: '수정 응답을 확인하지 못했습니다.' }))) as {
        error?: string;
      };

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '콘텐츠를 수정하지 못했습니다.');
        return;
      }

      setSnackbarMessage('콘텐츠를 수정했습니다.');
      closeContent();
      await loadItems();
    } catch {
      setErrorMessage('콘텐츠를 수정하지 못했습니다.');
    } finally {
      setActionLoading(false);
    }
  }

  async function requestEditReview(item: AppealCenterItem) {
    if (!window.confirm('수정을 완료하고 데브허브 컨시어지팀에 확인을 요청하시겠습니까?')) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`/api/concierge/appeals/content/${item.reportType}/${item.reportId}`, {
        method: 'POST',
        credentials: 'include',
      });
      const result = (await response.json().catch(() => ({ error: '수정 확인 요청 응답을 확인하지 못했습니다.' }))) as {
        error?: string;
      };

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '수정 확인을 요청하지 못했습니다.');
        return;
      }

      setSnackbarMessage('수정 확인을 요청했습니다.');
      closeContent();
      await loadItems();
    } catch {
      setErrorMessage('수정 확인을 요청하지 못했습니다.');
    } finally {
      setActionLoading(false);
    }
  }

  const contentBody = contentLoading ? (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
      <LoadingIndicator />
    </Stack>
  ) : contentResponse && contentForm ? (
    contentResponse.canEdit ? (
      <ContentEditor response={contentResponse} form={contentForm} setForm={setContentForm} />
    ) : (
      <ContentViewer response={contentResponse} />
    )
  ) : null;

  return (
    <Stack gap={2}>
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
      ) : items.length === 0 ? (
        <div className="paper">
          <Typography>소명내역이 없습니다.</Typography>
        </div>
      ) : (
        <div className="paper">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={cellSx}>신고 유형</TableCell>
                <TableCell sx={cellSx}>신고 대상</TableCell>
                <TableCell sx={cellSx}>신고 주소</TableCell>
                <TableCell sx={cellSx}>처리 상태</TableCell>
                <TableCell sx={cellSx}>소명 상태</TableCell>
                <TableCell sx={cellSx}>신고일</TableCell>
                <TableCell sx={cellSx}>소명 제출 기한</TableCell>
                <TableCell sx={cellSx}>소명 의견서</TableCell>
                <TableCell sx={cellSx}>콘텐츠</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={`${item.reportType}-${item.reportId}`}>
                  <TableCell sx={cellSx}>{item.reportName}</TableCell>
                  <TableCell sx={cellSx}>{item.targetType === 'post' ? item.postTitle : '댓글'}</TableCell>
                  <TableCell sx={cellSx}>{item.reportUrl}</TableCell>
                  <TableCell sx={cellSx}>{item.adminStatusLabel}</TableCell>
                  <TableCell sx={cellSx}>{item.appellantStatusLabel}</TableCell>
                  <TableCell sx={cellSx}>{formatDateTimeDetail(item.reportedAt)}</TableCell>
                  <TableCell sx={cellSx}>{`${item.deadlineStartedOn} ~ ${item.deadlineEndedOn}`}</TableCell>
                  <TableCell sx={cellSx}>
                    {item.canSubmitOpinion ? (
                      <button type="button" className="button small action" onClick={() => openOpinion(item)}>
                        소명 의견서 작성
                      </button>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Stack direction="row" gap={1}>
                      <button type="button" className="button small" onClick={() => void openContent(item)}>
                        {item.targetType === 'post' ? '게시물 보기' : '댓글 보기'}
                      </button>
                      {item.canRequestEditReview ? (
                        <button
                          type="button"
                          className="button small action"
                          disabled={actionLoading}
                          onClick={() => void requestEditReview(item)}
                        >
                          수정 확인 요청
                        </button>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(opinionItem)} onClose={closeOpinion} maxWidth="lg" fullWidth className="VhiDialog">
        <DialogTitle>소명 의견서 제출</DialogTitle>
        <button className="close-button" onClick={closeOpinion}>
          <CloseRoundedIcon />
        </button>
        <DialogContent>
          {opinionItem?.appeal ? (
            <Stack gap={2}>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">신고 대상 URL</Typography>
                <Typography sx={{ wordBreak: 'break-all' }}>{opinionItem.reportUrl}</Typography>
              </Stack>
              {opinionItem.targetType === 'comment' ? (
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">댓글 내용</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {opinionItem.commentContent}
                  </Typography>
                </Stack>
              ) : null}
              {opinionItem.reportDetails.map((detail) => (
                <Stack key={detail.label} gap={0.5}>
                  <Typography variant="subtitle2">{detail.label}</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detail.value}</Typography>
                </Stack>
              ))}
              <Stack gap={0.5}>
                <Typography variant="subtitle2">처리 내용 및 사유</Typography>
                <Typography>
                  {getAppealTreatmentMessage({
                    category: opinionItem.category,
                    deletionReason: opinionItem.appeal.deletionReason,
                    targetType: opinionItem.targetType,
                  })}
                </Typography>
              </Stack>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">제출 자료 요지</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {opinionItem.appeal.submissionSummary}
                </Typography>
              </Stack>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">삭제 사유</Typography>
                <Typography>{getDeletionReasonLabel(opinionItem)}</Typography>
              </Stack>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">소명 요청사항</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {opinionItem.appeal.appealRequest}
                </Typography>
              </Stack>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">소명 제출 기한</Typography>
                <Typography>{`${opinionItem.deadlineStartedOn}부터 ${opinionItem.deadlineEndedOn}까지`}</Typography>
              </Stack>
              <FormControl fullWidth required>
                <Select
                  displayEmpty
                  value={opinionPosition}
                  onChange={(event) => setOpinionPosition(event.target.value)}
                >
                  <MenuItem value="" disabled>
                    소명 입장 선택
                  </MenuItem>
                  {appealOpinionPositionOptions[opinionItem.category].map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">인정하거나 이의를 제기하는 부분 *</Typography>
                <TextField
                  aria-label="인정하거나 이의를 제기하는 부분"
                  value={disputedParts}
                  onChange={(event) => setDisputedParts(event.currentTarget.value)}
                  multiline
                  minRows={4}
                  fullWidth
                  required
                />
              </Stack>
              {visibleOpinionFields.map((field) =>
                field.type === 'select' ? (
                  <FormControl key={field.key} fullWidth required>
                    <Select
                      displayEmpty
                      value={opinionValues[field.key] ?? ''}
                      onChange={(event) =>
                        setOpinionValues((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                    >
                      <MenuItem value="" disabled>{`${field.label} 선택`}</MenuItem>
                      {field.options?.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <Typography variant="caption">{field.helperText}</Typography>
                  </FormControl>
                ) : (
                  <Stack key={field.key} gap={0.5}>
                    <Typography variant="subtitle2">{field.label} *</Typography>
                    <TextField
                      aria-label={field.label}
                      helperText={field.helperText}
                      value={opinionValues[field.key] ?? ''}
                      onChange={(event) =>
                        setOpinionValues((current) => ({ ...current, [field.key]: event.currentTarget.value }))
                      }
                      multiline
                      minRows={4}
                      fullWidth
                      required
                    />
                  </Stack>
                ),
              )}
              <FormControl fullWidth required>
                <Select
                  displayEmpty
                  value={contentRequest}
                  onChange={(event) => setContentRequest(event.target.value as ReportAppealContentRequest)}
                >
                  <MenuItem value="" disabled>
                    게시물·댓글 처리 요청 선택
                  </MenuItem>
                  {Object.entries(reportAppealContentRequestLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {contentRequest === 'edit_and_review' ? (
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">수정 예정 내용 *</Typography>
                  <TextField
                    aria-label="수정 예정 내용"
                    value={modificationContent}
                    onChange={(event) => setModificationContent(event.currentTarget.value)}
                    multiline
                    minRows={4}
                    fullWidth
                    required
                  />
                </Stack>
              ) : null}
              <Stack gap={0.5}>
                <Typography variant="subtitle2">첨부자료</Typography>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setOpinionFile(event.currentTarget.files?.[0] ?? null)}
                />
                <Typography variant="caption">10MB 미만의 PDF 파일 1개만 첨부할 수 있습니다.</Typography>
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <button type="button" className="button medium close" disabled={actionLoading} onClick={closeOpinion}>
            취소
          </button>
          <button type="button" className="button medium submit" disabled={actionLoading} onClick={submitOpinion}>
            제출
          </button>
        </DialogActions>
      </Dialog>

      {isDialog ? (
        <Dialog open={Boolean(contentItem)} onClose={closeContent} maxWidth="lg" fullWidth className="VhiDialog">
          <DialogTitle>{contentResponse?.canEdit ? '콘텐츠 수정' : '콘텐츠 보기'}</DialogTitle>
          <button className="close-button" onClick={closeContent}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>{contentBody}</DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" disabled={actionLoading} onClick={closeContent}>
              닫기
            </button>
            {contentResponse?.canEdit ? (
              <button type="button" className="button medium submit" disabled={actionLoading} onClick={saveContent}>
                수정 저장
              </button>
            ) : null}
            {contentItem?.canRequestEditReview ? (
              <button
                type="button"
                className="button medium submit"
                disabled={actionLoading}
                onClick={() => requestEditReview(contentItem)}
              >
                수정 확인 요청
              </button>
            ) : null}
          </DialogActions>
        </Dialog>
      ) : (
        <Drawer anchor="bottom" open={Boolean(contentItem)} onClose={closeContent} className="VhiDrawer-bottom">
          <h2>{contentResponse?.canEdit ? '콘텐츠 수정' : '콘텐츠 보기'}</h2>
          <button type="button" className="close-button" onClick={closeContent} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            {contentBody}
            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium close" disabled={actionLoading} onClick={closeContent}>
                닫기
              </button>
              {contentResponse?.canEdit ? (
                <button type="button" className="button medium submit" disabled={actionLoading} onClick={saveContent}>
                  수정 저장
                </button>
              ) : null}
              {contentItem?.canRequestEditReview ? (
                <button
                  type="button"
                  className="button medium submit"
                  disabled={actionLoading}
                  onClick={() => requestEditReview(contentItem)}
                >
                  수정 확인 요청
                </button>
              ) : null}
            </Stack>
          </Stack>
        </Drawer>
      )}

      <Snackbar
        open={Boolean(snackbarMessage)}
        message={snackbarMessage}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage('')}
      />
    </Stack>
  );
}
