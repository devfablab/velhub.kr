import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const normalizedSiteName = siteName.trim().toLowerCase();

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id')
      .eq('site_key', normalizedSiteName)
      .maybeSingle();

    if (rhizomeResult.error) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 500 });
    }

    if (!rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const blogResult = await supabaseAdmin.from('blogs').select('*').eq('site_id', rhizomeResult.data.id).maybeSingle();

    if (blogResult.error) {
      return Response.json({ error: 'blogs 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!blogResult.data) {
      return Response.json({ error: 'blogs 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      blogs: blogResult.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || 'blogs 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: 'blogs 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
