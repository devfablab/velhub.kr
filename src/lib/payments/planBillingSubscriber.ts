import { PAYMENT_TARGET_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export async function getPlanBillingSubscriberUserId({
  supabaseAdmin,
  siteId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
}) {
  const subscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('subscriber_user_id')
    .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
    .eq('target_id', siteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionResult.error) {
    throw new Error('요금제 결제 멤버를 확인하지 못했습니다.');
  }

  return subscriptionResult.data?.subscriber_user_id ?? null;
}

export async function getPlanBillingSubscriberStigmaId({
  supabaseAdmin,
  siteId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
}) {
  const subscriberUserId = await getPlanBillingSubscriberUserId({ supabaseAdmin, siteId });

  if (!subscriberUserId) {
    return null;
  }

  const stigmaResult = await supabaseAdmin.from('stigmas').select('id').eq('user_id', subscriberUserId).maybeSingle();

  if (stigmaResult.error) {
    throw new Error('요금제 결제 멤버를 확인하지 못했습니다.');
  }

  return stigmaResult.data?.id ?? null;
}

export async function isPlanBillingSubscriberStigma({
  supabaseAdmin,
  siteId,
  stigmaId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  stigmaId: string;
}) {
  const subscriberStigmaId = await getPlanBillingSubscriberStigmaId({ supabaseAdmin, siteId });

  return subscriberStigmaId === stigmaId;
}
