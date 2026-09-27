export const MEDIA_BOARD_PAGE_SIZES = [6, 9, 12, 15, 30] as const;
export const LIST_BOARD_PAGE_SIZES = [5, 10, 20, 30, 50] as const;

export const DEFAULT_MEDIA_BOARD_PAGE_SIZE = 9;
export const DEFAULT_LIST_BOARD_PAGE_SIZE = 20;

type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed' | 'page' | 'blog';

export function isMediaBoardPageSize(siteType: string, boardType: BoardType) {
  return siteType === 'blog' || boardType === 'blog' || boardType === 'gallery' || boardType === 'youtube';
}

export function normalizePageSize(
  value: string | string[] | null | undefined,
  options: readonly number[],
  fallback: number,
) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const parsedValue = Number(normalizedValue);

  return options.includes(parsedValue) ? parsedValue : fallback;
}
