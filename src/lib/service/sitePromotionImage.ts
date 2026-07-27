import { getSiteOgAccess } from '@/lib/service/siteOgImage';

export const SITE_PROMOTION_BUCKET = 'promotion-image';
export const MAX_SITE_PROMOTION_FILE_SIZE = 1024 * 1024;
export const SITE_PROMOTION_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export { getSiteOgAccess as getSitePromotionAccess };
