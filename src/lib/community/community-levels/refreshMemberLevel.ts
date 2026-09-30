import type { SupabaseClient } from '@supabase/supabase-js';

type LevelRow = {
  id: string;
  lv: number;
  requirement_type: 'manual' | 'automatic';
  required_posts: number | null;
  required_comments: number | null;
  required_checkins: number | null;
  required_days: number | null;
  required_likes: number | null;
};

type MembershipRow = {
  id: string;
  lv: string | null;
  is_approval: boolean;
  approval_at: string | null;
  post_count: number | null;
  comment_count: number | null;
  checkin_count: number | null;
  like_count: number | null;
};

function numericValue(value: number | null | undefined) {
  return Math.max(0, Number(value ?? 0) || 0);
}

function hasReachedRequiredDays(approvalAt: string | null, requiredDays: number) {
  if (requiredDays === 0) {
    return true;
  }

  if (!approvalAt) {
    return false;
  }

  const approvedAt = new Date(approvalAt).getTime();

  if (Number.isNaN(approvedAt)) {
    return false;
  }

  return Date.now() - approvedAt >= requiredDays * 24 * 60 * 60 * 1000;
}

function meetsRequirements(membership: MembershipRow, level: LevelRow) {
  const requiredPosts = numericValue(level.required_posts);
  const requiredComments = numericValue(level.required_comments);
  const requiredCheckins = numericValue(level.required_checkins);
  const requiredLikes = numericValue(level.required_likes);
  const requiredDays = numericValue(level.required_days);

  return (
    numericValue(membership.post_count) >= requiredPosts &&
    numericValue(membership.comment_count) >= requiredComments &&
    numericValue(membership.checkin_count) >= requiredCheckins &&
    numericValue(membership.like_count) >= requiredLikes &&
    hasReachedRequiredDays(membership.approval_at, requiredDays)
  );
}

function hasAtLeastOneRequirement(level: LevelRow) {
  return [
    level.required_posts,
    level.required_comments,
    level.required_checkins,
    level.required_days,
    level.required_likes,
  ].some((value) => numericValue(value) > 0);
}

export async function refreshCommunityMemberLevel({
  supabaseAdmin,
  siteId,
  membershipId,
}: {
  supabaseAdmin: SupabaseClient;
  siteId: string;
  membershipId: string;
}) {
  const [membershipResult, levelsResult] = await Promise.all([
    supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, lv, is_approval, approval_at, post_count, comment_count, checkin_count, like_count')
      .eq('site_id', siteId)
      .eq('id', membershipId)
      .maybeSingle(),
    supabaseAdmin
      .from('community_levels')
      .select('id, lv, requirement_type, required_posts, required_comments, required_checkins, required_days, required_likes')
      .eq('site_id', siteId)
      .order('lv', { ascending: false }),
  ]);

  if (membershipResult.error || levelsResult.error || !membershipResult.data) {
    return;
  }

  const membership = membershipResult.data as MembershipRow;

  if (!membership.is_approval) {
    return;
  }

  const levels = (levelsResult.data ?? []) as LevelRow[];
  const targetLevel = levels.find(
    (level) => level.requirement_type === 'automatic' && hasAtLeastOneRequirement(level) && meetsRequirements(membership, level),
  );

  if (!targetLevel) {
    return;
  }

  const currentLevel = levels.find((level) => level.id === membership.lv);

  if (currentLevel && currentLevel.lv >= targetLevel.lv) {
    return;
  }

  await supabaseAdmin.from('rhizome_stigmas').update({ lv: targetLevel.id }).eq('id', membership.id).eq('site_id', siteId);
}

export async function refreshCommunitySiteMemberLevels({
  supabaseAdmin,
  siteId,
}: {
  supabaseAdmin: SupabaseClient;
  siteId: string;
}) {
  const membershipsResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id')
    .eq('site_id', siteId)
    .eq('is_approval', true);

  if (membershipsResult.error) {
    return;
  }

  await Promise.all(
    (membershipsResult.data ?? []).map((membership) =>
      refreshCommunityMemberLevel({ supabaseAdmin, siteId, membershipId: membership.id }),
    ),
  );
}
