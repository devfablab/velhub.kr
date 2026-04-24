import path from 'path';
import sharp from 'sharp';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type LevelRequirementType = 'manual' | 'automatic';

type LevelRow = {
  id: string;
  lv: number;
  icon: string | null;
  name: string | null;
  description: string | null;
  requirement_type: LevelRequirementType;
  required_posts: number;
  required_comments: number;
  required_checkins: number;
  required_days: number;
  required_likes: number;
};

type SaveRequestBody = {
  action?: 'enable' | 'save' | 'delete-icon' | null;
  siteName?: string | null;
  levelId?: string | null;
  levels?: Array<LevelRow>;
};

const BUCKET_NAME = 'lv-icon';

function isAllowedRequirementType(value: string): value is LevelRequirementType {
  return value === 'manual' || value === 'automatic';
}

function normalizeNullableText(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  return normalizedValue ? normalizedValue : null;
}

function normalizeNumericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return Math.max(0, Math.floor(parsedValue));
    }
  }

  return 0;
}

function isSupabaseStorageValue(value: string | null | undefined) {
  return Boolean(value && value.startsWith('supabase:'));
}

function getStoragePath(value: string | null | undefined) {
  if (!isSupabaseStorageValue(value)) {
    return '';
  }

  return value!.replace('supabase:', '').trim();
}

function getLevelIconUrl(value: string | null | undefined) {
  const targetPath = getStoragePath(value);

  if (!targetPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(targetPath);

  return publicUrl.data.publicUrl ?? '';
}

function getSafeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === '.png' || extension === '.jpg' || extension === '.jpeg' || extension === '.svg') {
    return extension;
  }

  return '';
}

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (rhizome.data.site_type !== 'community') {
    return {
      ok: false,
      status: 403,
      error: '커뮤니티만 사용할 수 있습니다.',
    } as const;
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  if (session.case !== 'staff' || !session.stigmaId) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    supabaseAdmin,
    siteId: rhizome.data.id,
    siteName: rhizome.data.site_key,
    session,
  } as const;
}

async function getLevels(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const levelResult = await supabaseAdmin
    .from('community_levels')
    .select(
      'id, lv, icon, name, description, requirement_type, required_posts, required_comments, required_checkins, required_days, required_likes',
    )
    .eq('site_id', siteId)
    .order('lv', { ascending: true });

  if (levelResult.error) {
    return {
      ok: false,
      error: '등급 정보를 불러오지 못했습니다.',
    } as const;
  }

  return {
    ok: true,
    levels: (levelResult.data ?? []).map((level) => ({
      ...level,
      icon_url: getLevelIconUrl(level.icon),
    })),
  } as const;
}

async function deleteStorageFile(iconValue: string | null | undefined) {
  const targetPath = getStoragePath(iconValue);

  if (!targetPath) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.storage.from(BUCKET_NAME).remove([targetPath]);
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const levelsResult = await getLevels(access.siteId);

    if (!levelsResult.ok) {
      return Response.json({ error: levelsResult.error }, { status: 500 });
    }

    return Response.json({
      ok: true,
      enabled: levelsResult.levels.length > 0,
      levels: levelsResult.levels,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '등급 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '등급 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as SaveRequestBody;
    const action = requestBody.action ?? null;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (action === 'enable') {
      const existingLevels = await access.supabaseAdmin
        .from('community_levels')
        .select('id')
        .eq('site_id', access.siteId)
        .limit(1);

      if (existingLevels.error) {
        return Response.json({ error: '등업 시스템 생성에 실패했습니다.' }, { status: 500 });
      }

      if ((existingLevels.data ?? []).length > 0) {
        const levelsResult = await getLevels(access.siteId);

        if (!levelsResult.ok) {
          return Response.json({ error: levelsResult.error }, { status: 500 });
        }

        return Response.json({
          ok: true,
          enabled: true,
          levels: levelsResult.levels,
        });
      }

      const insertRows = Array.from({ length: 7 }, (_, index) => ({
        site_id: access.siteId,
        lv: index + 1,
        icon: null,
        name: null,
        description: null,
        requirement_type: 'manual',
        required_posts: 0,
        required_comments: 0,
        required_checkins: 0,
        required_days: 0,
        required_likes: 0,
      }));

      const insertResult = await access.supabaseAdmin.from('community_levels').insert(insertRows).select('id, lv');

      if (insertResult.error || !insertResult.data) {
        return Response.json({ error: '등업 시스템 생성에 실패했습니다.' }, { status: 500 });
      }

      const levelOne = insertResult.data.find((level) => level.lv === 1);

      if (!levelOne) {
        return Response.json({ error: '등업 시스템 생성에 실패했습니다.' }, { status: 500 });
      }

      const updateMembers = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          lv: levelOne.id,
        })
        .eq('site_id', access.siteId)
        .eq('is_approval', true);

      if (updateMembers.error) {
        return Response.json({ error: '등업 시스템 생성에 실패했습니다.' }, { status: 500 });
      }

      const levelsResult = await getLevels(access.siteId);

      if (!levelsResult.ok) {
        return Response.json({ error: levelsResult.error }, { status: 500 });
      }

      return Response.json({
        ok: true,
        enabled: true,
        levels: levelsResult.levels,
      });
    }

    if (action !== 'save') {
      return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
    }

    const nextLevels = Array.isArray(requestBody.levels) ? requestBody.levels : [];

    if (nextLevels.length !== 7) {
      return Response.json({ error: '등급 데이터가 올바르지 않습니다.' }, { status: 400 });
    }

    const currentLevelsResult = await access.supabaseAdmin
      .from('community_levels')
      .select(
        'id, lv, icon, name, description, requirement_type, required_posts, required_comments, required_checkins, required_days, required_likes',
      )
      .eq('site_id', access.siteId)
      .order('lv', { ascending: true });

    if (currentLevelsResult.error) {
      return Response.json({ error: '등급 저장에 실패했습니다.' }, { status: 500 });
    }

    const currentLevels = currentLevelsResult.data ?? [];

    if (currentLevels.length !== 7) {
      return Response.json({ error: '등업 시스템이 초기화되지 않았습니다.' }, { status: 400 });
    }

    const currentLevelMap = new Map(currentLevels.map((level) => [level.id, level]));
    const nextLvSet = new Set<number>();

    for (const level of nextLevels) {
      const currentLevel = currentLevelMap.get(level.id);

      if (!currentLevel) {
        return Response.json({ error: '등급 데이터가 올바르지 않습니다.' }, { status: 400 });
      }

      const normalizedLv = normalizeNumericValue(level.lv);

      if (normalizedLv < 1 || normalizedLv > 7 || nextLvSet.has(normalizedLv)) {
        return Response.json({ error: '등급 순서가 올바르지 않습니다.' }, { status: 400 });
      }

      nextLvSet.add(normalizedLv);

      const requirementType = normalizeText(level.requirement_type).toLowerCase();

      if (!isAllowedRequirementType(requirementType)) {
        return Response.json({ error: '등업방식이 올바르지 않습니다.' }, { status: 400 });
      }
    }

    for (const level of nextLevels) {
      const currentLevel = currentLevelMap.get(level.id)!;
      const nextIcon = level.icon ?? null;
      const nextRequirementType = normalizeText(level.requirement_type).toLowerCase();

      const updateResult = await access.supabaseAdmin
        .from('community_levels')
        .update({
          icon: nextIcon,
          name: normalizeNullableText(level.name),
          description: normalizeNullableText(level.description),
          requirement_type: isAllowedRequirementType(nextRequirementType) ? nextRequirementType : 'manual',
          required_posts: normalizeNumericValue(level.required_posts),
          required_comments: normalizeNumericValue(level.required_comments),
          required_checkins: normalizeNumericValue(level.required_checkins),
          required_days: normalizeNumericValue(level.required_days),
          required_likes: normalizeNumericValue(level.required_likes),
        })
        .eq('id', level.id)
        .eq('site_id', access.siteId);

      if (updateResult.error) {
        return Response.json({ error: '등급 저장에 실패했습니다.' }, { status: 500 });
      }

      if (currentLevel.icon !== nextIcon && currentLevel.icon) {
        await deleteStorageFile(currentLevel.icon);
      }
    }

    const levelsResult = await getLevels(access.siteId);

    if (!levelsResult.ok) {
      return Response.json({ error: levelsResult.error }, { status: 500 });
    }

    return Response.json({
      ok: true,
      enabled: true,
      levels: levelsResult.levels,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '등급 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '등급 저장에 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const formData = await request.formData();
    const rawSiteName = formData.get('siteName');
    const rawLevelId = formData.get('levelId');

    const siteName = normalizeText(typeof rawSiteName === 'string' ? rawSiteName : '').toLowerCase();
    const levelId = normalizeText(typeof rawLevelId === 'string' ? rawLevelId : '');
    const file = formData.get('file');

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!levelId) {
      return Response.json({ error: 'levelId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return Response.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const currentLevel = await access.supabaseAdmin
      .from('community_levels')
      .select('id, lv, icon')
      .eq('site_id', access.siteId)
      .eq('id', levelId)
      .maybeSingle();

    if (currentLevel.error || !currentLevel.data) {
      return Response.json({ error: '등급 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const extension = getSafeExtension(file.name);
    const mimeType = file.type.toLowerCase();

    if (!extension) {
      return Response.json({ error: 'png, jpg, svg 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const isSvg = extension === '.svg' || mimeType === 'image/svg+xml';
    const isPng = extension === '.png' || mimeType === 'image/png';
    const isJpg =
      extension === '.jpg' || extension === '.jpeg' || mimeType === 'image/jpeg' || mimeType === 'image/jpg';

    if (!isSvg && !isPng && !isJpg) {
      return Response.json({ error: 'png, jpg, svg 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);
    const inputBuffer = new Uint8Array(fileArrayBuffer);

    let uploadBuffer = fileBuffer;
    let uploadContentType = file.type || 'application/octet-stream';
    let uploadExtension = extension === '.jpeg' ? '.jpg' : extension;

    if (!isSvg) {
      uploadBuffer = Buffer.from(
        await sharp(inputBuffer)
          .resize(25, 25, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer(),
      );

      uploadContentType = 'image/png';
      uploadExtension = '.png';
    }

    const filePath = `site/${access.siteId}/lv-${currentLevel.data.lv}-${Date.now()}${uploadExtension}`;

    const uploadResult = await access.supabaseAdmin.storage.from(BUCKET_NAME).upload(filePath, uploadBuffer, {
      contentType: uploadContentType,
      upsert: false,
    });

    if (uploadResult.error) {
      return Response.json({ error: '아이콘 업로드에 실패했습니다.' }, { status: 500 });
    }

    const nextIconValue = `supabase:${filePath}`;

    const updateResult = await access.supabaseAdmin
      .from('community_levels')
      .update({
        icon: nextIconValue,
      })
      .eq('id', levelId)
      .eq('site_id', access.siteId);

    if (updateResult.error) {
      await access.supabaseAdmin.storage.from(BUCKET_NAME).remove([filePath]);
      return Response.json({ error: '아이콘 저장에 실패했습니다.' }, { status: 500 });
    }

    if (currentLevel.data.icon) {
      await deleteStorageFile(currentLevel.data.icon);
    }

    return Response.json({
      ok: true,
      levelId,
      icon: nextIconValue,
      iconUrl: getLevelIconUrl(nextIconValue),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '아이콘 업로드에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '아이콘 업로드에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const requestBody = (await request.json()) as SaveRequestBody;
    const action = requestBody.action ?? null;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const levelId = normalizeText(requestBody.levelId);

    if (action !== 'delete-icon') {
      return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!levelId) {
      return Response.json({ error: 'levelId가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const currentLevel = await access.supabaseAdmin
      .from('community_levels')
      .select('id, icon')
      .eq('site_id', access.siteId)
      .eq('id', levelId)
      .maybeSingle();

    if (currentLevel.error || !currentLevel.data) {
      return Response.json({ error: '등급 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateResult = await access.supabaseAdmin
      .from('community_levels')
      .update({
        icon: null,
      })
      .eq('id', levelId)
      .eq('site_id', access.siteId);

    if (updateResult.error) {
      return Response.json({ error: '아이콘 삭제에 실패했습니다.' }, { status: 500 });
    }

    if (currentLevel.data.icon) {
      await deleteStorageFile(currentLevel.data.icon);
    }

    return Response.json({
      ok: true,
      levelId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '아이콘 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '아이콘 삭제에 실패했습니다.' }, { status: 500 });
  }
}
