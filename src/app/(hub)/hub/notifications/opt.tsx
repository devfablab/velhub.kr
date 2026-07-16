'use client';

import { useEffect, useState } from 'react';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type NotificationItem = {
  id: string;
  createdAt: string;
  notificationType: string;
  title: string;
  message: string;
  href: string | null;
  isRead: boolean;
};

type NotificationsResponse = {
  items?: NotificationItem[];
  error?: string;
};

export default function Opt() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isReadingAll, setIsReadingAll] = useState(false);

  async function loadNotifications() {
    try {
      setErrorMessage('');

      const response = await fetch('/api/notifications', {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as NotificationsResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '알림을 불러오지 못했습니다.');
      }

      setItems(result.items ?? []);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '알림을 불러오지 못했습니다.');
      } else {
        setErrorMessage('알림을 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function markNotificationAsRead(notificationId: string) {
    const targetItem = items.find((item) => item.id === notificationId);

    if (!targetItem || targetItem.isRead) {
      return;
    }

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? '알림 읽음 처리에 실패했습니다.');
      }

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                isRead: true,
              }
            : item,
        ),
      );
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '알림 읽음 처리에 실패했습니다.');
      } else {
        setErrorMessage('알림 읽음 처리에 실패했습니다.');
      }
    }
  }

  async function handleReadAll() {
    if (isReadingAll || !items.some((item) => !item.isRead)) {
      return;
    }

    try {
      setErrorMessage('');
      setIsReadingAll(true);

      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? '전체 알림 읽음 처리에 실패했습니다.');
      }

      setItems((currentItems) =>
        currentItems.map((item) => ({
          ...item,
          isRead: true,
        })),
      );
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '전체 알림 읽음 처리에 실패했습니다.');
      } else {
        setErrorMessage('전체 알림 읽음 처리에 실패했습니다.');
      }
    } finally {
      setIsReadingAll(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper}`}>
      <div className={styles.headline}>
        <h2>알림</h2>
        <button
          type="button"
          onClick={handleReadAll}
          disabled={isReadingAll || !items.some((item) => !item.isRead)}
          className="button small action"
        >
          모두 읽음
        </button>
      </div>

      {errorMessage ? <p className="alert error">{errorMessage}</p> : null}

      {items.length === 0 ? (
        <p>새로운 알림이 없습니다.</p>
      ) : (
        <ul className={styles.notifications}>
          {items.map((item) => (
            <li
              key={item.id}
              data-read={item.isRead}
              className={`paper ${styles['notification-item']} ${item.isRead ? styles['read-notification'] : ''}`}
            >
              {item.href ? (
                <Anchor href={item.href} onClick={() => void markNotificationAsRead(item.id)}>
                  <strong>{item.title}</strong>
                  <div>
                    <p>{item.message}</p>
                    <time dateTime={item.createdAt}>{formatTimeAgo(item.createdAt)}</time>
                  </div>
                </Anchor>
              ) : (
                <button type="button" onClick={() => void markNotificationAsRead(item.id)}>
                  <strong>{item.title}</strong>
                  <div>
                    <p>{item.message}</p>
                    <time dateTime={item.createdAt}>{formatTimeAgo(item.createdAt)}</time>
                  </div>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
