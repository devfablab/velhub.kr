import { getPastDueGraceDays } from '@/lib/payments/refunds';
import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

const DAY_MS = 24 * 60 * 60 * 1000;

type PastDueSubscriptionRow = {
  id: string;
  subscription_type: string;
  target_type: string;
  target_id: string;
  past_due_started_at: string | null;
};

type ExpirePastDueResult = {
  subscriptionId: string;
  status: 'expired' | 'skipped';
  message?: string;
};

function isTestMode() {
  return process.env.NEXT_PUBLIC_APP_ENV === 'test';
}

function verifyTaskRequest(request: Request) {
  if (isTestMode()) {
    return true;
  }

  const taskSecret = process.env.CRON_SECRET ?? process.env.PAYMENT_TASK_SECRET;

  if (!taskSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');

  return authorization === `Bearer ${taskSecret}`;
}

function isSubscriptionApiTarget(subscription: PastDueSubscriptionRow) {
  if (
    subscription.subscription_type !== SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD &&
    subscription.subscription_type !== SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES
  ) {
    return false;
  }

  return (
    subscription.target_type === PAYMENT_TARGET_TYPE.BOARD || subscription.target_type === PAYMENT_TARGET_TYPE.SERIES
  );
}

async function expirePastDue(request: Request) {
  if (!verifyTaskRequest(request)) {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date();
  const nowText = now.toISOString();
  const graceDays = getPastDueGraceDays();
  const expiredBefore = new Date(now.getTime() - graceDays * DAY_MS).toISOString();

  const subscriptionsResult = await supabaseAdmin
    .from('subscriptions')
    .select('id, subscription_type, target_type, target_id, past_due_started_at')
    .eq('status', SUBSCRIPTION_STATUS.PAST_DUE)
    .in('subscription_type', [SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD, SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES])
    .in('target_type', [PAYMENT_TARGET_TYPE.BOARD, PAYMENT_TARGET_TYPE.SERIES])
    .is('expired_at', null)
    .lte('past_due_started_at', expiredBefore);

  if (subscriptionsResult.error) {
    console.error(subscriptionsResult.error);

    return Response.json({ error: '결제 실패 구독을 확인하지 못했습니다.' }, { status: 500 });
  }

  const subscriptions = (subscriptionsResult.data ?? []) as PastDueSubscriptionRow[];
  const results: ExpirePastDueResult[] = [];

  for (const subscription of subscriptions) {
    if (!isSubscriptionApiTarget(subscription)) {
      results.push({
        subscriptionId: subscription.id,
        status: 'skipped',
        message: 'subscriptions API 처리 대상이 아닙니다.',
      });

      continue;
    }

    if (!subscription.past_due_started_at) {
      results.push({
        subscriptionId: subscription.id,
        status: 'skipped',
        message: 'past_due_started_at이 없습니다.',
      });

      continue;
    }

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: SUBSCRIPTION_STATUS.EXPIRED,
        canceled_at: nowText,
        expired_at: nowText,
        next_billing_at: null,
        updated_at: nowText,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);

      results.push({
        subscriptionId: subscription.id,
        status: 'skipped',
        message: '구독 만료 처리에 실패했습니다.',
      });

      continue;
    }

    results.push({
      subscriptionId: subscription.id,
      status: 'expired',
    });
  }

  return Response.json({
    ok: true,
    graceDays,
    expiredCount: results.filter((result) => result.status === 'expired').length,
    skippedCount: results.filter((result) => result.status === 'skipped').length,
    results,
  });
}

export async function GET(request: Request) {
  return expirePastDue(request);
}

export async function POST(request: Request) {
  return expirePastDue(request);
}
