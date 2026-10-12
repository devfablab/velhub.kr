import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = { siteName?: string | null; words?: unknown };

function normalizeWord(value: unknown) {
  return (typeof value === 'string' ? value : '').replace(/\s+/g, '').replace(/[^\p{L}]/gu, '').trim();
}

function normalizeWords(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map(normalizeWord).filter((word) => word.length >= 2 && word.length <= 10)));
}

async function getAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const site = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

  if (site.error || !site.data) {
    return { ok: false, status: 404, error: '사이트를 찾을 수 없습니다.' } as const;
  }

  const session = await verifySession({ siteId: site.data.id });

  if (session.case !== 'admin' && session.case !== 'staff') {
    return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
  }

  return { ok: true, site: site.data, supabaseAdmin } as const;
}

export async function GET(request: Request) {
  try {
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const words = await access.supabaseAdmin
      .from('site_denywords')
      .select('id, word')
      .eq('site_id', access.site.id)
      .order('created_at');

    if (words.error) {
      return Response.json({ error: '차단 단어를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      siteType: access.site.site_type,
      words: (words.data ?? []).map((word) => ({ id: word.id, word: word.word })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '차단 단어를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const siteName = normalizeText(body.siteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const words = normalizeWords(body.words);

    if (Array.isArray(body.words) && words.length !== body.words.filter((word) => normalizeWord(word)).length) {
      return Response.json({ error: '단어는 2자 이상 10자 이하의 문자만 사용할 수 있습니다.' }, { status: 400 });
    }

    const deleted = await access.supabaseAdmin.from('site_denywords').delete().eq('site_id', access.site.id);

    if (deleted.error) {
      return Response.json({ error: '차단 단어 저장에 실패했습니다.' }, { status: 500 });
    }

    if (words.length > 0) {
      const inserted = await access.supabaseAdmin
        .from('site_denywords')
        .insert(words.map((word) => ({ site_id: access.site.id, word })))
        .select('id, word');

      if (inserted.error) {
        return Response.json({ error: '차단 단어 저장에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({ siteType: access.site.site_type, words: inserted.data ?? [] });
    }

    return Response.json({ siteType: access.site.site_type, words: [] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '차단 단어 저장에 실패했습니다.' }, { status: 500 });
  }
}
