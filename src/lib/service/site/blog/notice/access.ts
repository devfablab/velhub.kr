import { getSupabaseAdmin } from '@/lib/clients/supabase';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

export const NOTICE_DEFAULT_BOARD_LABEL = '공지';
export const NOTICE_MAX_CONTENT_LENGTH = 10000;
export const NOTICE_MAX_IMAGE_SIZE = 1024 * 1024;
export const NOTICE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type NoticeBoard = {
  id: string;
  board_label: string;
  is_enabled: boolean;
};

export type NoticeContext = {
  siteId: string;
  siteName: string;
  isPersonalBlog: boolean;
  board: NoticeBoard | null;
  // 서비스 화면에서 공지 게시판을 쓸 수 있는 상태 (개인 블로그 + 활성화)
  isAvailable: boolean;
  // 사이트 운영자 (rhizome_stigmas.role = 'owner')
  isOwner: boolean;
  stigmaId: string | null;
};

// 기존 개인 블로그는 blog_type이 null일 수 있으며, team으로 명시된 경우만 팀 블로그
export function isPersonalBlogType(blogType: string | null | undefined) {
  return blogType !== 'team';
}

export async function getNoticeContext(siteName: string): Promise<NoticeContext | null> {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteResult.error) {
    throw new Error('블로그 정보를 불러오지 못했습니다.');
  }

  if (!siteResult.data || siteResult.data.site_type !== 'blog') {
    return null;
  }

  const siteId = siteResult.data.id as string;
  const [blogResult, boardResult, session] = await Promise.all([
    supabaseAdmin.from('blogs').select('blog_type').eq('site_id', siteId).maybeSingle(),
    supabaseAdmin.from('notice_boards').select('id, board_label, is_enabled').eq('site_id', siteId).maybeSingle(),
    verifySession({ siteId }),
  ]);

  if (blogResult.error || boardResult.error) {
    throw new Error('공지 정보를 불러오지 못했습니다.');
  }

  let isOwner = false;

  if (session.rhizomeStigmaId) {
    const roleResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('id', session.rhizomeStigmaId)
      .eq('site_id', siteId)
      .maybeSingle();

    if (roleResult.error) {
      throw new Error('공지 정보를 불러오지 못했습니다.');
    }

    isOwner = normalizeText(roleResult.data?.role) === 'owner';
  }

  const isPersonalBlog = isPersonalBlogType(blogResult.data?.blog_type);
  const board = (boardResult.data as NoticeBoard | null) ?? null;

  return {
    siteId,
    siteName: normalizedSiteName,
    isPersonalBlog,
    board,
    isAvailable: isPersonalBlog && board?.is_enabled === true,
    isOwner,
    stigmaId: session.stigmaId,
  };
}

export function getNoticeImagePath(siteId: string, postId: string) {
  return `${siteId}/${postId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
}

// 1MB 미만, png/webp/jpg만 허용
export function validateNoticeImage(file: File) {
  if (!NOTICE_IMAGE_MIME_TYPES.has(file.type)) {
    return 'JPG, PNG, WEBP 이미지만 등록할 수 있습니다.';
  }

  if (file.size >= NOTICE_MAX_IMAGE_SIZE) {
    return '이미지는 1MB 미만만 등록할 수 있습니다.';
  }

  return '';
}

export function validateNoticeContent(content: string) {
  if (!content) {
    return '내용을 입력해주세요.';
  }

  if (content.length > NOTICE_MAX_CONTENT_LENGTH) {
    return '내용은 10,000자 이하로 입력해주세요.';
  }

  return '';
}
