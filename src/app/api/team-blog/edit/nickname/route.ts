import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName: string | null;
  nickname?: string | null;
};

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const nickname = normalizeText(requestBody.nickname);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!nickname) {
      return Response.json({ error: '별명을 입력해주세요.' }, { status: 400 });
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

    const updateMember = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        nickname,
      })
      .eq('id', session.rhizomeStigmaId)
      .eq('site_id', rhizome.data.id)
      .select('id, nickname')
      .maybeSingle();

    if (updateMember.error || !updateMember.data) {
      return Response.json({ error: '별명 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      member: updateMember.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '별명 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '별명 수정에 실패했습니다.' }, { status: 500 });
  }
}
