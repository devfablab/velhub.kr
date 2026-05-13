import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function isExpired(value: string | null) {
  if (!value) {
    return true;
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return true;
  }

  return time < Date.now();
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const normalizedToken = normalizeText(token);
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!normalizedToken) {
      return Response.json({ error: 'token이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const invite = await supabaseAdmin
      .from('invite')
      .select('id, site_id, email, role, status, expires_at, accepted_user_id, joined_at, cancelled_at')
      .eq('token', normalizedToken)
      .maybeSingle();

    if (invite.error || !invite.data) {
      return Response.json({ error: '초대장을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (invite.data.status === 'cancelled') {
      return Response.json({ error: '취소된 초대장입니다.' }, { status: 400 });
    }

    if (invite.data.status === 'expired' || isExpired(invite.data.expires_at)) {
      if (invite.data.status !== 'expired') {
        await supabaseAdmin
          .from('invite')
          .update({
            status: 'expired',
          })
          .eq('id', invite.data.id);
      }

      return Response.json({ error: '만료된 초대장입니다.' }, { status: 400 });
    }

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type')
      .eq('id', invite.data.site_id)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '블로그 사이트만 접근할 수 있습니다.' }, { status: 403 });
    }

    if (rhizome.data.site_key !== siteName) {
      return Response.json({ error: '초대장 정보가 올바르지 않습니다.' }, { status: 403 });
    }

    return Response.json({
      ok: true,
      invite: {
        id: invite.data.id,
        email: invite.data.email,
        role: invite.data.role,
        status: invite.data.status,
        expires_at: invite.data.expires_at,
      },
      site: {
        id: rhizome.data.id,
        site_key: rhizome.data.site_key,
        site_label: rhizome.data.site_label,
        site_type: rhizome.data.site_type,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대장을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '초대장을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { token } = await context.params;
    const normalizedToken = normalizeText(token);
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!normalizedToken) {
      return Response.json({ error: 'token이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const invite = await supabaseAdmin
      .from('invite')
      .select('id, site_id, email, role, status, expires_at')
      .eq('token', normalizedToken)
      .maybeSingle();

    if (invite.error || !invite.data) {
      return Response.json({ error: '초대장을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (invite.data.status === 'cancelled') {
      return Response.json({ error: '취소된 초대장입니다.' }, { status: 400 });
    }

    if (invite.data.status === 'expired' || isExpired(invite.data.expires_at)) {
      if (invite.data.status !== 'expired') {
        await supabaseAdmin
          .from('invite')
          .update({
            status: 'expired',
          })
          .eq('id', invite.data.id);
      }

      return Response.json({ error: '만료된 초대장입니다.' }, { status: 400 });
    }

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key')
      .eq('id', invite.data.site_id)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_key !== siteName) {
      return Response.json({ error: '초대장 정보가 올바르지 않습니다.' }, { status: 403 });
    }

    const stigma = await supabaseAdmin
      .from('stigmas')
      .select('id, email')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigma.error || !stigma.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const currentEmail = stigma.data.email ? decrypt(stigma.data.email) : '';

    if (!currentEmail || currentEmail.trim().toLowerCase() !== invite.data.email.trim().toLowerCase()) {
      return Response.json({ error: '초대받은 이메일과 현재 계정 이메일이 일치하지 않습니다.' }, { status: 403 });
    }

    const currentRhizomeStigma = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, is_approval')
      .eq('site_id', invite.data.site_id)
      .eq('user_id', stigma.data.id)
      .maybeSingle();

    let acceptedUserId = '';

    if (currentRhizomeStigma.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
    }

    if (currentRhizomeStigma.data) {
      acceptedUserId = currentRhizomeStigma.data.id;

      const updateRhizomeStigma = await supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          role: invite.data.role,
          is_approval: true,
          approval_at: new Date().toISOString(),
        })
        .eq('id', currentRhizomeStigma.data.id);

      if (updateRhizomeStigma.error) {
        return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
      }
    } else {
      const insertRhizomeStigma = await supabaseAdmin
        .from('rhizome_stigmas')
        .insert({
          site_id: invite.data.site_id,
          user_id: stigma.data.id,
          role: invite.data.role,
          is_approval: true,
          approval_at: new Date().toISOString(),
          is_block: false,
          block_count: 0,
        })
        .select('id')
        .maybeSingle();

      if (insertRhizomeStigma.error || !insertRhizomeStigma.data) {
        return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
      }

      acceptedUserId = insertRhizomeStigma.data.id;
    }

    const joinedAt = new Date().toISOString();

    const updateInvite = await supabaseAdmin
      .from('invite')
      .update({
        status: 'joined',
        accepted_user_id: acceptedUserId,
        joined_at: joinedAt,
      })
      .eq('id', invite.data.id);

    if (updateInvite.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
    }

    const deleteInvite = await supabaseAdmin.from('invite').delete().eq('id', invite.data.id);

    if (deleteInvite.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteName: rhizome.data.site_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
  }
}
