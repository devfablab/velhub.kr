import { ACTIVITY_NAME_MAX_LENGTH, ACTIVITY_NAME_MIN_LENGTH, isValidActivityName } from '@/lib/auth/emailSignUp';

export function normalizeFavoriteFolderLabel(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateFavoriteFolderLabel(value: unknown) {
  const label = normalizeFavoriteFolderLabel(value);

  return {
    label,
    error: isValidActivityName(label)
      ? ''
      : `폴더 이름은 ${ACTIVITY_NAME_MIN_LENGTH}자 이상 ${ACTIVITY_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`,
  };
}

export const DEFAULT_FAVORITE_FOLDER_LABEL = '기본 폴더';

export type FavoriteFolder = {
  id: string;
  label: string;
  isDefault: boolean;
  sortOrder: number;
};

export type FavoriteBlog = {
  id: string;
  siteName: string;
  siteLabel: string;
  visibilityType: string;
  visibilityLabel: string;
  isShutdown: boolean;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
  profileLogoWidth: number | null;
  profileLogoHeight: number | null;
  href: string;
  favoritedAt: string;
  folderId: string;
  sortOrder: number;
};

export type FavoriteBlogsResponse = {
  blogs?: FavoriteBlog[];
  folders?: FavoriteFolder[];
  canUseFolders?: boolean;
  error?: string;
};

export function sortFavoriteFolders(folders: FavoriteFolder[]) {
  return [...folders].sort((first, second) => first.sortOrder - second.sortOrder);
}

export function getFolderBlogs(blogs: FavoriteBlog[], folderId: string) {
  return blogs.filter((blog) => blog.folderId === folderId).sort((first, second) => first.sortOrder - second.sortOrder);
}

export function sortFavoriteBlogs(blogs: FavoriteBlog[], folders: FavoriteFolder[]) {
  return sortFavoriteFolders(folders).flatMap((folder) => getFolderBlogs(blogs, folder.id));
}

let pendingFavoriteRequest: Promise<unknown> = Promise.resolve();

export function trackFavoriteRequest<T>(request: Promise<T>) {
  pendingFavoriteRequest = Promise.allSettled([pendingFavoriteRequest, request]);

  return request;
}

export function waitForFavoriteRequests() {
  return pendingFavoriteRequest;
}
