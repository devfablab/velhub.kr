import verifySession from '@/lib/session/verifySession';
import { decrypt } from '@/lib/encryption/decrypt';
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

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티에서만 가입할 수 있습니다.' }, { status: 403 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status !== 'FAIL' || session.case !== 'guest-site' || !session.stigmaId) {
      return Response.json({ error: '가입 대기 사용자만 요청할 수 있습니다.' }, { status: 403 });
    }

    const stigma = await supabaseAdmin.from('stigmas').select('id, user_name').eq('id', session.stigmaId).maybeSingle();

    if (stigma.error || !stigma.data) {
      return Response.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const fallbackNickname = stigma.data.user_name ? decrypt(stigma.data.user_name as string) : '';
    const finalNickname = nickname || fallbackNickname || null;

    const existingRhizomeStigma = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('user_id', stigma.data.id)
      .maybeSingle();

    if (existingRhizomeStigma.error) {
      return Response.json({ error: '가입 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingRhizomeStigma.data) {
      return Response.json({ error: '이미 가입된 사용자입니다.' }, { status: 400 });
    }

    const insertRhizomeStigma = await supabaseAdmin
      .from('rhizome_stigmas')
      .insert({
        user_id: stigma.data.id,
        site_id: rhizome.data.id,
        is_approval: false,
        blocked_at: null,
        block_count: 0,
        approval_at: null,
        is_block: false,
        role: 'member',
        nickname: finalNickname,
        post_count: 0,
        comment_count: 0,
        checkin_count: 0,
        last_visit_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (insertRhizomeStigma.error || !insertRhizomeStigma.data) {
      return Response.json({ error: '가입에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteName: rhizome.data.site_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '가입에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '가입에 실패했습니다.' }, { status: 500 });
  }
}
