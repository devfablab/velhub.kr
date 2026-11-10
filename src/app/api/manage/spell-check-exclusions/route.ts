import { getSpellCheckAccess } from '@/lib/spellCheck/checkSpelling.server';
import { normalizeText } from '@/lib/utils';

type RequestBody = { siteName?: string | null; id?: string | null; word?: unknown };

const MAX_WORD_LENGTH = 50;

function normalizeWord(value: unknown) {
  return (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim();
}

async function getManageAccess(siteName: string) {
  if (!siteName) {
    return { ok: false, status: 400, error: 'siteName이 유효하지 않습니다.' } as const;
  }

  const access = await getSpellCheckAccess(siteName);

  if (!access.ok) {
    return access;
  }

  if (!access.canManageExclusions) {
    return { ok: false, status: 403, error: '검사 제외 목록은 운영자와 매니저만 관리할 수 있습니다.' } as const;
  }

  return access;
}

function getWordError(word: string) {
  if (!word) return '단어를 입력해주세요.';
  if (word.length > MAX_WORD_LENGTH) return `단어는 ${MAX_WORD_LENGTH}자 이하로 입력해주세요.`;

  return '';
}

function getDuplicateMessage(code: string | undefined) {
  return code === '23505' ? '이미 검사 제외 목록에 있는 단어입니다.' : '';
}

export async function GET(request: Request) {
  try {
    const access = await getManageAccess(
      normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase(),
    );

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const words = await access.supabaseAdmin
      .from('blog_spell_check_exclusions')
      .select('id, word')
      .eq('site_id', access.siteId)
      .order('created_at');

    if (words.error) {
      return Response.json({ error: '검사 제외 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ words: words.data ?? [] });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '검사 제외 목록을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const access = await getManageAccess(normalizeText(body.siteName).toLowerCase());

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const word = normalizeWord(body.word);
    const wordError = getWordError(word);

    if (wordError) {
      return Response.json({ error: wordError }, { status: 400 });
    }

    const inserted = await access.supabaseAdmin
      .from('blog_spell_check_exclusions')
      .insert({ site_id: access.siteId, word, created_by: access.stigmaId })
      .select('id, word')
      .single();

    if (inserted.error) {
      const duplicateMessage = getDuplicateMessage(inserted.error.code);

      return Response.json(
        { error: duplicateMessage || '검사 제외 목록에 추가하지 못했습니다.' },
        { status: duplicateMessage ? 409 : 500 },
      );
    }

    return Response.json({ word: inserted.data });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '검사 제외 목록에 추가하지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const access = await getManageAccess(normalizeText(body.siteName).toLowerCase());

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const id = normalizeText(body.id);
    const word = normalizeWord(body.word);
    const wordError = getWordError(word);

    if (!id) {
      return Response.json({ error: '수정할 단어를 찾을 수 없습니다.' }, { status: 400 });
    }

    if (wordError) {
      return Response.json({ error: wordError }, { status: 400 });
    }

    const updated = await access.supabaseAdmin
      .from('blog_spell_check_exclusions')
      .update({ word, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('site_id', access.siteId)
      .select('id, word')
      .maybeSingle();

    if (updated.error) {
      const duplicateMessage = getDuplicateMessage(updated.error.code);

      return Response.json(
        { error: duplicateMessage || '단어를 수정하지 못했습니다.' },
        { status: duplicateMessage ? 409 : 500 },
      );
    }

    if (!updated.data) {
      return Response.json({ error: '수정할 단어를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({ word: updated.data });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '단어를 수정하지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const access = await getManageAccess(normalizeText(body.siteName).toLowerCase());

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const id = normalizeText(body.id);

    if (!id) {
      return Response.json({ error: '삭제할 단어를 찾을 수 없습니다.' }, { status: 400 });
    }

    const deleted = await access.supabaseAdmin
      .from('blog_spell_check_exclusions')
      .delete()
      .eq('id', id)
      .eq('site_id', access.siteId);

    if (deleted.error) {
      return Response.json({ error: '단어를 삭제하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '단어를 삭제하지 못했습니다.' },
      { status: 500 },
    );
  }
}
