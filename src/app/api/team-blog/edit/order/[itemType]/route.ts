import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    itemType: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  orderedIds: string[];
};

type ItemType = 'educations' | 'awards' | 'projects' | 'careers';

function isItemType(value: string): value is ItemType {
  return value === 'educations' || value === 'awards' || value === 'projects' || value === 'careers';
}

function getTableName(itemType: ItemType) {
  return `member_${itemType}`;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { itemType: rawItemType } = await context.params;
    const itemType = normalizeText(rawItemType).toLowerCase();

    if (!isItemType(itemType)) {
      return Response.json({ error: '항목 유형이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const orderedIds = Array.isArray(requestBody.orderedIds)
      ? requestBody.orderedIds.map((id) => normalizeText(id)).filter(Boolean)
      : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (orderedIds.length === 0) {
      return Response.json({ error: '정렬할 항목이 없습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '블로그에서만 사용할 수 있습니다.' }, { status: 400 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (!session.rhizomeStigmaId || (session.case !== 'staff' && session.case !== 'member')) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const tableName = getTableName(itemType);

    const existing = await supabaseAdmin
      .from(tableName)
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('member_id', session.rhizomeStigmaId)
      .in('id', orderedIds);

    if (existing.error) {
      return Response.json({ error: '정렬 항목을 확인하지 못했습니다.' }, { status: 500 });
    }

    if ((existing.data ?? []).length !== orderedIds.length) {
      return Response.json({ error: '본인 항목만 정렬할 수 있습니다.' }, { status: 403 });
    }

    const updates = orderedIds.map((id, index) => {
      const sortOrder = itemType === 'educations' ? index + 1 : orderedIds.length - index;

      return supabaseAdmin
        .from(tableName)
        .update({
          sort_order: sortOrder,
        })
        .eq('id', id)
        .eq('site_id', rhizome.data.id)
        .eq('member_id', session.rhizomeStigmaId);
    });

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      return Response.json({ error: '정렬 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '정렬 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '정렬 저장에 실패했습니다.' }, { status: 500 });
  }
}
