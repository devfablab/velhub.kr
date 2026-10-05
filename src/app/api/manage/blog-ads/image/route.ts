import crypto from 'crypto';
import sharp from 'sharp';
import {
  BLOG_AD_BUCKET,
  BLOG_AD_IMAGE_TYPES,
  MAX_BLOG_AD_IMAGE_SIZE,
  getBlogAdIdentityStatus,
  getBlogAdSiteContext,
} from '@/lib/blogAds/server';
import { normalizeText } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawSiteName = formData.get('siteName');
    const siteName = normalizeText(typeof rawSiteName === 'string' ? rawSiteName : '').toLowerCase();
    const file = formData.get('file');
    const context = await getBlogAdSiteContext(siteName);

    if (!context) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    if (!context.session.stigmaId || !['admin', 'staff', 'member'].includes(context.session.case)) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }
    if (!(file instanceof File)) return Response.json({ error: '업로드할 이미지가 없습니다.' }, { status: 400 });
    if (!BLOG_AD_IMAGE_TYPES.has(file.type.toLowerCase())) {
      return Response.json({ error: 'PNG, WEBP 이미지만 업로드할 수 있습니다.' }, { status: 400 });
    }
    if (file.size >= MAX_BLOG_AD_IMAGE_SIZE) {
      return Response.json({ error: '상품 썸네일은 1MB 미만만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const identity = await getBlogAdIdentityStatus(context.session.stigmaId);
    if (!identity.isIdentityVerified)
      return Response.json({ error: '광고를 설정하려면 본인인증이 필요합니다.' }, { status: 400 });
    if (!identity.isAtLeastAge14)
      return Response.json({ error: '만 14세 미만은 광고를 설정할 수 없습니다.' }, { status: 400 });

    let output: Buffer;
    try {
      output = await sharp(Buffer.from(await file.arrayBuffer()))
        .webp({ quality: 90 })
        .toBuffer();
    } catch {
      return Response.json({ error: '이미지 파일이 올바르지 않습니다.' }, { status: 400 });
    }

    const path = `${context.siteId}/${crypto.randomUUID()}.webp`;
    const uploaded = await context.supabaseAdmin.storage.from(BLOG_AD_BUCKET).upload(path, output, {
      contentType: 'image/webp',
      upsert: false,
    });
    if (uploaded.error) return Response.json({ error: '상품 썸네일 업로드에 실패했습니다.' }, { status: 500 });

    return Response.json({
      ok: true,
      path,
      url: context.supabaseAdmin.storage.from(BLOG_AD_BUCKET).getPublicUrl(path).data.publicUrl ?? '',
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message || '상품 썸네일 업로드에 실패했습니다.'
            : '상품 썸네일 업로드에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}
