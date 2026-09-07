export function normalizeCustomDomain(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

export function getCustomDomainError(value: string) {
  if (!value) return '커스텀 도메인을 입력해주세요.';
  if (value.length > 253) return '커스텀 도메인은 253자 이하여야 합니다.';
  if (!value.includes('.')) return 'example.com 형식의 도메인을 입력해주세요.';
  if (
    value.split('.').some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
  ) {
    return '영문 소문자, 숫자, 하이픈(-), 점(.)만 사용할 수 있습니다.';
  }

  return null;
}
