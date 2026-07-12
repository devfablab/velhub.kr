'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/payments.module.sass';

type RevenueListType = 'transactions' | 'refunds' | 'scheduled' | 'confirmed' | 'completed';
type RevenueRangeType = 'all' | 'year' | 'quarter' | 'half' | 'custom';

type RevenueListItem = {
  id: string;
  buyerName: string | null;
  buyerEmail: string | null;
  boardName: string | null;
  seriesName: string | null;
  postTitle: string | null;
  paymentType: string | null;
  status: string | null;
  paymentAmount: number;
  refundAmount: number;
  paidAt: string | null;
  refundedAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
};

type RevenueListResponse = {
  items: RevenueListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    years: number[];
    quarters: {
      label: string;
      year: number;
      quarter: 1 | 2 | 3 | 4;
    }[];
    halves: {
      label: string;
      year: number;
      half: 1 | 2;
    }[];
  };
};

type RevenueListPageProps = {
  type: RevenueListType;
};

type RevenueErrorResponse = {
  error: string;
};

function isRevenueErrorResponse(value: RevenueListResponse | RevenueErrorResponse): value is RevenueErrorResponse {
  return 'error' in value;
}

function formatAmount(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getVisibleDateColumns(type: RevenueListType) {
  return {
    refundedAt: type === 'refunds',
    confirmedAt: type === 'confirmed' || type === 'completed',
    completedAt: type === 'completed',
  };
}

export default function RevenueList({ type }: RevenueListPageProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteName = normalizeText(params.siteName);

  const [responseData, setResponseData] = useState<RevenueListResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const page = Number(searchParams.get('page') ?? '1') || 1;
  const rangeType = (searchParams.get('rangeType') as RevenueRangeType | null) ?? 'all';
  const visibleDateColumns = getVisibleDateColumns(type);

  const queryString = useMemo(() => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    nextSearchParams.set('siteName', siteName);
    nextSearchParams.set('page', String(page));
    nextSearchParams.set('pageSize', '20');

    return nextSearchParams.toString();
  }, [page, searchParams, siteName]);

  useEffect(() => {
    async function loadList() {
      if (!siteName) {
        return;
      }

      const fetchResponse = await fetch(`/api/revenue/${type}?${queryString}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await fetchResponse.json()) as RevenueListResponse | RevenueErrorResponse;

      if (!fetchResponse.ok || isRevenueErrorResponse(result)) {
        setErrorMessage(isRevenueErrorResponse(result) ? result.error : '내역을 불러오지 못했습니다.');
        return;
      }

      setResponseData(result);
      setErrorMessage('');
    }

    void loadList();
  }, [queryString, siteName, type]);

  function updateSearchParams(nextValues: Record<string, string | null>) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(nextValues).forEach(([key, value]) => {
      if (value === null) {
        nextSearchParams.delete(key);
        return;
      }

      nextSearchParams.set(key, value);
    });

    nextSearchParams.set('page', '1');

    router.replace(`?${nextSearchParams.toString()}`);
  }

  function handleRangeTypeChange(_mouseEvent: React.MouseEvent<HTMLElement>, nextRangeType: RevenueRangeType | null) {
    if (!nextRangeType) {
      return;
    }

    updateSearchParams({
      rangeType: nextRangeType,
      year: null,
      quarter: null,
      half: null,
      startYear: null,
      startMonth: null,
      endYear: null,
      endMonth: null,
    });
  }

  function handlePageChange(_changeEvent: React.ChangeEvent<unknown>, nextPage: number) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set('page', String(nextPage));
    router.replace(`?${nextSearchParams.toString()}`);
  }

  function handleExcelDownload() {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    nextSearchParams.set('siteName', siteName);
    nextSearchParams.set('type', type);

    window.location.href = `/api/revenue/export?${nextSearchParams.toString()}`;
  }

  const totalPages = responseData ? Math.max(Math.ceil(responseData.total / responseData.pageSize), 1) : 1;

  return (
    <div className={`container ${styles.container}`}>
      <div className={`content ${styles.content} ${styles['content-payments']}`}>
        <Stack direction="column" gap={1} alignItems="flex-end">
          <ToggleButtonGroup
            exclusive
            value={rangeType}
            size="small"
            onChange={handleRangeTypeChange}
            className={styles.ToggleButtonGroup}
          >
            <ToggleButton value="all">전체</ToggleButton>
            <ToggleButton value="year">연 단위 검색</ToggleButton>
            <ToggleButton value="quarter">분기별 검색</ToggleButton>
            <ToggleButton value="half">반기별 검색</ToggleButton>
            <ToggleButton value="custom">직접 입력</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" gap={1}>
            {responseData && rangeType === 'year' ? (
              <Select
                size="small"
                displayEmpty
                value={searchParams.get('year') ?? ''}
                onChange={(changeEvent) => updateSearchParams({ year: changeEvent.target.value })}
              >
                <MenuItem value="">년도 선택</MenuItem>
                {responseData.filters.years.map((year) => (
                  <MenuItem key={year} value={String(year)}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            ) : null}

            {responseData && rangeType === 'quarter' ? (
              <Select
                size="small"
                displayEmpty
                value={
                  searchParams.get('year') && searchParams.get('quarter')
                    ? `${searchParams.get('year')}-${searchParams.get('quarter')}`
                    : ''
                }
                onChange={(changeEvent) => {
                  const [year, quarter] = changeEvent.target.value.split('-');
                  updateSearchParams({ year, quarter });
                }}
              >
                <MenuItem value="">분기 선택</MenuItem>
                {responseData.filters.quarters.map((quarterOption) => (
                  <MenuItem
                    key={`${quarterOption.year}-${quarterOption.quarter}`}
                    value={`${quarterOption.year}-${quarterOption.quarter}`}
                  >
                    {quarterOption.label}
                  </MenuItem>
                ))}
              </Select>
            ) : null}

            {responseData && rangeType === 'half' ? (
              <Select
                size="small"
                displayEmpty
                value={
                  searchParams.get('year') && searchParams.get('half')
                    ? `${searchParams.get('year')}-${searchParams.get('half')}`
                    : ''
                }
                onChange={(changeEvent) => {
                  const [year, half] = changeEvent.target.value.split('-');
                  updateSearchParams({ year, half });
                }}
              >
                <MenuItem value="">반기 선택</MenuItem>
                {responseData.filters.halves.map((halfOption) => (
                  <MenuItem
                    key={`${halfOption.year}-${halfOption.half}`}
                    value={`${halfOption.year}-${halfOption.half}`}
                  >
                    {halfOption.label}
                  </MenuItem>
                ))}
              </Select>
            ) : null}

            {responseData && rangeType === 'custom' ? (
              <>
                <Select
                  size="small"
                  displayEmpty
                  value={searchParams.get('startYear') ?? ''}
                  onChange={(changeEvent) => updateSearchParams({ startYear: changeEvent.target.value })}
                >
                  <MenuItem value="">시작 년도</MenuItem>
                  {responseData.filters.years.map((year) => (
                    <MenuItem key={year} value={String(year)}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  size="small"
                  displayEmpty
                  value={searchParams.get('startMonth') ?? ''}
                  onChange={(changeEvent) => updateSearchParams({ startMonth: changeEvent.target.value })}
                >
                  <MenuItem value="">시작 월</MenuItem>
                  {Array.from({ length: 12 }, (_value, index) => index + 1).map((month) => (
                    <MenuItem key={month} value={String(month)}>
                      {month}월
                    </MenuItem>
                  ))}
                </Select>
                <Typography sx={{ alignSelf: 'center' }}>~</Typography>
                <Select
                  size="small"
                  displayEmpty
                  value={searchParams.get('endYear') ?? ''}
                  onChange={(changeEvent) => updateSearchParams({ endYear: changeEvent.target.value })}
                >
                  <MenuItem value="">종료 년도</MenuItem>
                  {responseData.filters.years.map((year) => (
                    <MenuItem key={year} value={String(year)}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  size="small"
                  displayEmpty
                  value={searchParams.get('endMonth') ?? ''}
                  onChange={(changeEvent) => updateSearchParams({ endMonth: changeEvent.target.value })}
                >
                  <MenuItem value="">종료 월</MenuItem>
                  {Array.from({ length: 12 }, (_value, index) => index + 1).map((month) => (
                    <MenuItem key={month} value={String(month)}>
                      {month}월
                    </MenuItem>
                  ))}
                </Select>
              </>
            ) : null}

            {responseData && responseData.items.length === 0 ? null : (
              <Button type="button" className="button medium submit" onClick={handleExcelDownload}>
                엑셀 다운로드
              </Button>
            )}
          </Stack>
        </Stack>

        {errorMessage ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}

        {!responseData && !errorMessage ? (
          <div className={`paper ${styles.paper}`}>
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        ) : null}

        {responseData ? (
          <>
            {responseData.items.length === 0 ? (
              <p className="alert warning" style={{ justifyContent: 'center' }}>
                <WarningAmberRoundedIcon />
                <span>데이터가 없습니다</span>
              </p>
            ) : (
              <div className="paper paper-p0">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>구매자</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>결제 이메일</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>게시판 이름</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>연재 이름</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>포스팅 제목</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>결제 유형</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>상태</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', align: 'right' }}>결제금액</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', align: 'right' }}>환불금액</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>일시</TableCell>
                      {visibleDateColumns.refundedAt ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>환불일</TableCell>
                      ) : null}
                      {visibleDateColumns.confirmedAt ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>확정일</TableCell>
                      ) : null}
                      {visibleDateColumns.completedAt ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>완료일</TableCell>
                      ) : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {responseData.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.buyerName || ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.buyerEmail || ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.boardName || ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.seriesName || ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.postTitle || ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.paymentType || ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.status || ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', align: 'right' }}>
                          {formatAmount(item.paymentAmount)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', align: 'right' }}>
                          {item.refundAmount ? formatAmount(item.refundAmount) : ''}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(item.paidAt)}</TableCell>
                        {visibleDateColumns.refundedAt ? (
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(item.refundedAt)}</TableCell>
                        ) : null}
                        {visibleDateColumns.confirmedAt ? (
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(item.confirmedAt)}</TableCell>
                        ) : null}
                        {visibleDateColumns.completedAt ? (
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(item.completedAt)}</TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination count={totalPages} page={page} onChange={handlePageChange} />
            </Box>
          </>
        ) : null}
      </div>
    </div>
  );
}
