import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type VisibilityType = 'public' | 'private';
type ThemeType = 'default';
type JoinType = 'open' | 'invite';
type PolicyPost = 'comment_0' | 'comment_1' | 'comment_3' | 'comment_5';
type PolicyComment = 'estimate_0' | 'estimate_1' | 'estimate_3' | 'estimate_5';

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
    const trimmedPlanType = getFormText(formData, 'planType').trim();
    const visibilityValue = getFormText(formData, 'visibilityType');
    const themeValue = getFormText(formData, 'themeType');
    const joinTypeValue = getFormText(formData, 'joinType');
    const policyPostValue = getFormText(formData, 'policyPost');
    const policyCommentValue = getFormText(formData, 'policyComment');

    const visibilityType = isVisibilityType(visibilityValue) ? visibilityValue : 'public';
    const themeType = isThemeType(themeValue) ? themeValue : 'default';
    const isShutdown = getFormText(formData, 'isShutdown') === 'true';
    const joinType = isJoinType(joinTypeValue) ? joinTypeValue : 'open';
    const policyPost = isPolicyPost(policyPostValue) ? policyPostValue : 'comment_1';
    const policyComment = isPolicyComment(policyCommentValue) ? policyCommentValue : 'estimate_0';

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

    if (!trimmedPlanType) {
      return Response.json({ error: '요금제를 선택해주세요.' }, { status: 400 });
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

    const planResult = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('id', trimmedPlanType)
      .eq('category_key', 'community')
      .maybeSingle();

    if (planResult.error) {
      return Response.json({ error: planResult.error.message || '요금제 확인에 실패했습니다.' }, { status: 500 });
    }

    if (!planResult.data) {
      return Response.json({ error: '유효하지 않은 요금제입니다.' }, { status: 400 });
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

    const rpcResult = await supabaseAdmin.rpc('create_community_site', {
      p_owner_particle_id: particlesResult.data.id,
      p_owner_stigma_id: stigmaResult.data.id,
      p_site_key: normalizedSiteKey,
      p_site_label: finalSiteLabel,
      p_profile_picture: uploadedProfilePicture,
      p_summary: trimmedSummary,
      p_visibility_type: visibilityType,
      p_theme_type: themeType,
      p_plan_type: trimmedPlanType,
      p_is_shutdown: isShutdown,
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
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '커뮤니티 개설에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '커뮤니티 개설에 실패했습니다.' }, { status: 500 });
  }
}
