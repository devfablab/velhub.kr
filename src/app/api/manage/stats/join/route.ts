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

type JoinCreatedRow = {
  created_at: string | null;
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

function getCreatedTime(row: JoinCreatedRow) {
  if (!row.created_at) {
    return null;
  }

  const createdTime = new Date(row.created_at).getTime();

  if (Number.isNaN(createdTime)) {
    return null;
  }

  return createdTime;
}

async function getJoinRows(siteId: string, start: Date, endExclusive: Date, from = 0): Promise<JoinCreatedRow[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const to = from + 999;

  const joinResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('created_at')
    .eq('site_id', siteId)
    .eq('is_approval', true)
    .gte('created_at', start.toISOString())
    .lt('created_at', endExclusive.toISOString())
    .range(from, to);

  if (joinResult.error) {
    throw new Error('가입자수 정보를 불러오지 못했습니다.');
  }

  const rows = (joinResult.data ?? []) as JoinCreatedRow[];

  if (rows.length < 1000) {
    return rows;
  }

  const nextRows = await getJoinRows(siteId, start, endExclusive, to + 1);

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
    const tomorrowStart = addDays(todayStart, 1);

    const todayApprovedResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', true)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString());

    if (todayApprovedResult.error) {
      return Response.json({ error: '오늘 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const todayUnapprovedResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', false)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString());

    if (todayUnapprovedResult.error) {
      return Response.json({ error: '오늘 비승인 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const totalApprovedResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', true);

    if (totalApprovedResult.error) {
      return Response.json({ error: '총 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const beforeStartResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', true)
      .lt('created_at', dateRange.start.toISOString());

    if (beforeStartResult.error) {
      return Response.json({ error: '누적 가입자 수를 불러오지 못했습니다.' }, { status: 500 });
    }

    const joinRows = await getJoinRows(access.rhizome.id, dateRange.start, dateRange.endExclusive);
    const buckets = buildBuckets(dateRange);

    const chartData = buckets.reduce<{
      cumulativeJoinCount: number;
      rows: {
        label: string;
        startDate: string;
        endDate: string;
        periodJoinCount: number;
        cumulativeJoinCount: number;
      }[];
    }>(
      (accumulator, bucket) => {
        const periodJoinCount = joinRows.filter((row) => {
          const createdTime = getCreatedTime(row);

          return createdTime !== null && createdTime >= bucket.start.getTime() && createdTime < bucket.end.getTime();
        }).length;
        const cumulativeJoinCount = accumulator.cumulativeJoinCount + periodJoinCount;

        return {
          cumulativeJoinCount,
          rows: [
            ...accumulator.rows,
            {
              label: bucket.label,
              startDate: formatKstDate(bucket.start),
              endDate: formatKstDate(addDays(bucket.end, -1)),
              periodJoinCount,
              cumulativeJoinCount,
            },
          ],
        };
      },
      {
        cumulativeJoinCount: getNumber(beforeStartResult.count),
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
        todayApprovedJoinCount: todayApprovedResult.count ?? 0,
        todayUnapprovedJoinCount: todayUnapprovedResult.count ?? 0,
        todayTotalJoinCount: getNumber(todayApprovedResult.count) + getNumber(todayUnapprovedResult.count),
        totalApprovedJoinCount: totalApprovedResult.count ?? 0,
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
      return Response.json({ error: unknownError.message || '가입자수 통계를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '가입자수 통계를 불러오지 못했습니다.' }, { status: 500 });
  }
}
