import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export async function getPrivateBoardAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const site = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (site.error || !site.data) return { ok: false, status: 404, error: '사이트를 찾을 수 없습니다.' } as const;

  const session = await getSessionClaims();
  if (!session?.userId) return { ok: false, status: 401, error: '로그인이 필요합니다.' } as const;

  const stigma = await supabaseAdmin.from('stigmas').select('id, role').eq('user_id', session.userId).maybeSingle();
  if (stigma.error || !stigma.data)
    return { ok: false, status: 403, error: '회원에게만 공개되는 게시판입니다.' } as const;

  const membership = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role')
    .eq('site_id', site.data.id)
    .eq('user_id', stigma.data.id)
    .maybeSingle();
  if (membership.error || !membership.data)
    return { ok: false, status: 403, error: '회원에게만 공개되는 게시판입니다.' } as const;

  const community = await supabaseAdmin.from('communities').select('id').eq('site_id', site.data.id).maybeSingle();
  const managerRoles = community.data
    ? await supabaseAdmin
        .from('community_manage_role')
        .select('id')
        .eq('community_id', community.data.id)
        .eq('manager_id', membership.data.id)
    : { data: [] };
  const isStaff =
    stigma.data.role === 'admin' || membership.data.role === 'owner' || (managerRoles.data?.length ?? 0) > 0;

  const board = await supabaseAdmin
    .from('private_boards')
    .select('id, board_label, is_image_enabled')
    .eq('site_id', site.data.id)
    .maybeSingle();
  if (board.error || !board.data) return { ok: false, status: 404, error: '설치된 비공개 게시판이 없습니다.' } as const;

  return { ok: true, supabaseAdmin, site: site.data, stigmaId: stigma.data.id, isStaff, board: board.data } as const;
}

export function getPrivateBoardSiteName(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}
