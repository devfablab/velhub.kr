/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { ChangeEvent, SyntheticEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdjustRoundedIcon from '@mui/icons-material/AdjustRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import {
  Chip,
  FormControl,
  InputAdornment,
  MenuItem,
  Pagination,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
} from '@mui/material';
import { LABS_CATEGORIES, LABS_STATUSES, LabsStatus } from '@/lib/github/labs';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import type { LabsIssueRow } from './page';
import styles from '@/app/concierge.module.sass';

type Props = {
  initialIssues: LabsIssueRow[];
  initialTotal: number;
  initialPage: number;
  initialTotalPages: number;
  initialCategory: string;
  initialStatus: string;
  initialSearch: string;
  initialIsMy: boolean;
  isLoggedIn: boolean;
  initialError: string | null;
};

type TabMenuItem = {
  href: string;
  label: string;
  category?: string;
  startsWith?: boolean;
};

function isCurrentTab(currentCategory: string, item: TabMenuItem) {
  if (item.category !== undefined) {
    return (item.category ?? '') === currentCategory;
  }

  if (item.startsWith) {
    return currentCategory === item.href || currentCategory.startsWith(`${item.href}/`);
  }

  return currentCategory === item.href;
}

export function getStatusColor(status: LabsStatus): 'default' | 'warning' | 'info' | 'success' | 'error' {
  switch (status) {
    case '미확인':
      return 'default';
    case '검토 중':
      return 'warning';
    case '진행 중':
      return 'info';
    case '반영 완료':
      return 'success';
    case '반려됨':
      return 'error';
    default:
      return 'default';
  }
}

export default function Opt({
  initialIssues,
  initialTotal,
  initialPage,
  initialTotalPages,
  initialCategory,
  initialStatus,
  initialSearch,
  initialIsMy,
  isLoggedIn,
  initialError,
}: Props) {
  const router = useRouter();

  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [isMy, setIsMy] = useState(initialIsMy);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setIsMy(initialIsMy);
  }, [initialIsMy]);

  function updateQuery(nextParams: {
    category?: string;
    status?: string;
    search?: string;
    isMy?: boolean;
    page?: number;
  }) {
    const params = new URLSearchParams();

    const nextCategory = nextParams.category !== undefined ? nextParams.category : category;
    const nextStatus = nextParams.status !== undefined ? nextParams.status : status;
    const nextSearch = nextParams.search !== undefined ? nextParams.search : search;
    const nextIsMy = nextParams.isMy !== undefined ? nextParams.isMy : isMy;
    const nextPage = nextParams.page !== undefined ? nextParams.page : 1;

    if (nextCategory) params.set('category', nextCategory);
    if (nextStatus) params.set('status', nextStatus);
    if (nextSearch) params.set('search', nextSearch);
    if (nextIsMy) params.set('my', 'true');
    if (nextPage > 1) params.set('page', String(nextPage));

    const queryString = params.toString();
    router.push(`/concierge/labs${queryString ? `?${queryString}` : ''}`);
  }

  function handleStatusChange(event: SelectChangeEvent<string>) {
    const nextStatus = event.target.value;
    setStatus(nextStatus);
    updateQuery({ status: nextStatus, page: 1 });
  }

  function handleSearchSubmit(event: SyntheticEvent) {
    event.preventDefault();
    updateQuery({ search, page: 1 });
  }

  function handleToggleMy(myValue: boolean) {
    setIsMy(myValue);
    updateQuery({ isMy: myValue, page: 1 });
  }

  function handlePageChange(_event: ChangeEvent<unknown>, newPage: number) {
    updateQuery({ page: newPage });
  }

  function getCategoryHref(targetCategory?: string) {
    const params = new URLSearchParams();
    if (targetCategory) params.set('category', targetCategory);
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (isMy) params.set('my', 'true');
    const queryString = params.toString();
    return `/concierge/labs${queryString ? `?${queryString}` : ''}`;
  }

  const tabMenuItems: TabMenuItem[] = [
    {
      href: getCategoryHref(),
      label: '전체 카테고리',
      category: '',
    },
    ...LABS_CATEGORIES.map((categoryItem) => ({
      href: getCategoryHref(categoryItem),
      label: categoryItem,
      category: categoryItem,
    })),
  ];

  return (
    <div className={styles.labs}>
      <div className={styles.tabs}>
        <ul className="content">
          {tabMenuItems.map((item) => {
            const isCurrent = isCurrentTab(category, item);
            return (
              <li
                key={item.href}
                className={isCurrent ? styles.current : undefined}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <Anchor href={item.href}>{item.label}</Anchor>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.headline}>
        <h1>기능 연구소</h1>
        <p>데브허브의 새로운 기능 제안이나 버그, 개선 요청을 자유롭게 남겨주세요.</p>
      </div>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <div className={styles.actions}>
          {isLoggedIn ? (
            <Anchor href="/concierge/labs/new" className="button medium submit">
              <span>제안하기</span>
            </Anchor>
          ) : null}
          <span>총 {initialTotal}건</span>
          {isLoggedIn ? (
            <Chip
              label="내 제안 보기"
              size="small"
              className={`chip ${isMy ? 'success' : 'default outlined'}`}
              onClick={() => handleToggleMy(!isMy)}
              clickable
            />
          ) : null}
        </div>

        <Stack direction="row" alignItems="center" gap={1}>
          <FormControl size="small">
            <Select value={status} onChange={handleStatusChange} displayEmpty size="small">
              <MenuItem value="">전체 상태</MenuItem>
              {LABS_STATUSES.map((statusItem) => (
                <MenuItem key={statusItem} value={statusItem}>
                  {statusItem}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <form onSubmit={handleSearchSubmit}>
            <TextField
              size="small"
              placeholder="제목 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchRoundedIcon fontSize="small" sx={{ opacity: 0.6 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </form>
        </Stack>
      </Stack>

      {initialError ? <ScreenState kind="error">{initialError}</ScreenState> : null}

      {!initialError && initialIssues.length === 0 ? <ScreenState>등록된 제안이 없습니다.</ScreenState> : null}

      {initialIssues.length > 0 ? (
        <div className={`paper ${styles.issues}`}>
          {initialIssues.map((issue) => {
            const isClosed = issue.status === '반영 완료' || issue.status === '반려됨';
            const isReopened =
              !isClosed &&
              Math.abs(new Date(issue.updated_at).getTime() - new Date(issue.created_at).getTime()) > 1000;
            return (
              <div className={styles['issue-item']} key={issue.id}>
                <div className={`${styles.status} ${isClosed ? styles['status-closed'] : styles['status-open']}`}>
                  {isClosed ? <TaskAltRoundedIcon /> : <AdjustRoundedIcon />}
                </div>
                <div className={styles.summary}>
                  <div className={styles.link}>
                    <Anchor href={`/concierge/labs/${issue.github_issue_number}`} className="link">
                      {issue.title}
                    </Anchor>
                    <div className={styles.chips}>
                      <Chip label={issue.status} size="small" className="chip outlined warning" />
                      <Chip label={issue.category} size="small" className="chip outlined success" />
                    </div>
                  </div>
                  <div className={styles.info}>
                    <span>{issue.user_name}</span> ·{' '}
                    {isClosed ? (
                      <time>{formatTimeAgo(issue.updated_at)}에 닫힘</time>
                    ) : isReopened ? (
                      <time>{formatTimeAgo(issue.updated_at)}에 다시 열림</time>
                    ) : (
                      <time>{formatTimeAgo(issue.created_at)}에 등록됨</time>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {initialTotalPages > 1 ? (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination
            count={initialTotalPages}
            page={initialPage}
            onChange={handlePageChange}
            color="primary"
            size="medium"
          />
        </Stack>
      ) : null}
    </div>
  );
}
