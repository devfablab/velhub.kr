import sharp from 'sharp';
import { getR2PublicUrl } from '@/lib/clients/r2Public';
import { r2Storage } from '@/lib/clients/r2Storage';

export const POST_COMMENT_IMAGE_BUCKET = 'comment-images';
export const BLOG_COMMUNITY_COMMENT_IMAGE_BUCKET = 'blog-comment-images';

const MAX_COMMENT_IMAGE_FILE_SIZE = 1024 * 1024;
const ALLOWED_IMAGE_FORMATS = new Set(['png', 'jpeg', 'webp']);

export type CommentImageBucket = typeof POST_COMMENT_IMAGE_BUCKET | typeof BLOG_COMMUNITY_COMMENT_IMAGE_BUCKET;

export type CommentRequestPayload = {
  fields: Record<string, unknown>;
  imageFile: File | null;
  shouldRemoveImage: boolean;
};

export type UploadedCommentImage = {
  path: string;
  width: number | null;
  height: number | null;
};

export async function readCommentRequest(request: Request): Promise<CommentRequestPayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (!contentType.includes('multipart/form-data')) {
    const fields = ((await request.json()) ?? {}) as Record<string, unknown>;

    return { fields, imageFile: null, shouldRemoveImage: fields.removeImage === true };
  }

  const formData = await request.formData();
  const fields: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    if (typeof value === 'string') fields[key] = value;
  });

  const image = formData.get('image');

  return {
    fields,
    imageFile: image instanceof File && image.size > 0 ? image : null,
    shouldRemoveImage: fields.removeImage === 'true',
  };
}

export async function uploadCommentImage({
  bucket,
  siteId,
  stigmaId,
  file,
}: {
  bucket: CommentImageBucket;
  siteId: string;
  stigmaId: string;
  file: File;
}): Promise<UploadedCommentImage> {
  if (file.size >= MAX_COMMENT_IMAGE_FILE_SIZE) {
    throw new Error('댓글 이미지는 1MB 미만으로 올려주세요.');
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(fileBuffer).metadata();
  } catch {
    throw new Error('webp, png, jpg 이미지만 올릴 수 있습니다.');
  }

  if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) {
    throw new Error('webp, png, jpg 이미지만 올릴 수 있습니다.');
  }

  const output = await sharp(fileBuffer).rotate().webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const path = `${siteId}/${stigmaId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
  const uploadResult = await r2Storage.from(bucket).upload(path, output.data, {
    contentType: 'image/webp',
    upsert: false,
  });

  if (uploadResult.error) {
    throw new Error('댓글 이미지 업로드에 실패했습니다.');
  }

  return { path, width: output.info.width ?? null, height: output.info.height ?? null };
}

export async function removeCommentImage(bucket: CommentImageBucket, path: string | null | undefined) {
  if (!path) return;

  await r2Storage
    .from(bucket)
    .remove([path])
    .catch(() => undefined);
}

export function getCommentImageUrl(bucket: CommentImageBucket, path: string | null | undefined) {
  return path ? getR2PublicUrl(bucket, path) : '';
}
