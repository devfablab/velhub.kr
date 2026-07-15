import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type WritePermission = 'member' | 'manager' | 'community-manager' | 'owner';

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: string;
  is_active: boolean;
  sort_order: number | null;
  markdown_status: string;
  site_id: string;
  created_at: string;
  post_per_page: number | null;
  write_permission: string | null;
};

type CommunityRow = {
  id: string;
  site_id: string;
};

type CommunityManageRoleRow = {
  role: string | null;
};

const MANAGER_ROLES = [
  'community-manager',
  'board-manager',
  'board-general-manager',
  'board-assistant-manager',
] as const;

function normalizeWritePermission(value: string | null | undefined): WritePermission {
  const normalizedValue = normalizeText(value);

  if (
    normalizedValue === 'member' ||
    normalizedValue === 'manager' ||
    normalizedValue === 'community-manager' ||
    normalizedValue === 'owner'
  ) {
    return normalizedValue;
  }

  return 'member';
}

function isManagerRole(value: string) {
  return MANAGER_ROLES.includes(value as (typeof MANAGER_ROLES)[number]);
}

function canWriteBoard({
  writePermission,
  sessionCase,
  siteRole,
  managerRoles,
}: {
  writePermission: WritePermission;
  sessionCase: string;
  siteRole: string;
  managerRoles: string[];
}) {
  const isAdmin = sessionCase === 'admin';
  const isOwner = siteRole === 'owner';
  const isApprovedMember = sessionCase === 'member' || sessionCase === 'staff';
  const isAnyManager = siteRole === 'manager' || managerRoles.some(isManagerRole);
  const isCommunityManager = managerRoles.includes('community-manager');

  if (writePermission === 'member') {
    return isAdmin || isApprovedMember;
  }

  if (writePermission === 'manager') {
    return isAdmin || isOwner || isAnyManager;
  }

  if (writePermission === 'community-manager') {
    return isAdmin || isOwner || isCommunityManager;
  }

  return isAdmin || isOwner;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (session.case === 'admin' || session.case === 'staff' || session.case === 'member') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const boards = await supabaseAdmin
      .from('boards')
      .select(
        'id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id, created_at, post_per_page, write_permission',
      )
      .eq('site_id', rhizome.data.id)
      .order('sort_order', { ascending: true });

    if (boards.error) {
      return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    let siteRole = '';
    let managerRoles: string[] = [];

    if (session.rhizomeStigmaId) {
      const membership = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('role')
        .eq('id', session.rhizomeStigmaId)
        .eq('site_id', rhizome.data.id)
        .maybeSingle();

      if (!membership.error && membership.data?.role) {
        siteRole = normalizeText(membership.data.role);
      }
    }

    if (rhizome.data.site_type === 'community' && session.rhizomeStigmaId) {
      const community = await supabaseAdmin
        .from('communities')
        .select('id, site_id')
        .eq('site_id', rhizome.data.id)
        .maybeSingle();

      if (!community.error && community.data) {
        const communityRow = community.data as CommunityRow;

        const communityManageRoles = await supabaseAdmin
          .from('community_manage_role')
          .select('role')
          .eq('community_id', communityRow.id)
          .eq('manager_id', session.rhizomeStigmaId);

        if (!communityManageRoles.error) {
          managerRoles = ((communityManageRoles.data ?? []) as CommunityManageRoleRow[])
            .map((row) => normalizeText(row.role))
            .filter(isManagerRole);
        }
      }
    }

    const boardRows = (boards.data ?? []) as BoardRow[];

    const writeBoards = boardRows
      .filter((board) => board.is_active === true && board.board_type !== 'page')
      .filter((board) =>
        canWriteBoard({
          writePermission: normalizeWritePermission(board.write_permission),
          sessionCase: session.case,
          siteRole,
          managerRoles,
        }),
      );

    return Response.json({
      boards: writeBoards,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
  }
}
