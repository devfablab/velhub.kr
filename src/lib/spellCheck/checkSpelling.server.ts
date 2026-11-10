import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import verifySession from '@/lib/session/verifySession';
import { SPELL_CHECK_PLACEHOLDER } from '@/lib/spellCheck/markdownBlocks';

export const SPELL_CHECK_DAILY_LIMIT = 5;
export const SPELL_CHECK_MAX_BLOCKS = 100;
export const SPELL_CHECK_MAX_CHARACTERS = 5000;

const SPELL_CHECK_MODEL = 'claude-haiku-5-5';

const systemPrompt = `너는 한국어 맞춤법 검사기다. 맞춤법과 띄어쓰기 오류만 찾는다.
입력은 블로그 글의 문단 목록(JSON)이다. 각 문단에는 id와 text가 있다.
지키기:
- 문체, 어휘 선택, 어순, 문장 다듬기는 절대 고치지 않는다.
- 구어체, 인터넷 표현(ㅋㅋ, 신조어, 줄임말), 영문, 외래어, 숫자, 문장부호, 마크다운 기호는 고치지 않는다.
- 붙여 써도 되고 띄어 써도 되는 말(전문 용어, 합성어, 보조 용언 등)은 고치지 않는다.
- 표준어 규정상 확실히 틀린 것만 지적한다. 애매하면 지적하지 않는다.
- ${SPELL_CHECK_PLACEHOLDER}은 검사하지 않는 부분이다. origin에 넣지 않는다.
- origin은 해당 문단 text에 있는 글자 그대로(띄어쓰기 포함) 틀린 어절만 적는다. 고칠 부분을 이해하는 데 필요하면 앞뒤 어절을 함께 적는다.
- id는 입력 문단의 id를 그대로 적는다.
- reason은 사용자가 이해할 수 있는 짧은 한국어 설명이다.
오류가 없으면 corrections를 빈 배열로 답한다.`;

const correctionSchema = z.object({
  corrections: z.array(
    z.object({
      id: z.string(),
      origin: z.string(),
      revised: z.string(),
      reason: z.string(),
    }),
  ),
});

export type SpellCheckRequestBlock = { id: string; text: string };
export type SpellCheckCorrection = { id: string; origin: string; revised: string; reason: string };

let anthropicClient: Anthropic | null = null;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('맞춤법 검사 설정이 되어 있지 않습니다.');
  }

  anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  return anthropicClient;
}

export function getSeoulDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function getSpellCheckAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const site = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

  if (site.error || !site.data) {
    return { ok: false, status: 404, error: '사이트를 찾을 수 없습니다.' } as const;
  }

  if (site.data.site_type !== 'blog') {
    return { ok: false, status: 400, error: '맞춤법 검사는 블로그에서만 사용할 수 있습니다.' } as const;
  }

  const session = await verifySession({ siteId: site.data.id });

  if (session.case !== 'admin' && session.case !== 'staff' && session.case !== 'member') {
    return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
  }

  return {
    ok: true,
    siteId: site.data.id as string,
    stigmaId: session.stigmaId,
    canManageExclusions: session.case === 'admin' || session.case === 'staff',
    supabaseAdmin,
  } as const;
}

export async function getRemainingCount(siteId: string) {
  const usage = await getSupabaseAdmin()
    .from('blog_spell_check_usages')
    .select('used_count')
    .eq('site_id', siteId)
    .eq('usage_date', getSeoulDate())
    .maybeSingle();

  if (usage.error) {
    throw new Error('맞춤법 검사 횟수를 불러오지 못했습니다.');
  }

  return Math.max(SPELL_CHECK_DAILY_LIMIT - Number(usage.data?.used_count ?? 0), 0);
}

export async function consumeSpellCheckCount(siteId: string) {
  const result = await getSupabaseAdmin().rpc('use_blog_spell_check', {
    target_site_id: siteId,
    daily_limit: SPELL_CHECK_DAILY_LIMIT,
  });

  if (result.error) {
    throw new Error('맞춤법 검사 횟수를 확인하지 못했습니다.');
  }

  if (typeof result.data !== 'number') {
    return null;
  }

  return Math.max(SPELL_CHECK_DAILY_LIMIT - result.data, 0);
}

export async function refundSpellCheckCount(siteId: string) {
  await getSupabaseAdmin().rpc('refund_blog_spell_check', { target_site_id: siteId });
}

export async function getExclusionWords(siteId: string) {
  const words = await getSupabaseAdmin().from('blog_spell_check_exclusions').select('word').eq('site_id', siteId);

  if (words.error) {
    throw new Error('검사 제외 목록을 불러오지 못했습니다.');
  }

  return (words.data ?? []).map((item) => String(item.word)).filter(Boolean);
}

export async function checkSpelling(blocks: SpellCheckRequestBlock[], exclusionWords: string[]) {
  const response = await getAnthropicClient().messages.parse({
    model: SPELL_CHECK_MODEL,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: JSON.stringify(blocks) }],
    output_config: { format: zodOutputFormat(correctionSchema) },
  });

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    throw new Error('맞춤법 검사에 실패했습니다.');
  }

  const textById = new Map(blocks.map((block) => [block.id, block.text]));
  const seen = new Set<string>();

  return response.parsed_output.corrections.filter((correction) => {
    const text = textById.get(correction.id);
    const key = `${correction.id}\u0000${correction.origin}\u0000${correction.revised}`;

    if (!text || !correction.origin.trim() || correction.origin === correction.revised) return false;
    if (!text.includes(correction.origin) || correction.origin.includes(SPELL_CHECK_PLACEHOLDER)) return false;
    if (exclusionWords.some((word) => correction.origin.includes(word))) return false;
    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
}
