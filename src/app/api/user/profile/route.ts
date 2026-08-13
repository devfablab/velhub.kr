import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthorState } from '@/lib/session/author';

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

  if (creatorResult.error) return NextResponse.json({ message: '독자 프로필을 불러오지 못했습니다.' }, { status: 500 });

  const linksResult = creatorResult.data
    ? await supabaseAdmin
        .from('creator_links')
        .select('id, label, url, sort_order')
        .eq('creator_id', creatorResult.data.id)
        .order('sort_order', { ascending: true })
    : { data: [], error: null };

  if (linksResult.error) return NextResponse.json({ message: '독자 링크를 불러오지 못했습니다.' }, { status: 500 });

  return NextResponse.json({
    isAuthor: authorState.isAuthor,
    user: creatorResult.data
      ? {
          id: creatorResult.data.id,
          handleName: creatorResult.data.handle_name,
          coverImage: creatorResult.data.cover_image,
          introduction: creatorResult.data.introduction,
          links: (linksResult.data ?? []).map((link) => ({
            id: link.id,
            label: link.label,
            url: link.url,
          })),
        }
      : null,
  });
}

export async function PUT(request: Request) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });


  const body = await request.json().catch(() => null) as {
    handleName?: unknown;
    coverImage?: unknown;
    introduction?: unknown;
    links?: CreatorLinkInput[];
  } | null;
  const handleName = normalizeHandleName(body?.handleName);
  const introduction = toText(body?.introduction) || null;
  const coverImage = toText(body?.coverImage) || null;
  const links = Array.isArray(body?.links) ? body.links : [];

  if (!/^[a-z0-9](?:[a-z0-9-]{1,13}[a-z0-9])?$/.test(handleName)) {
    return NextResponse.json({ message: '핸들네임은 영문 소문자, 숫자, 하이픈으로 3~15자 입력해 주세요.' }, { status: 400 });
  }

  if (links.length > 5) return NextResponse.json({ message: '링크는 최대 5개까지 등록할 수 있습니다.' }, { status: 400 });

  const normalizedLinks = links.map((link, index) => ({
    label: toText(link.label),
    url: normalizeUrl(link.url),
    sort_order: index + 1,
  }));
  if (normalizedLinks.some((link) => !link.label || !link.url)) {
    return NextResponse.json({ message: '링크의 레이블과 주소를 모두 입력해 주세요.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [existingResult, sameHandleResult] = await Promise.all([
    supabaseAdmin.from('creators').select('id').eq('user_id', currentStigma.stigmaId).maybeSingle(),
    supabaseAdmin.from('creators').select('id, user_id').eq('handle_name', handleName).maybeSingle(),
  ]);
  if (existingResult.error || sameHandleResult.error) return NextResponse.json({ message: '독자 프로필을 확인하지 못했습니다.' }, { status: 500 });
  if (sameHandleResult.data && sameHandleResult.data.user_id !== currentStigma.stigmaId) {
    return NextResponse.json({ message: '이미 사용 중인 핸들네임입니다.' }, { status: 409 });
  }

  const savedResult = existingResult.data
    ? await supabaseAdmin
        .from('creators')
        .update({ handle_name: handleName, cover_image: coverImage, introduction, updated_at: new Date().toISOString() })
        .eq('id', existingResult.data.id)
        .select('id, handle_name, cover_image, introduction')
        .single()
    : await supabaseAdmin
        .from('creators')
        .insert({ user_id: currentStigma.stigmaId, handle_name: handleName, cover_image: coverImage, introduction })
        .select('id, handle_name, cover_image, introduction')
        .single();

  if (savedResult.error || !savedResult.data) return NextResponse.json({ message: '독자 프로필을 저장하지 못했습니다.' }, { status: 500 });

  const deleteResult = await supabaseAdmin.from('creator_links').delete().eq('creator_id', savedResult.data.id);
  if (deleteResult.error) return NextResponse.json({ message: '독자 링크를 저장하지 못했습니다.' }, { status: 500 });
  if (normalizedLinks.length) {
    const insertResult = await supabaseAdmin
      .from('creator_links')
      .insert(normalizedLinks.map((link) => ({ ...link, creator_id: savedResult.data.id })));
    if (insertResult.error) return NextResponse.json({ message: '독자 링크를 저장하지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      id: savedResult.data.id,
      handleName: savedResult.data.handle_name,
      coverImage: savedResult.data.cover_image,
      introduction: savedResult.data.introduction,
    },
  });
}
