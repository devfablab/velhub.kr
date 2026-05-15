import { getSupabaseBrowser } from './supabase';

type DateInput = string | Date | null | undefined;

const parseDate = (value: DateInput): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

export function formatDate(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return '';

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatDateSimple(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return '';

  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

export function formatDateTimeDetail(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return '';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${hours}:${minutes}`;
}

export function formatDateTimeFull(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return '';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${hours}시 ${minutes}분 ${seconds}초`;
}

export function formatTimeAgo(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // 1분 미만
  if (diffInSeconds < 60) return '방금 전';

  const diffInHours = Math.floor(diffInSeconds / 3600);

  // 1분 ~ 60분 사이
  const diffInMinutes = Math.floor(diffInSeconds / 60);

  if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`;
  }

  // 24시간 미만: x시간 전
  if (diffInHours < 24) {
    return `${diffInHours}시간 전`;
  }

  // 정확한 개월/년수 계산을 위해 연도와 월 차이 계산
  const yearsDiff = now.getFullYear() - date.getFullYear();
  const monthsDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

  // 일수 차이 계산
  const diffInDays = Math.floor(diffInHours / 24);

  // 1일 ~ 30일: x일 전
  if (diffInDays <= 30) {
    return `${diffInDays}일 전`;
  }

  // 1개월 ~ 11개월: x개월 전
  if (monthsDiff < 12) {
    // 현재 날짜가 기준일보다 느리면 한 달을 뺌 (정확한 날짜 기준)
    const adjustedMonths = now.getDate() < date.getDate() ? monthsDiff - 1 : monthsDiff;
    return adjustedMonths <= 0 ? `${diffInDays}일 전` : `${adjustedMonths}개월 전`;
  }

  // 1년 이상: x년 전
  const adjustedYears =
    now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())
      ? yearsDiff - 1
      : yearsDiff;

  return `${adjustedYears || 1}년 전`;
}

export function normalizeText(value: string | string[] | null | undefined) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return '';
}

export function getOgImageUrl(value: string) {
  const imagePath = normalizeText(value);

  if (!imagePath) {
    return '';
  }

  const { data } = getSupabaseBrowser().storage.from('og-image').getPublicUrl(imagePath);

  return data.publicUrl || '';
}
