'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { formatTimeAgo } from '@/lib/utils';
import styles from '@/app/header.module.sass';

type Props = {
  isMobile: boolean;
};

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

type UnreadCountResponse = {
  count?: number;
  error?: string;
};

export default function NotificationButton({ isMobile }: Props) {
  const router = useRouter();

  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const visibleItems = useMemo(() => {
    return items.slice(0, isMobile ? 5 : 20);
  }, [isMobile, items]);

  const isOpen = isMobile ? isDrawerOpen : Boolean(anchorElement);

  async function loadUnreadCount() {
    try {
      const response = await fetch('/api/notifications/unread-count', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 401) {
        setIsLoggedIn(false);
        setUnreadCount(0);
        return;
      }

      const result = (await response.json()) as UnreadCountResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '읽지 않은 알림 개수를 불러오지 못했습니다.');
      }

      setIsLoggedIn(true);
      setUnreadCount(Number(result.count ?? 0));
    } catch (unknownError) {
      console.error(unknownError);
      setUnreadCount(0);
    }
  }

  async function loadNotifications() {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const response = await fetch('/api/notifications', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 401) {
        setIsLoggedIn(false);
        setItems([]);
        return;
      }

      const result = (await response.json()) as NotificationsResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '알림을 불러오지 못했습니다.');
      }

      const nextItems = result.items ?? [];

      setIsLoggedIn(true);
      setItems(nextItems);
      setUnreadCount(nextItems.filter((item) => !item.isRead).length);
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
    void loadUnreadCount();
  }, []);

  function handleOpen(event: MouseEvent<HTMLButtonElement>) {
    if (isMobile) {
      setIsDrawerOpen(true);
    } else {
      setAnchorElement(event.currentTarget);
    }

    void loadNotifications();
  }

  function handleClose() {
    setAnchorElement(null);
    setIsDrawerOpen(false);
  }

  async function handleNotificationClick(item: NotificationItem) {
    try {
      if (!item.isRead) {
        const response = await fetch(`/api/notifications/${item.id}/read`, {
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
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  isRead: true,
                }
              : currentItem,
          ),
        );

        setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
      }

      handleClose();

      if (item.href) {
        router.push(item.href);
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '알림 읽음 처리에 실패했습니다.');
      } else {
        setErrorMessage('알림 읽음 처리에 실패했습니다.');
      }
    }
  }

  function renderContent() {
    if (isLoggedIn === false) {
      return (
        <ul>
          <li>로그인해 주세요</li>
        </ul>
      );
    }

    if (isLoading) {
      return (
        <ul>
          <li>어떤 기다림...</li>
        </ul>
      );
    }

    if (errorMessage) {
      return (
        <ul>
          <li>{errorMessage}</li>
        </ul>
      );
    }

    if (visibleItems.length === 0) {
      return (
        <ul>
          <li>새로운 알림이 없습니다.</li>
        </ul>
      );
    }

    return (
      <ul>
        {visibleItems.map((item) => (
          <li key={item.id} data-read={item.isRead}>
            <button type="button" onClick={() => void handleNotificationClick(item)}>
              <strong>{item.title}</strong>
              <span>{item.message}</span>
              <time dateTime={item.createdAt}>{formatTimeAgo(item.createdAt)}</time>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <IconButton onClick={handleOpen} aria-label="알림" aria-expanded={isOpen} className={styles['theme-mode-button']}>
        {/* <Badge badgeContent={unreadCount} color="error" max={99}></Badge> */}
        <NotificationsNoneRoundedIcon />
      </IconButton>

      {isMobile ? (
        <Drawer anchor="right" open={isDrawerOpen} onClose={handleClose} className={styles.VhiDrawer}>
          <li className={styles['VhiDrawer-header']}>
            <strong>알림</strong>
            <IconButton type="button" onClick={handleClose} aria-label="알림 닫기">
              <CloseRoundedIcon />
            </IconButton>
          </li>
          <li className={styles.notification}>{renderContent()}</li>
        </Drawer>
      ) : (
        <Menu anchorEl={anchorElement} open={Boolean(anchorElement)} onClose={handleClose} className={styles.VhiMenu}>
          {renderContent()}
        </Menu>
      )}
    </>
  );
}
