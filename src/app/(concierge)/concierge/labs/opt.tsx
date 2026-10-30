'use client';

import { ChangeEvent, SyntheticEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Chip,
  FormControl,
  InputAdornment,
  MenuItem,
  Pagination,
  Select,
  SelectChangeEvent,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { LABS_CATEGORIES, LABS_STATUSES, LabsStatus } from '@/lib/github/labs';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import type { LabsIssueRow } from './page';

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

const cellSx = { whiteSpace: 'nowrap' } as const;

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

  function handleCategoryTabChange(_event: React.SyntheticEvent, newValue: string) {
    setCategory(newValue);
    updateQuery({ category: newValue, page: 1 });
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

  return (
    <Stack gap={2.5}>
      <Typography variant="body2" sx={{ opacity: 0.8 }}>
        데브허브의 새로운 기능 제안이나 버그, 개선 요청을 자유롭게 남겨주세요.
      </Typography>

      <Tabs
        value={category}
        onChange={handleCategoryTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="전체 카테고리" value="" />
        {LABS_CATEGORIES.map((cat) => (
          <Tab key={cat} label={cat} value={cat} />
        ))}
      </Tabs>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select value={status} onChange={handleStatusChange} displayEmpty>
              <MenuItem value="">전체 상태</MenuItem>
              {LABS_STATUSES.map((st) => (
                <MenuItem key={st} value={st}>
                  {st}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isLoggedIn ? (
            <Chip
              label="내가 쓴 제안"
              variant={isMy ? 'filled' : 'outlined'}
              color={isMy ? 'primary' : 'default'}
              onClick={() => handleToggleMy(!isMy)}
              clickable
            />
          ) : null}

          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            총 {initialTotal}건
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1}>
          <form onSubmit={handleSearchSubmit}>
            <TextField
              size="small"
              placeholder="제목 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

          {isLoggedIn ? (
            <Anchor href="/concierge/labs/new" className="button medium action">
              <AddRoundedIcon fontSize="small" />
              <span>제안하기</span>
            </Anchor>
          ) : null}
        </Stack>
      </Stack>

      {initialError ? <ScreenState kind="error">{initialError}</ScreenState> : null}

      {!initialError && initialIssues.length === 0 ? <ScreenState>등록된 제안이 없습니다.</ScreenState> : null}

      {initialIssues.length > 0 ? (
        <div className="paper">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={cellSx}>번호</TableCell>
                <TableCell sx={cellSx}>카테고리</TableCell>
                <TableCell>제목</TableCell>
                <TableCell sx={cellSx}>상태</TableCell>
                <TableCell sx={cellSx}>작성자</TableCell>
                <TableCell sx={cellSx}>등록일</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {initialIssues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell sx={cellSx}>#{issue.github_issue_number}</TableCell>
                  <TableCell sx={cellSx}>
                    <Chip label={issue.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Anchor href={`/concierge/labs/${issue.github_issue_number}`} className="link">
                      {issue.title}
                    </Anchor>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Chip label={issue.status} size="small" color={getStatusColor(issue.status)} />
                  </TableCell>
                  <TableCell sx={cellSx}>{issue.user_name}</TableCell>
                  <TableCell sx={cellSx}>{formatTimeAgo(issue.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    </Stack>
  );
}
