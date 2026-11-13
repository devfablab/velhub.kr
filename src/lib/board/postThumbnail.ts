import { getR2PublicUrl } from '@/lib/clients/r2Public';
import { normalizeText } from '@/lib/utils';

export const AUTO_OG_IMAGE_WIDTH = 1200;
export const AUTO_OG_IMAGE_HEIGHT = 630;

export function getAutoOgImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  return getR2PublicUrl('og-image', normalizedPath) || '';
}

export function getPostThumbnailUrl(thumbnailUrl: string | null | undefined, autoOgImage: string | null | undefined) {
  return normalizeText(thumbnailUrl) || getAutoOgImageUrl(autoOgImage);
}

export function getImageWithAutoOg(
  imageUrl: string | null | undefined,
  width: number | null | undefined,
  height: number | null | undefined,
  autoOgImage: string | null | undefined,
) {
  const normalizedImageUrl = normalizeText(imageUrl);

  if (normalizedImageUrl) {
    return { url: normalizedImageUrl, width: width ?? null, height: height ?? null };
  }

  const autoOgImageUrl = getAutoOgImageUrl(autoOgImage);

  return autoOgImageUrl
    ? { url: autoOgImageUrl, width: AUTO_OG_IMAGE_WIDTH, height: AUTO_OG_IMAGE_HEIGHT }
    : { url: '', width: width ?? null, height: height ?? null };
}
