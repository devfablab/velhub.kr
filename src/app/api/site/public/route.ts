import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

function onlyDigits(value: string | null | undefined) {
  return normalizeText(value).replace(/\D/g, '');
}

function isAdult(birthDate: string | null | undefined) {
  const digits = onlyDigits(birthDate);

  if (digits.length !== 8) {
    return false;
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age >= 19;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, owner_id, site_key, site_label, site_type, visibility_type, is_shutdown, is_blocked, is_closed')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const rhizomeStigmas = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, user_id')
      .eq('site_id', rhizome.data.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (rhizomeStigmas.error) {
      return Response.json({ error: '사이트 유저 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!rhizomeStigmas.data) {
      return Response.json({ error: '사이트 유저를 찾을 수 없습니다.' }, { status: 404 });
    }

    const owner = await supabaseAdmin
      .from('stigmas')
      .select('user_id')
      .eq('id', rhizomeStigmas.data?.user_id)
      .maybeSingle();

    if (owner.error) {
      return Response.json({ error: '운영자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    let purchaseAvailable = false;

    if (owner.data?.user_id) {
      const chorogon = await supabaseAdmin
        .from('chorogons')
        .select('birth_date, birth_date_dummy, identity_verified_at')
        .eq('user_id', owner.data.user_id)
        .maybeSingle();

      if (chorogon.error) {
        return Response.json({ error: '운영자 인증 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      if (chorogon.data?.identity_verified_at) {
        const birthDate =
          process.env.NEXT_PUBLIC_APP_ENV === 'test' && chorogon.data.birth_date_dummy
            ? chorogon.data.birth_date_dummy
            : chorogon.data.birth_date
              ? decrypt(chorogon.data.birth_date)
              : null;

        purchaseAvailable = isAdult(birthDate);
      }
    }

    const boards = await supabaseAdmin
      .from('boards')
      .select('id, board_type, board_key, board_label, sort_order')
      .eq('site_id', rhizome.data.id)
      .order('sort_order', { ascending: true });

    if (boards.error) {
      return Response.json({ error: '메뉴 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    const boardRows = boards.data ?? [];
    const pageBoardIds = boardRows.filter((board) => board.board_type === 'page').map((board) => board.id);
    const pageSubjectMap = new Map<string, string>();
    const pageSlugMap = new Map<string, string>();

    if (pageBoardIds.length > 0) {
      const pages = await supabaseAdmin
        .from('pages')
        .select('board_id, subject, slug')
        .in('board_id', pageBoardIds)
        .order('sort_order', { ascending: true });

      if (pages.error) {
        return Response.json({ error: '메뉴 설정을 불러오지 못했습니다.' }, { status: 500 });
      }

      for (const page of pages.data ?? []) {
        if (!pageSubjectMap.has(page.board_id)) {
          pageSubjectMap.set(page.board_id, page.subject ?? '');
        }

        if (!pageSlugMap.has(page.board_id)) {
          pageSlugMap.set(page.board_id, page.slug ?? '');
        }
      }
    }

    return Response.json({
      siteInfo: {
        site_key: rhizome.data.site_key,
        site_type: rhizome.data.site_type,
        site_label: rhizome.data.site_label,
        visibility_type: rhizome.data.visibility_type,
        is_shutdown: rhizome.data.is_shutdown,
        is_blocked: rhizome.data.is_blocked,
        is_closed: rhizome.data.is_closed,
        purchase_available: purchaseAvailable,
      },
      menus: boardRows.map((board) => ({
        id: board.id,
        board_type: board.board_type,
        board_label: board.board_label,
        display_label:
          board.board_type === 'blog'
            ? board.board_label
            : board.board_type === 'page'
              ? pageSubjectMap.get(board.id)
              : board.board_label,
        slug: board.board_type === 'page' ? `p/${pageSlugMap.get(board.id)}` : board.board_key,
        sort_order: board.sort_order,
        is_renameable: board.board_type === 'blog',
      })),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
