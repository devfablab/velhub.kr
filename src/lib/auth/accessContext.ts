import { getClientLocation } from '@/lib/clientRequest';

export const SECURITY_CHECK_REQUIRED_CODE = 'security_check_required';
export const SETTINGS_CHECK_REQUIRED_CODE = 'settings_check_required';

type HeaderReader = {
  get(name: string): string | null;
};

export type AccessContext = {
  regionKey: string;
  deviceKey: string;
};

function getBrowserName(userAgent: string) {
  if (/KAKAOTALK/i.test(userAgent)) return 'kakaotalk';
  if (/NAVER\(inapp/i.test(userAgent)) return 'naver-app';
  if (/Whale\//i.test(userAgent)) return 'whale';
  if (/SamsungBrowser\//i.test(userAgent)) return 'samsung';
  if (/Edg(e|A|iOS)?\//i.test(userAgent)) return 'edge';
  if (/OPR\/|Opera/i.test(userAgent)) return 'opera';
  if (/Firefox\/|FxiOS\//i.test(userAgent)) return 'firefox';
  if (/Chrome\/|CriOS\//i.test(userAgent)) return 'chrome';
  if (/Safari\//i.test(userAgent)) return 'safari';
  return 'other';
}

function getOperatingSystemName(userAgent: string) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macos';
  if (/CrOS/i.test(userAgent)) return 'chromeos';
  if (/Linux/i.test(userAgent)) return 'linux';
  return 'other';
}

function getDeviceType(userAgent: string) {
  if (/iPad|Tablet/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return 'tablet';
  if (/Mobi|iPhone|iPod/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export function getAccessContext(headerList: HeaderReader): AccessContext {
  const location = getClientLocation(headerList);
  const country = location.country || 'LOCAL';
  const countryRegion = location.region ?? '';
  const userAgent = headerList.get('user-agent') ?? '';

  return {
    regionKey: country === 'KR' ? `KR-${countryRegion || 'UNKNOWN'}` : country,
    deviceKey: [getBrowserName(userAgent), getOperatingSystemName(userAgent), getDeviceType(userAgent)].join('|'),
  };
}

export function getAccessContextKey(context: AccessContext) {
  return `${context.regionKey}#${context.deviceKey}`;
}
