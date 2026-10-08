import sharp from 'sharp';
import { getBlogCommunityEnablement } from '@/lib/blogCommunity/access';
import { getSupabaseAdmin } from '@/lib/supabase';

const PERIODS = [0, 1, 3, 6, 12, 24, 36, 48, 60];
const MAX_SIZE = 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ siteName: string }> }) {
  try {
    const { siteName } = await params;
    const feature = await getBlogCommunityEnablement(siteName);
    if (!feature?.isPersonalBlog || !feature.isOwner) return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    if (!feature.isEnabled) return Response.json({ error: '블로그 구독이 활성화되어 있지 않아 사용할 수 없습니다.' }, { status: 400 });
    const form = await request.formData();
    const months = Number(form.get('months'));
    const file = form.get('image');
    if (!PERIODS.includes(months) || !(file instanceof File)) return Response.json({ error: '배지 정보가 올바르지 않습니다.' }, { status: 400 });
    if (!['image/png', 'image/webp'].includes(file.type) || file.size >= MAX_SIZE)
      return Response.json({ error: '1MB 미만의 PNG 또는 WEBP 이미지만 등록할 수 있습니다.' }, { status: 400 });
    const db = getSupabaseAdmin();
    const existing = await db.from('blog_subscription_badges').select('subscription_months,image_url').eq('site_id', feature.siteId).order('subscription_months');
    if (existing.error) throw existing.error;
    const required = PERIODS.slice(0, PERIODS.indexOf(months));
    if (required.some((period) => !(existing.data ?? []).some((badge) => badge.subscription_months === period))) {
      const missing = required.find((period) => !(existing.data ?? []).some((badge) => badge.subscription_months === period))!;
      return Response.json({ error: `${missing >= 60 ? '5년 이상' : `${missing}개월`}차 배지 이미지가 등록되지 않았습니다.` }, { status: 400 });
    }
    const path = `${feature.siteId}/${months}/${crypto.randomUUID()}.webp`;
    const converted = await sharp(Buffer.from(await file.arrayBuffer())).webp().toBuffer();
    const upload = await db.storage.from('blog-badges').upload(path, converted, { contentType: 'image/webp', upsert: false });
    if (upload.error) throw upload.error;
    const imageUrl = db.storage.from('blog-badges').getPublicUrl(path).data.publicUrl;
    const old = (existing.data ?? []).find((badge) => badge.subscription_months === months);
    const saved = await db.from('blog_subscription_badges').upsert({ site_id: feature.siteId, subscription_months: months, image_url: imageUrl, updated_at: new Date().toISOString() }, { onConflict: 'site_id,subscription_months' });
    if (saved.error) { await db.storage.from('blog-badges').remove([path]); throw saved.error; }
    if (old?.image_url) { const marker = '/blog-badges/'; const oldPath = old.image_url.split(marker)[1]; if (oldPath) await db.storage.from('blog-badges').remove([oldPath]); }
    const [allBadges, subscriptions] = await Promise.all([
      db.from('blog_subscription_badges').select('subscription_months,image_url').eq('site_id', feature.siteId).order('subscription_months'),
      db.from('subscriptions').select('id,badge_months').eq('subscription_type', 'subscription_site').eq('target_type', 'site').eq('target_id', feature.siteId),
    ]);
    if (allBadges.error || subscriptions.error) throw new Error('구독자 배지를 갱신하지 못했습니다.');
    await Promise.all((subscriptions.data ?? []).map((subscription) => {
      const selected = (allBadges.data ?? []).filter((badge) => badge.subscription_months <= subscription.badge_months).at(-1) ?? (allBadges.data ?? [])[0];
      return db.from('subscriptions').update({ badge_image_url: selected?.image_url ?? null }).eq('id', subscription.id);
    }));
    return Response.json({ ok: true, months, imageUrl });
  } catch { return Response.json({ error: '멤버십팬 배지를 저장하지 못했습니다.' }, { status: 500 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ siteName: string }> }) {
  try {
    const { siteName } = await params;
    const feature = await getBlogCommunityEnablement(siteName);
    if (!feature?.isPersonalBlog || !feature.isOwner) return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    const body = (await request.json()) as { months?: unknown };
    const months = Number(body.months);
    if (!PERIODS.includes(months)) return Response.json({ error: '배지 정보가 올바르지 않습니다.' }, { status: 400 });
    const db = getSupabaseAdmin();
    const row = await db.from('blog_subscription_badges').select('image_url').eq('site_id', feature.siteId).eq('subscription_months', months).maybeSingle();
    if (row.error || !row.data) return Response.json({ error: '등록한 배지를 찾을 수 없습니다.' }, { status: 404 });
    const later = PERIODS.filter((period) => period > months);
    const dependent = await db.from('blog_subscription_badges').select('subscription_months').eq('site_id', feature.siteId).in('subscription_months', later).limit(1);
    if (dependent.data?.length) return Response.json({ error: '뒤 기간의 배지를 먼저 삭제해주세요.' }, { status: 400 });
    const deleted = await db.from('blog_subscription_badges').delete().eq('site_id', feature.siteId).eq('subscription_months', months);
    if (deleted.error) throw deleted.error;
    const marker = '/blog-badges/'; const path = row.data.image_url.split(marker)[1];
    if (path) await db.storage.from('blog-badges').remove([path]);
    return Response.json({ ok: true });
  } catch { return Response.json({ error: '멤버십팬 배지를 삭제하지 못했습니다.' }, { status: 500 }); }
}
