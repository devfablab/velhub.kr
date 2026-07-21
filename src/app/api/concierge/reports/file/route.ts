import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

const allowedBuckets = new Set(['report-legals', 'report-rights']);

export async function GET(request: Request) {
  try {
    const session = await verifySession({ siteId: null });

    if (session.case !== 'admin') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const requestUrl = new URL(request.url);
    const bucket = normalizeText(requestUrl.searchParams.get('bucket'));
    const path = normalizeText(requestUrl.searchParams.get('path'));

    if (!allowedBuckets.has(bucket) || !path) {
      return Response.json({ error: '첨부 파일 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const signedUrlResult = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60);

    if (signedUrlResult.error || !signedUrlResult.data.signedUrl) {
      console.error('[concierge/reports/file] signed url error', signedUrlResult.error);
      return Response.json({ error: '첨부 파일을 열 수 없습니다.' }, { status: 404 });
    }

    return Response.redirect(signedUrlResult.data.signedUrl);
  } catch (unknownError) {
    console.error('[concierge/reports/file] unexpected error', unknownError);
    return Response.json({ error: '첨부 파일을 열 수 없습니다.' }, { status: 500 });
  }
}
