import { getPrivateBoardAccess, getPrivateBoardSiteName } from '@/lib/private-board/access';
import { normalizeText } from '@/lib/utils';

async function getReplyAccess(request: Request, postId: string, replyId: string) {
  const siteName = getPrivateBoardSiteName(new URL(request.url).searchParams.get('siteName'));

  if (!siteName || !postId || !replyId) {
    return { ok: false, status: 400, error: '요청 정보가 유효하지 않습니다.' } as const;
  }

  const access = await getPrivateBoardAccess(siteName);

  if (!access.ok) return access;

  const reply = await access.supabaseAdmin
    .from('private_post_replies')
    .select('id, author_stigma_id, author_type, content_html, created_at')
    .eq('id', replyId)
    .eq('private_post_id', postId)
    .eq('site_id', access.site.id)
    .maybeSingle();

  if (reply.error || !reply.data) {
    return { ok: false, status: 404, error: '답변을 찾을 수 없습니다.' } as const;
  }

  if (reply.data.author_type !== 'staff' || reply.data.author_stigma_id !== access.stigmaId) {
    return { ok: false, status: 403, error: '본인이 작성한 운영자 답변만 수정할 수 있습니다.' } as const;
  }

  if (Date.now() - new Date(reply.data.created_at).getTime() > 5 * 60 * 1000) {
    return { ok: false, status: 400, error: '답변은 작성 후 5분 동안만 수정할 수 있습니다.' } as const;
  }

  return { ok: true, access, reply: reply.data } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ postId: string; replyId: string }> }) {
  const { postId, replyId } = await params;
  const result = await getReplyAccess(request, postId, replyId);

  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ reply: result.reply });
}

export async function PUT(request: Request, { params }: { params: Promise<{ postId: string; replyId: string }> }) {
  const { postId, replyId } = await params;
  const result = await getReplyAccess(request, postId, replyId);

  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  const body = (await request.json()) as { contentHtml?: string | null };
  const contentHtml = normalizeText(body.contentHtml);

  if (!contentHtml) return Response.json({ error: '내용을 입력해 주세요.' }, { status: 400 });

  const update = await result.access.supabaseAdmin
    .from('private_post_replies')
    .update({ content_html: contentHtml, updated_at: new Date().toISOString() })
    .eq('id', replyId)
    .eq('private_post_id', postId)
    .eq('site_id', result.access.site.id);

  if (update.error) return Response.json({ error: '답변 수정에 실패했습니다.' }, { status: 500 });

  return Response.json({ ok: true });
}
