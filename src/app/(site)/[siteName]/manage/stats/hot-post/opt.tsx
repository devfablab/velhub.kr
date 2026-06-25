'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type RangeType = 'today' | 'week' | 'month' | 'three-months' | 'six-months' | 'year' | 'custom';

type DateValue = {
  year: string;
  month: string;
  day: string;
};

type HotPost = {
  id: string;
  rank: number;
  slug: string;
  subject: string;
  readCount: number;
  boardKey: string | null;
  boardLabel: string | null;
  seriesLabel: string | null;
};

type HotPostResponse = {
  site?: {
    siteName: string;
    siteLabel: string | null;
    siteType: 'blog';
  };
  range?: {
    type: RangeType;
    startDate: string;
    endDate: string;
    endLabel: string | null;
  };
  posts?: HotPost[];
  error?: string;
};

type AppliedRequest = {
  range: RangeType;
  startDate?: string;
  endDate?: string;
};

type DateSelectGroupProps = {
  title: string;
  value: DateValue;
  yearOptions: string[];
  onChange: (nextValue: DateValue) => void;
};

const RANGE_OPTIONS: {
  value: Exclude<RangeType, 'custom'>;
  label: string;
}[] = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '일주일' },
  { value: 'month', label: '한달' },
  { value: 'three-months', label: '3개월' },
  { value: 'six-months', label: '6개월' },
  { value: 'year', label: '1년' },
];

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}

function getTodayDateValue() {
  const now = new Date();

  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    day: String(now.getDate()),
  };
}

function getDateBefore(days: number) {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1),
    day: String(date.getDate()),
  };
}

function getDaysInMonth(year: string, month: string) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function normalizeDateValue(value: DateValue) {
  const maxDay = getDaysInMonth(value.year, value.month);
  const day = Math.min(Number(value.day), maxDay);

  return {
    ...value,
    day: String(day),
  };
}

function formatDateValue(value: DateValue) {
  const month = value.month.padStart(2, '0');
  const day = value.day.padStart(2, '0');

  return `${value.year}-${month}-${day}`;
}

function createNumberOptions(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
}

function createYearOptions() {
  const currentYear = new Date().getFullYear();

  return createNumberOptions(currentYear - 5, currentYear + 1);
}

function getPostHref(siteName: string, post: HotPost) {
  if (!post.boardKey) {
    return null;
  }

  return `/${siteName}/${post.boardKey}/${post.slug}`;
}

function DateSelectGroup({ title, value, yearOptions, onChange }: DateSelectGroupProps) {
  const monthOptions = createNumberOptions(1, 12);
  const dayOptions = createNumberOptions(1, getDaysInMonth(value.year, value.month));

  function handleChange(key: keyof DateValue) {
    return (event: SelectChangeEvent) => {
      onChange(
        normalizeDateValue({
          ...value,
          [key]: event.target.value,
        }),
      );
    };
  }

  return (
    <>
      <Typography variant="subtitle2">{title}</Typography>
      <div className={styles.buttons}>
        <Select
          size="small"
          value={value.year}
          onChange={handleChange('year')}
          inputProps={{
            'aria-label': `${title} 년`,
          }}
        >
          {yearOptions.map((year) => (
            <MenuItem key={year} value={year}>
              {year} 년
            </MenuItem>
          ))}
        </Select>

        <Select
          size="small"
          value={value.month}
          onChange={handleChange('month')}
          inputProps={{
            'aria-label': `${title} 월`,
          }}
        >
          {monthOptions.map((month) => (
            <MenuItem key={month} value={month}>
              {month} 월
            </MenuItem>
          ))}
        </Select>

        <Select
          size="small"
          value={value.day}
          onChange={handleChange('day')}
          inputProps={{
            'aria-label': `${title} 일`,
          }}
        >
          {dayOptions.map((day) => (
            <MenuItem key={day} value={day}>
              {day} 일
            </MenuItem>
          ))}
        </Select>
      </div>
    </>
  );
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const yearOptions = createYearOptions();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRange, setSelectedRange] = useState<RangeType>('today');
  const [appliedRequest, setAppliedRequest] = useState<AppliedRequest>({ range: 'today' });
  const [startDate, setStartDate] = useState<DateValue>(() => getDateBefore(29));
  const [endDate, setEndDate] = useState<DateValue>(() => getTodayDateValue());
  const [hotPostStats, setHotPostStats] = useState<HotPostResponse | null>(null);

  useEffect(() => {
    async function loadHotPosts() {
      try {
        const isFirstLoad = !hotPostStats;

        if (isFirstLoad) {
          setIsInitialLoading(true);
        } else {
          setIsListLoading(true);
        }

        setErrorMessage('');

        const query = new URLSearchParams({
          siteName,
          range: appliedRequest.range,
        });

        if (appliedRequest.range === 'custom' && appliedRequest.startDate && appliedRequest.endDate) {
          query.set('startDate', appliedRequest.startDate);
          query.set('endDate', appliedRequest.endDate);
        }

        const response = await fetch(`/api/manage/stats/hot-post?${query.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as HotPostResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '인기글 순위를 불러오지 못했습니다.');
        }

        setHotPostStats(result);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '인기글 순위를 불러오지 못했습니다.');
        } else {
          setErrorMessage('인기글 순위를 불러오지 못했습니다.');
        }
      } finally {
        setIsInitialLoading(false);
        setIsListLoading(false);
      }
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsInitialLoading(false);
      setIsListLoading(false);
      return;
    }

    void loadHotPosts();
  }, [appliedRequest, siteName]);

  function handleSelectPreset(range: Exclude<RangeType, 'custom'>) {
    setSelectedRange(range);
    setAppliedRequest({ range });
  }

  function handleOpenCustomRange() {
    setSelectedRange('custom');
  }

  function handleApplyCustomRange() {
    setAppliedRequest({
      range: 'custom',
      startDate: formatDateValue(startDate),
      endDate: formatDateValue(endDate),
    });
  }

  if (isInitialLoading) {
    return (
      <Container pageTitle="인기글 순위" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (errorMessage || !hotPostStats?.posts) {
    return (
      <Container pageTitle="인기글 순위" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <div className={`paper paper-error ${styles.paper}`}>
              {errorMessage || '인기글 순위를 불러오지 못했습니다.'}
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="인기글 순위" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
            인기글 조회
          </Typography>

          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">기간 선택</Typography>
            <div className={styles.buttons}>
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`button small ${selectedRange === option.value ? 'action' : 'cancel'}`}
                  onClick={() => handleSelectPreset(option.value)}
                >
                  {option.label}
                </button>
              ))}

              <button
                type="button"
                className={`button small ${selectedRange === 'custom' ? 'action' : 'cancel'}`}
                onClick={handleOpenCustomRange}
              >
                기간 설정
              </button>
            </div>

            {selectedRange === 'custom' ? (
              <>
                <DateSelectGroup title="시작일" value={startDate} yearOptions={yearOptions} onChange={setStartDate} />
                <DateSelectGroup title="종료일" value={endDate} yearOptions={yearOptions} onChange={setEndDate} />
                <button type="button" className="button medium action" onClick={handleApplyCustomRange}>
                  조회
                </button>
              </>
            ) : null}
          </div>

          {isListLoading ? (
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          ) : (
            <>
              <div className={`paper ${styles.paper}`}>
                <Typography variant="subtitle2">조회 기간</Typography>
                <Typography variant="body2">
                  {hotPostStats.range?.startDate} ~ {hotPostStats.range?.endLabel ?? hotPostStats.range?.endDate}
                </Typography>
              </div>

              <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
                인기글 순위
              </Typography>

              <div className={`paper ${styles['paper-table']}`}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>순위</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>연재</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>글</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>조회수</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {hotPostStats.posts.length > 0 ? (
                        hotPostStats.posts.map((post) => {
                          const href = getPostHref(siteName, post);
                          return (
                            <TableRow key={post.id}>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{post.rank}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{post.seriesLabel || ''}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {href ? (
                                  <Anchor href={href}>{post.subject || '(제목 없음)'}</Anchor>
                                ) : (
                                  post.subject || '(제목 없음)'
                                )}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                                {formatNumber(post.readCount)} 회
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5}>인기글 정보가 없습니다.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
