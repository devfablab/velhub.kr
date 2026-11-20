export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 10;

const DISPLAY_NAME_CHARACTER_PATTERN =
  /^(?:[\p{L}\p{M}\p{N}()[\]{}_\- ]|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[‍️⃣])+$/u;

const graphemeSegmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

export function collapseDisplayNameSpaces(value: string) {
  return value.replace(/ {2,}/g, ' ');
}

export function normalizeDisplayName(value: string | null | undefined) {
  return collapseDisplayNameSpaces(typeof value === 'string' ? value : '').trim();
}

export function getDisplayNameLength(value: string) {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

export function limitDisplayNameInput(value: string) {
  const collapsedValue = collapseDisplayNameSpaces(value);
  const segments = Array.from(graphemeSegmenter.segment(collapsedValue));

  if (segments.length <= DISPLAY_NAME_MAX_LENGTH) {
    return collapsedValue;
  }

  return segments
    .slice(0, DISPLAY_NAME_MAX_LENGTH)
    .map((segment) => segment.segment)
    .join('');
}

export function hasValidDisplayNameLength(value: string) {
  const length = getDisplayNameLength(normalizeDisplayName(value));
  return length >= DISPLAY_NAME_MIN_LENGTH && length <= DISPLAY_NAME_MAX_LENGTH;
}

export function hasValidDisplayNameCharacters(value: string) {
  const normalizedValue = normalizeDisplayName(value);
  return DISPLAY_NAME_CHARACTER_PATTERN.test(normalizedValue) && !/ {2,}/.test(normalizedValue);
}

export function isValidDisplayName(value: string) {
  return hasValidDisplayNameLength(value) && hasValidDisplayNameCharacters(value);
}

export function getDisplayNameErrorMessage(value: string, label: '별명' | '활동명') {
  if (!hasValidDisplayNameLength(value)) {
    return `${label}은 2자 이상 10자 이하로 입력해 주세요.`;
  }

  if (!hasValidDisplayNameCharacters(value)) {
    return `${label}에는 글자, 숫자, 이모지, ( ) [ ] { } _ - 와 띄어쓰기 한 칸만 쓸 수 있습니다.`;
  }

  return '';
}

export function getDisplayNameLookupKey(value: string) {
  return normalizeDisplayName(value).toLowerCase();
}
