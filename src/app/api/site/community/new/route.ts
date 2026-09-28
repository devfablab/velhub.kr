import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { sanitizeSvg } from '@/lib/attachments/sanitizeSvg.server';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { hasMembershipFeature } from '@/lib/memberships/features';
import { getSessionClaims } from '@/lib/session';
import { EMPTY_SITE_CREATE_FIELD_ERRORS, validateSiteCreateFields } from '@/lib/site/createValidation.shared';
import { getSupabaseAdmin } from '@/lib/supabase';

type VisibilityType = 'public' | 'private';
type ThemeType = 'default';
type JoinType = 'open' | 'invite';
type PolicyPost = 'comment_0' | 'comment_1' | 'comment_3' | 'comment_5';
type PolicyComment = 'estimate_0' | 'estimate_1' | 'estimate_3' | 'estimate_5';

const AVATAR_BUCKET = 'avatar';

function isAtLeast14(birthDate: string | null) {
  const digits = String(birthDate ?? '').replace(/\D/g, '');

  if (digits.length !== 8) {
    return false;
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age >= 14;
}

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

function isJoinType(value: unknown): value is JoinType {
  return value === 'open' || value === 'invite';
}

function isPolicyPost(value: unknown): value is PolicyPost {
  return value === 'comment_0' || value === 'comment_1' || value === 'comment_3' || value === 'comment_5';
}

function isPolicyComment(value: unknown): value is PolicyComment {
  return value === 'estimate_0' || value === 'estimate_1' || value === 'estimate_3' || value === 'estimate_5';
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

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const profilePictureFile = formData.get('profilePicture');

    const normalizedSiteKey = normalizeSiteKey(getFormText(formData, 'siteKey').trim());
    const trimmedSiteLabel = getFormText(formData, 'siteLabel').trim();
    const trimmedSummary = getFormText(formData, 'summary').trim();
    const visibilityValue = getFormText(formData, 'visibilityType');
    const themeValue = getFormText(formData, 'themeType');
    const joinTypeValue = getFormText(formData, 'joinType');
    const policyPostValue = getFormText(formData, 'policyPost');
    const policyCommentValue = getFormText(formData, 'policyComment');

    const visibilityType = isVisibilityType(visibilityValue) ? visibilityValue : 'public';
    const themeType = isThemeType(themeValue) ? themeValue : 'default';
    const joinType = isJoinType(joinTypeValue) ? joinTypeValue : 'open';
    const policyPost = isPolicyPost(policyPostValue) ? policyPostValue : 'comment_1';
    const policyComment = isPolicyComment(policyCommentValue) ? policyCommentValue : 'estimate_0';

    const validation = validateSiteCreateFields({
      siteKey: normalizedSiteKey,
      siteLabel: trimmedSiteLabel,
      summary: trimmedSummary,
    });

    if (validation.messages.length > 0) {
      return Response.json({ error: validation.messages[0], fieldErrors: validation.fieldErrors }, { status: 400 });
    }

    const finalSiteLabel = trimmedSiteLabel || normalizedSiteKey;

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

    const identityResult = await supabaseAdmin
      .from('chorogons')
      .select('birth_date, birth_date_dummy')
      .eq('user_id', stigmaResult.data.id)
      .maybeSingle();

    if (identityResult.error) {
      return Response.json({ error: '본인인증 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!isAtLeast14(getChorogonBirthDate(identityResult.data))) {
      return Response.json(
        { error: '커뮤니티는 데브허브 정책상 만 14세 이상부터 만들 수 있어요. 😭' },
        { status: 403 },
      );
    }

    try {
      const hasUnlimitedSites = await hasMembershipFeature(stigmaResult.data.id, 'owner_unlimited_sites');

      if (!hasUnlimitedSites) {
        const siteCountResult = await supabaseAdmin
          .from('rhizomes')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', stigmaResult.data.id)
          .eq('site_type', 'community');

        if (siteCountResult.error) {
          return Response.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
        }

        if ((siteCountResult.count ?? 0) >= 1) {
          return Response.json(
            { error: '기본 오너 멤버십에서는 커뮤니티를 1개만 개설할 수 있습니다.' },
            { status: 403 },
          );
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

    const rpcResult = await supabaseAdmin.rpc('create_community_site', {
      p_owner_particle_id: particlesResult.data.id,
      p_owner_stigma_id: stigmaResult.data.id,
      p_site_key: normalizedSiteKey,
      p_site_label: finalSiteLabel,
      p_profile_picture: uploadedProfilePicture,
      p_summary: trimmedSummary,
      p_visibility_type: visibilityType,
      p_theme_type: themeType,
      p_is_shutdown: false,
      p_join_type: joinType,
      p_policy_post: policyPost,
      p_policy_comment: policyComment,
    });

    if (rpcResult.error || !rpcResult.data) {
      if (uploadedProfilePicture) {
        await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([uploadedProfilePicture]);
      }

      console.error('create_community_site rpc 실패:', rpcResult.error);
      return Response.json({ error: rpcResult.error?.message || '커뮤니티 개설에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteId: rpcResult.data,
      siteKey: normalizedSiteKey,
    });
  } catch (unknownError) {
    console.error('create_community_site 요청 실패:', unknownError);
    return Response.json({ error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
