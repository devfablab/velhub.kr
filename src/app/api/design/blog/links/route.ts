import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

type ServiceValue = 'Facebook' | 'GitHub' | 'Instagram' | 'LinkedIn' | 'Pinterest' | 'X' | 'YouTube';

type LinkRow = {
  service: ServiceValue | null;
  account: string | null;
};

type RequestBody = {
  siteName: string | null;
  links: LinkRow[] | null;
};

const ALLOWED_SERVICES: ServiceValue[] = ['Facebook', 'GitHub', 'Instagram', 'LinkedIn', 'Pinterest', 'X', 'YouTube'];

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function isAllowedService(value: string): value is ServiceValue {
  return ALLOWED_SERVICES.includes(value as ServiceValue);
}

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (rhizome.data.site_type !== 'blog') {
    return {
      ok: false,
      status: 403,
      error: '블로그 사이트만 접근할 수 있습니다.',
    } as const;
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  if (session.status === 'FAIL' || session.case !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  const blog = await supabaseAdmin.from('blogs').select('id').eq('site_id', rhizome.data.id).maybeSingle();

  if (blog.error) {
    return {
      ok: false,
      status: 500,
      error: '소셜 링크를 불러오지 못했습니다.',
    } as const;
  }

  if (!blog.data) {
    return {
      ok: true,
      status: 200,
      siteId: rhizome.data.id,
      blogId: null,
      supabaseAdmin,
    } as const;
  }

  return {
    ok: true,
    status: 200,
    siteId: rhizome.data.id,
    blogId: blog.data.id,
    supabaseAdmin,
  } as const;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!access.blogId) {
      return Response.json({
        links: [],
      });
    }

    const links = await access.supabaseAdmin
      .from('blog_links')
      .select('id, service, account, sort_order, blog_id')
      .eq('blog_id', access.blogId)
      .order('sort_order', { ascending: true });

    if (links.error) {
      console.error('소셜 링크 불러오기 실패:', links.error);
      return Response.json({ error: '소셜 링크를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      links: links.data ?? [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소셜 링크를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소셜 링크를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const links = Array.isArray(requestBody.links) ? requestBody.links : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    for (const link of links) {
      const service = normalizeText(link.service);
      const account = normalizeText(link.account);

      if (!service || !account) {
        return Response.json({ error: '빈 데이터가 있습니다.' }, { status: 400 });
      }

      if (!isAllowedService(service)) {
        return Response.json({ error: '서비스 값이 유효하지 않습니다.' }, { status: 400 });
      }
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!access.blogId) {
      return Response.json({ error: '블로그 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const deleteLinks = await access.supabaseAdmin.from('blog_links').delete().eq('blog_id', access.blogId);

    if (deleteLinks.error) {
      return Response.json({ error: '소셜 링크 저장에 실패했습니다.' }, { status: 500 });
    }

    if (links.length === 0) {
      return Response.json({
        ok: true,
        links: [],
      });
    }

    const insertLinks = await access.supabaseAdmin
      .from('blog_links')
      .insert(
        links.map((link, index) => ({
          service: normalizeText(link.service),
          account: normalizeText(link.account),
          sort_order: index + 1,
          blog_id: access.blogId,
        })),
      )
      .select('id, service, account, sort_order, blog_id');

    if (insertLinks.error) {
      return Response.json({ error: '소셜 링크 저장에 실패했습니다.' }, { status: 500 });
    }

    const sortedLinks = [...(insertLinks.data ?? [])].sort((a, b) => {
      const aOrder = typeof a.sort_order === 'number' ? a.sort_order : 0;
      const bOrder = typeof b.sort_order === 'number' ? b.sort_order : 0;
      return aOrder - bOrder;
    });

    return Response.json({
      ok: true,
      links: sortedLinks,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소셜 링크 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소셜 링크 저장에 실패했습니다.' }, { status: 500 });
  }
}
