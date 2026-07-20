import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { getOwnerTransferAvailability } from '@/lib/community/ownerTransfers';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { normalizeText } from '@/lib/utils';

type OwnerTransferRequestBody = {
  siteName?: string | null;
  targetMemberId?: string | null;
};

type TargetMembershipRow = {
  id: string;
  user_id: string;
};

type StigmaRow = {
  user_id: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OwnerTransferRequestBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const targetMemberId = normalizeText(body.targetMemberId);

    if (!siteName || !targetMemberId) {
      return Response.json({ error: '교체할 멤버를 선택해주세요.' }, { status: 400 });
    }

    const access = await getCommunityManagerAccess(siteName);
    const availability = await getOwnerTransferAvailability(access);

    if (!availability.canRequest || !availability.requesterRole) {
      return Response.json({ error: '운영자 교체를 요청할 수 없습니다.' }, { status: 403 });
    }

    const targetMembershipResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, user_id')
      .eq('id', targetMemberId)
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', true)
      .eq('is_block', false)
      .is('kicked_at', null)
      .is('banned_at', null)
      .is('withdrawn_at', null)
      .maybeSingle();

    if (targetMembershipResult.error) {
      throw new Error('멤버 정보를 확인하지 못했습니다.');
    }

    if (!targetMembershipResult.data) {
      return Response.json({ error: '운영자 권한을 요청할 수 없는 멤버입니다.' }, { status: 400 });
    }

    const targetMembership = targetMembershipResult.data as TargetMembershipRow;

    if (targetMembership.id === access.actor.rhizomeStigmaId || targetMembership.user_id === access.rhizome.owner_id) {
      return Response.json({ error: '현재 운영자에게는 요청할 수 없습니다.' }, { status: 400 });
    }

    const targetStigmaResult = await access.supabaseAdmin
      .from('stigmas')
      .select('user_id')
      .eq('id', targetMembership.user_id)
      .maybeSingle();

    if (targetStigmaResult.error || !targetStigmaResult.data) {
      throw new Error('멤버 계정 정보를 확인하지 못했습니다.');
    }

    const targetStigma = targetStigmaResult.data as StigmaRow;
    const transferResult = await access.supabaseAdmin
      .from('owner_transfers')
      .insert({
        site_id: access.rhizome.id,
        requester_user_id: access.actor.authUserId,
        requester_role: availability.requesterRole,
        previous_owner_id: access.rhizome.owner_id,
        target_member_id: targetMembership.id,
        status: 'pending',
        responded_at: null,
      })
      .select('id')
      .single();

    if (transferResult.error) {
      if (transferResult.error.code === '23505') {
        return Response.json({ error: '이미 처리 대기 중인 운영자 교체 요청이 있습니다.' }, { status: 409 });
      }

      console.error(transferResult.error);
      throw new Error('운영자 교체 요청을 저장하지 못했습니다.');
    }

    const notificationResult = await access.supabaseAdmin.from('notifications').insert({
      user_id: targetStigma.user_id,
      send_user_id: access.actor.authUserId,
      target_id: targetStigma.user_id,
      send_site_id: access.rhizome.id,
      send_board_id: null,
      send_series_id: null,
      send_post_id: null,
      notification_type: NOTIFICATION_TYPE.SITE_OWNER_TRANSFER_REQUESTED,
      is_read: false,
    });

    if (notificationResult.error) {
      console.error(notificationResult.error);
      await access.supabaseAdmin.from('owner_transfers').delete().eq('id', transferResult.data.id);
      throw new Error('운영자 교체 알림을 보내지 못했습니다.');
    }

    return Response.json({ ok: true, transferId: transferResult.data.id });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '운영자 교체 요청에 실패했습니다.';
      const status =
        errorMessage === 'siteName이 유효하지 않습니다.'
          ? 400
          : errorMessage === '사이트를 찾을 수 없습니다.'
            ? 404
            : errorMessage === '접근 권한이 없습니다.'
              ? 403
              : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '운영자 교체 요청에 실패했습니다.' }, { status: 500 });
  }
}
