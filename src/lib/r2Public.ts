const R2_BUCKET_NAMES: Record<string, string> = {
  avatar: 'avatars',
  'blog-ad-images': 'blog-add-images',
  'blog-badges': 'blog-badges',
  'blog-community': 'blog-communities',
  'business-license': 'business-license',
  category: 'categories',
  community_answer: 'community-answers',
  community_links: 'community-links',
  'cover-image': 'cover-images',
  'family-relation-certificates': 'family-relation-certificates',
  'inquiry-attachments': 'inquiry-attachments',
  'lv-icon': 'lv-icons',
  manager_icon: 'manager-icons',
  'og-image': 'og-images',
  post: 'posts',
  'private-post-images': 'private-post-images',
  'promotion-image': 'promotion-images',
  'report-appeals': 'report-appeals',
  'report-legals': 'report-legals',
  'report-rights': 'report-rights',
  series: 'series',
  'site-logo': 'site-logos',
  'site-og': 'site-ogs',
  profile_logo: 'site-logos',
  profile_picture: 'avatars',
};

const R2_PUBLIC_BUCKETS = new Set([
  'avatars',
  'blog-add-images',
  'blog-badges',
  'blog-communities',
  'categories',
  'community-answers',
  'community-links',
  'cover-images',
  'lv-icons',
  'manager-icons',
  'og-images',
  'posts',
  'promotion-images',
  'series',
  'site-logos',
  'site-ogs',
]);

export function isR2PublicBucket(bucket: string) {
  return R2_PUBLIC_BUCKETS.has(resolveR2BucketName(bucket));
}

export function resolveR2BucketName(bucket: string) {
  const resolvedBucket = R2_BUCKET_NAMES[bucket] ?? bucket;

  if (!resolvedBucket) {
    throw new Error('R2 버킷 이름이 올바르지 않습니다.');
  }

  return resolvedBucket;
}

export function getR2ObjectPath(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return '';
  }

  try {
    const url = new URL(normalizedValue);
    return url.pathname.replace(/^\//, '');
  } catch {
    return normalizedValue.replace(/^\//, '');
  }
}

export function getR2PublicUrl(bucket: string, value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const normalizedValue = value.trim();

  try {
    const url = new URL(normalizedValue);
    const isR2PublicUrl = url.hostname === 'dist.velhub.xyz' || url.hostname.endsWith('.dist.velhub.xyz');

    if (!isR2PublicUrl) {
      return normalizedValue;
    }
  } catch {
    // 저장된 경로는 아래에서 R2 공개 URL로 변환한다.
  }

  const r2Bucket = resolveR2BucketName(bucket);
  const objectPath = getR2ObjectPath(normalizedValue);

  if (!objectPath || !R2_PUBLIC_BUCKETS.has(r2Bucket)) {
    return '';
  }

  const baseUrl = r2Bucket === 'blog-badges' ? 'https://dist.velhub.xyz' : `https://${r2Bucket}.dist.velhub.xyz`;

  return `${baseUrl}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}

export const r2PublicStorage = {
  from(bucket: string) {
    return {
      getPublicUrl(value: string) {
        return {
          data: {
            publicUrl: getR2PublicUrl(bucket, value),
          },
        };
      },
    };
  },
};

export const r2BucketMappings = R2_BUCKET_NAMES;
