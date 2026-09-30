'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { FormHelperText, type SelectChangeEvent, Typography } from '@mui/material';
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

type RepeatVisitChartRow = {
  label: string;
  startDate: string;
  endDate: string;
  totalVisitorCount: number;
  repeatVisitorCount: number;
  repeatVisitRate: number;
};

export type RepeatVisitResponse = {
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
  error?: string;
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

type OptProps = { initialData: RepeatVisitResponse | null; initialError: string };

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
  const [errorDialogTitle, setErrorDialogTitle] = useState<string | null>(initialError ? '재방문율 통계' : null);
  const [selectedRange, setSelectedRange] = useState<RangeType>('week');
  const [startDate, setStartDate] = useState<DateValue>(() => getKstDateValue(29));
  const [endDate, setEndDate] = useState<DateValue>(() => getKstDateValue());
  const [repeatVisitStats, setRepeatVisitStats] = useState<RepeatVisitResponse | null>(initialData);

  function showError(message: string, title: string | null, errors?: { startDate?: string; endDate?: string }) {
    setErrorMessage(message);
    setStartDateError(errors?.startDate ?? '');
    setEndDateError(errors?.endDate ?? '');
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  async function loadRepeatVisitStats(request: AppliedRequest) {
    if (!siteName) {
      showError('사이트 주소가 유효하지 않습니다.', '재방문율 통계');
      return;
    }

    try {
      const isFirstLoad = !repeatVisitStats;

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

      const response = await fetch(`/api/manage/stats/repeat-visit?${query.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as RepeatVisitResponse;

      if (!response.ok) {
        showError(result.error ?? '재방문율 통계를 불러오지 못했습니다.', response.status >= 500 ? null : '재방문율 통계');
        return;
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
        showError(unknownError.message || '재방문율 통계를 불러오지 못했습니다.', null);
      } else {
        showError('재방문율 통계를 불러오지 못했습니다.', null);
      }
    } finally {
      setIsInitialLoading(false);
      setIsChartLoading(false);
    }
  }

  function handleSelectPreset(range: Exclude<RangeType, 'custom'>) {
    setSelectedRange(range);
    void loadRepeatVisitStats({ range });
  }

  function handleOpenCustomRange() {
    setSelectedRange('custom');
  }

  function handleApplyCustomRange() {
    const formattedStartDate = formatDateValue(startDate);
    const formattedEndDate = formatDateValue(endDate);
    const today = formatDateValue(getKstDateValue());

    if (formattedStartDate > formattedEndDate) {
      showError('시작일은 종료일보다 늦을 수 없습니다.', '기간 조회', { startDate: '시작일을 확인해 주세요.', endDate: '종료일을 확인해 주세요.' });
      return;
    }
    if (formattedStartDate > today || formattedEndDate > today) {
      showError('오늘 이후의 날짜는 조회할 수 없습니다.', '기간 조회', {
        startDate: formattedStartDate > today ? '오늘 이전 날짜를 선택해 주세요.' : '',
        endDate: formattedEndDate > today ? '오늘 이전 날짜를 선택해 주세요.' : '',
      });
      return;
    }

    void loadRepeatVisitStats({
      range: 'custom',
      startDate: formattedStartDate,
      endDate: formattedEndDate,
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

  if (!repeatVisitStats?.summary || !repeatVisitStats.chart) {
    return (
      <Container pageTitle="재방문율" pageBack={`/${siteName}/manage/stats/dashboard`} menu="stats">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <ScreenState kind="error">{errorMessage || '재방문율 통계를 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog open={isErrorDialogOpen} onClose={() => setIsErrorDialogOpen(false)} title={errorDialogTitle} messages={[errorMessage || '재방문율 통계를 불러오지 못했습니다.']} />
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

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

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
                <DateSelectGroup title="시작일" value={startDate} yearOptions={yearOptions} error={startDateError} onChange={(value) => { setStartDate(value); setStartDateError(''); setEndDateError(''); }} />
                <DateSelectGroup title="종료일" value={endDate} yearOptions={yearOptions} error={endDateError} onChange={(value) => { setEndDate(value); setStartDateError(''); setEndDateError(''); }} />
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
      <FormErrorDialog open={isErrorDialogOpen} onClose={() => setIsErrorDialogOpen(false)} title={errorDialogTitle} messages={errorMessage ? errorMessage.split('\n') : []} />
    </Container>
  );
}
