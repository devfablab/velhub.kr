'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MenuItem, Select, Typography, type SelectChangeEvent } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
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

type JoinStatsResponse = {
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
};

type JoinAreaChartProps = {
  title: string;
  data: JoinChartRow[];
  dataKey: 'periodJoinCount' | 'cumulativeJoinCount';
};

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

function JoinAreaChart({ title, data, dataKey }: JoinAreaChartProps) {
  return (
    <div className={`paper ${styles.paper}`}>
      <Typography variant="subtitle2">{title}</Typography>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tickMargin={8} />
          <YAxis allowDecimals={false} tickFormatter={(value) => formatNumber(Number(value))} />
          <Tooltip formatter={(value) => `${formatNumber(Number(value))} 명`} />
          <Area type="monotone" dataKey={dataKey} stroke="currentColor" fill="currentColor" fillOpacity={0.18} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const yearOptions = createYearOptions();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRange, setSelectedRange] = useState<RangeType>('week');
  const [appliedRequest, setAppliedRequest] = useState<AppliedRequest>({ range: 'week' });
  const [startDate, setStartDate] = useState<DateValue>(() => getDateBefore(29));
  const [endDate, setEndDate] = useState<DateValue>(() => getTodayDateValue());
  const [joinStats, setJoinStats] = useState<JoinStatsResponse | null>(null);

  useEffect(() => {
    async function loadJoinStats() {
      try {
        const isFirstLoad = !joinStats;

        if (isFirstLoad) {
          setIsInitialLoading(true);
        } else {
          setIsChartLoading(true);
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

        const response = await fetch(`/api/manage/stats/join?${query.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as JoinStatsResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '가입자수 통계를 불러오지 못했습니다.');
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
          setErrorMessage(unknownError.message || '가입자수 통계를 불러오지 못했습니다.');
        } else {
          setErrorMessage('가입자수 통계를 불러오지 못했습니다.');
        }
      } finally {
        setIsInitialLoading(false);
        setIsChartLoading(false);
      }
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsInitialLoading(false);
      setIsChartLoading(false);
      return;
    }

    void loadJoinStats();
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

  if (errorMessage || !joinStats?.summary || !joinStats.chart) {
    return (
      <Container pageTitle="가입자수" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <div className={`paper paper-error ${styles.paper}`}>
              {errorMessage || '가입자수 통계를 불러오지 못했습니다.'}
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="가입자수" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
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
                <DateSelectGroup title="시작일" value={startDate} yearOptions={yearOptions} onChange={setStartDate} />
                <DateSelectGroup title="종료일" value={endDate} yearOptions={yearOptions} onChange={setEndDate} />
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
                  {' / '}
                  {joinStats.range?.unit === 'day' ? '일별' : '월별'}
                </Typography>
              </div>

              <JoinAreaChart title="기간별 가입자 수" data={joinStats.chart} dataKey="periodJoinCount" />
              <JoinAreaChart title="누적 가입자 수" data={joinStats.chart} dataKey="cumulativeJoinCount" />
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
