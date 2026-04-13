import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const normalizedSiteName = normalizeText(siteName).toLowerCase();

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', normalizedSiteName).maybeSingle();

    if (rhizome.error) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 500 });
    }

    if (!rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const sites = await supabaseAdmin.from('sites').select('*').eq('site_id', rhizome.data.id).maybeSingle();

    if (sites.error) {
      return Response.json({ error: 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!sites.data) {
      return Response.json({ error: 'sites 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      sites: sites.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
