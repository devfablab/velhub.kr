import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const nickname = normalizeText(requestUrl.searchParams.get('nickname'));

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!nickname) {
      return Response.json({ error: '닉네임을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티만 사용할 수 있습니다.' }, { status: 403 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case === 'guest-public' || !session.stigmaId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const duplicateNicknameResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('nickname', nickname)
      .neq('user_id', session.stigmaId)
      .limit(1)
      .maybeSingle();

    if (duplicateNicknameResult.error) {
      return Response.json({ error: '닉네임을 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      isAvailable: !duplicateNicknameResult.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '닉네임을 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '닉네임을 확인하지 못했습니다.' }, { status: 500 });
  }
}
