import { NextResponse } from 'next/server';
import { getAuthorState } from '@/lib/session/author';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

type CreatorLinkInput = { label?: unknown; url?: unknown; sortOrder?: unknown };

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHandleName(value: unknown) {
  return toText(value).toLowerCase();
}

function normalizeUrl(value: unknown) {
  const text = toText(value);
  if (!text) return '';
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const [authorState, creatorResult] = await Promise.all([
    getAuthorState(currentStigma.stigmaId),
    supabaseAdmin
      .from('creators')
      .select('id, handle_name, cover_image, introduction')
      .eq('user_id', currentStigma.stigmaId)
      .maybeSingle(),
  ]);

  if (creatorResult.error)
    return NextResponse.json(
      { message: `작가 프로필을 불러오지 못했습니다. (${creatorResult.error.message})` },
      { status: 500 },
    );

  const linksResult = creatorResult.data
    ? await supabaseAdmin
        .from('creator_links')
        .select('id, label, url, sort_order')
        .eq('creator_id', creatorResult.data.id)
        .order('sort_order', { ascending: true })
    : { data: [], error: null };

  if (linksResult.error) return NextResponse.json({ message: '작가 링크를 불러오지 못했습니다.' }, { status: 500 });

  const { getMembershipFeatures } = await import('@/lib/memberships/features');
  const features = await getMembershipFeatures(currentStigma.stigmaId);
  const hasBranding = features.has('creator_branding');

  return NextResponse.json({
    isAuthor: authorState.isAuthor,
    creator: creatorResult.data
      ? {
          id: creatorResult.data.id,
          handleName: creatorResult.data.handle_name,
          coverImage: hasBranding ? creatorResult.data.cover_image : null,
          introduction: hasBranding ? creatorResult.data.introduction : null,
          links: hasBranding
            ? (linksResult.data ?? []).map((link) => ({
                id: link.id,
                label: link.label,
                url: link.url,
              }))
            : [],
        }
      : null,
  });
}

export async function PUT(request: Request) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const authorState = await getAuthorState(currentStigma.stigmaId);
  if (!authorState.isAuthor)
    return NextResponse.json({ message: '작가만 프로필을 설정할 수 있습니다.' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    handleName?: unknown;
    coverImage?: unknown;
    introduction?: unknown;
    links?: CreatorLinkInput[];
  } | null;
  const handleName = normalizeHandleName(body?.handleName);
  const introduction = toText(body?.introduction) || null;
  const coverImage = toText(body?.coverImage) || null;

  if (!/^[a-z0-9](?:[a-z0-9-]{1,13}[a-z0-9])?$/.test(handleName)) {
    return NextResponse.json(
      { message: '핸들네임은 영문 소문자, 숫자, 하이픈으로 3~15자 입력해 주세요.' },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [existingResult, sameHandleResult] = await Promise.all([
    supabaseAdmin.from('creators').select('id').eq('user_id', currentStigma.stigmaId).maybeSingle(),
    supabaseAdmin.from('creators').select('id, user_id').eq('handle_name', handleName).maybeSingle(),
  ]);

  if (existingResult.error || sameHandleResult.error)
    return NextResponse.json({ message: '작가 프로필을 확인하지 못했습니다.' }, { status: 500 });
  if (sameHandleResult.data && sameHandleResult.data.user_id !== currentStigma.stigmaId) {
    return NextResponse.json({ message: '이미 사용 중인 핸들네임입니다.' }, { status: 409 });
  }

  const { getMembershipFeatures } = await import('@/lib/memberships/features');
  const features = await getMembershipFeatures(currentStigma.stigmaId);
  const hasBranding = features.has('creator_branding');

  const updateData: Record<string, unknown> = { handle_name: handleName };
  if (hasBranding) {
    updateData.introduction = introduction;
    updateData.cover_image = coverImage;
  }

  const updateResult = existingResult.data
    ? await supabaseAdmin
        .from('creators')
        .update(updateData)
        .eq('id', existingResult.data.id)
        .select('id, handle_name, cover_image, introduction')
        .single()
    : await supabaseAdmin
        .from('creators')
        .insert({ user_id: currentStigma.stigmaId, ...updateData })
        .select('id, handle_name, cover_image, introduction')
        .single();

  if (updateResult.error || !updateResult.data)
    return NextResponse.json({ message: '작가 프로필을 저장하지 못했습니다.' }, { status: 500 });

  if (hasBranding) {
    const nextLinks = (body?.links ?? [])
      .map((link, index) => ({
        label: toText(link.label),
        url: normalizeUrl(link.url),
        sort_order: index,
      }))
      .filter((link) => link.label && link.url);

    if (nextLinks.length > 5)
      return NextResponse.json({ message: '링크는 최대 5개까지 등록할 수 있습니다.' }, { status: 400 });

    const deleteResult = await supabaseAdmin.from('creator_links').delete().eq('creator_id', updateResult.data.id);
    if (deleteResult.error) return NextResponse.json({ message: '작가 링크를 갱신하지 못했습니다.' }, { status: 500 });

    if (nextLinks.length > 0) {
      const insertResult = await supabaseAdmin
        .from('creator_links')
        .insert(nextLinks.map((link) => ({ ...link, creator_id: updateResult.data.id })));
      if (insertResult.error)
        return NextResponse.json({ message: '작가 링크를 저장하지 못했습니다.' }, { status: 500 });
    }
  }

  const finalLinksResult = hasBranding
    ? await supabaseAdmin
        .from('creator_links')
        .select('id, label, url, sort_order')
        .eq('creator_id', updateResult.data.id)
        .order('sort_order', { ascending: true })
    : { data: [], error: null };

  return NextResponse.json({
    creator: {
      id: updateResult.data.id,
      handleName: updateResult.data.handle_name,
      coverImage: hasBranding ? updateResult.data.cover_image : null,
      introduction: hasBranding ? updateResult.data.introduction : null,
      links: hasBranding
        ? (finalLinksResult.data ?? []).map((link) => ({
            id: link.id,
            label: link.label,
            url: link.url,
          }))
        : [],
    },
  });
}
