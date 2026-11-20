import { getSupabaseAdmin } from '@/lib/clients/supabase';

export const MAX_POST_HASHTAGS = 10;
export const MAX_HASHTAG_LENGTH = 27;

const HASHTAG_PATTERN = /^[\p{L}\p{M}\p{N}_-]+$/u;

export type BlogHashtag = {
  id: string;
  label: string;
};

export function normalizeHashtagLabel(value: unknown) {
  return (typeof value === 'string' ? value : '').trim().replace(/^#+/, '').normalize('NFC');
}

export function getHashtagKey(label: string) {
  return label.toLocaleLowerCase();
}

export function getHashtagLabelError(label: string) {
  if (!label) return '해시태그를 입력해 주세요.';
  if ([...label].length > MAX_HASHTAG_LENGTH) return `해시태그는 ${MAX_HASHTAG_LENGTH}자 이하로 입력해 주세요.`;
  if (!HASHTAG_PATTERN.test(label)) return '해시태그에는 문자, 숫자, -, _만 쓸 수 있습니다.';

  return '';
}

export function getDuplicateHashtagMessage(existingLabel: string, label: string) {
  if (existingLabel === label) {
    return '이미 등록된 해시태그입니다.';
  }

  return `이미 '${existingLabel}'로 등록되어 있는 해시태그입니다.\n기존 해시태그를 수정하여 사용해 주세요`;
}

export function parsePostHashtagLabels(value: unknown): { labels: string[]; error: string } {
  if (value === undefined || value === null) {
    return { labels: [], error: '' };
  }

  if (!Array.isArray(value)) {
    return { labels: [], error: '해시태그 값이 올바르지 않습니다.' };
  }

  const labels: string[] = [];
  const keys = new Set<string>();

  for (const item of value) {
    const label = normalizeHashtagLabel(item);
    const error = getHashtagLabelError(label);

    if (error) {
      return { labels: [], error };
    }

    const key = getHashtagKey(label);

    if (!keys.has(key)) {
      keys.add(key);
      labels.push(label);
    }
  }

  if (labels.length > MAX_POST_HASHTAGS) {
    return { labels: [], error: `해시태그는 글 하나에 ${MAX_POST_HASHTAGS}개까지 넣을 수 있습니다.` };
  }

  return { labels, error: '' };
}

export async function getSiteHashtags(siteId: string): Promise<BlogHashtag[]> {
  const result = await getSupabaseAdmin()
    .from('blog_hashtags')
    .select('id, label')
    .eq('site_id', siteId)
    .order('label', { ascending: true });

  if (result.error) {
    throw new Error('해시태그 목록을 불러오지 못했습니다.');
  }

  return (result.data ?? []) as BlogHashtag[];
}

export async function resolvePostHashtagIds(siteId: string, labels: string[], stigmaId: string | null) {
  if (labels.length === 0) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const keys = labels.map(getHashtagKey);
  const existing = await supabaseAdmin
    .from('blog_hashtags')
    .select('id, label_key')
    .eq('site_id', siteId)
    .in('label_key', keys);

  if (existing.error) {
    throw new Error('해시태그를 확인하지 못했습니다.');
  }

  const idByKey = new Map((existing.data ?? []).map((row) => [row.label_key as string, row.id as string]));
  const missing = labels.filter((label) => !idByKey.has(getHashtagKey(label)));

  if (missing.length > 0) {
    const inserted = await supabaseAdmin
      .from('blog_hashtags')
      .upsert(
        missing.map((label) => ({ site_id: siteId, label, label_key: getHashtagKey(label), created_by: stigmaId })),
        { onConflict: 'site_id,label_key', ignoreDuplicates: true },
      )
      .select('id, label_key');

    if (inserted.error) {
      throw new Error('해시태그를 저장하지 못했습니다.');
    }

    (inserted.data ?? []).forEach((row) => idByKey.set(row.label_key as string, row.id as string));

    if (missing.some((label) => !idByKey.has(getHashtagKey(label)))) {
      const reloaded = await supabaseAdmin
        .from('blog_hashtags')
        .select('id, label_key')
        .eq('site_id', siteId)
        .in('label_key', keys);

      if (reloaded.error) {
        throw new Error('해시태그를 확인하지 못했습니다.');
      }

      (reloaded.data ?? []).forEach((row) => idByKey.set(row.label_key as string, row.id as string));
    }
  }

  return keys.map((key) => idByKey.get(key)).filter((id): id is string => Boolean(id));
}

export async function getHashtagsByIds(ids: string[] | null | undefined): Promise<BlogHashtag[]> {
  const hashtagIds = (ids ?? []).filter(Boolean);

  if (hashtagIds.length === 0) {
    return [];
  }

  const result = await getSupabaseAdmin().from('blog_hashtags').select('id, label').in('id', hashtagIds);

  if (result.error) {
    return [];
  }

  const hashtagById = new Map(((result.data ?? []) as BlogHashtag[]).map((hashtag) => [hashtag.id, hashtag]));

  return hashtagIds.map((id) => hashtagById.get(id)).filter((hashtag): hashtag is BlogHashtag => Boolean(hashtag));
}
