import {
  checkSpelling,
  consumeSpellCheckCount,
  getExclusionWords,
  getRemainingCount,
  getSpellCheckAccess,
  refundSpellCheckCount,
  SPELL_CHECK_DAILY_LIMIT,
  SPELL_CHECK_MAX_BLOCKS,
  SPELL_CHECK_MAX_CHARACTERS,
  type SpellCheckRequestBlock,
} from '@/lib/spellCheck/checkSpelling.server';
import { normalizeText } from '@/lib/utils';

type RequestBody = { siteName?: string | null; blocks?: unknown };

function normalizeBlocks(value: unknown): SpellCheckRequestBlock[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > SPELL_CHECK_MAX_BLOCKS) {
    return null;
  }

  const blocks: SpellCheckRequestBlock[] = [];
  const ids = new Set<string>();
  let totalLength = 0;

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;

    const id = (item as { id?: unknown }).id;
    const text = (item as { text?: unknown }).text;

    if (typeof id !== 'string' || typeof text !== 'string' || !id || ids.has(id)) return null;

    ids.add(id);
    totalLength += text.length;
    blocks.push({ id, text });
  }

  if (totalLength > SPELL_CHECK_MAX_CHARACTERS) {
    return null;
  }

  return blocks;
}

export async function GET(request: Request) {
  try {
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getSpellCheckAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    return Response.json({
      dailyLimit: SPELL_CHECK_DAILY_LIMIT,
      remainingCount: await getRemainingCount(access.siteId),
      canManageExclusions: access.canManageExclusions,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '맞춤법 검사 정보를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const siteName = normalizeText(body.siteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const blocks = normalizeBlocks(body.blocks);

    if (!blocks) {
      return Response.json({ error: '검사할 글이 너무 길거나 올바르지 않습니다.' }, { status: 400 });
    }

    const access = await getSpellCheckAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const exclusionWords = await getExclusionWords(access.siteId);
    const remainingCount = await consumeSpellCheckCount(access.siteId);

    if (remainingCount === null) {
      return Response.json({ error: '오늘 맞춤법 검사 횟수를 모두 사용했어요.', remainingCount: 0 }, { status: 429 });
    }

    try {
      const corrections = await checkSpelling(blocks, exclusionWords);

      return Response.json({ corrections, remainingCount });
    } catch (error) {
      console.error('맞춤법 검사 실패:', error);
      await refundSpellCheckCount(access.siteId);

      return Response.json(
        { error: '맞춤법 검사에 실패했습니다. 잠시 후 다시 시도해주세요.', remainingCount: remainingCount + 1 },
        { status: 502 },
      );
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '맞춤법 검사에 실패했습니다.' },
      { status: 500 },
    );
  }
}
