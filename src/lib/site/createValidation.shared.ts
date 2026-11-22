import { getDisplayNameLength, hasValidDisplayNameCharacters, normalizeDisplayName } from '@/lib/users/displayName';

export const SITE_LABEL_MIN_LENGTH = 2;
export const SITE_LABEL_MAX_LENGTH = 10;

export function hasValidSiteLabelLength(value: string) {
  const length = getDisplayNameLength(normalizeDisplayName(value));
  return length >= SITE_LABEL_MIN_LENGTH && length <= SITE_LABEL_MAX_LENGTH;
}

export function isValidSiteLabel(value: string) {
  return hasValidSiteLabelLength(value) && hasValidDisplayNameCharacters(value);
}

export type SiteCreateFieldErrors = {
  siteKey: string;
  siteLabel: string;
  summary: string;
  profilePicture: string;
};

export const EMPTY_SITE_CREATE_FIELD_ERRORS: SiteCreateFieldErrors = {
  siteKey: '',
  siteLabel: '',
  summary: '',
  profilePicture: '',
};

export function getSiteKeyError(siteKey: string) {
  if (!siteKey) return '사이트 주소를 입력해 주세요.';
  if (/[^a-z0-9-]/.test(siteKey) || siteKey.includes('--')) {
    return "사이트 주소는 영문 소문자, 숫자, 하이픈('-')만 사용할 수 있습니다.";
  }
  if (/^\d/.test(siteKey)) return '사이트 주소는 숫자로 시작할 수 없습니다.';
  if (siteKey.length < 5 || siteKey.length > 15) return '사이트 주소는 5자 이상 15자 이하여야 합니다.';
  return '';
}

export function getSiteLabelError(siteKey: string, siteLabel: string) {
  if (!siteLabel) {
    return siteKey.length > SITE_LABEL_MAX_LENGTH ? '사이트 주소가 10자를 초과하므로 사이트명을 입력해 주세요.' : '';
  }
  return isValidSiteLabel(siteLabel)
    ? ''
    : `사이트명은 ${SITE_LABEL_MIN_LENGTH}자 이상 ${SITE_LABEL_MAX_LENGTH}자 이하여야 합니다.`;
}

export function getSiteSummaryError(summary: string) {
  return summary.length > 52 ? '사이트 설명은 52자 이하여야 합니다.' : '';
}

export function validateSiteCreateFields({
  siteKey,
  siteLabel,
  summary,
}: {
  siteKey: string;
  siteLabel: string;
  summary: string;
}) {
  const fieldErrors: SiteCreateFieldErrors = {
    ...EMPTY_SITE_CREATE_FIELD_ERRORS,
    siteKey: getSiteKeyError(siteKey),
    siteLabel: getSiteLabelError(siteKey, siteLabel),
    summary: getSiteSummaryError(summary),
  };

  return {
    fieldErrors,
    messages: Object.values(fieldErrors).filter(Boolean),
  };
}
