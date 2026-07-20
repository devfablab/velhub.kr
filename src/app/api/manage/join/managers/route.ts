import path from 'path';
import sharp from 'sharp';
import {
  buildCommunityManagerList,
  getBoardSummaries,
  getCommunityManagerAccess,
} from '@/lib/community/community-manager/utils';
import { getOwnerTransferAvailability } from '@/lib/community/ownerTransfers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

const BUCKET_NAME = 'manager_icon';

const MANAGER_ICON_ROLES = [
  'owner',
  'community-manager',
  'board-manager',
  'board-general-manager',
  'board-assistant-manager',
] as const;

type ManagerIconRole = (typeof MANAGER_ICON_ROLES)[number];

type ManagerIconRow = {
  id: string;
  created_at: string;
  role: ManagerIconRole;
  icon: string | null;
  site_id: string;
};

type IconRequestBody = {
  action?: 'enable-icons' | 'delete-icon' | null;
  siteName?: string | null;
  iconId?: string | null;
};

function isManagerIconRole(value: string): value is ManagerIconRole {
  return MANAGER_ICON_ROLES.includes(value as ManagerIconRole);
}

function getStoragePath(value: string | null | undefined) {
  return normalizeText(value);
}

function getManagerIconUrl(value: string | null | undefined) {
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

async function deleteStorageFile(iconValue: string | null | undefined) {
  const targetPath = getStoragePath(iconValue);

  if (!targetPath) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.storage.from(BUCKET_NAME).remove([targetPath]);
}

async function checkAccess(siteName: string) {
  try {
    const access = await getCommunityManagerAccess(siteName);

    if (!access.actor.permissions.join_manage) {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }

    return {
      ok: true,
      access,
    } as const;
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return {
        ok: false,
        status: 403,
        error: unknownError.message || '접근 권한이 없습니다.',
      } as const;
    }

    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }
}

function serializeManagerIcon(icon: ManagerIconRow) {
  return {
    ...icon,
    icon: getStoragePath(icon.icon),
    icon_url: getManagerIconUrl(icon.icon),
  };
}

async function getManagerIcons(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const icons = await supabaseAdmin
    .from('community_manage_icons')
    .select('id, created_at, role, icon, site_id')
    .eq('site_id', siteId)
    .order('created_at', { ascending: true });

  if (icons.error) {
    return {
      ok: false,
      error: '매니저 아이콘 정보를 불러오지 못했습니다.',
    } as const;
  }

  return {
    ok: true,
    icons: (icons.data ?? [])
      .filter((icon): icon is ManagerIconRow => isManagerIconRole(normalizeText(icon.role)))
      .map((icon) => ({
        ...icon,
        role: normalizeText(icon.role) as ManagerIconRole,
        icon: getStoragePath(icon.icon),
      }))
      .map(serializeManagerIcon),
  } as const;
}

async function ensureManagerIcons(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const currentIcons = await supabaseAdmin
    .from('community_manage_icons')
    .select('id, created_at, role, icon, site_id')
    .eq('site_id', siteId);

  if (currentIcons.error) {
    return {
      ok: false,
      error: '매니저 아이콘 정보를 불러오지 못했습니다.',
    } as const;
  }

  const currentRoles = new Set((currentIcons.data ?? []).map((icon) => normalizeText(icon.role)));
  const missingRoles = MANAGER_ICON_ROLES.filter((role) => !currentRoles.has(role));

  if (missingRoles.length > 0) {
    const insertResult = await supabaseAdmin.from('community_manage_icons').insert(
      missingRoles.map((role) => ({
        site_id: siteId,
        role,
        icon: '',
      })),
    );

    if (insertResult.error) {
      return {
        ok: false,
        error: '매니저 아이콘 기본값 생성에 실패했습니다.',
      } as const;
    }
  }

  return getManagerIcons(siteId);
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    const accessResult = await checkAccess(siteName);

    if (!accessResult.ok) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const { access } = accessResult;
    const managers = await buildCommunityManagerList(access);
    const boards = await getBoardSummaries(access);
    const managerIcons = await getManagerIcons(access.rhizome.id);
    const ownerTransfer = await getOwnerTransferAvailability(access);

    if (!managerIcons.ok) {
      return Response.json({ error: managerIcons.error }, { status: 500 });
    }

    return Response.json({
      ok: true,
      permissions: access.actor.permissions,
      limits: {
        community_manager: access.planFeature.communityManagerLimit,
        board_manager: access.planFeature.boardManagerLimit,
        board_general_manager: access.planFeature.boardGeneralManagerLimit,
        board_assistant_manager: access.planFeature.boardAssistantManagerLimit,
      },
      managers,
      boards,
      managerIcons: managerIcons.icons,
      managerIconRoles: MANAGER_ICON_ROLES,
      ownerTransfer,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '매니저 정보를 불러오지 못했습니다.';
      const status =
        errorMessage === 'siteName이 유효하지 않습니다.'
          ? 400
          : errorMessage === '사이트를 찾을 수 없습니다.'
            ? 404
            : errorMessage === '접근 권한이 없습니다.'
              ? 403
              : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '매니저 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as IconRequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();

    if (requestBody.action !== 'enable-icons') {
      return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
    }

    const accessResult = await checkAccess(siteName);

    if (!accessResult.ok) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const managerIcons = await ensureManagerIcons(accessResult.access.rhizome.id);

    if (!managerIcons.ok) {
      return Response.json({ error: managerIcons.error }, { status: 500 });
    }

    return Response.json({
      ok: true,
      managerIcons: managerIcons.icons,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        {
          error: unknownError.message || '매니저 아이콘 정보를 생성하지 못했습니다.',
        },
        { status: 500 },
      );
    }

    return Response.json({ error: '매니저 아이콘 정보를 생성하지 못했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const formData = await request.formData();
    const rawSiteName = formData.get('siteName');
    const rawIconId = formData.get('iconId');

    const siteName = normalizeText(typeof rawSiteName === 'string' ? rawSiteName : '').toLowerCase();
    const iconId = normalizeText(typeof rawIconId === 'string' ? rawIconId : '');
    const file = formData.get('file');

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!iconId) {
      return Response.json({ error: 'iconId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return Response.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    const accessResult = await checkAccess(siteName);

    if (!accessResult.ok) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const { access } = accessResult;

    const currentIcon = await access.supabaseAdmin
      .from('community_manage_icons')
      .select('id, role, icon, site_id')
      .eq('site_id', access.rhizome.id)
      .eq('id', iconId)
      .maybeSingle();

    if (currentIcon.error || !currentIcon.data) {
      return Response.json({ error: '매니저 아이콘 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const role = normalizeText(currentIcon.data.role);

    if (!isManagerIconRole(role)) {
      return Response.json({ error: '매니저 역할 값이 올바르지 않습니다.' }, { status: 400 });
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

    const filePath = `site/${access.rhizome.id}/${role}-${Date.now()}${uploadExtension}`;

    const uploadResult = await access.supabaseAdmin.storage.from(BUCKET_NAME).upload(filePath, uploadBuffer, {
      contentType: uploadContentType,
      upsert: false,
    });

    if (uploadResult.error) {
      return Response.json({ error: '아이콘 업로드에 실패했습니다.' }, { status: 500 });
    }

    const nextIconValue = filePath;

    const updateResult = await access.supabaseAdmin
      .from('community_manage_icons')
      .update({
        icon: nextIconValue,
      })
      .eq('id', iconId)
      .eq('site_id', access.rhizome.id);

    if (updateResult.error) {
      await access.supabaseAdmin.storage.from(BUCKET_NAME).remove([filePath]);
      return Response.json({ error: '아이콘 저장에 실패했습니다.' }, { status: 500 });
    }

    if (currentIcon.data.icon) {
      await deleteStorageFile(currentIcon.data.icon);
    }

    return Response.json({
      ok: true,
      iconId,
      role,
      icon: nextIconValue,
      iconUrl: getManagerIconUrl(nextIconValue),
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
    const requestBody = (await request.json()) as IconRequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const iconId = normalizeText(requestBody.iconId);

    if (requestBody.action !== 'delete-icon') {
      return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!iconId) {
      return Response.json({ error: 'iconId가 유효하지 않습니다.' }, { status: 400 });
    }

    const accessResult = await checkAccess(siteName);

    if (!accessResult.ok) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const { access } = accessResult;

    const currentIcon = await access.supabaseAdmin
      .from('community_manage_icons')
      .select('id, icon')
      .eq('site_id', access.rhizome.id)
      .eq('id', iconId)
      .maybeSingle();

    if (currentIcon.error || !currentIcon.data) {
      return Response.json({ error: '매니저 아이콘 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateResult = await access.supabaseAdmin
      .from('community_manage_icons')
      .update({
        icon: '',
      })
      .eq('id', iconId)
      .eq('site_id', access.rhizome.id);

    if (updateResult.error) {
      return Response.json({ error: '아이콘 삭제에 실패했습니다.' }, { status: 500 });
    }

    if (currentIcon.data.icon) {
      await deleteStorageFile(currentIcon.data.icon);
    }

    return Response.json({
      ok: true,
      iconId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '아이콘 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '아이콘 삭제에 실패했습니다.' }, { status: 500 });
  }
}
