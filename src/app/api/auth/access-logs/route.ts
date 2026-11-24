import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getSessionClaims } from '@/lib/session/server';

const KOREA_REGION_NAMES: Record<string, string> = {
  '11': '서울',
  '26': '부산',
  '27': '대구',
  '28': '인천',
  '29': '광주',
  '30': '대전',
  '31': '울산',
  '41': '경기',
  '42': '강원',
  '43': '충북',
  '44': '충남',
  '45': '전북',
  '46': '전남',
  '47': '경북',
  '48': '경남',
  '49': '제주',
  '50': '세종',
  '51': '강원',
  '52': '전북',
};

const BROWSER_NAMES: Record<string, string> = {
  kakaotalk: '카카오톡',
  'naver-app': '네이버 앱',
  whale: '웨일',
  samsung: '삼성 인터넷',
  edge: '엣지',
  opera: '오페라',
  firefox: '파이어폭스',
  chrome: '크롬',
  safari: '사파리',
};

const OPERATING_SYSTEM_NAMES: Record<string, string> = {
  ios: 'iOS',
  android: '안드로이드',
  windows: '윈도우',
  macos: 'macOS',
  chromeos: '크롬 OS',
  linux: '리눅스',
};

const DEVICE_TYPE_NAMES: Record<string, string> = {
  mobile: '모바일',
  tablet: '태블릿',
  desktop: '데스크톱',
};

function getCountryName(country: string) {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}

function getAccessLocation(country: string | null, region: string | null) {
  if (!country) {
    return '알 수 없음';
  }

  if (country !== 'KR') {
    return `${getCountryName(country)} (${country})`;
  }

  const regionName = region ? KOREA_REGION_NAMES[region] : '';
  return regionName ? `대한민국 ${regionName}` : '대한민국';
}

function getAccessDevice(deviceKey: string) {
  const [browser = '', operatingSystem = '', deviceType = ''] = deviceKey.split('|');
  return [
    OPERATING_SYSTEM_NAMES[operatingSystem] ?? '기타 운영체제',
    BROWSER_NAMES[browser] ?? '기타 브라우저',
    DEVICE_TYPE_NAMES[deviceType] ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

function formatAccessDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const logResult = await getSupabaseAdmin()
      .from('stigma_access_logs')
      .select('id, ip_address, country, region, device_key, created_at')
      .eq('user_id', sessionClaims.userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (logResult.error) {
      return Response.json({ error: '접속 기록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json(
      {
        logs: (logResult.data ?? []).map((log) => ({
          id: log.id as string,
          createdAt: formatAccessDate(log.created_at as string),
          location: getAccessLocation(log.country as string | null, log.region as string | null),
          device: getAccessDevice(log.device_key as string),
          ipAddress: (log.ip_address as string | null) ?? '알 수 없음',
        })),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch {
    return Response.json({ error: '접속 기록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
