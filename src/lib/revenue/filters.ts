import { toNumber } from '@/lib/revenue/amounts';

export type RevenueRangeType = 'all' | 'year' | 'quarter' | 'half' | 'custom';

export type RevenueFilterParams = {
  rangeType: RevenueRangeType;
  year: number | null;
  quarter: 1 | 2 | 3 | 4 | null;
  half: 1 | 2 | null;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  page: number;
  pageSize: number;
};

export type RevenueFilterOptions = {
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

function isRevenueRangeType(value: string | null): value is RevenueRangeType {
  return value === 'all' || value === 'year' || value === 'quarter' || value === 'half' || value === 'custom';
}

function toPositiveInteger(value: string | null, fallback: number) {
  const numberValue = toNumber(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return fallback;
  }

  return numberValue;
}

function toYear(value: string | null) {
  const numberValue = toNumber(value);

  if (!Number.isInteger(numberValue) || numberValue < 2000) {
    return null;
  }

  return numberValue;
}

function toMonth(value: string | null) {
  const numberValue = toNumber(value);

  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 12) {
    return null;
  }

  return numberValue;
}

function toQuarter(value: string | null) {
  const numberValue = toNumber(value);

  if (numberValue === 1 || numberValue === 2 || numberValue === 3 || numberValue === 4) {
    return numberValue;
  }

  return null;
}

function toHalf(value: string | null) {
  const numberValue = toNumber(value);

  if (numberValue === 1 || numberValue === 2) {
    return numberValue;
  }

  return null;
}

function getKstBoundary(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0)).toISOString();
}

export function getRevenueFilterParams(searchParams: URLSearchParams): RevenueFilterParams {
  const rangeTypeValue = searchParams.get('rangeType');
  const rangeType = isRevenueRangeType(rangeTypeValue) ? rangeTypeValue : 'all';

  return {
    rangeType,
    year: toYear(searchParams.get('year')),
    quarter: toQuarter(searchParams.get('quarter')),
    half: toHalf(searchParams.get('half')),
    startYear: toYear(searchParams.get('startYear')),
    startMonth: toMonth(searchParams.get('startMonth')),
    endYear: toYear(searchParams.get('endYear')),
    endMonth: toMonth(searchParams.get('endMonth')),
    page: toPositiveInteger(searchParams.get('page'), 1),
    pageSize: Math.min(toPositiveInteger(searchParams.get('pageSize'), 20), 100),
  };
}

export function getRevenueFilterOptions(dateValues: (string | null)[]): RevenueFilterOptions {
  const yearSet = new Set<number>();
  const quarterMap = new Map<string, { label: string; year: number; quarter: 1 | 2 | 3 | 4 }>();
  const halfMap = new Map<string, { label: string; year: number; half: 1 | 2 }>();

  dateValues.forEach((dateValue) => {
    if (!dateValue) {
      return;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const year = kstDate.getUTCFullYear();
    const month = kstDate.getUTCMonth() + 1;
    const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4;
    const half = month <= 6 ? 1 : 2;

    yearSet.add(year);
    quarterMap.set(`${year}-${quarter}`, { label: `${year}년 ${quarter}분기`, year, quarter });
    halfMap.set(`${year}-${half}`, { label: `${year}년 ${half === 1 ? '상반기' : '후반기'}`, year, half });
  });

  return {
    years: [...yearSet].sort((a, b) => b - a),
    quarters: [...quarterMap.values()].sort((a, b) => b.year - a.year || b.quarter - a.quarter),
    halves: [...halfMap.values()].sort((a, b) => b.year - a.year || b.half - a.half),
  };
}

export function isDateInRevenueRange(dateValue: string | null, filterParams: RevenueFilterParams) {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (filterParams.rangeType === 'all') {
    return true;
  }

  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth() + 1;

  if (filterParams.rangeType === 'year') {
    return filterParams.year === year;
  }

  if (filterParams.rangeType === 'quarter') {
    const quarter = Math.ceil(month / 3);

    return filterParams.year === year && filterParams.quarter === quarter;
  }

  if (filterParams.rangeType === 'half') {
    const half = month <= 6 ? 1 : 2;

    return filterParams.year === year && filterParams.half === half;
  }

  if (filterParams.rangeType === 'custom') {
    if (!filterParams.startYear || !filterParams.startMonth || !filterParams.endYear || !filterParams.endMonth) {
      return false;
    }

    const currentMonthValue = year * 100 + month;
    const startMonthValue = filterParams.startYear * 100 + filterParams.startMonth;
    const endMonthValue = filterParams.endYear * 100 + filterParams.endMonth;

    return currentMonthValue >= startMonthValue && currentMonthValue <= endMonthValue;
  }

  return true;
}
