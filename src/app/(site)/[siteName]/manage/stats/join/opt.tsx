'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { FormHelperText, type SelectChangeEvent, Typography } from '@mui/material';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type RangeType = 'week' | 'month' | 'three-months' | 'six-months' | 'year' | 'custom';
type ChartUnit = 'day' | 'month';

type DateValue = {
  year: string;
  month: string;
  day: string;
};

type JoinChartRow = {
  label: string;
  startDate: string;
  endDate: string;
  periodJoinCount: number;
  cumulativeJoinCount: number;
};

export type JoinStatsResponse = {
  site?: {
    siteName: string;
    siteLabel: string | null;
    siteType: 'community';
  };
  summary?: {
    todayApprovedJoinCount: number;
    todayUnapprovedJoinCount: number;
    todayTotalJoinCount: number;
    totalApprovedJoinCount: number;
  };
  range?: {
    type: RangeType;
    unit: ChartUnit;
    startDate: string;
    endDate: string;
  };
  chart?: JoinChartRow[];
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

type JoinAreaChartProps = {
  title: string;
  data: JoinChartRow[];
  dataKey: 'periodJoinCount' | 'cumulativeJoinCount';
};

function getChartColor(dataKey: JoinAreaChartProps['dataKey']) {
  if (dataKey === 'periodJoinCount') {
    return '#007ADB';
  }
  return '#FF555D';
}

function getGradientId(dataKey: JoinAreaChartProps['dataKey']) {
  return `${dataKey}-gradient`;
}

const RANGE_OPTIONS: {
  value: Exclude<RangeType, 'custom'>;
  label: string;
}[] = [
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
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
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

function DateSelectGroup({ title, value, yearOptions, onChange, error = '' }: DateSelectGroupProps) {
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

function JoinAreaChart({ title, data, dataKey }: JoinAreaChartProps) {
  const chartColor = getChartColor(dataKey);
  const gradientId = getGradientId(dataKey);

  return (
    <div className={`paper ${styles.paper}`}>
      <Typography variant="subtitle2">{title}</Typography>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.45} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tickMargin={8} tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(Number(value))} />
          <Tooltip formatter={(value) => `${formatNumber(Number(value))} 명`} wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={chartColor}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type OptProps = { initialData: JoinStatsResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const yearOptions = createYearOptions();

  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [errorDialogTitle, setErrorDialogTitle] = useState<string | null>(initialError ? '가입자수 통계' : null);
  const [selectedRange, setSelectedRange] = useState<RangeType>('week');
  const [startDate, setStartDate] = useState<DateValue>(() => getKstDateValue(29));
  const [endDate, setEndDate] = useState<DateValue>(() => getKstDateValue());
  const [joinStats, setJoinStats] = useState<JoinStatsResponse | null>(initialData);

  function showError(message: string, title: string | null, errors?: { startDate?: string; endDate?: string }) {
    setErrorMessage(message);
    setStartDateError(errors?.startDate ?? '');
    setEndDateError(errors?.endDate ?? '');
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  async function loadJoinStats(request: AppliedRequest) {
    if (!siteName) {
      showError('사이트 주소가 유효하지 않습니다.', '가입자수 통계');
      return;
    }

    try {
      const isFirstLoad = !joinStats;

      if (isFirstLoad) {
        setIsInitialLoading(true);
      } else {
        setIsChartLoading(true);
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

      const response = await fetch(`/api/manage/stats/join?${query.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as JoinStatsResponse;

      if (!response.ok) {
        showError(result.error ?? '가입자수 통계를 불러오지 못했습니다.', response.status >= 500 ? null : '가입자수 통계');
        return;
      }

      setJoinStats((prevJoinStats) => {
        if (!prevJoinStats) {
          return result;
        }

        return {
          ...prevJoinStats,
          range: result.range,
          chart: result.chart,
        };
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '가입자수 통계를 불러오지 못했습니다.', null);
      } else {
        showError('가입자수 통계를 불러오지 못했습니다.', null);
      }
    } finally {
      setIsInitialLoading(false);
      setIsChartLoading(false);
    }
  }

  function handleSelectPreset(range: Exclude<RangeType, 'custom'>) {
    setSelectedRange(range);
    void loadJoinStats({ range });
  }

  function handleOpenCustomRange() {
    setSelectedRange('custom');
  }

  function handleApplyCustomRange() {
    const formattedStartDate = formatDateValue(startDate);
    const formattedEndDate = formatDateValue(endDate);
    const today = formatDateValue(getKstDateValue());

    if (formattedStartDate > formattedEndDate || formattedStartDate > today || formattedEndDate > today) {
      const nextStartDateError = formattedStartDate > formattedEndDate ? '시작일은 종료일보다 늦을 수 없습니다.' : '';
      const nextEndDateError = formattedEndDate > today ? '오늘 이전 날짜를 선택해 주세요.' : nextStartDateError;
      showError(nextEndDateError || nextStartDateError, '기간 조회', {
        startDate: formattedStartDate > today ? '오늘 이전 날짜를 선택해 주세요.' : nextStartDateError,
        endDate: nextEndDateError,
      });
      return;
    }

    void loadJoinStats({
      range: 'custom',
      startDate: formattedStartDate,
      endDate: formattedEndDate,
    });
  }

  if (isInitialLoading) {
    return (
      <Container pageTitle="가입자수" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
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

  if (!joinStats?.summary || !joinStats.chart) {
    return (
      <Container pageTitle="가입자수" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <ScreenState kind="error">{errorMessage || '가입자수 통계를 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog open={isErrorDialogOpen} title={errorDialogTitle} messages={errorMessage ? errorMessage.split('\n') : []} onClose={() => setIsErrorDialogOpen(false)} />
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="가입자수" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
          <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
            가입자수 요약
          </Typography>
          <div className={`paper ${styles['stack-paper']}`}>
            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">오늘 신규 가입자 수</Typography>
              <Typography variant="body2">
                {formatNumber(joinStats.summary.todayTotalJoinCount)} 명{' / '}
                승인 {formatNumber(joinStats.summary.todayApprovedJoinCount)} 명{' / '}
                비승인 {formatNumber(joinStats.summary.todayUnapprovedJoinCount)} 명
              </Typography>
            </div>
            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">총 가입자 수</Typography>
              <Typography variant="body2">{formatNumber(joinStats.summary.totalApprovedJoinCount)} 명</Typography>
            </div>
          </div>

          <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
            가입자수 조회
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
                <DateSelectGroup title="시작일" value={startDate} yearOptions={yearOptions} onChange={setStartDate} error={startDateError} />
                <DateSelectGroup title="종료일" value={endDate} yearOptions={yearOptions} onChange={setEndDate} error={endDateError} />
                <button type="button" className="button medium action" onClick={handleApplyCustomRange}>
                  조회
                </button>
              </>
            ) : null}
          </div>

          {isChartLoading ? (
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
                  {joinStats.range?.startDate} ~ {joinStats.range?.endDate}
                </Typography>
              </div>

              <JoinAreaChart title="기간별 가입자 수" data={joinStats.chart} dataKey="periodJoinCount" />
              <JoinAreaChart title="누적 가입자 수" data={joinStats.chart} dataKey="cumulativeJoinCount" />
            </>
          )}
        </div>
      </div>
      <FormErrorDialog open={isErrorDialogOpen} title={errorDialogTitle} messages={errorMessage ? errorMessage.split('\n') : []} onClose={() => setIsErrorDialogOpen(false)} />
    </Container>
  );
}
