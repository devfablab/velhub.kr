import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type SessionCase = string;

type RhizomeStigmaPolicyRow = {
  id: string;
  role: string | null;
  comment_count: number | null;
  approval_at: string | null;
};

function getPostPolicyRequiredCommentCount(policyPost: string | null | undefined) {
  if (policyPost === 'comment_1') {
    return 1;
  }

  if (policyPost === 'comment_3') {
    return 3;
  }

  if (policyPost === 'comment_5') {
    return 5;
  }

  return 0;
}

function getCommentPolicyRequiredHours(policyComment: string | null | undefined) {
  if (policyComment === 'estimate_1') {
    return 6;
  }

  if (policyComment === 'estimate_3') {
    return 12;
  }

  if (policyComment === 'estimate_5') {
    return 24;
  }

  return 0;
}

function canBypassCommunityPolicy(sessionCase: SessionCase, role: string | null | undefined) {
  if (sessionCase === 'admin' || sessionCase === 'staff') {
    return true;
  }

  return role === 'owner';
}

async function getRhizomeStigmaForPolicy({
  supabaseAdmin,
  siteId,
  authUserId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  authUserId: string;
}) {
  const stigmaResult = await supabaseAdmin.from('stigmas').select('id').eq('user_id', authUserId).maybeSingle();

  if (stigmaResult.error) {
    throw new Error('회원 정보를 확인하지 못했습니다.');
  }

  const stigmaId = normalizeText(stigmaResult.data?.id) || authUserId;

  const rhizomeStigmaResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role, comment_count, approval_at')
    .eq('site_id', siteId)
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (rhizomeStigmaResult.error) {
    throw new Error('커뮤니티 가입 정보를 확인하지 못했습니다.');
  }

  return (rhizomeStigmaResult.data as RhizomeStigmaPolicyRow | null) ?? null;
}

export async function assertCommunityPostWritePolicy({
  siteId,
  authUserId,
  sessionCase,
}: {
  siteId: string;
  authUserId: string;
  sessionCase: SessionCase;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const communityResult = await supabaseAdmin
    .from('communities')
    .select('policy_post')
    .eq('site_id', siteId)
    .maybeSingle();

  if (communityResult.error) {
    throw new Error('글 작성 정책을 확인하지 못했습니다.');
  }

  if (!communityResult.data) {
    return;
  }

  const rhizomeStigma = await getRhizomeStigmaForPolicy({
    supabaseAdmin,
    siteId,
    authUserId,
  });

  if (!rhizomeStigma) {
    throw new Error('커뮤니티 가입 후 글을 작성할 수 있습니다.');
  }

  if (canBypassCommunityPolicy(sessionCase, rhizomeStigma.role)) {
    return;
  }

  const requiredCommentCount = getPostPolicyRequiredCommentCount(communityResult.data.policy_post);
  const commentCount = Number(rhizomeStigma.comment_count ?? 0);

  if (commentCount < requiredCommentCount) {
    throw new Error(`댓글 ${requiredCommentCount}개 등록 후 글을 작성할 수 있습니다.`);
  }
}

export async function assertCommunityCommentWritePolicy({
  siteId,
  authUserId,
  sessionCase,
}: {
  siteId: string;
  authUserId: string;
  sessionCase: SessionCase;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const communityResult = await supabaseAdmin
    .from('communities')
    .select('policy_comment')
    .eq('site_id', siteId)
    .maybeSingle();

  if (communityResult.error) {
    throw new Error('댓글 작성 정책을 확인하지 못했습니다.');
  }

  if (!communityResult.data) {
    return;
  }

  const requiredHours = getCommentPolicyRequiredHours(communityResult.data.policy_comment);

  if (requiredHours === 0) {
    return;
  }

  const rhizomeStigma = await getRhizomeStigmaForPolicy({
    supabaseAdmin,
    siteId,
    authUserId,
  });

  if (!rhizomeStigma) {
    throw new Error('커뮤니티 가입 후 댓글을 작성할 수 있습니다.');
  }

  if (canBypassCommunityPolicy(sessionCase, rhizomeStigma.role)) {
    return;
  }

  if (!rhizomeStigma.approval_at) {
    throw new Error(`가입 ${requiredHours}시간 이후 댓글을 작성할 수 있습니다.`);
  }

  const approvalTime = new Date(rhizomeStigma.approval_at).getTime();

  if (!Number.isFinite(approvalTime)) {
    throw new Error(`가입 ${requiredHours}시간 이후 댓글을 작성할 수 있습니다.`);
  }

  const availableTime = approvalTime + requiredHours * 60 * 60 * 1000;

  if (Date.now() < availableTime) {
    throw new Error(`가입 ${requiredHours}시간 이후 댓글을 작성할 수 있습니다.`);
  }
}

export async function increaseCommunityCommentCount({ siteId, authUserId }: { siteId: string; authUserId: string }) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeStigma = await getRhizomeStigmaForPolicy({
    supabaseAdmin,
    siteId,
    authUserId,
  });

  if (!rhizomeStigma) {
    return;
  }

  const updateResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .update({
      comment_count: Number(rhizomeStigma.comment_count ?? 0) + 1,
    })
    .eq('id', rhizomeStigma.id);

  if (updateResult.error) {
    console.error(updateResult.error);
  }
}
