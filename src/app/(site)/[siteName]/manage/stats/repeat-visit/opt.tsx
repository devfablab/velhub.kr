'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

type RepeatVisitChartRow = {
  label: string;
  startDate: string;
  endDate: string;
  totalVisitorCount: number;
  repeatVisitorCount: number;
  repeatVisitRate: number;
};

type RepeatVisitResponse = {
  site?: {
    siteName: string;
    siteLabel: string | null;
    siteType: 'blog';
  };
  summary?: {
    totalVisitorCount: number;
    repeatVisitorCount: number;
    onceVisitorCount: number;
    repeatVisitRate: number;
  };
  range?: {
    type: RangeType;
    unit: ChartUnit;
    startDate: string;
    endDate: string;
  };
  chart?: RepeatVisitChartRow[];
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
  { value: 'week', label: '일주일' },
  { value: 'month', label: '한달' },
  { value: 'three-months', label: '3개월' },
  { value: 'six-months', label: '6개월' },
  { value: 'year', label: '1년' },
];

const REPEAT_VISIT_COLOR = '#EEB400';
const ONCE_VISIT_COLOR = '#616161';

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}

function formatPercent(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
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

function RepeatVisitPieChart({ summary }: { summary: NonNullable<RepeatVisitResponse['summary']> }) {
  const data = [
    {
      name: '재방문',
      value: summary.repeatVisitorCount,
      color: REPEAT_VISIT_COLOR,
    },
    {
      name: '1회 방문',
      value: summary.onceVisitorCount,
      color: ONCE_VISIT_COLOR,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Tooltip
          formatter={(value, name) => [`${formatNumber(Number(value))} 명`, name]}
          wrapperStyle={{ fontSize: 14 }}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={92}
          label={({ cx, cy, midAngle, outerRadius, percent }) => {
            const radius = Number(outerRadius) + 22;
            const RADIAN = Math.PI / 180;
            const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);
            const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);

            return (
              <text
                x={x}
                y={y}
                fill="#111"
                textAnchor={x > Number(cx) ? 'start' : 'end'}
                dominantBaseline="central"
                fontSize={14}
              >
                {`${((percent ?? 0) * 100).toFixed(0)} %`}
              </text>
            );
          }}
          labelLine={false}
        >
          {data.map((item) => (
            <Cell key={item.name} fill={item.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function RepeatVisitAreaChart({ data }: { data: RepeatVisitChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="repeatVisitRateGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={REPEAT_VISIT_COLOR} stopOpacity={0.45} />
            <stop offset="95%" stopColor={REPEAT_VISIT_COLOR} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tickMargin={8} tick={{ fontSize: 12 }} />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `${formatPercent(Number(value))}%`}
        />
        <Tooltip formatter={(value) => `${formatPercent(Number(value))} %`} wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="repeatVisitRate"
          stroke={REPEAT_VISIT_COLOR}
          fill="url(#repeatVisitRateGradient)"
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 4,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
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
  const [repeatVisitStats, setRepeatVisitStats] = useState<RepeatVisitResponse | null>(null);

  useEffect(() => {
    async function loadRepeatVisitStats() {
      try {
        const isFirstLoad = !repeatVisitStats;

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

        const response = await fetch(`/api/manage/stats/repeat-visit?${query.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as RepeatVisitResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '재방문율 통계를 불러오지 못했습니다.');
        }

        setRepeatVisitStats((prevRepeatVisitStats) => {
          if (!prevRepeatVisitStats) {
            return result;
          }

          return {
            ...prevRepeatVisitStats,
            range: result.range,
            chart: result.chart,
          };
        });
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '재방문율 통계를 불러오지 못했습니다.');
        } else {
          setErrorMessage('재방문율 통계를 불러오지 못했습니다.');
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

    void loadRepeatVisitStats();
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
      <Container pageTitle="재방문율" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
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

  if (errorMessage || !repeatVisitStats?.summary || !repeatVisitStats.chart) {
    return (
      <Container pageTitle="재방문율" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <div className={`paper paper-error ${styles.paper}`}>
              {errorMessage || '재방문율 통계를 불러오지 못했습니다.'}
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="재방문율" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
            재방문율 요약
          </Typography>

          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">오늘 재방문율</Typography>
            <Typography variant="body2">
              {formatPercent(repeatVisitStats.summary.repeatVisitRate)} % (재방문{' '}
              {formatNumber(repeatVisitStats.summary.repeatVisitorCount)} 명{' / '}
              전체 {formatNumber(repeatVisitStats.summary.totalVisitorCount)} 명)
            </Typography>
            <RepeatVisitPieChart summary={repeatVisitStats.summary} />
          </div>

          <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
            재방문율 조회
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
                <Typography variant="subtitle2">재방문율 현황</Typography>
                <Typography variant="body2">
                  {repeatVisitStats.range?.startDate} ~ {repeatVisitStats.range?.endDate}
                </Typography>
                <RepeatVisitAreaChart data={repeatVisitStats.chart} />
              </div>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
