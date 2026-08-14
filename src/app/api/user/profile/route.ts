import { NextResponse } from 'next/server';
import { getAuthorState } from '@/lib/session/author';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHandleName(value: unknown) {
  return toText(value).toLowerCase();
}

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const [authorState, profileResult] = await Promise.all([
    getAuthorState(currentStigma.stigmaId),
    supabaseAdmin
      .from('users')
      .select('id, handle_name, cover_image, introduction')
      .eq('user_id', currentStigma.stigmaId)
      .maybeSingle(),
  ]);

  if (profileResult.error) return NextResponse.json({ message: '독자 프로필을 불러오지 못했습니다.' }, { status: 500 });

  return NextResponse.json({
    isAuthor: authorState.isAuthor,
    user: profileResult.data
      ? {
          id: profileResult.data.id,
          handleName: profileResult.data.handle_name,
          coverImage: profileResult.data.cover_image,
          introduction: profileResult.data.introduction,
        }
      : null,
  });
}

export async function PUT(request: Request) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    handleName?: unknown;
    coverImage?: unknown;
    introduction?: unknown;
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
    supabaseAdmin.from('users').select('id').eq('user_id', currentStigma.stigmaId).maybeSingle(),
    supabaseAdmin.from('users').select('id, user_id').eq('handle_name', handleName).maybeSingle(),
  ]);
  if (existingResult.error || sameHandleResult.error)
    return NextResponse.json({ message: '독자 프로필을 확인하지 못했습니다.' }, { status: 500 });
  if (sameHandleResult.data && sameHandleResult.data.user_id !== currentStigma.stigmaId) {
    return NextResponse.json({ message: '이미 사용 중인 핸들네임입니다.' }, { status: 409 });
  }

  const savedResult = existingResult.data
    ? await supabaseAdmin
        .from('users')
        .update({
          handle_name: handleName,
          cover_image: coverImage,
          introduction,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingResult.data.id)
        .select('id, handle_name, cover_image, introduction')
        .single()
    : await supabaseAdmin
        .from('users')
        .insert({ user_id: currentStigma.stigmaId, handle_name: handleName, cover_image: coverImage, introduction })
        .select('id, handle_name, cover_image, introduction')
        .single();

  if (savedResult.error || !savedResult.data)
    return NextResponse.json({ message: '독자 프로필을 저장하지 못했습니다.' }, { status: 500 });

  return NextResponse.json({
    user: {
      id: savedResult.data.id,
      handleName: savedResult.data.handle_name,
      coverImage: savedResult.data.cover_image,
      introduction: savedResult.data.introduction,
    },
  });
}
