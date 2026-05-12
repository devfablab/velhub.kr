import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';
type GiscusInputPosition = 'top' | 'bottom';
type GiscusFlag = '0' | '1';

type GiscusSettings = {
  repo: string;
  repoId: string;
  strict: GiscusFlag;
  reactionsEnabled: GiscusFlag;
  emitMetadata: GiscusFlag;
  inputPosition: GiscusInputPosition;
};

type RequestBody = {
  siteName: string | null;
  commentProvider: CommentProvider | null;
  giscusSettings?: Partial<GiscusSettings> | null;
};

function isCommentProvider(value: string): value is CommentProvider {
  return value === 'none' || value === 'giscus' || value === 'disqus' || value === 'velhub';
}

function isGiscusInputPosition(value: string): value is GiscusInputPosition {
  return value === 'top' || value === 'bottom';
}

function normalizeGiscusFlag(value: unknown): GiscusFlag {
  return value === '1' ? '1' : '0';
}

function normalizeGiscusSettings(value: Partial<GiscusSettings> | null | undefined): GiscusSettings {
  const repo = normalizeText(value?.repo);
  const repoId = normalizeText(value?.repoId);
  const inputPositionValue = normalizeText(value?.inputPosition).toLowerCase();

  return {
    repo,
    repoId,
    strict: normalizeGiscusFlag(value?.strict),
    reactionsEnabled: normalizeGiscusFlag(value?.reactionsEnabled),
    emitMetadata: normalizeGiscusFlag(value?.emitMetadata),
    inputPosition: isGiscusInputPosition(inputPositionValue) ? inputPositionValue : 'bottom',
  };
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

  if (session.case !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    siteId: rhizome.data.id,
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

    const blog = await access.supabaseAdmin
      .from('blogs')
      .select('comment_provider, giscus_settings')
      .eq('site_id', access.siteId)
      .maybeSingle();

    if (blog.error || !blog.data) {
      return Response.json({ error: '댓글 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      blog: {
        commentProvider: blog.data.comment_provider,
        giscusSettings: normalizeGiscusSettings(blog.data.giscus_settings as Partial<GiscusSettings> | null),
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '댓글 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '댓글 설정을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const commentProvider = normalizeText(requestBody.commentProvider).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isCommentProvider(commentProvider)) {
      return Response.json({ error: '댓글 방식을 확인해주세요.' }, { status: 400 });
    }

    const giscusSettings = normalizeGiscusSettings(requestBody.giscusSettings);

    if (commentProvider === 'giscus' && (!giscusSettings.repo || !giscusSettings.repoId)) {
      return Response.json({ error: 'Giscus 설정값을 입력해주세요.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const updateBlog = await access.supabaseAdmin
      .from('blogs')
      .update({
        comment_provider: commentProvider,
        giscus_settings: giscusSettings,
      })
      .eq('site_id', access.siteId)
      .select('comment_provider, giscus_settings')
      .maybeSingle();

    if (updateBlog.error || !updateBlog.data) {
      return Response.json({ error: '댓글 설정 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      blog: {
        commentProvider: updateBlog.data.comment_provider,
        giscusSettings: normalizeGiscusSettings(updateBlog.data.giscus_settings as Partial<GiscusSettings> | null),
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '댓글 설정 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '댓글 설정 저장에 실패했습니다.' }, { status: 500 });
  }
}
