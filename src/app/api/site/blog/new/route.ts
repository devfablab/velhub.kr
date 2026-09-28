import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { sanitizeSvg } from '@/lib/attachments/sanitizeSvg.server';
import { hasMembershipFeature } from '@/lib/memberships/features';
import { getSessionClaims } from '@/lib/session';
import { EMPTY_SITE_CREATE_FIELD_ERRORS, validateSiteCreateFields } from '@/lib/site/createValidation.shared';
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

function getFieldErrorResponse(field: keyof typeof EMPTY_SITE_CREATE_FIELD_ERRORS, error: string) {
  return Response.json(
    { error, fieldErrors: { ...EMPTY_SITE_CREATE_FIELD_ERRORS, [field]: error } },
    { status: 400 },
  );
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
  const shouldConvertToWebp = extension !== '.svg';
  const uploadBuffer = shouldConvertToWebp
    ? await sharp(inputBuffer).resize(72, 72, { fit: 'cover' }).webp({ lossless: true }).toBuffer()
    : extension === '.svg'
      ? sanitizeSvg(inputBuffer)
      : inputBuffer;
  const contentType = shouldConvertToWebp ? 'image/webp' : file.type;
  const outputExtension = shouldConvertToWebp ? '.webp' : '.svg';
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

  while (true) {
    const suffix = String(nextNumber);
    const candidate = [...normalizedBaseLabel].slice(0, 10 - suffix.length).join('') + suffix;

    if (!usedLabels.has(candidate)) {
      return candidate;
    }

    nextNumber += 1;
  }
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

    const validation = validateSiteCreateFields({
      siteKey: normalizedSiteKey,
      siteLabel: trimmedSiteLabel,
      summary: trimmedSummary,
    });

    if (validation.messages.length > 0) {
      return Response.json({ error: validation.messages[0], fieldErrors: validation.fieldErrors }, { status: 400 });
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

    try {
      const hasUnlimitedSites = await hasMembershipFeature(stigmaResult.data.id, 'owner_unlimited_sites');

      if (!hasUnlimitedSites) {
        const siteCountResult = await supabaseAdmin
          .from('rhizomes')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', stigmaResult.data.id)
          .eq('site_type', 'blog');

        if (siteCountResult.error) {
          return Response.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
        }

        if ((siteCountResult.count ?? 0) >= 1) {
          return Response.json({ error: '기본 오너 멤버십에서는 블로그를 1개만 개설할 수 있습니다.' }, { status: 403 });
        }
      }
    } catch {
      return Response.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
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
      return getFieldErrorResponse('siteKey', '사용할 수 없는 사이트 주소입니다.');
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
      return getFieldErrorResponse('siteKey', '사용할 수 없는 사이트 주소입니다.');
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
        return getFieldErrorResponse('siteLabel', '이미 사용 중인 사이트명입니다.');
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
        return getFieldErrorResponse(
          'profilePicture',
          uploadError instanceof Error ? uploadError.message : '프로필 이미지 업로드에 실패했습니다.',
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
    console.error('create_blog_site 요청 실패:', unknownError);
    return Response.json({ error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
