import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RangeType = 'week' | 'month' | 'three-months' | 'six-months' | 'year' | 'custom';
type ChartUnit = 'day' | 'month';

type RhizomeRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type InactiveCheckinRow = {
  last_checkin_at: string | null;
};

type ChartBucket = {
  label: string;
  start: Date;
  end: Date;
};

type DateRange = {
  start: Date;
  endExclusive: Date;
  unit: ChartUnit;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isRangeType(value: string): value is RangeType {
  return (
    value === 'week' ||
    value === 'month' ||
    value === 'three-months' ||
    value === 'six-months' ||
    value === 'year' ||
    value === 'custom'
  );
}

function getNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

function getKstDateParts(date: Date) {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);

  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth() + 1,
    day: kstDate.getUTCDate(),
  };
}

function createKstDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - KST_OFFSET_MS);
}

function getKstStartOfToday() {
  const today = getKstDateParts(new Date());

  return createKstDate(today.year, today.month, today.day);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function addMonths(date: Date, months: number) {
  const dateParts = getKstDateParts(date);

  return createKstDate(dateParts.year, dateParts.month + months, 1);
}

function getKstMonthStart(date: Date) {
  const dateParts = getKstDateParts(date);

  return createKstDate(dateParts.year, dateParts.month, 1);
}

function formatKstDate(date: Date) {
  const dateParts = getKstDateParts(date);
  const month = String(dateParts.month).padStart(2, '0');
  const day = String(dateParts.day).padStart(2, '0');

  return `${dateParts.year}-${month}-${day}`;
}

function formatBucketLabel(date: Date, unit: ChartUnit) {
  const dateParts = getKstDateParts(date);
  const month = String(dateParts.month).padStart(2, '0');
  const day = String(dateParts.day).padStart(2, '0');

  if (unit === 'month') {
    return `${dateParts.year}.${month}`;
  }

  return `${month}.${day}`;
}

function parseDateText(value: string) {
  const normalizedValue = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return null;
  }

  const [yearText, monthText, dayText] = normalizedValue.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = createKstDate(year, month, day);
  const dateParts = getKstDateParts(date);

  if (dateParts.year !== year || dateParts.month !== month || dateParts.day !== day) {
    return null;
  }

  return date;
}

function getPresetRange(range: Exclude<RangeType, 'custom'>): DateRange {
  const todayStart = getKstStartOfToday();

  if (range === 'week') {
    return {
      start: addDays(todayStart, -6),
      endExclusive: addDays(todayStart, 1),
      unit: 'day',
    };
  }

  if (range === 'month') {
    return {
      start: addDays(todayStart, -29),
      endExclusive: addDays(todayStart, 1),
      unit: 'day',
    };
  }

  if (range === 'three-months') {
    return {
      start: addMonths(getKstMonthStart(todayStart), -2),
      endExclusive: addMonths(getKstMonthStart(todayStart), 1),
      unit: 'month',
    };
  }

  if (range === 'six-months') {
    return {
      start: addMonths(getKstMonthStart(todayStart), -5),
      endExclusive: addMonths(getKstMonthStart(todayStart), 1),
      unit: 'month',
    };
  }

  return {
    start: addMonths(getKstMonthStart(todayStart), -11),
    endExclusive: addMonths(getKstMonthStart(todayStart), 1),
    unit: 'month',
  };
}

function getCustomRange(startDate: string, endDate: string) {
  const start = parseDateText(startDate);
  const end = parseDateText(endDate);

  if (!start || !end) {
    return null;
  }

  const endExclusive = addDays(end, 1);

  if (start.getTime() >= endExclusive.getTime()) {
    return null;
  }

  const dayCount = Math.floor((endExclusive.getTime() - start.getTime()) / ONE_DAY_MS);

  return {
    start,
    endExclusive,
    unit: dayCount <= 31 ? 'day' : 'month',
  } satisfies DateRange;
}

function buildDailyBuckets(start: Date, endExclusive: Date, buckets: ChartBucket[] = []): ChartBucket[] {
  if (start.getTime() >= endExclusive.getTime()) {
    return buckets;
  }

  const nextStart = addDays(start, 1);

  return buildDailyBuckets(nextStart, endExclusive, [
    ...buckets,
    {
      label: formatBucketLabel(start, 'day'),
      start,
      end: nextStart,
    },
  ]);
}

function buildMonthlyBuckets(
  monthStart: Date,
  endExclusive: Date,
  rangeStart: Date,
  buckets: ChartBucket[] = [],
): ChartBucket[] {
  if (monthStart.getTime() >= endExclusive.getTime()) {
    return buckets;
  }

  const nextMonthStart = addMonths(monthStart, 1);
  const bucketStart = monthStart.getTime() < rangeStart.getTime() ? rangeStart : monthStart;
  const bucketEnd = nextMonthStart.getTime() > endExclusive.getTime() ? endExclusive : nextMonthStart;

  return buildMonthlyBuckets(nextMonthStart, endExclusive, rangeStart, [
    ...buckets,
    {
      label: formatBucketLabel(monthStart, 'month'),
      start: bucketStart,
      end: bucketEnd,
    },
  ]);
}

function buildBuckets(dateRange: DateRange) {
  if (dateRange.unit === 'day') {
    return buildDailyBuckets(dateRange.start, dateRange.endExclusive);
  }

  return buildMonthlyBuckets(getKstMonthStart(dateRange.start), dateRange.endExclusive, dateRange.start);
}

function getLastCheckinTime(row: InactiveCheckinRow) {
  if (!row.last_checkin_at) {
    return null;
  }

  const lastCheckinTime = new Date(row.last_checkin_at).getTime();

  if (Number.isNaN(lastCheckinTime)) {
    return null;
  }

  return lastCheckinTime;
}

async function getInactiveRows(
  siteId: string,
  start: Date,
  endExclusive: Date,
  from = 0,
): Promise<InactiveCheckinRow[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const to = from + 999;

  const inactiveResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('last_checkin_at')
    .eq('site_id', siteId)
    .eq('is_approval', true)
    .gte('last_checkin_at', start.toISOString())
    .lt('last_checkin_at', endExclusive.toISOString())
    .range(from, to);

  if (inactiveResult.error) {
    throw new Error('비활동 유저 정보를 불러오지 못했습니다.');
  }

  const rows = (inactiveResult.data ?? []) as InactiveCheckinRow[];

  if (rows.length < 1000) {
    return rows;
  }

  const nextRows = await getInactiveRows(siteId, start, endExclusive, to + 1);

  return [...rows, ...nextRows];
}

async function getStatsAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트 정보를 불러오지 못했습니다.',
    } as const;
  }

  const rhizome = rhizomeResult.data as RhizomeRow;
  const session = await verifySession({ siteId: rhizome.id });

  if (session.case !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  if (rhizome.site_type !== 'community') {
    return {
      ok: false,
      status: 400,
      error: '커뮤니티 통계만 확인할 수 있습니다.',
    } as const;
  }

  return {
    ok: true,
    supabaseAdmin,
    rhizome,
  } as const;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const requestedRange = normalizeText(requestUrl.searchParams.get('range')) || 'week';
    const startDate = normalizeText(requestUrl.searchParams.get('startDate'));
    const endDate = normalizeText(requestUrl.searchParams.get('endDate'));

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isRangeType(requestedRange)) {
      return Response.json({ error: '기간 설정이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getStatsAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const dateRange = requestedRange === 'custom' ? getCustomRange(startDate, endDate) : getPresetRange(requestedRange);

    if (!dateRange) {
      return Response.json({ error: '기간 설정이 유효하지 않습니다.' }, { status: 400 });
    }

    const todayStart = getKstStartOfToday();
    const weekStart = addDays(todayStart, -7);
    const monthStart = addDays(todayStart, -30);

    const weekInactiveResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', true)
      .lt('last_checkin_at', weekStart.toISOString());

    if (weekInactiveResult.error) {
      return Response.json({ error: '일주일 전 비활동 유저 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const monthInactiveResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', true)
      .lt('last_checkin_at', monthStart.toISOString());

    if (monthInactiveResult.error) {
      return Response.json({ error: '30일 이전 비활동 유저 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const beforeStartResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', true)
      .lt('last_checkin_at', dateRange.start.toISOString());

    if (beforeStartResult.error) {
      return Response.json({ error: '누적 비활동 유저 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const inactiveRows = await getInactiveRows(access.rhizome.id, dateRange.start, dateRange.endExclusive);
    const buckets = buildBuckets(dateRange);

    const chartData = buckets.reduce<{
      cumulativeInactiveCount: number;
      rows: {
        label: string;
        startDate: string;
        endDate: string;
        periodInactiveCount: number;
        cumulativeInactiveCount: number;
      }[];
    }>(
      (accumulator, bucket) => {
        const periodInactiveCount = inactiveRows.filter((row) => {
          const lastCheckinTime = getLastCheckinTime(row);

          return (
            lastCheckinTime !== null &&
            lastCheckinTime >= bucket.start.getTime() &&
            lastCheckinTime < bucket.end.getTime()
          );
        }).length;
        const cumulativeInactiveCount = accumulator.cumulativeInactiveCount + periodInactiveCount;

        return {
          cumulativeInactiveCount,
          rows: [
            ...accumulator.rows,
            {
              label: bucket.label,
              startDate: formatKstDate(bucket.start),
              endDate: formatKstDate(addDays(bucket.end, -1)),
              periodInactiveCount,
              cumulativeInactiveCount,
            },
          ],
        };
      },
      {
        cumulativeInactiveCount: getNumber(beforeStartResult.count),
        rows: [],
      },
    );

    return Response.json({
      site: {
        siteName: access.rhizome.site_key,
        siteLabel: access.rhizome.site_label,
        siteType: 'community',
      },
      summary: {
        weekInactiveMemberCount: weekInactiveResult.count ?? 0,
        monthInactiveMemberCount: monthInactiveResult.count ?? 0,
      },
      range: {
        type: requestedRange,
        unit: dateRange.unit,
        startDate: formatKstDate(dateRange.start),
        endDate: formatKstDate(addDays(dateRange.endExclusive, -1)),
      },
      chart: chartData.rows,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '비활동 유저 통계를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '비활동 유저 통계를 불러오지 못했습니다.' }, { status: 500 });
  }
}
