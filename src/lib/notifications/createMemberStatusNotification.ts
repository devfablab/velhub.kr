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
  const notificationResult = await supabaseAdmin.from('notifications').insert({
    user_id: recipientStigmaId,
    send_user_id: senderStigmaId,
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
