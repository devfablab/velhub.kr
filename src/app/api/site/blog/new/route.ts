import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type VisibilityType = 'public' | 'private';
type ThemeType = 'default';
type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';

const AVATAR_BUCKET = 'avatar';

function normalizeSiteKey(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

function isVisibilityType(value: unknown): value is VisibilityType {
  return value === 'public' || value === 'private';
}

function isThemeType(value: unknown): value is ThemeType {
  return value === 'default';
}

function isCommentProvider(value: unknown): value is CommentProvider {
  return value === 'none' || value === 'giscus' || value === 'disqus' || value === 'velhub';
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function isAllowedProfilePictureFile(file: File) {
  const extension = path.extname(file.name).toLowerCase();

  return (
    (extension === '.png' && file.type === 'image/png') ||
    ((extension === '.jpg' || extension === '.jpeg') && file.type === 'image/jpeg') ||
    (extension === '.webp' && file.type === 'image/webp') ||
    (extension === '.svg' && file.type === 'image/svg+xml')
  );
}

async function uploadProfilePicture({
  supabaseAdmin,
  authUserId,
  file,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  authUserId: string;
  file: File;
}) {
  if (!isAllowedProfilePictureFile(file)) {
    throw new Error('PNG, JPG, WEBP, SVG 파일만 업로드할 수 있습니다.');
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name).toLowerCase();
  const shouldConvertToWebp = extension === '.png' || extension === '.jpg' || extension === '.jpeg';
  const uploadBuffer = shouldConvertToWebp ? await sharp(inputBuffer).webp({ lossless: true }).toBuffer() : inputBuffer;
  const contentType = shouldConvertToWebp ? 'image/webp' : file.type;
  const outputExtension = shouldConvertToWebp ? '.webp' : extension;
  const storagePath = `site/${authUserId}/${crypto.randomUUID()}${outputExtension}`;

  const uploadResult = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(storagePath, uploadBuffer, {
    contentType,
    upsert: false,
  });

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || '프로필 이미지 업로드에 실패했습니다.');
  }

  return storagePath;
}

async function resolveUniqueSiteLabel(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, baseLabel: string) {
  const normalizedBaseLabel = normalizeText(baseLabel);

  if (!normalizedBaseLabel) {
    return '';
  }

  const exactResult = await supabaseAdmin
    .from('rhizomes')
    .select('id')
    .eq('site_label', normalizedBaseLabel)
    .maybeSingle();

  if (exactResult.error) {
    throw new Error('사이트명 확인에 실패했습니다.');
  }

  if (!exactResult.data) {
    return normalizedBaseLabel;
  }

  const likePattern = `${normalizedBaseLabel}%`;

  const similarResult = await supabaseAdmin.from('rhizomes').select('site_label').like('site_label', likePattern);

  if (similarResult.error) {
    throw new Error('사이트명 확인에 실패했습니다.');
  }

  const usedLabels = new Set((similarResult.data ?? []).map((row) => normalizeText(row.site_label)).filter(Boolean));

  let nextNumber = 1;

  while (usedLabels.has(`${normalizedBaseLabel}${nextNumber}`)) {
    nextNumber += 1;
  }

  return `${normalizedBaseLabel}${nextNumber}`;
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const profilePictureFile = formData.get('profilePicture');

    const normalizedSiteKey = normalizeSiteKey(getFormText(formData, 'siteKey').trim());
    const trimmedSiteLabel = normalizeText(getFormText(formData, 'siteLabel'));
    const trimmedSummary = getFormText(formData, 'summary').trim();
    const visibilityValue = getFormText(formData, 'visibilityType');
    const themeValue = getFormText(formData, 'themeType');
    const commentProviderValue = getFormText(formData, 'commentProvider');

    const visibilityType = isVisibilityType(visibilityValue) ? visibilityValue : 'public';
    const themeType = isThemeType(themeValue) ? themeValue : 'default';
    const commentProvider = isCommentProvider(commentProviderValue) ? commentProviderValue : 'disqus';

    if (!normalizedSiteKey) {
      return Response.json({ error: '사이트 주소를 입력해주세요.' }, { status: 400 });
    }

    if (hasInvalidCharacters(normalizedSiteKey)) {
      return Response.json({ error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다." }, { status: 400 });
    }

    if (/^\d/.test(normalizedSiteKey)) {
      return Response.json({ error: '사이트 주소는 숫자로 시작할 수 없습니다.' }, { status: 400 });
    }

    if (normalizedSiteKey.length < 5 || normalizedSiteKey.length > 15) {
      return Response.json({ error: '사이트 주소는 5자 이상 15자 이하여야 합니다.' }, { status: 400 });
    }

    if (trimmedSiteLabel && (trimmedSiteLabel.length < 4 || trimmedSiteLabel.length > 10)) {
      return Response.json({ error: '사이트명은 4자 이상 10자 이하여야 합니다.' }, { status: 400 });
    }

    if (trimmedSummary.length > 52) {
      return Response.json({ error: '사이트 설명은 52자 이하여야 합니다.' }, { status: 400 });
    }

    if (normalizedSiteKey.includes('--')) {
      return Response.json({ error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const particlesResult = await supabaseAdmin
      .from('particles')
      .select('id')
      .eq('id', sessionClaims.userId)
      .maybeSingle();

    if (particlesResult.error || !particlesResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const denylistResult = await supabaseAdmin
      .from('denylist')
      .select('word')
      .eq('word', normalizedSiteKey)
      .maybeSingle();

    if (denylistResult.error) {
      return Response.json({ error: '사이트 주소 확인에 실패했습니다.' }, { status: 500 });
    }

    if (denylistResult.data) {
      return Response.json({ error: '사용할 수 없는 사이트 주소입니다.' }, { status: 400 });
    }

    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id')
      .eq('site_key', normalizedSiteKey)
      .maybeSingle();

    if (rhizomeResult.error) {
      return Response.json({ error: '사이트 주소 확인에 실패했습니다.' }, { status: 500 });
    }

    if (rhizomeResult.data) {
      return Response.json({ error: '사용할 수 없는 사이트 주소입니다.' }, { status: 400 });
    }

    let finalSiteLabel = '';

    if (trimmedSiteLabel) {
      const siteLabelResult = await supabaseAdmin
        .from('rhizomes')
        .select('id')
        .eq('site_label', trimmedSiteLabel)
        .maybeSingle();

      if (siteLabelResult.error) {
        return Response.json({ error: '사이트명 확인에 실패했습니다.' }, { status: 500 });
      }

      if (siteLabelResult.data) {
        return Response.json({ error: '이미 사용 중인 사이트명입니다.' }, { status: 400 });
      }

      finalSiteLabel = trimmedSiteLabel;
    } else {
      finalSiteLabel = await resolveUniqueSiteLabel(supabaseAdmin, normalizedSiteKey);
    }

    let uploadedProfilePicture = '';

    if (profilePictureFile instanceof File) {
      try {
        uploadedProfilePicture = await uploadProfilePicture({
          supabaseAdmin,
          authUserId: sessionClaims.userId,
          file: profilePictureFile,
        });
      } catch (uploadError) {
        return Response.json(
          { error: uploadError instanceof Error ? uploadError.message : '프로필 이미지 업로드에 실패했습니다.' },
          { status: 400 },
        );
      }
    }

    const rpcResult = await supabaseAdmin.rpc('create_blog_site', {
      p_owner_particle_id: particlesResult.data.id,
      p_owner_stigma_id: stigmaResult.data.id,
      p_site_key: normalizedSiteKey,
      p_site_label: finalSiteLabel,
      p_profile_picture: uploadedProfilePicture,
      p_summary: trimmedSummary,
      p_visibility_type: visibilityType,
      p_theme_type: themeType,
      p_plan_type: null,
      p_is_shutdown: false,
      p_comment_provider: commentProvider,
    });

    if (rpcResult.error || !rpcResult.data) {
      if (uploadedProfilePicture) {
        await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([uploadedProfilePicture]);
      }

      console.error('create_blog_site rpc 실패:', rpcResult.error);
      return Response.json({ error: rpcResult.error?.message || '블로그 개설에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteId: rpcResult.data,
      siteKey: normalizedSiteKey,
      siteLabel: finalSiteLabel,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '블로그 개설에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '블로그 개설에 실패했습니다.' }, { status: 500 });
  }
}
