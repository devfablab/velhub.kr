'use client';

import { useEffect, useRef, useState } from 'react';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { Avatar, IconButton, TextField } from '@mui/material';
import { format } from 'date-fns';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/communityChat.module.sass';

type ChatMessage = {
  id: string;
  senderId: string | null;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  isDeleted: boolean;
  createdAt: string;
};

type MessagesResponse = {
  myId?: string;
  connectionUrl?: string;
  messages?: ChatMessage[];
  hasMore?: boolean;
  error?: string;
};

const MAX_LENGTH = 1000;
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;
const DELETED_MESSAGE = '삭제된 메시지입니다';

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));

  for (const message of incoming) byId.set(message.id, message);

  return [...byId.values()].sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  );
}

export default function CoPostChat({ coPostId, onSent }: { coPostId: string; onSent?: () => void }) {
  const [myId, setMyId] = useState('');
  const [connectionUrl, setConnectionUrl] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [reconnectKey, setReconnectKey] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const previousScrollHeightRef = useRef<number | null>(null);
  const messagesApi = `/api/co-posts/${coPostId}/messages`;

  async function loadMessages(before?: string) {
    const response = await fetch(`${messagesApi}${before ? `?before=${encodeURIComponent(before)}` : ''}`, {
      credentials: 'include',
    });
    const result = (await response.json()) as MessagesResponse;

    if (!response.ok) throw new Error(result.error ?? '메시지를 불러오지 못했습니다.');

    return result;
  }

  useEffect(() => {
    let isActive = true;

    fetch(messagesApi, { credentials: 'include' })
      .then(async (response) => {
        const result = (await response.json()) as MessagesResponse;

        if (!response.ok) throw new Error(result.error ?? '메시지를 불러오지 못했습니다.');

        return result;
      })
      .then((result) => {
        if (!isActive) return;

        setMyId(result.myId ?? '');
        setConnectionUrl(result.connectionUrl ?? '');
        setMessages((current) => mergeMessages(current, result.messages ?? []));
        setHasMore(result.hasMore === true);
      })
      .catch((error: unknown) => {
        if (isActive) setErrorMessage(error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [messagesApi]);

  async function loadOlder() {
    const oldest = messages[0];

    if (!oldest) return;

    try {
      const result = await loadMessages(oldest.createdAt);
      previousScrollHeightRef.current = listRef.current?.scrollHeight ?? null;
      setMessages((current) => mergeMessages(current, result.messages ?? []));
      setHasMore(result.hasMore === true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.');
    }
  }

  useEffect(() => {
    if (!connectionUrl) return;

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
          | { type: 'message'; message: ChatMessage }
          | { type: 'deleted'; id: string };

        if (payload.type === 'message') {
          setMessages((current) => mergeMessages(current, [payload.message]));
        }

        if (payload.type === 'deleted') {
          setMessages((current) =>
            current.map((message) => (message.id === payload.id ? { ...message, body: '', isDeleted: true } : message)),
          );
        }
      } catch {
        return;
      }
    });

    socket.addEventListener('close', () => {
      if (isClosedByUser) return;

      reconnectTimer = setTimeout(() => {
        loadMessages()
          .then((result) => {
            setConnectionUrl(result.connectionUrl ?? '');
            setMessages((current) => mergeMessages(current, result.messages ?? []));
            setReconnectKey((value) => value + 1);
          })
          .catch(() => undefined);
      }, RECONNECT_DELAY);
    });

    return () => {
      isClosedByUser = true;
      clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket.close();
    };
  }, [connectionUrl, reconnectKey]);

  useEffect(() => {
    const list = listRef.current;

    if (!list) return;

    if (previousScrollHeightRef.current !== null) {
      list.scrollTop = list.scrollHeight - previousScrollHeightRef.current;
      previousScrollHeightRef.current = null;
      return;
    }

    if (stickToBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  async function sendMessage() {
    const body = inputValue.trim();

    if (!body || isSending) return;

    setIsSending(true);
    setErrorMessage('');
    stickToBottomRef.current = true;

    try {
      const response = await fetch(messagesApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body }),
      });
      const result = (await response.json()) as { message?: ChatMessage; error?: string };

      if (!response.ok || !result.message) throw new Error(result.error ?? '메시지를 보내지 못했습니다.');

      const sentMessage = result.message;
      setInputValue('');
      setMessages((current) => mergeMessages(current, [sentMessage]));
      onSent?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '메시지를 보내지 못했습니다.');
    } finally {
      setIsSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    try {
      const response = await fetch(`${messagesApi}/${messageId}`, { method: 'DELETE', credentials: 'include' });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(result.error ?? '메시지를 지우지 못했습니다.');

      setMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, body: '', isDeleted: true } : message)),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '메시지를 지우지 못했습니다.');
    }
  }

  return (
    <section className={`${styles.window} ${styles.inline}`} aria-label="공동 집필 채팅">
      <div className={styles.header}>
        <h2>공동 집필 채팅</h2>
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
            <button type="button" className="button small cancel" onClick={() => void loadOlder()}>
              이전 메시지 보기
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className={styles.state}>
            <LoadingIndicator size={18} />
          </div>
        ) : null}

        {!isLoading && messages.length === 0 ? <p className={styles.state}>첫 메시지를 남겨 보세요.</p> : null}

        {messages.map((message) => {
          const isMine = message.senderId === myId;

          return (
            <div key={message.id} className={`${styles.message} ${isMine ? styles.mine : ''}`}>
              {isMine ? null : (
                <Avatar
                  src={message.senderAvatarUrl || '/broken-image.jpg'}
                  alt={message.senderName}
                  sx={{ width: 32, height: 32 }}
                />
              )}
              <div className={styles.body}>
                {isMine ? null : <span className={styles.author}>{message.senderName}</span>}
                <div className={styles.row}>
                  <div className={`${styles.bubble} ${message.isDeleted ? styles.deleted : ''}`}>
                    {message.isDeleted ? DELETED_MESSAGE : message.body}
                  </div>
                  <div className={styles.meta}>
                    {isMine && !message.isDeleted ? (
                      <button type="button" aria-label="메시지 지우기" onClick={() => void deleteMessage(message.id)}>
                        <DeleteOutlineRoundedIcon />
                      </button>
                    ) : null}
                    <time dateTime={message.createdAt}>{format(new Date(message.createdAt), 'M/d HH:mm')}</time>
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
          disabled={!inputValue.trim() || isSending}
          onClick={() => void sendMessage()}
        >
          <SendRoundedIcon />
        </IconButton>
      </div>
    </section>
  );
}
