import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getPersonalBlogOwner, searchCoPostPartners } from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const siteName = normalizeText(searchParams.get('siteName')).toLowerCase();
    const keyword = normalizeText(searchParams.get('keyword'));
    const siteResult = await getSupabaseAdmin().from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return NextResponse.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: siteResult.data.id });
    const owner = await getPersonalBlogOwner(siteResult.data.id);

    if (!session.stigmaId || !owner || owner.ownerId !== session.stigmaId) {
      return NextResponse.json({ error: '공동 집필은 1인 블로그 운영자만 시작할 수 있습니다.' }, { status: 403 });
    }

    const partners = await searchCoPostPartners(keyword, session.stigmaId);

    return NextResponse.json({
      partners: partners.map((partner) => ({
        siteId: partner.siteId,
        siteKey: partner.siteKey,
        siteLabel: partner.siteLabel,
        ownerName: partner.ownerName,
        ownerAvatarUrl: partner.ownerAvatarUrl,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '운영자를 검색하지 못했습니다.' },
      { status: 500 },
    );
  }
}
