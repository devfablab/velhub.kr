import { getSupabaseAdmin } from '@/lib/supabase';

type WordRow = { word: string | null };

function normalizeWord(value: string) {
  return value.normalize('NFKC').normalize('NFC').trim().replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

function normalizeContent(value: string | null | undefined) {
  return decodeHtmlEntities(value ?? '')
    .normalize('NFKC')
    .normalize('NFC')
    .replace(/<[^>]*>/g, '')
    .replace(/[\s\p{Cf}\p{P}\p{S}\p{N}_]+/gu, '')
    .toLocaleLowerCase('ko-KR');
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&(nbsp|thinsp|ensp|emsp|zwnj|zwj);?/gi, (_, entity: string) =>
      entity.toLowerCase() === 'zwnj' ? '\u200c' : entity.toLowerCase() === 'zwj' ? '\u200d' : ' ',
    );
}

function hasKoreanLetterOnly(value: string) {
  return /^[\p{Script=Hangul}]+$/u.test(value);
}

const LEADING_JAMO = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];
const VOWEL_JAMO = [
  'ㅏ',
  'ㅐ',
  'ㅑ',
  'ㅒ',
  'ㅓ',
  'ㅔ',
  'ㅕ',
  'ㅖ',
  'ㅗ',
  'ㅘ',
  'ㅙ',
  'ㅚ',
  'ㅛ',
  'ㅜ',
  'ㅝ',
  'ㅞ',
  'ㅟ',
  'ㅠ',
  'ㅡ',
  'ㅢ',
  'ㅣ',
];
const TRAILING_JAMO = [
  '',
  'ㄱ',
  'ㄲ',
  'ㄳ',
  'ㄴ',
  'ㄵ',
  'ㄶ',
  'ㄷ',
  'ㄹ',
  'ㄺ',
  'ㄻ',
  'ㄼ',
  'ㄽ',
  'ㄾ',
  'ㄿ',
  'ㅀ',
  'ㅁ',
  'ㅂ',
  'ㅄ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

function toKoreanJamoSkeleton(value: string) {
  return Array.from(value.normalize('NFKD'))
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;

      if (codePoint >= 0x1100 && codePoint <= 0x1112) return LEADING_JAMO[codePoint - 0x1100];
      if (codePoint >= 0x1161 && codePoint <= 0x1175) return VOWEL_JAMO[codePoint - 0x1161];
      if (codePoint >= 0x11a8 && codePoint <= 0x11c2) return TRAILING_JAMO[codePoint - 0x11a7];

      return character;
    })
    .join('');
}

function containsBlockedWord(value: string, word: string) {
  const normalized = decodeHtmlEntities(value)
    .normalize('NFKC')
    .normalize('NFC')
    .replace(/<[^>]*>/g, '')
    .toLocaleLowerCase('ko-KR');
  const compact = normalizeContent(normalized);

  if (compact.includes(word)) {
    return true;
  }

  if (!hasKoreanLetterOnly(word)) {
    return false;
  }

  // 한글 금칙어 사이에 숫자, 다른 문자권 문자, 제로폭 문자, 기호 또는 자모를 끼워 넣은 우회를 막는다.
  const wordSkeleton = toKoreanJamoSkeleton(word);
  const contentSkeleton = toKoreanJamoSkeleton(normalized).replace(/[^ㄱ-ㅎㅏ-ㅣ]/g, '');

  return contentSkeleton.includes(wordSkeleton);
}

export type WordingProfilerInput = Record<string, string | null | undefined>;

export async function getWordingProfilerWords(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const [platformWords, siteWords] = await Promise.all([
    supabaseAdmin.from('denylist_words').select('word'),
    supabaseAdmin.from('site_denywords').select('word').eq('site_id', siteId),
  ]);

  if (platformWords.error || siteWords.error) {
    throw new Error('워딩 프로파일러 단어를 불러오지 못했습니다.');
  }

  return Array.from(
    new Set(
      [...(platformWords.data ?? []), ...(siteWords.data ?? [])]
        .map((row) => normalizeWord((row as WordRow).word ?? ''))
        .filter(Boolean),
    ),
  );
}

export async function getWordingProfilerViolationFields(siteId: string, input: WordingProfilerInput) {
  const words = await getWordingProfilerWords(siteId);

  if (words.length === 0) {
    return [];
  }

  return Object.entries(input)
    .filter(([, value]) => {
      const content = value ?? '';
      return Boolean(content) && words.some((word) => containsBlockedWord(content, word));
    })
    .map(([field]) => field);
}

export async function hasWordingProfilerViolation(siteId: string, input: WordingProfilerInput) {
  return (await getWordingProfilerViolationFields(siteId, input)).length > 0;
}

export const WORDING_PROFILER_POST_EDIT_ERROR = '혐오 표현이 여전히 존재합니다. 글 수정을 완료할 수 없습니다.';
export const WORDING_PROFILER_COMMENT_EDIT_ERROR = '혐오 표현이 여전히 존재합니다. 댓글 수정을 완료할 수 없습니다.';
