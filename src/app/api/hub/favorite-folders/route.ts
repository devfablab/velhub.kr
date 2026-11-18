import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  canUseFavoriteFolders,
  ensureDefaultFavoriteFolder,
  getFavoriteFolders,
  saveFavoriteFolderOrder,
  toFavoriteFolder,
} from '@/lib/service/hubFavoriteFolder.server';
import { validateFavoriteFolderLabel } from '@/lib/service/hubFavoriteFolder.shared';
import { getCurrentStigma } from '@/lib/session/utils';

async function getEditableStigmaId() {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }

  const canUseFolders = await canUseFavoriteFolders(currentStigma.stigmaId);

  if (canUseFolders === null) {
    return { error: NextResponse.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 }) };
  }

  if (!canUseFolders) {
    return {
      error: NextResponse.json({ error: '즐겨찾기 폴더 관리는 아페토 멤버십 전용 기능입니다.' }, { status: 403 }),
    };
  }

  return { stigmaId: currentStigma.stigmaId };
}

export async function POST(request: NextRequest) {
  const editable = await getEditableStigmaId();

  if (editable.error) return editable.error;

  let label: unknown = '';
  let isDefault = false;

  try {
    const body = await request.json();
    label = body.label;
    isDefault = body.isDefault === true;
  } catch {
    return NextResponse.json({ error: '요청 정보를 확인해 주세요.' }, { status: 400 });
  }

  const validated = validateFavoriteFolderLabel(label);

  if (validated.error) {
    return NextResponse.json({ error: validated.error, fieldErrors: { label: validated.error } }, { status: 400 });
  }

  try {
    const folders = await ensureDefaultFavoriteFolder(editable.stigmaId);
    const bottomSortOrder = folders.reduce((maximum, folder) => Math.max(maximum, folder.sort_order + 1), 0);
    const insertResult = await getSupabaseAdmin()
      .from('favorite_folders')
      .insert({
        user_id: editable.stigmaId,
        label: validated.label,
        is_default: false,
        sort_order: bottomSortOrder,
      })
      .select('id')
      .single();

    if (insertResult.error || !insertResult.data) throw new Error('폴더를 추가하지 못했습니다.');

    const existingFolderIds = folders.map((folder) => folder.id);
    const nextFolderIds = isDefault
      ? [insertResult.data.id as string, ...existingFolderIds]
      : [...existingFolderIds, insertResult.data.id as string];

    await saveFavoriteFolderOrder(editable.stigmaId, nextFolderIds);

    const nextFolders = await getFavoriteFolders(editable.stigmaId);

    return NextResponse.json({ folders: nextFolders.map(toFavoriteFolder) });
  } catch {
    return NextResponse.json({ error: '폴더를 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const editable = await getEditableStigmaId();

  if (editable.error) return editable.error;

  let folderIds: unknown = null;

  try {
    const body = await request.json();
    folderIds = body.folderIds;
  } catch {
    return NextResponse.json({ error: '요청 정보를 확인해 주세요.' }, { status: 400 });
  }

  if (!Array.isArray(folderIds) || !folderIds.every((folderId) => typeof folderId === 'string')) {
    return NextResponse.json({ error: '요청 정보를 확인해 주세요.' }, { status: 400 });
  }

  try {
    const folders = await getFavoriteFolders(editable.stigmaId);
    const savedFolderIds = new Set(folders.map((folder) => folder.id));
    const requestedFolderIds = new Set(folderIds as string[]);

    if (
      requestedFolderIds.size !== folderIds.length ||
      requestedFolderIds.size !== savedFolderIds.size ||
      [...requestedFolderIds].some((folderId) => !savedFolderIds.has(folderId))
    ) {
      return NextResponse.json({ error: '폴더 목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.' }, { status: 409 });
    }

    await saveFavoriteFolderOrder(editable.stigmaId, folderIds as string[]);

    const nextFolders = await getFavoriteFolders(editable.stigmaId);

    return NextResponse.json({ folders: nextFolders.map(toFavoriteFolder) });
  } catch {
    return NextResponse.json(
      { error: '폴더 순서를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
}
