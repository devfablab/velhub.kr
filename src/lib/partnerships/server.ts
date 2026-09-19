import 'server-only';
import { decrypt } from '@/lib/encryption/decrypt';
import {
  getKoreanNineAmBoundary,
  getKoreanNineAmNotice,
  type PartnershipFormInfo,
  type PartnershipProposalDetail,
  type PartnershipProposalRow,
} from '@/lib/partnerships';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

async function getAttachmentAvailability(db: ReturnType<typeof getSupabaseAdmin>) {
  const boundary = getKoreanNineAmBoundary();
  const countResult = await db
    .from('partnership_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('response_channel', 'email')
    .gte('email_sent_at', boundary.toISOString());
  if (countResult.error) throw countResult.error;
  return {
    available: (countResult.count ?? 0) < 100,
    notice: getKoreanNineAmNotice(),
  };
}

export async function getPartnershipFormInfo(): Promise<PartnershipFormInfo> {
  const db = getSupabaseAdmin();
  const current = await getCurrentStigma();
  const [categoryResult, attachmentAvailability] = await Promise.all([
    db
      .from('partnership_categories')
      .select('id, category_label')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    getAttachmentAvailability(db),
  ]);
  if (categoryResult.error) throw categoryResult.error;

  let paymentEmail = '';
  if (current) {
    const stigmaResult = await db.from('stigmas').select('payment_email').eq('id', current.stigmaId).maybeSingle();
    if (stigmaResult.error) throw stigmaResult.error;
    if (stigmaResult.data?.payment_email) {
      try {
        paymentEmail = decrypt(stigmaResult.data.payment_email);
      } catch {
        paymentEmail = '';
      }
    }
  }

  return {
    categories: categoryResult.data ?? [],
    isLoggedIn: Boolean(current),
    paymentEmail,
    attachmentAvailable: attachmentAvailability.available,
    attachmentUnavailableNotice: attachmentAvailability.notice,
  };
}

export async function getPartnershipProposals(): Promise<{
  proposals: PartnershipProposalRow[];
  error: string | null;
}> {
  const db = getSupabaseAdmin();
  const current = await getCurrentStigma();
  if (!current) return { proposals: [], error: '로그인이 필요합니다.' };

  const [proposalResult, categoryResult] = await Promise.all([
    db
      .from('partnership_proposals')
      .select(
        'id, category_id, subject, response_channel, email_response_status, last_message_author, last_message_at, customer_last_read_at, created_at',
      )
      .eq('proposer_stigma_id', current.stigmaId)
      .order('last_message_at', { ascending: false }),
    db.from('partnership_categories').select('id, category_label'),
  ]);
  if (proposalResult.error || categoryResult.error) {
    return { proposals: [], error: '제휴 제안 내역을 불러오지 못했습니다.' };
  }

  const categoryLabelById = new Map(
    (categoryResult.data ?? []).map((category) => [category.id, category.category_label]),
  );
  return {
    proposals: (proposalResult.data ?? []).map((proposal) => ({
      ...proposal,
      category_label: categoryLabelById.get(proposal.category_id) ?? '기타',
      has_new_answer:
        proposal.response_channel === 'portal' &&
        proposal.last_message_author === 'admin' &&
        (!proposal.customer_last_read_at || proposal.last_message_at > proposal.customer_last_read_at),
    })),
    error: null,
  };
}

export async function getPartnershipProposal(proposalId: string): Promise<{
  proposal: PartnershipProposalDetail | null;
  error: string | null;
}> {
  const db = getSupabaseAdmin();
  const current = await getCurrentStigma();
  if (!current) return { proposal: null, error: '로그인이 필요합니다.' };

  const proposalResult = await db
    .from('partnership_proposals')
    .select(
      'id, category_id, subject, content, organization_name, proposer_name, proposer_phone, proposer_email, homepage_url, response_channel, email_response_status, created_at',
    )
    .eq('id', proposalId)
    .eq('proposer_stigma_id', current.stigmaId)
    .maybeSingle();
  if (proposalResult.error) return { proposal: null, error: '제휴 제안을 불러오지 못했습니다.' };
  if (!proposalResult.data) return { proposal: null, error: '제휴 제안을 찾을 수 없습니다.' };

  const proposal = proposalResult.data;
  const [categoryResult, messageResult] = await Promise.all([
    db.from('partnership_categories').select('category_label').eq('id', proposal.category_id).maybeSingle(),
    proposal.response_channel === 'portal'
      ? db
          .from('partnership_messages')
          .select('id, author_type, content, created_at')
          .eq('proposal_id', proposalId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (categoryResult.error || messageResult.error) {
    return { proposal: null, error: '제휴 제안 상세를 불러오지 못했습니다.' };
  }

  if (proposal.response_channel === 'portal') {
    const now = new Date().toISOString();
    await db
      .from('partnership_proposals')
      .update({ customer_last_read_at: now, updated_at: now })
      .eq('id', proposalId)
      .eq('proposer_stigma_id', current.stigmaId);
  }

  const decryptValue = (value: string) => {
    try {
      return decrypt(value);
    } catch {
      return '';
    }
  };
  return {
    proposal: {
      ...proposal,
      category_label: categoryResult.data?.category_label ?? '기타',
      organization_name: decryptValue(proposal.organization_name),
      proposer_name: decryptValue(proposal.proposer_name),
      proposer_phone: decryptValue(proposal.proposer_phone),
      proposer_email: decryptValue(proposal.proposer_email),
      messages: messageResult.data ?? [],
    },
    error: null,
  };
}
