import { reorderSeriesIdx } from '@/lib/board/seriesIdx';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { NOTIFICATION_TYPE, type NotificationType } from '@/lib/notifications/types';
import { decryptNullable, getStigmaAvatarUrl } from '@/lib/users/utils';
import { normalizeText } from '@/lib/utils';

export type CoPostStatus = 'invited' | 'declined' | 'canceled' | 'active';

export type CoPostPartnerCandidate = {
  siteId: string;
  siteKey: string;
  siteLabel: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
};

export type CoPostRow = {
  id: string;
  post_id: string;
  inviter_site_id: string;
  inviter_id: string;
  partner_site_id: string;
  partner_id: string;
  status: CoPostStatus;
  partner_category_ids: string[];
  partner_series_id: string | null;
  lock_holder_id: string | null;
  lock_seen_at: string | null;
  lock_active_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

export const CO_POST_COLUMNS =
  'id, post_id, inviter_site_id, inviter_id, partner_site_id, partner_id, status, partner_category_ids, partner_series_id, lock_holder_id, lock_seen_at, lock_active_at, responded_at, created_at, updated_at';

const SEARCH_RESULT_LIMIT = 20;

type OwnerRow = { site_id: string; user_id: string; nickname: string | null };
type SiteRow = { id: string; site_key: string; site_label: string | null };
type StigmaRow = { id: string; user_name: string | null; avatar: string | null; withdrawal_status: string | null };

async function getActivePersonalBlogs(siteIds?: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  let siteQuery = supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label')
    .eq('site_type', 'blog')
    .eq('is_shutdown', false);

  if (siteIds) {
    siteQuery = siteQuery.in('id', siteIds);
  }

  const [siteResult, teamResult] = await Promise.all([
    siteQuery,
    supabaseAdmin.from('blogs').select('site_id').eq('blog_type', 'team'),
  ]);

  if (siteResult.error || teamResult.error) {
    throw new Error('블로그 목록을 불러오지 못했습니다.');
  }

  const teamSiteIds = new Set((teamResult.data ?? []).map((row) => row.site_id as string));

  return ((siteResult.data ?? []) as SiteRow[]).filter((site) => !teamSiteIds.has(site.id));
}

async function getPartnerCandidates(sites: SiteRow[]) {
  if (sites.length === 0) return [];

  const supabaseAdmin = getSupabaseAdmin();
  const ownerResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('site_id, user_id, nickname')
    .in(
      'site_id',
      sites.map((site) => site.id),
    )
    .eq('role', 'owner');

  if (ownerResult.error) {
    throw new Error('운영자 정보를 불러오지 못했습니다.');
  }

  const owners = (ownerResult.data ?? []) as OwnerRow[];
  const stigmaResult = owners.length
    ? await supabaseAdmin
        .from('stigmas')
        .select('id, user_name, avatar, withdrawal_status')
        .in(
          'id',
          owners.map((owner) => owner.user_id),
        )
    : { data: [] as StigmaRow[], error: null };

  if (stigmaResult.error) {
    throw new Error('운영자 정보를 불러오지 못했습니다.');
  }

  const stigmaById = new Map(((stigmaResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.id, stigma]));
  const siteById = new Map(sites.map((site) => [site.id, site]));

  return owners.flatMap((owner): CoPostPartnerCandidate[] => {
    const site = siteById.get(owner.site_id);
    const stigma = stigmaById.get(owner.user_id);

    if (!site || !stigma || stigma.withdrawal_status) return [];

    const ownerName = normalizeText(owner.nickname) || normalizeText(decryptNullable(stigma.user_name));

    if (!ownerName) return [];

    return [
      {
        siteId: site.id,
        siteKey: site.site_key,
        siteLabel: normalizeText(site.site_label) || site.site_key,
        ownerId: owner.user_id,
        ownerName,
        ownerAvatarUrl: getStigmaAvatarUrl(stigma.avatar),
      },
    ];
  });
}

export async function getPersonalBlogOwner(siteId: string) {
  const sites = await getActivePersonalBlogs([siteId]);
  const [candidate] = await getPartnerCandidates(sites);

  return candidate ?? null;
}

export async function searchCoPostPartners(keyword: string, excludeStigmaId: string) {
  const normalizedKeyword = normalizeText(keyword).toLocaleLowerCase();

  if (!normalizedKeyword) return [];

  const candidates = await getPartnerCandidates(await getActivePersonalBlogs());

  return candidates
    .filter(
      (candidate) =>
        candidate.ownerId !== excludeStigmaId && candidate.ownerName.toLocaleLowerCase().includes(normalizedKeyword),
    )
    .slice(0, SEARCH_RESULT_LIMIT);
}

export async function validateCoPostInvite(inviterSiteId: string, inviterId: string, partnerSiteId: string) {
  const [inviter, partner] = await Promise.all([
    getPersonalBlogOwner(inviterSiteId),
    getPersonalBlogOwner(partnerSiteId),
  ]);

  if (!inviter || inviter.ownerId !== inviterId) {
    return { error: '공동 집필은 1인 블로그 운영자만 시작할 수 있습니다.', partner: null };
  }

  if (!partner) {
    return { error: '공동 집필은 1인 블로그 운영자와만 할 수 있습니다.', partner: null };
  }

  if (partner.ownerId === inviterId) {
    return { error: '본인과는 공동 집필을 할 수 없습니다.', partner: null };
  }

  return { error: '', partner };
}

export async function sendCoPostNotification({
  type,
  recipientId,
  recipientSiteId,
  senderId,
  postId,
}: {
  type: NotificationType;
  recipientId: string;
  recipientSiteId: string;
  senderId: string;
  postId: string;
}) {
  await getSupabaseAdmin().from('notifications').insert({
    user_id: recipientId,
    send_user_id: senderId,
    send_site_id: recipientSiteId,
    send_post_id: postId,
    notification_type: type,
    is_read: false,
  });
}

export async function createCoPostInvite({
  postId,
  inviterSiteId,
  inviterId,
  partner,
}: {
  postId: string;
  inviterSiteId: string;
  inviterId: string;
  partner: CoPostPartnerCandidate;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const postResult = await supabaseAdmin
    .from('posts')
    .select(
      'subject, summary, content_html, content_markdown, preview_html, preview_markdown, thumbnail_image, thumbnail_width, thumbnail_height',
    )
    .eq('id', postId)
    .maybeSingle();

  if (postResult.error || !postResult.data) {
    throw new Error('공동 집필 글을 찾지 못했습니다.');
  }

  const insertResult = await supabaseAdmin
    .from('co_posts')
    .insert({
      post_id: postId,
      inviter_site_id: inviterSiteId,
      inviter_id: inviterId,
      partner_site_id: partner.siteId,
      partner_id: partner.ownerId,
    })
    .select('id')
    .single();

  if (insertResult.error || !insertResult.data) {
    throw new Error('공동 집필 초대를 만들지 못했습니다.');
  }

  await supabaseAdmin.from('co_post_revisions').insert({
    co_post_id: insertResult.data.id,
    editor_id: inviterId,
    payload: postResult.data,
  });

  await sendCoPostNotification({
    type: NOTIFICATION_TYPE.CO_POST_INVITED,
    recipientId: partner.ownerId,
    recipientSiteId: partner.siteId,
    senderId: inviterId,
    postId,
  });

  return insertResult.data.id as string;
}

export async function getCoPost(coPostId: string) {
  const result = await getSupabaseAdmin().from('co_posts').select(CO_POST_COLUMNS).eq('id', coPostId).maybeSingle();

  if (result.error) {
    throw new Error('공동 집필 정보를 불러오지 못했습니다.');
  }

  return (result.data as CoPostRow | null) ?? null;
}

export function getCoPostRole(coPost: CoPostRow, stigmaId: string | null) {
  if (!stigmaId) return null;
  if (coPost.inviter_id === stigmaId) return 'inviter' as const;
  if (coPost.partner_id === stigmaId) return 'partner' as const;

  return null;
}

export const CO_POST_LOCK_SEEN_TIMEOUT = 2 * 60 * 1000;
export const CO_POST_LOCK_IDLE_TIMEOUT = 30 * 60 * 1000;

export type CoPostPayload = {
  subject: string | null;
  summary: string | null;
  content_html: string | null;
  content_markdown: string | null;
  [key: string]: unknown;
};

export function isCoPostLockHeld(coPost: CoPostRow, now = Date.now()) {
  if (!coPost.lock_holder_id || !coPost.lock_seen_at || !coPost.lock_active_at) return false;

  return (
    now - new Date(coPost.lock_seen_at).getTime() < CO_POST_LOCK_SEEN_TIMEOUT &&
    now - new Date(coPost.lock_active_at).getTime() < CO_POST_LOCK_IDLE_TIMEOUT
  );
}

export async function getCoPostBySiteAndSlug(siteKey: string, slug: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const [siteResult, postResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('id').eq('site_key', normalizeText(siteKey).toLowerCase()).maybeSingle(),
    supabaseAdmin.from('posts').select('id').eq('slug', normalizeText(slug)).limit(5),
  ]);

  if (siteResult.error || !siteResult.data || postResult.error) return null;

  const postIds = (postResult.data ?? []).map((post) => post.id as string);

  if (postIds.length === 0) return null;

  const siteId = siteResult.data.id as string;
  const coPostResult = await supabaseAdmin
    .from('co_posts')
    .select(CO_POST_COLUMNS)
    .in('post_id', postIds)
    .in('status', ['invited', 'active'])
    .or(`inviter_site_id.eq.${siteId},partner_site_id.eq.${siteId}`)
    .maybeSingle();

  if (coPostResult.error) return null;

  return (coPostResult.data as CoPostRow | null) ?? null;
}

export async function getLatestCoPostRevision(coPostId: string) {
  const result = await getSupabaseAdmin()
    .from('co_post_revisions')
    .select('id, editor_id, payload, created_at')
    .eq('co_post_id', coPostId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error('공동 집필 내용을 불러오지 못했습니다.');
  }

  return result.data as { id: string; editor_id: string | null; payload: CoPostPayload; created_at: string } | null;
}

export async function getCoPostParticipantName(siteId: string, stigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const [membershipResult, stigmaResult] = await Promise.all([
    supabaseAdmin
      .from('rhizome_stigmas')
      .select('nickname')
      .eq('site_id', siteId)
      .eq('user_id', stigmaId)
      .maybeSingle(),
    supabaseAdmin.from('stigmas').select('user_name').eq('id', stigmaId).maybeSingle(),
  ]);

  return (
    normalizeText(membershipResult.data?.nickname) || normalizeText(decryptNullable(stigmaResult.data?.user_name)) || ''
  );
}

export const CO_POST_DIRECT_CHANGE_ERROR = '공동 집필 글은 공동 집필 화면에서만 수정하거나 숨길 수 있습니다.';

export async function isPostInCoPost(postId: string) {
  const result = await getSupabaseAdmin()
    .from('co_posts')
    .select('id')
    .eq('post_id', postId)
    .in('status', ['invited', 'active'])
    .maybeSingle();

  return Boolean(result.data);
}

export const CO_POST_MESSAGE_MAX_LENGTH = 1000;
export const CO_POST_MESSAGE_PAGE_SIZE = 50;

export type CoPostMessageRow = {
  id: string;
  co_post_id: string;
  sender_id: string | null;
  body: string;
  is_deleted: boolean;
  created_at: string;
};

export async function getCoPostParticipants(coPost: CoPostRow) {
  const [inviterName, partnerName, stigmaResult] = await Promise.all([
    getCoPostParticipantName(coPost.inviter_site_id, coPost.inviter_id),
    getCoPostParticipantName(coPost.partner_site_id, coPost.partner_id),
    getSupabaseAdmin().from('stigmas').select('id, avatar').in('id', [coPost.inviter_id, coPost.partner_id]),
  ]);
  const avatarById = new Map(
    (stigmaResult.data ?? []).map((row) => [row.id as string, getStigmaAvatarUrl(row.avatar as string | null)]),
  );

  return new Map([
    [coPost.inviter_id, { name: inviterName, avatarUrl: avatarById.get(coPost.inviter_id) ?? null }],
    [coPost.partner_id, { name: partnerName, avatarUrl: avatarById.get(coPost.partner_id) ?? null }],
  ]);
}

export function toCoPostMessage(
  row: CoPostMessageRow,
  participants: Map<string, { name: string; avatarUrl: string | null }>,
) {
  const sender = row.sender_id ? participants.get(row.sender_id) : null;

  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: sender?.name || '알 수 없음',
    senderAvatarUrl: sender?.avatarUrl ?? null,
    body: row.is_deleted ? '' : row.body,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
  };
}

export type CoPostRequestType = 'publish' | 'reschedule' | 'apply_revision' | 'unpublish';

export type CoPostRequestRow = {
  id: string;
  co_post_id: string;
  request_type: CoPostRequestType;
  requester_id: string;
  publish_at: string | null;
  revision_id: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'canceled';
  responded_at: string | null;
  created_at: string;
};

export const CO_POST_REQUEST_COLUMNS =
  'id, co_post_id, request_type, requester_id, publish_at, revision_id, status, responded_at, created_at';

export function getCoPostOtherParty(coPost: CoPostRow, stigmaId: string) {
  return coPost.inviter_id === stigmaId
    ? { id: coPost.partner_id, siteId: coPost.partner_site_id }
    : { id: coPost.inviter_id, siteId: coPost.inviter_site_id };
}

export async function getCoPostPublishState(postId: string) {
  const result = await getSupabaseAdmin()
    .from('posts')
    .select('published_status, published_at, is_closed')
    .eq('id', postId)
    .maybeSingle();

  if (result.error || !result.data) {
    throw new Error('글을 찾을 수 없습니다.');
  }

  const publishedAt = result.data.published_at ? new Date(result.data.published_at as string).getTime() : null;
  const status = result.data.published_status as string;

  if (status === 'draft')
    return { state: 'draft' as const, publishedAt: null, isClosed: result.data.is_closed === true };

  if (status === 'unknown' && publishedAt && publishedAt > Date.now()) {
    return {
      state: 'scheduled' as const,
      publishedAt: result.data.published_at as string,
      isClosed: result.data.is_closed === true,
    };
  }

  return {
    state: 'published' as const,
    publishedAt: result.data.published_at as string | null,
    isClosed: result.data.is_closed === true,
  };
}

export async function scheduleCoPostPublish(coPost: CoPostRow, publishAt: string) {
  const latestRevision = await getLatestCoPostRevision(coPost.id);
  const payload = latestRevision?.payload;
  const effectiveAt = new Date(Math.max(new Date(publishAt).getTime(), Date.now())).toISOString();
  const updateResult = await getSupabaseAdmin()
    .from('posts')
    .update({
      ...(payload
        ? {
            subject: payload.subject,
            summary: payload.summary,
            content_html: payload.content_html,
            content_markdown: payload.content_markdown,
          }
        : {}),
      published_status: 'unknown',
      published_at: effectiveAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', coPost.post_id);

  if (updateResult.error) {
    throw new Error('공개 일정을 정하지 못했습니다.');
  }

  return effectiveAt;
}

export async function acceptCoPostRequest(coPost: CoPostRow, request: CoPostRequestRow, accepterId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const publishState = await getCoPostPublishState(coPost.post_id);
  const nowIsoString = new Date().toISOString();

  if (request.request_type === 'publish') {
    if (publishState.state !== 'draft') throw new Error('이미 공개 일시가 정해진 글입니다.');
    if (!request.publish_at) throw new Error('공개 일시가 없습니다.');

    await scheduleCoPostPublish(coPost, request.publish_at);
  }

  if (request.request_type === 'reschedule') {
    if (publishState.state !== 'scheduled') throw new Error('이미 공개된 글은 공개 일시를 바꿀 수 없습니다.');
    if (!request.publish_at) throw new Error('공개 일시가 없습니다.');

    const updateResult = await supabaseAdmin
      .from('posts')
      .update({
        published_at: new Date(Math.max(new Date(request.publish_at).getTime(), Date.now())).toISOString(),
      })
      .eq('id', coPost.post_id);

    if (updateResult.error) throw new Error('공개 일시를 바꾸지 못했습니다.');
  }

  if (request.request_type === 'apply_revision') {
    if (publishState.state === 'draft') throw new Error('아직 공개되지 않은 글입니다.');

    const revisionResult = request.revision_id
      ? await supabaseAdmin.from('co_post_revisions').select('payload').eq('id', request.revision_id).maybeSingle()
      : null;
    const payload = revisionResult?.data?.payload as CoPostPayload | undefined;

    if (!payload) throw new Error('반영할 수정본을 찾지 못했습니다.');

    const updateResult = await supabaseAdmin
      .from('posts')
      .update({
        subject: payload.subject,
        summary: payload.summary,
        content_html: payload.content_html,
        content_markdown: payload.content_markdown,
        edited_at: nowIsoString,
        updated_at: nowIsoString,
      })
      .eq('id', coPost.post_id);

    if (updateResult.error) throw new Error('수정본을 반영하지 못했습니다.');
  }

  if (request.request_type === 'unpublish') {
    if (publishState.isClosed) throw new Error('이미 삭제된 글입니다.');

    const postResult = await supabaseAdmin
      .from('posts')
      .select('site_id, board_id, series_id, published_status')
      .eq('id', coPost.post_id)
      .maybeSingle();
    const updateResult = await supabaseAdmin
      .from('posts')
      .update({
        is_closed: true,
        closed_by: request.requester_id,
        closed_at: nowIsoString,
        closed_message: null,
        series_idx: null,
      })
      .eq('id', coPost.post_id);

    if (updateResult.error) throw new Error('글을 삭제하지 못했습니다.');

    const closedPost = postResult.data;

    if (closedPost?.series_id && closedPost.published_status === 'published') {
      await reorderSeriesIdx({
        siteId: closedPost.site_id as string,
        boardId: closedPost.board_id as string,
        seriesId: closedPost.series_id as string,
      });
    }
  }

  await supabaseAdmin
    .from('co_post_requests')
    .update({ status: 'accepted', responded_at: nowIsoString })
    .eq('id', request.id);

  const sameGroupTypes: CoPostRequestType[] =
    request.request_type === 'publish' || request.request_type === 'reschedule'
      ? ['publish', 'reschedule']
      : [request.request_type];

  await supabaseAdmin
    .from('co_post_requests')
    .update({ status: 'canceled', responded_at: nowIsoString })
    .eq('co_post_id', coPost.id)
    .eq('status', 'pending')
    .in('request_type', sameGroupTypes)
    .neq('id', request.id);

  const requesterSiteId = request.requester_id === coPost.inviter_id ? coPost.inviter_site_id : coPost.partner_site_id;

  await sendCoPostNotification({
    type: NOTIFICATION_TYPE.CO_POST_REQUEST_ACCEPTED,
    recipientId: request.requester_id,
    recipientSiteId: requesterSiteId,
    senderId: accepterId,
    postId: coPost.post_id,
  });
}

export type SharedCoPostForSite = {
  coPostId: string;
  postId: string;
  postSiteId: string;
  postBoardId: string;
  partnerCategoryIds: string[];
  partnerSeriesId: string | null;
};

export async function findSharedCoPostForSite(siteId: string, slug: string): Promise<SharedCoPostForSite | null> {
  const normalizedSlug = normalizeText(slug);

  if (!normalizedSlug) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const postResult = await supabaseAdmin
    .from('posts')
    .select('id, site_id, board_id')
    .eq('slug', normalizedSlug)
    .limit(5);
  const posts = (postResult.data ?? []) as { id: string; site_id: string; board_id: string }[];

  if (postResult.error || posts.length === 0) return null;

  const coPostResult = await supabaseAdmin
    .from('co_posts')
    .select('id, post_id, partner_category_ids, partner_series_id')
    .in(
      'post_id',
      posts.map((post) => post.id),
    )
    .eq('partner_site_id', siteId)
    .eq('status', 'active')
    .maybeSingle();

  const coPost = coPostResult.data;

  if (coPostResult.error || !coPost) return null;

  const post = posts.find((row) => row.id === coPost.post_id);

  if (!post) return null;

  return {
    coPostId: coPost.id as string,
    postId: post.id,
    postSiteId: post.site_id,
    postBoardId: post.board_id,
    partnerCategoryIds: (coPost.partner_category_ids as string[] | null) ?? [],
    partnerSeriesId: (coPost.partner_series_id as string | null) ?? null,
  };
}

export async function getActiveCoPostByPostId(postId: string) {
  const result = await getSupabaseAdmin()
    .from('co_posts')
    .select(CO_POST_COLUMNS)
    .eq('post_id', postId)
    .eq('status', 'active')
    .maybeSingle();

  return (result.data as CoPostRow | null) ?? null;
}

export async function findSharedCoPostByPostId(siteId: string, postId: string) {
  const coPostResult = await getSupabaseAdmin()
    .from('co_posts')
    .select('post_id')
    .eq('post_id', postId)
    .eq('partner_site_id', siteId)
    .eq('status', 'active')
    .maybeSingle();

  if (coPostResult.error || !coPostResult.data) return null;

  const postResult = await getSupabaseAdmin()
    .from('posts')
    .select('id, site_id, board_id')
    .eq('id', postId)
    .maybeSingle();

  return (postResult.data as { id: string; site_id: string; board_id: string } | null) ?? null;
}
