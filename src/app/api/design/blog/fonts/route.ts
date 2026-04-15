import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type FontApplyScope = 'subject' | 'description' | 'both';
type FontFamily = 'neo' | 'pre' | 'sans' | 'serif' | 'ham';

type RequestBody = {
  siteName: string | null;
  applyScope: FontApplyScope | null;
  subjectFontFamily: FontFamily | null;
  subjectLetterSpacing: number | string | null;
  subjectLineHeight: number | string | null;
  descriptionFontFamily: FontFamily | null;
  descriptionLetterSpacing: number | string | null;
  descriptionLineHeight: number | string | null;
  descriptionFontSize: number | string | null;
  descriptionMargin: number | string | null;
};

function normalizeNullableText(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue ? normalizedValue : null;
}

function normalizeNullableNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return null;
    }

    const parsedValue = Number(normalizedValue);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function isAllowedFontFamily(value: string | null): value is FontFamily {
  return value === 'neo' || value === 'pre' || value === 'sans' || value === 'serif' || value === 'ham';
}

function isAllowedLetterSpacing(value: number | null) {
  return value === -0.075 || value === -0.005 || value === 0.7;
}

function isAllowedLineHeight(value: number | null) {
  return value === 1.2 || value === 1.5 || value === 1.7;
}

function isAllowedFontSize(value: number | null) {
  return value === 14 || value === 16 || value === 18;
}

function isAllowedMargin(value: number | null) {
  return value === 14 || value === 16 || value === 18;
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

  if (session.status === 'FAIL') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

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
      .select(
        'subject_font_family, subject_letter_spacing, subject_line_height, description_font_family, description_letter_spacing, description_line_height, description_font_size, description_margin',
      )
      .eq('site_id', access.siteId)
      .maybeSingle();

    if (blog.error) {
      return Response.json({ error: blog.error.message || '기본 서체 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      blog: blog.data ?? {
        subject_font_family: null,
        subject_letter_spacing: null,
        subject_line_height: null,
        description_font_family: null,
        description_letter_spacing: null,
        description_line_height: null,
        description_font_size: null,
        description_margin: null,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '기본 서체 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '기본 서체 설정을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const applyScope = requestBody.applyScope;
    const subjectFontFamily = normalizeNullableText(requestBody.subjectFontFamily);
    const subjectLetterSpacing = normalizeNullableNumber(requestBody.subjectLetterSpacing);
    const subjectLineHeight = normalizeNullableNumber(requestBody.subjectLineHeight);
    const descriptionFontFamily = normalizeNullableText(requestBody.descriptionFontFamily);
    const descriptionLetterSpacing = normalizeNullableNumber(requestBody.descriptionLetterSpacing);
    const descriptionLineHeight = normalizeNullableNumber(requestBody.descriptionLineHeight);
    const descriptionFontSize = normalizeNullableNumber(requestBody.descriptionFontSize);
    const descriptionMargin = normalizeNullableNumber(requestBody.descriptionMargin);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (applyScope !== 'subject' && applyScope !== 'description' && applyScope !== 'both') {
      return Response.json({ error: '적용 범위를 확인해주세요.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    let nextSubjectFontFamily: FontFamily | null = null;
    let nextSubjectLetterSpacing: number | null = null;
    let nextSubjectLineHeight: number | null = null;
    let nextDescriptionFontFamily: FontFamily | null = null;
    let nextDescriptionLetterSpacing: number | null = null;
    let nextDescriptionLineHeight: number | null = null;
    let nextDescriptionFontSize: number | null = null;
    let nextDescriptionMargin: number | null = null;

    if (applyScope === 'subject' || applyScope === 'both') {
      if (subjectFontFamily !== null && !isAllowedFontFamily(subjectFontFamily)) {
        return Response.json({ error: '제목 서체 값을 확인해주세요.' }, { status: 400 });
      }

      if (subjectLetterSpacing !== null && !isAllowedLetterSpacing(subjectLetterSpacing)) {
        return Response.json({ error: '제목 자간 값을 확인해주세요.' }, { status: 400 });
      }

      if (subjectLineHeight !== null && !isAllowedLineHeight(subjectLineHeight)) {
        return Response.json({ error: '제목 행간 값을 확인해주세요.' }, { status: 400 });
      }

      nextSubjectFontFamily = subjectFontFamily;
      nextSubjectLetterSpacing = subjectLetterSpacing;
      nextSubjectLineHeight = subjectLineHeight;
    }

    if (applyScope === 'description' || applyScope === 'both') {
      if (descriptionFontFamily !== null && !isAllowedFontFamily(descriptionFontFamily)) {
        return Response.json({ error: '본문 서체 값을 확인해주세요.' }, { status: 400 });
      }

      if (descriptionLetterSpacing !== null && !isAllowedLetterSpacing(descriptionLetterSpacing)) {
        return Response.json({ error: '본문 자간 값을 확인해주세요.' }, { status: 400 });
      }

      if (descriptionLineHeight !== null && !isAllowedLineHeight(descriptionLineHeight)) {
        return Response.json({ error: '본문 행간 값을 확인해주세요.' }, { status: 400 });
      }

      if (descriptionFontSize !== null && !isAllowedFontSize(descriptionFontSize)) {
        return Response.json({ error: '본문 크기 값을 확인해주세요.' }, { status: 400 });
      }

      if (descriptionMargin !== null && !isAllowedMargin(descriptionMargin)) {
        return Response.json({ error: '본문 마진 값을 확인해주세요.' }, { status: 400 });
      }

      nextDescriptionFontFamily = descriptionFontFamily;
      nextDescriptionLetterSpacing = descriptionLetterSpacing;
      nextDescriptionLineHeight = descriptionLineHeight;
      nextDescriptionFontSize = descriptionFontSize;
      nextDescriptionMargin = descriptionMargin;
    }

    if (applyScope === 'subject') {
      nextDescriptionFontFamily = null;
      nextDescriptionLetterSpacing = null;
      nextDescriptionLineHeight = null;
      nextDescriptionFontSize = null;
      nextDescriptionMargin = null;
    }

    if (applyScope === 'description') {
      nextSubjectFontFamily = null;
      nextSubjectLetterSpacing = null;
      nextSubjectLineHeight = null;
    }

    const save = await access.supabaseAdmin
      .from('blogs')
      .update({
        subject_font_family: nextSubjectFontFamily,
        subject_letter_spacing: nextSubjectLetterSpacing,
        subject_line_height: nextSubjectLineHeight,
        description_font_family: nextDescriptionFontFamily,
        description_letter_spacing: nextDescriptionLetterSpacing,
        description_line_height: nextDescriptionLineHeight,
        description_font_size: nextDescriptionFontSize,
        description_margin: nextDescriptionMargin,
      })
      .eq('site_id', access.siteId)
      .select(
        'subject_font_family, subject_letter_spacing, subject_line_height, description_font_family, description_letter_spacing, description_line_height, description_font_size, description_margin',
      )
      .maybeSingle();

    if (save.error || !save.data) {
      return Response.json({ error: save.error?.message || '기본 서체 설정 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      blog: save.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '기본 서체 설정 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '기본 서체 설정 저장에 실패했습니다.' }, { status: 500 });
  }
}
