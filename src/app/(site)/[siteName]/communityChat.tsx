'use client';

import { useEffect, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import FaceRetouchingNaturalRoundedIcon from '@mui/icons-material/FaceRetouchingNaturalRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import {
  Avatar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { format } from 'date-fns';
import type { CommunityChatMessage } from '@/lib/service/community/communityChat';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/communityChat.module.sass';

type ChatStatus =
  | { status: 'loading' | 'hidden' | 'openable' }
  | { status: 'open'; stigmaId: string; canDelete: boolean; connectionUrl: string };

type ViewMessage = CommunityChatMessage & { state: 'sent' | 'pending' | 'hidden' };

type ConfirmState = {
  title: string;
  content: string;
  confirmLabel: string;
  isDanger: boolean;
  onConfirm: () => Promise<void>;
};

const MAX_LENGTH = 1000;
const HIDDEN_MESSAGE = '워딩 프로파일러에 의해 숨김 처리되었습니다';
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

function ConfirmPopup({
  confirm,
  isSubmitting,
  onClose,
}: {
  confirm: ConfirmState | null;
  isSubmitting: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={Boolean(confirm)}
        onClose={onClose}
        className="VhiDrawer-bottom VhiDrawer-bottom-service"
      >
        <h2>{confirm?.title}</h2>
        <button type="button" className="close-button" onClick={onClose} aria-label="닫기">
          <CloseRoundedIcon />
        </button>
        <div className="VhiDrawer-bottom-content">
          <p style={{ whiteSpace: 'pre-wrap' }}>{confirm?.content}</p>
        </div>
        <div className="drawer-dialog-actions">
          <button type="button" className="button medium close" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={confirm?.isDanger ? 'button medium danger' : 'button medium submit'}
            disabled={isSubmitting}
            onClick={() => void confirm?.onConfirm()}
          >
            {confirm?.confirmLabel}
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Dialog open={Boolean(confirm)} onClose={onClose} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
      <DialogTitle>{confirm?.title}</DialogTitle>
      <button type="button" className="close-button" onClick={onClose} aria-label="닫기">
        <CloseRoundedIcon />
      </button>
      <DialogContent>
        <DialogContentText sx={{ whiteSpace: 'pre-wrap' }}>{confirm?.content}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <button type="button" className="cancel-button" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className={confirm?.isDanger ? 'danger-button' : undefined}
          disabled={isSubmitting}
          onClick={() => void confirm?.onConfirm()}
        >
          {confirm?.confirmLabel}
        </button>
      </DialogActions>
    </Dialog>
  );
}

function mergeMessages(current: ViewMessage[], incoming: ViewMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));

  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  );
}

export default function CommunityChat({ siteName }: { siteName: string }) {
  const [chat, setChat] = useState<ChatStatus>({ status: 'loading' });
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const stickToBottomRef = useRef(true);
  const previousScrollHeightRef = useRef<number | null>(null);

  const chatApi = `/api/site/${encodeURIComponent(siteName)}/chat`;
  const connectionUrl = chat.status === 'open' ? chat.connectionUrl : null;

  useEffect(() => {
    let isActive = true;

    fetch(chatApi, { credentials: 'include' })
      .then((response) => response.json() as Promise<ChatStatus>)
      .then((result) => {
        if (isActive) setChat(result.status ? result : { status: 'hidden' });
      })
      .catch(() => {
        if (isActive) setChat({ status: 'hidden' });
      });

    return () => {
      isActive = false;
    };
  }, [chatApi]);

  useEffect(() => {
    if (!isWindowOpen || !connectionUrl) return;

    let isClosedByUser = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const socket = new WebSocket(connectionUrl);
    const pingTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send('ping');
    }, PING_INTERVAL);

    socket.addEventListener('message', (event) => {
      if (event.data === 'pong') return;

      try {
        const payload = JSON.parse(String(event.data)) as
          | { type: 'message'; message: CommunityChatMessage }
          | { type: 'delete'; id: string };

        if (payload.type === 'message') {
          setMessages((current) => mergeMessages(current, [{ ...payload.message, state: 'sent' }]));
        }

        if (payload.type === 'delete') {
          setMessages((current) => current.filter((message) => message.id !== payload.id));
        }
      } catch {
        return;
      }
    });

    socket.addEventListener('close', () => {
      if (isClosedByUser) return;

      reconnectTimer = setTimeout(() => {
        fetch(chatApi, { credentials: 'include' })
          .then((response) => response.json() as Promise<ChatStatus>)
          .then((result) => setChat(result.status ? result : { status: 'hidden' }))
          .catch(() => undefined);
      }, RECONNECT_DELAY);
    });

    return () => {
      isClosedByUser = true;
      clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket.close();
    };
  }, [chatApi, connectionUrl, isWindowOpen]);

  useEffect(() => {
    if (!isWindowOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) return;
      if (windowRef.current?.contains(target) || launcherRef.current?.contains(target)) return;
      if (target.closest('.MuiDialog-root, .MuiDrawer-root, .MuiPopover-root')) return;

      setIsWindowOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isWindowOpen]);

  useEffect(() => {
    const list = listRef.current;

    if (!list) return;

    if (previousScrollHeightRef.current !== null) {
      list.scrollTop = list.scrollHeight - previousScrollHeightRef.current;
      previousScrollHeightRef.current = null;
      return;
    }

    if (stickToBottomRef.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, isWindowOpen]);

  async function loadMessages(before?: string) {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    const response = await fetch(`${chatApi}/messages${query}`, { credentials: 'include' });
    const result = (await response.json()) as { messages?: CommunityChatMessage[]; hasMore?: boolean; error?: string };

    if (!response.ok) throw new Error(result.error ?? '메시지를 불러오지 못했습니다.');

    return {
      messages: (result.messages ?? []).map((message) => ({ ...message, state: 'sent' as const })),
      hasMore: result.hasMore === true,
    };
  }

  async function openWindow() {
    setIsWindowOpen(true);
    setIsLoadingMessages(true);
    setErrorMessage('');
    stickToBottomRef.current = true;

    try {
      const result = await loadMessages();
      setMessages((current) =>
        mergeMessages(
          current.filter((message) => message.state !== 'sent'),
          result.messages,
        ),
      );
      setHasMore(result.hasMore);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.');
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function loadOlderMessages() {
    const oldest = messages.find((message) => message.state === 'sent');

    if (!oldest || isLoadingOlder) return;

    setIsLoadingOlder(true);

    try {
      const result = await loadMessages(oldest.createdAt);
      previousScrollHeightRef.current = listRef.current?.scrollHeight ?? null;
      setMessages((current) => mergeMessages(current, result.messages));
      setHasMore(result.hasMore);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.');
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function openRoom() {
    setIsSubmitting(true);

    try {
      const response = await fetch(chatApi, { method: 'POST', credentials: 'include' });
      const result = (await response.json()) as ChatStatus & { error?: string };

      if (!response.ok || result.status !== 'open') {
        throw new Error(result.error ?? '채팅방을 개설하지 못했습니다.');
      }

      setChat(result);
      setConfirm(null);
      await openWindow();
    } catch (error) {
      setConfirm(null);
      setIsWindowOpen(true);
      setErrorMessage(error instanceof Error ? error.message : '채팅방을 개설하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLauncherClick() {
    if (chat.status === 'openable') {
      setConfirm({
        title: '단체 채팅방 개설',
        content: '커뮤니티 단체 채팅방을 오픈하시겠어요?',
        confirmLabel: '개설',
        isDanger: false,
        onConfirm: openRoom,
      });
      return;
    }

    if (isWindowOpen) {
      setIsWindowOpen(false);
      return;
    }

    void openWindow();
  }

  async function sendMessage() {
    const body = inputValue.trim();

    if (!body || chat.status !== 'open') return;

    const localId = `local-${Date.now()}`;
    const localMessage: ViewMessage = {
      id: localId,
      stigmaId: chat.stigmaId,
      authorName: '',
      authorAvatarUrl: null,
      body,
      createdAt: new Date().toISOString(),
      state: 'pending',
    };

    stickToBottomRef.current = true;
    setInputValue('');
    setErrorMessage('');
    setMessages((current) => [...current, localMessage]);

    try {
      const response = await fetch(`${chatApi}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body }),
      });
      const result = (await response.json()) as {
        status?: 'sent' | 'hidden';
        message?: CommunityChatMessage;
        error?: string;
      };

      if (!response.ok) throw new Error(result.error ?? '메시지를 보내지 못했습니다.');

      if (result.status === 'hidden') {
        setMessages((current) =>
          current.map((message) =>
            message.id === localId ? { ...message, body: HIDDEN_MESSAGE, state: 'hidden' } : message,
          ),
        );
        return;
      }

      const sentMessage = result.message;

      if (sentMessage) {
        setMessages((current) =>
          mergeMessages(
            current.filter((message) => message.id !== localId),
            [{ ...sentMessage, state: 'sent' }],
          ),
        );
      }
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== localId));
      setInputValue(body);
      setErrorMessage(error instanceof Error ? error.message : '메시지를 보내지 못했습니다.');
    }
  }

  function requestDelete(messageId: string) {
    setConfirm({
      title: '메시지 지우기',
      content: '이 메시지를 지울까요?\n지운 메시지는 되돌릴 수 없습니다.',
      confirmLabel: '지우기',
      isDanger: true,
      onConfirm: async () => {
        setIsSubmitting(true);

        try {
          const response = await fetch(`${chatApi}/messages/${messageId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          const result = (await response.json()) as { error?: string };

          if (!response.ok) throw new Error(result.error ?? '메시지를 지우지 못했습니다.');

          setMessages((current) => current.filter((message) => message.id !== messageId));
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : '메시지를 지우지 못했습니다.');
        } finally {
          setIsSubmitting(false);
          setConfirm(null);
        }
      },
    });
  }

  if (chat.status === 'loading' || chat.status === 'hidden') {
    return null;
  }

  const myStigmaId = chat.status === 'open' ? chat.stigmaId : null;
  const canDelete = chat.status === 'open' && chat.canDelete;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={`${styles.launcher} ${isWindowOpen ? '' : styles.default}`}
        onClick={handleLauncherClick}
        aria-label={isWindowOpen ? '단체 채팅 닫기' : '단체 채팅 열기'}
      >
        {isWindowOpen ? <CloseRoundedIcon /> : <FaceRetouchingNaturalRoundedIcon />}
      </button>

      {isWindowOpen ? (
        <section ref={windowRef} className={styles.window} aria-label="단체 채팅">
          <div className={styles.header}>
            <h2>단체 채팅</h2>
            <button type="button" onClick={() => setIsWindowOpen(false)} aria-label="단체 채팅 닫기">
              <CloseRoundedIcon />
            </button>
          </div>

          <div
            ref={listRef}
            className={styles.messages}
            onScroll={(event) => {
              const list = event.currentTarget;
              stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
            }}
          >
            {hasMore ? (
              <div className={styles.more}>
                <button
                  type="button"
                  className="button small cancel"
                  disabled={isLoadingOlder}
                  onClick={() => void loadOlderMessages()}
                >
                  이전 메시지 보기
                </button>
              </div>
            ) : null}

            {isLoadingMessages ? (
              <div className={styles.state}>
                <LoadingIndicator size={18} />
              </div>
            ) : null}

            {!isLoadingMessages && messages.length === 0 ? (
              <p className={styles.state}>첫 메시지를 남겨 보세요.</p>
            ) : null}

            {messages.map((message) => {
              const isMine = message.stigmaId === myStigmaId;

              return (
                <div key={message.id} className={`${styles.message} ${isMine ? styles.mine : ''}`}>
                  {isMine ? null : (
                    <Avatar
                      src={message.authorAvatarUrl || '/broken-image.jpg'}
                      alt={message.authorName}
                      sx={{ width: 32, height: 32 }}
                    />
                  )}
                  <div className={styles.body}>
                    {isMine ? null : <span className={styles.author}>{message.authorName}</span>}
                    <div className={styles.row}>
                      <div
                        className={`${styles.bubble} ${message.state === 'hidden' ? styles.hidden : ''} ${
                          message.state === 'pending' ? styles.pending : ''
                        }`}
                      >
                        {message.body}
                      </div>
                      <div className={styles.meta}>
                        {(canDelete || isMine) && message.state === 'sent' ? (
                          <button type="button" aria-label="메시지 지우기" onClick={() => requestDelete(message.id)}>
                            <DeleteOutlineRoundedIcon />
                          </button>
                        ) : null}
                        <time dateTime={message.createdAt}>{format(new Date(message.createdAt), 'HH:mm')}</time>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {errorMessage ? (
            <div className={styles.error}>
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            </div>
          ) : null}

          {chat.status === 'open' ? (
            <div className={styles.composer}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                placeholder="메시지 입력"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;

                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <IconButton
                size="small"
                aria-label="보내기"
                disabled={!inputValue.trim()}
                onClick={() => void sendMessage()}
              >
                <SendRoundedIcon />
              </IconButton>
            </div>
          ) : null}
        </section>
      ) : null}

      <ConfirmPopup confirm={confirm} isSubmitting={isSubmitting} onClose={() => setConfirm(null)} />
    </>
  );
}
