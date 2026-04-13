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

    const rhizomes = await supabaseAdmin.from('rhizomes').select('*').eq('site_key', normalizedSiteName).maybeSingle();

    if (rhizomes.error) {
      return Response.json({ error: 'rhizomes 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!rhizomes.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      rhizomes: rhizomes.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || 'rhizomes 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: 'rhizomes 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
