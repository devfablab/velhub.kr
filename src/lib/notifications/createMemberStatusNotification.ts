import { getSupabaseAdmin } from '@/lib/supabase';

type CreateMemberStatusNotificationParams = {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  recipientStigmaId: string;
  senderStigmaId: string | null;
  siteId: string;
  notificationType: string;
};

export async function createMemberStatusNotification({
  supabaseAdmin,
  recipientStigmaId,
  senderStigmaId,
  siteId,
  notificationType,
}: CreateMemberStatusNotificationParams) {
  const stigmaIds = [...new Set([recipientStigmaId, senderStigmaId])];

  const stigmaResult = await supabaseAdmin.from('stigmas').select('id, user_id').in('id', stigmaIds);

  if (stigmaResult.error) {
    console.error(stigmaResult.error);
    return;
  }

  const particleIdMap = new Map((stigmaResult.data ?? []).map((stigma) => [stigma.id, stigma.user_id]));

  const recipientUserId = particleIdMap.get(recipientStigmaId);

  if (!recipientUserId) {
    return;
  }

  const notificationResult = await supabaseAdmin.from('notifications').insert({
    user_id: recipientUserId,
    send_user_id: particleIdMap.get(senderStigmaId),
    send_site_id: siteId,
    send_board_id: null,
    send_series_id: null,
    send_post_id: null,
    notification_type: notificationType,
    is_read: false,
  });

  if (notificationResult.error) {
    console.error(notificationResult.error);
  }
}
