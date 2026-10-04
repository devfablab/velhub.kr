'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FormHelperText,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';
import ScreenState from '@/components/service/ScreenState';
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

export type HotPostResponse = {
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
  error?: string;
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

function getKstDateValue(daysBefore = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  date.setUTCDate(date.getUTCDate() - daysBefore);

  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1),
    day: String(date.getUTCDate()),
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

  return createNumberOptions(currentYear - 5, currentYear);
}

function getPostHref(siteName: string, post: HotPost) {
  if (!post.boardKey) {
    return null;
  }

  return `/${siteName}/${post.boardKey}/${post.slug}`;
}

function DateSelectGroup({ title, value, yearOptions, onChange, error }: DateSelectGroupProps) {
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
      {error ? <FormHelperText error>{error}</FormHelperText> : null}
    </>
  );
}

type OptProps = { initialData: HotPostResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const yearOptions = createYearOptions();

  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [errorDialogTitle, setErrorDialogTitle] = useState<string | null>(initialError ? '인기글 순위' : null);
  const [selectedRange, setSelectedRange] = useState<RangeType>('today');
  const [startDate, setStartDate] = useState<DateValue>(() => getKstDateValue(29));
  const [endDate, setEndDate] = useState<DateValue>(() => getKstDateValue());
  const [hotPostStats, setHotPostStats] = useState<HotPostResponse | null>(initialData);

  function showError(message: string, title: string | null, errors?: { startDate?: string; endDate?: string }) {
    setErrorMessage(message);
    setStartDateError(errors?.startDate ?? '');
    setEndDateError(errors?.endDate ?? '');
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  async function loadHotPosts(request: AppliedRequest) {
    if (!siteName) {
      showError('사이트 주소가 유효하지 않습니다.', '인기글 순위');
      return;
    }

    try {
      const isFirstLoad = !hotPostStats;

      if (isFirstLoad) {
        setIsInitialLoading(true);
      } else {
        setIsListLoading(true);
      }

      setErrorMessage('');
      setStartDateError('');
      setEndDateError('');

      const query = new URLSearchParams({
        siteName,
        range: request.range,
      });

      if (request.range === 'custom' && request.startDate && request.endDate) {
        query.set('startDate', request.startDate);
        query.set('endDate', request.endDate);
      }

      const response = await fetch(`/api/manage/stats/hot-post?${query.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HotPostResponse;

      if (!response.ok) {
        showError(result.error ?? '인기글 순위를 불러오지 못했습니다.', response.status >= 500 ? null : '인기글 순위');
        return;
      }

      setHotPostStats(result);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '인기글 순위를 불러오지 못했습니다.', null);
      } else {
        showError('인기글 순위를 불러오지 못했습니다.', null);
      }
    } finally {
      setIsInitialLoading(false);
      setIsListLoading(false);
    }
  }

  function handleSelectPreset(range: Exclude<RangeType, 'custom'>) {
    setSelectedRange(range);
    void loadHotPosts({ range });
  }

  function handleOpenCustomRange() {
    setSelectedRange('custom');
  }

  function handleApplyCustomRange() {
    const formattedStartDate = formatDateValue(startDate);
    const formattedEndDate = formatDateValue(endDate);
    const today = formatDateValue(getKstDateValue());

    if (formattedStartDate > formattedEndDate) {
      showError('시작일은 종료일보다 늦을 수 없습니다.', '기간 조회', {
        startDate: '시작일을 확인해 주세요.',
        endDate: '종료일을 확인해 주세요.',
      });
      return;
    }
    if (formattedStartDate > today || formattedEndDate > today) {
      showError('오늘 이후의 날짜는 조회할 수 없습니다.', '기간 조회', {
        startDate: formattedStartDate > today ? '오늘 이전 날짜를 선택해 주세요.' : '',
        endDate: formattedEndDate > today ? '오늘 이전 날짜를 선택해 주세요.' : '',
      });
      return;
    }

    void loadHotPosts({
      range: 'custom',
      startDate: formattedStartDate,
      endDate: formattedEndDate,
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

  if (!hotPostStats?.posts) {
    return (
      <Container pageTitle="인기글 순위" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <ScreenState kind="error">{errorMessage || '인기글 순위를 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog
              open={isErrorDialogOpen}
              onClose={() => setIsErrorDialogOpen(false)}
              title={errorDialogTitle}
              messages={[errorMessage || '인기글 순위를 불러오지 못했습니다.']}
            />
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

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

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
                <DateSelectGroup
                  title="시작일"
                  value={startDate}
                  yearOptions={yearOptions}
                  error={startDateError}
                  onChange={(value) => {
                    setStartDate(value);
                    setStartDateError('');
                    setEndDateError('');
                  }}
                />
                <DateSelectGroup
                  title="종료일"
                  value={endDate}
                  yearOptions={yearOptions}
                  error={endDateError}
                  onChange={(value) => {
                    setEndDate(value);
                    setStartDateError('');
                    setEndDateError('');
                  }}
                />
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
      <FormErrorDialog
        open={isErrorDialogOpen}
        onClose={() => setIsErrorDialogOpen(false)}
        title={errorDialogTitle}
        messages={errorMessage ? errorMessage.split('\n') : []}
      />
    </Container>
  );
}
