'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
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
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import EmbeddedContentHtml from '@/components/service/EmbeddedContentHtml';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import {
  getGuidelineInitialMessageCreatedAt,
  guidelineAppealMessageStatusLabels,
  type GuidelineAppealItem,
  type GuidelineAppealMessage,
} from '@/lib/reports/guidelineAppeals';
import { formatDateTimeDetail, formatTimeAgo, normalizeText } from '@/lib/utils';

type ItemsResponse = {
  items?: GuidelineAppealItem[];
  error?: string;
};

type MessagesResponse = {
  siteName?: string;
  deletionMessage?: string;
  messages?: GuidelineAppealMessage[];
  error?: string;
};

type PostImage = {
  path: string;
  url: string;
  width?: number | null;
  height?: number | null;
};

type PollOption = {
  id: number;
  label: string;
  image: PostImage | null;
};

type PollData = {
  question: string;
  endsAt: string;
  options: PollOption[];
};

type ContentResponse = {
  targetType: 'post' | 'comment';
  site: { name: string; label: string };
  board: {
    name: string;
    label: string;
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
    images: PostImage[];
    poll: PollData | null;
  };
  comment: {
    content: string | null;
  } | null;
  error?: string;
};

const cellSx = { whiteSpace: 'nowrap' } as const;

function getYoutubeId(value: string | null) {
  const normalizedValue = normalizeText(value);
  const match = normalizedValue.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match?.[1] ?? '';
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

function ContentViewer({ response }: { response: ContentResponse }) {
  const theme = useTheme();

  if (response.targetType === 'comment') {
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {response.post.summary}
        </Typography>
      ) : null}
      {response.board.type === 'feed' && response.post.content_simple ? (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {response.post.content_simple}
        </Typography>
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
            <Typography variant="subtitle2">{response.post.poll.question}</Typography>
            <Typography variant="body2">{`${formatDateTimeDetail(response.post.poll.endsAt)} 종료`}</Typography>
            <Stack component="ol" gap={1} sx={{ m: 0, pl: 3 }}>
              {response.post.poll.options.map((option) => (
                <li key={option.id}>
                  <Stack direction="row" gap={1} alignItems="center">
                    {option.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={option.image.url} alt="" style={{ width: 80, height: 80, objectFit: 'cover' }} />
                    ) : null}
                    <Typography variant="body2">{option.label}</Typography>
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

export default function Opt() {
  const theme = useTheme();
  const isDialog = useMediaQuery(theme.breakpoints.up('lg'));
  const [items, setItems] = useState<GuidelineAppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [contentItem, setContentItem] = useState<GuidelineAppealItem | null>(null);
  const [contentResponse, setContentResponse] = useState<ContentResponse | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [messageItem, setMessageItem] = useState<GuidelineAppealItem | null>(null);
  const [messageResponse, setMessageResponse] = useState<MessagesResponse | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageOpenedAt, setMessageOpenedAt] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageSaving, setMessageSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);

    const response = await fetch('/api/concierge/appeals/guidelines', { credentials: 'include' });
    const result = (await response.json().catch(() => ({
      error: '가이드라인 소명 내역 응답을 확인하지 못했습니다.',
    }))) as ItemsResponse;

    setLoading(false);

    if (!response.ok || result.error) {
      setItems([]);
      setErrorMessage(result.error ?? '가이드라인 소명 내역을 불러오지 못했습니다.');
      return;
    }

    setItems(result.items ?? []);
    setErrorMessage('');
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItems();
  }, [loadItems]);

  async function openContent(item: GuidelineAppealItem) {
    setContentItem(item);
    setContentResponse(null);
    setContentLoading(true);
    setErrorMessage('');

    const response = await fetch(`/api/concierge/appeals/content/guideline/${item.reportId}`, {
      credentials: 'include',
    });
    const result = (await response.json().catch(() => ({
      error: '콘텐츠 응답을 확인하지 못했습니다.',
    }))) as ContentResponse;

    setContentLoading(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '콘텐츠를 불러오지 못했습니다.');
      setContentItem(null);
      return;
    }

    setContentResponse(result);
  }

  function closeContent() {
    setContentItem(null);
    setContentResponse(null);
  }

  async function openMessages(item: GuidelineAppealItem) {
    setMessageItem(item);
    setMessageResponse(null);
    setMessageText('');
    setMessageOpenedAt(new Date().toISOString());
    setMessageLoading(true);
    setErrorMessage('');

    const response = await fetch(`/api/concierge/appeals/guidelines/${item.reportId}/messages`, {
      credentials: 'include',
    });
    const result = (await response.json().catch(() => ({
      error: '소명 메시지 응답을 확인하지 못했습니다.',
    }))) as MessagesResponse;

    setMessageLoading(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '소명 메시지를 불러오지 못했습니다.');
      setMessageItem(null);
      return;
    }

    setMessageResponse(result);
  }

  function closeMessages() {
    if (messageSaving) {
      return;
    }

    setMessageItem(null);
    setMessageResponse(null);
    setMessageText('');
  }

  async function sendMessage() {
    const message = messageText.trim();

    if (!messageItem || !message) {
      setErrorMessage('소명 내용을 입력해 주세요.');
      return;
    }

    setMessageSaving(true);
    setErrorMessage('');

    const response = await fetch(`/api/concierge/appeals/guidelines/${messageItem.reportId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    const result = (await response.json().catch(() => ({
      error: '소명 메시지 전송 응답을 확인하지 못했습니다.',
    }))) as MessagesResponse;

    setMessageSaving(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '소명 메시지를 보내지 못했습니다.');
      return;
    }

    setMessageResponse(result);
    setMessageText('');
    setItems((current) =>
      current.map((item) =>
        item.reportId === messageItem.reportId ? { ...item, messageStatus: 'appellant_sent' } : item,
      ),
    );
    setSnackbarMessage('소명 메시지를 보냈습니다.');
  }

  const contentBody = contentLoading ? (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
      <LoadingIndicator />
    </Stack>
  ) : contentResponse ? (
    <ContentViewer response={contentResponse} />
  ) : null;

  const messageBody = (
    <Stack gap={2}>
      {messageLoading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 220 }}>
          <LoadingIndicator />
        </Stack>
      ) : messageResponse ? (
        <>
          <MessageBubble
            senderName={messageResponse.siteName}
            createdAt={getGuidelineInitialMessageCreatedAt(messageResponse.messages ?? [], messageOpenedAt)}
            message={messageResponse.deletionMessage}
            isOwn={false}
          />

          {(messageResponse.messages ?? []).map((message) => (
            <MessageBubble
              key={message.id}
              senderName={message.senderName}
              createdAt={message.createdAt}
              message={message.message}
              isOwn={message.senderType === 'appellant'}
            />
          ))}

          <TextField
            aria-label="소명 내용"
            placeholder="소명하세요"
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
          <Typography variant="body2">가이드라인 소명내역이 없습니다.</Typography>
        </div>
      ) : (
        <div className="paper">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={cellSx}>신고 유형</TableCell>
                <TableCell sx={cellSx}>신고 대상</TableCell>
                <TableCell sx={cellSx}>신고 주소</TableCell>
                <TableCell sx={cellSx}>신고일</TableCell>
                <TableCell sx={cellSx}>신고당한 콘텐츠</TableCell>
                <TableCell sx={cellSx}>소명 메시지</TableCell>
                <TableCell sx={cellSx}>상태</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.reportId}>
                  <TableCell sx={cellSx}>{item.reportName}</TableCell>
                  <TableCell sx={cellSx}>{item.targetLabel}</TableCell>
                  <TableCell sx={cellSx}>{item.reportUrl}</TableCell>
                  <TableCell sx={cellSx}>{formatDateTimeDetail(item.reportedAt)}</TableCell>
                  <TableCell sx={cellSx}>
                    <button type="button" className="button small action" onClick={() => void openContent(item)}>
                      {item.targetType === 'post' ? '게시물 보기' : '댓글 보기'}
                    </button>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <button type="button" className="button small action" onClick={() => void openMessages(item)}>
                      메시지 보기
                    </button>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {item.messageStatus ? guidelineAppealMessageStatusLabels[item.messageStatus] : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isDialog ? (
        <Dialog open={Boolean(contentItem)} onClose={closeContent} maxWidth="lg" fullWidth className="VhiDialog">
          <DialogTitle>콘텐츠 보기</DialogTitle>
          <button type="button" className="close-button" onClick={closeContent}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>{contentBody}</DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={closeContent}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      ) : (
        <Drawer anchor="bottom" open={Boolean(contentItem)} onClose={closeContent} className="VhiDrawer-bottom">
          <h2>콘텐츠 보기</h2>
          <button type="button" className="close-button" onClick={closeContent}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            {contentBody}
            <button type="button" className="button medium cancel" onClick={closeContent}>
              닫기
            </button>
          </Stack>
        </Drawer>
      )}

      {isDialog ? (
        <Dialog open={Boolean(messageItem)} onClose={closeMessages} maxWidth="lg" fullWidth className="VhiDialog">
          <DialogTitle>소명 메시지</DialogTitle>
          <button type="button" className="close-button" onClick={closeMessages} disabled={messageSaving}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>{messageBody}</DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={closeMessages} disabled={messageSaving}>
              닫기
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void sendMessage()}
              disabled={messageSaving || messageLoading || !messageText.trim()}
            >
              보내기
            </button>
          </DialogActions>
        </Dialog>
      ) : (
        <Drawer anchor="bottom" open={Boolean(messageItem)} onClose={closeMessages} className="VhiDrawer-bottom">
          <h2>소명 메시지</h2>
          <button type="button" className="close-button" onClick={closeMessages} disabled={messageSaving}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            {messageBody}
            <Stack gap={1.5}>
              <button type="button" className="button medium cancel" onClick={closeMessages} disabled={messageSaving}>
                닫기
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void sendMessage()}
                disabled={messageSaving || messageLoading || !messageText.trim()}
              >
                보내기
              </button>
            </Stack>
          </Stack>
        </Drawer>
      )}

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2700}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message={snackbarMessage}
        onClose={() => setSnackbarMessage('')}
      />
    </Stack>
  );
}
