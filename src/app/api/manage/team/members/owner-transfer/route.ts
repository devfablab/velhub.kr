import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  targetMemberId?: string | null;
};

type MembershipRow = {
  id: string;
  user_id: string;
  role: string | null;
  is_approval: boolean;
  is_block: boolean;
  kicked_at: string | null;
  banned_at: string | null;
  withdrawn_at: string | null;
};

const OWNER_TRANSFER_WAIT_MS = 30 * 24 * 60 * 60 * 1000;

function isActiveMembership(membership: MembershipRow) {
  return (
    membership.is_approval &&
    !membership.is_block &&
    !membership.kicked_at &&
    !membership.banned_at &&
    !membership.withdrawn_at
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const targetMemberId = normalizeText(body.targetMemberId);

    if (!siteName || !targetMemberId) {
      return Response.json({ error: '교체할 팀원을 선택해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, owner_id, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (siteResult.data.site_type !== 'blog') {
      return Response.json({ error: '블로그 사이트만 사용할 수 있습니다.' }, { status: 403 });
    }

    const session = await verifySession({ siteId: siteResult.data.id });

    if (!session.authUserId || !session.stigmaId || !session.rhizomeStigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const [requesterResult, targetResult, pendingResult] = await Promise.all([
      supabaseAdmin
        .from('rhizome_stigmas')
        .select('id, user_id, role, is_approval, is_block, kicked_at, banned_at, withdrawn_at')
        .eq('id', session.rhizomeStigmaId)
        .eq('site_id', siteResult.data.id)
        .maybeSingle(),
      supabaseAdmin
        .from('rhizome_stigmas')
        .select('id, user_id, role, is_approval, is_block, kicked_at, banned_at, withdrawn_at')
        .eq('id', targetMemberId)
        .eq('site_id', siteResult.data.id)
        .maybeSingle(),
      supabaseAdmin
        .from('owner_transfers')
        .select('id')
        .eq('site_id', siteResult.data.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle(),
    ]);

    if (requesterResult.error || targetResult.error || pendingResult.error) {
      throw new Error('운영자 교체 정보를 확인하지 못했습니다.');
    }

    if (!requesterResult.data || requesterResult.data.role !== 'owner') {
      return Response.json({ error: '운영자만 교체를 요청할 수 있습니다.' }, { status: 403 });
    }

    if (requesterResult.data.user_id !== siteResult.data.owner_id) {
      return Response.json({ error: '사이트 운영자 정보가 일치하지 않습니다.' }, { status: 409 });
    }

    if (pendingResult.data) {
      return Response.json({ error: '이미 처리 중인 운영자 교체 요청이 있습니다.' }, { status: 409 });
    }

    const targetMembership = targetResult.data as MembershipRow | null;

    if (
      !targetMembership ||
      targetMembership.id === requesterResult.data.id ||
      !isActiveMembership(targetMembership) ||
      targetMembership.role === 'owner' ||
      targetMembership.role === 'observer'
    ) {
      return Response.json({ error: '운영자로 변경할 수 없는 팀원입니다.' }, { status: 400 });
    }

    const [firstTransferResult, acceptedTransferResult] = await Promise.all([
      supabaseAdmin
        .from('owner_transfers')
        .select('previous_owner_id')
        .eq('site_id', siteResult.data.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('owner_transfers')
        .select('responded_at')
        .eq('site_id', siteResult.data.id)
        .eq('target_member_id', requesterResult.data.id)
        .eq('status', 'accepted')
        .order('responded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (firstTransferResult.error || acceptedTransferResult.error) {
      throw new Error('운영자 교체 가능 시점을 확인하지 못했습니다.');
    }

    const isOriginalOwner =
      !firstTransferResult.data || firstTransferResult.data.previous_owner_id === requesterResult.data.user_id;

    if (
      !isOriginalOwner &&
      acceptedTransferResult.data?.responded_at &&
      new Date(acceptedTransferResult.data.responded_at).getTime() + OWNER_TRANSFER_WAIT_MS > Date.now()
    ) {
      return Response.json({ error: '운영자가 변경된 뒤 30일 동안은 다시 교체할 수 없습니다.' }, { status: 403 });
    }

    const targetStigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('id', targetMembership.user_id)
      .maybeSingle();

    if (targetStigmaResult.error || !targetStigmaResult.data?.id) {
      throw new Error('팀원 계정 정보를 확인하지 못했습니다.');
    }

    const transferResult = await supabaseAdmin
      .from('owner_transfers')
      .insert({
        site_id: siteResult.data.id,
        requester_user_id: session.stigmaId,
        requester_role: 'owner',
        previous_owner_id: siteResult.data.owner_id,
        target_member_id: targetMembership.id,
        status: 'pending',
        responded_at: null,
      })
      .select('id')
      .single();

    if (transferResult.error) {
      if (transferResult.error.code === '23505') {
        return Response.json({ error: '이미 처리 중인 운영자 교체 요청이 있습니다.' }, { status: 409 });
      }

      console.error(transferResult.error);
      throw new Error('운영자 교체 요청을 저장하지 못했습니다.');
    }

    const notificationResult = await supabaseAdmin.from('notifications').insert({
      user_id: targetStigmaResult.data.id,
      send_user_id: session.stigmaId,
      target_id: targetStigmaResult.data.id,
      send_site_id: siteResult.data.id,
      send_board_id: null,
      send_series_id: null,
      send_post_id: null,
      notification_type: NOTIFICATION_TYPE.SITE_OWNER_TRANSFER_REQUESTED,
      is_read: false,
    });

    if (notificationResult.error) {
      console.error(notificationResult.error);
      await supabaseAdmin.from('owner_transfers').delete().eq('id', transferResult.data.id);
      throw new Error('운영자 교체 알림을 보내지 못했습니다.');
    }

    return Response.json({ ok: true, transferId: transferResult.data.id });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '운영자 교체 요청에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '운영자 교체 요청에 실패했습니다.' }, { status: 500 });
  }
}
