import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{ itemType: string }>;
};

type ItemType = 'educations' | 'awards' | 'projects' | 'careers';

function isItemType(value: string): value is ItemType {
  return value === 'educations' || value === 'awards' || value === 'projects' || value === 'careers';
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { itemType: rawItemType } = await context.params;
    const itemType = normalizeText(rawItemType).toLowerCase();
    const body = (await request.json()) as { siteName?: unknown; itemId?: unknown };
    const siteName = normalizeText(typeof body.siteName === 'string' ? body.siteName : null).toLowerCase();
    const itemId = normalizeText(typeof body.itemId === 'string' ? body.itemId : null);

    if (!isItemType(itemType) || !siteName || !itemId) {
      return Response.json({ error: '삭제할 항목 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const site = await db.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (site.error || !site.data || site.data.site_type !== 'blog') {
      return Response.json({ error: '블로그 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: site.data.id });

    if (!session.rhizomeStigmaId || !['admin', 'staff', 'member'].includes(session.case)) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const table = `member_${itemType}`;
    const item = await db.from(table).select('id, member_id').eq('id', itemId).eq('site_id', site.data.id).maybeSingle();

    if (item.error || !item.data) {
      return Response.json({ error: '삭제할 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (item.data.member_id !== session.rhizomeStigmaId) {
      return Response.json({ error: '본인 항목만 삭제할 수 있습니다.' }, { status: 403 });
    }

    const deleted = await db.from(table).delete().eq('id', itemId).eq('site_id', site.data.id);

    if (deleted.error) {
      return Response.json({ error: '항목 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '항목 삭제에 실패했습니다.' }, { status: 500 });
  }
}
