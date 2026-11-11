import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  getDuplicateHashtagMessage,
  getHashtagKey,
  getHashtagLabelError,
  getSiteHashtags,
  normalizeHashtagLabel,
} from '@/lib/service/blog/blogHashtags';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type RequestBody = { siteName?: string | null; id?: string | null; label?: unknown };

const IN_USE_MESSAGE = '이 해시태그를 사용하는 글이 존재합니다.';

async function getAccess(siteName: string, needsManage: boolean) {
  if (!siteName) {
    return { ok: false, status: 400, error: 'siteName이 유효하지 않습니다.' } as const;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const site = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

  if (site.error || !site.data) {
    return { ok: false, status: 404, error: '사이트를 찾을 수 없습니다.' } as const;
  }

  if (site.data.site_type !== 'blog') {
    return { ok: false, status: 400, error: '해시태그는 블로그에서만 사용할 수 있습니다.' } as const;
  }

  const session = await verifySession({ siteId: site.data.id });
  const canManage = session.case === 'admin' || session.case === 'staff';

  if (!canManage && session.case !== 'member') {
    return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
  }

  if (needsManage && !canManage) {
    return { ok: false, status: 403, error: '해시태그는 운영자와 매니저만 관리할 수 있습니다.' } as const;
  }

  return { ok: true, siteId: site.data.id as string, stigmaId: session.stigmaId, canManage, supabaseAdmin } as const;
}

async function getUsageCounts(siteId: string) {
  const posts = await getSupabaseAdmin()
    .from('posts')
    .select('hashtag_ids')
    .eq('site_id', siteId)
    .neq('hashtag_ids', '{}');

  if (posts.error) {
    throw new Error('해시태그 사용 현황을 불러오지 못했습니다.');
  }

  const counts = new Map<string, number>();
  (posts.data ?? []).forEach((post) =>
    ((post.hashtag_ids as string[] | null) ?? []).forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)),
  );

  return counts;
}

async function findDuplicate(siteId: string, label: string, exceptId?: string) {
  let query = getSupabaseAdmin()
    .from('blog_hashtags')
    .select('id, label')
    .eq('site_id', siteId)
    .eq('label_key', getHashtagKey(label));

  if (exceptId) query = query.neq('id', exceptId);

  const result = await query.maybeSingle();

  return result.data ? getDuplicateHashtagMessage(String(result.data.label), label) : '';
}

function errorResponse(error: unknown, fallback: string) {
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const access = await getAccess(
      normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase(),
      false,
    );

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const [hashtags, counts] = await Promise.all([getSiteHashtags(access.siteId), getUsageCounts(access.siteId)]);

    return Response.json({
      canManage: access.canManage,
      hashtags: hashtags.map((hashtag) => ({ ...hashtag, postCount: counts.get(hashtag.id) ?? 0 })),
    });
  } catch (error) {
    return errorResponse(error, '해시태그 목록을 불러오지 못했습니다.');
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const access = await getAccess(normalizeText(body.siteName).toLowerCase(), true);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const label = normalizeHashtagLabel(body.label);
    const labelError = getHashtagLabelError(label);

    if (labelError) {
      return Response.json({ error: labelError }, { status: 400 });
    }

    const duplicateMessage = await findDuplicate(access.siteId, label);

    if (duplicateMessage) {
      return Response.json({ error: duplicateMessage }, { status: 409 });
    }

    const inserted = await access.supabaseAdmin
      .from('blog_hashtags')
      .insert({ site_id: access.siteId, label, label_key: getHashtagKey(label), created_by: access.stigmaId })
      .select('id, label')
      .single();

    if (inserted.error) {
      return Response.json(
        { error: inserted.error.code === '23505' ? '이미 등록된 해시태그입니다.' : '해시태그를 추가하지 못했습니다.' },
        { status: inserted.error.code === '23505' ? 409 : 500 },
      );
    }

    return Response.json({ hashtag: { ...inserted.data, postCount: 0 } });
  } catch (error) {
    return errorResponse(error, '해시태그를 추가하지 못했습니다.');
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const access = await getAccess(normalizeText(body.siteName).toLowerCase(), true);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const id = normalizeText(body.id);
    const label = normalizeHashtagLabel(body.label);
    const labelError = getHashtagLabelError(label);

    if (!id) {
      return Response.json({ error: '수정할 해시태그를 찾을 수 없습니다.' }, { status: 400 });
    }

    if (labelError) {
      return Response.json({ error: labelError }, { status: 400 });
    }

    const duplicateMessage = await findDuplicate(access.siteId, label, id);

    if (duplicateMessage) {
      return Response.json({ error: duplicateMessage }, { status: 409 });
    }

    const updated = await access.supabaseAdmin
      .from('blog_hashtags')
      .update({ label, label_key: getHashtagKey(label), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('site_id', access.siteId)
      .select('id, label')
      .maybeSingle();

    if (updated.error || !updated.data) {
      return Response.json(
        { error: updated.error?.code === '23505' ? '이미 등록된 해시태그입니다.' : '해시태그를 수정하지 못했습니다.' },
        { status: updated.error?.code === '23505' ? 409 : 500 },
      );
    }

    return Response.json({ hashtag: updated.data });
  } catch (error) {
    return errorResponse(error, '해시태그를 수정하지 못했습니다.');
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const access = await getAccess(normalizeText(body.siteName).toLowerCase(), true);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const id = normalizeText(body.id);

    if (!id) {
      return Response.json({ error: '삭제할 해시태그를 찾을 수 없습니다.' }, { status: 400 });
    }

    const usage = await access.supabaseAdmin
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', access.siteId)
      .contains('hashtag_ids', [id]);

    if (usage.error) {
      return Response.json({ error: '해시태그 사용 현황을 확인하지 못했습니다.' }, { status: 500 });
    }

    if ((usage.count ?? 0) > 0) {
      return Response.json({ error: IN_USE_MESSAGE }, { status: 409 });
    }

    const deleted = await access.supabaseAdmin.from('blog_hashtags').delete().eq('id', id).eq('site_id', access.siteId);

    if (deleted.error) {
      return Response.json({ error: '해시태그를 삭제하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, '해시태그를 삭제하지 못했습니다.');
  }
}

type BatchBody = {
  siteName?: string | null;
  creates?: unknown;
  updates?: unknown;
  deletes?: unknown;
};

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as BatchBody;
    const access = await getAccess(normalizeText(body.siteName).toLowerCase(), true);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const [currentHashtags, counts] = await Promise.all([
      getSiteHashtags(access.siteId),
      getUsageCounts(access.siteId),
    ]);
    const currentLabels = new Map(currentHashtags.map((hashtag) => [hashtag.id, hashtag.label]));
    const deletes = (Array.isArray(body.deletes) ? body.deletes : [])
      .map((id) => normalizeText(typeof id === 'string' ? id : ''))
      .filter((id) => currentLabels.has(id));

    if (deletes.some((id) => (counts.get(id) ?? 0) > 0)) {
      return Response.json({ error: IN_USE_MESSAGE }, { status: 409 });
    }

    const deleteSet = new Set(deletes);
    const updates = (Array.isArray(body.updates) ? body.updates : [])
      .map((item) => {
        const record = (item ?? {}) as { id?: unknown; label?: unknown };
        return {
          id: normalizeText(typeof record.id === 'string' ? record.id : ''),
          label: normalizeHashtagLabel(record.label),
        };
      })
      .filter(
        (item) => currentLabels.has(item.id) && !deleteSet.has(item.id) && currentLabels.get(item.id) !== item.label,
      );
    const creates = (Array.isArray(body.creates) ? body.creates : []).map(normalizeHashtagLabel);

    for (const label of [...updates.map((item) => item.label), ...creates]) {
      const labelError = getHashtagLabelError(label);

      if (labelError) {
        return Response.json({ error: labelError }, { status: 400 });
      }
    }

    const updatedLabels = new Map(updates.map((item) => [item.id, item.label]));
    const keptLabels = [...currentLabels.entries()]
      .filter(([id]) => !deleteSet.has(id))
      .map(([id, label]) => ({ label: updatedLabels.get(id) ?? label, isChanged: updatedLabels.has(id) }));
    const finalLabels = [...keptLabels, ...creates.map((label) => ({ label, isChanged: true }))];
    const labelByKey = new Map<string, string>();

    for (const item of finalLabels.filter((entry) => !entry.isChanged)) {
      labelByKey.set(getHashtagKey(item.label), item.label);
    }

    for (const item of finalLabels.filter((entry) => entry.isChanged)) {
      const key = getHashtagKey(item.label);
      const existingLabel = labelByKey.get(key);

      if (existingLabel !== undefined) {
        return Response.json({ error: getDuplicateHashtagMessage(existingLabel, item.label) }, { status: 409 });
      }

      labelByKey.set(key, item.label);
    }

    if (deletes.length > 0) {
      const deleted = await access.supabaseAdmin
        .from('blog_hashtags')
        .delete()
        .eq('site_id', access.siteId)
        .in('id', deletes);

      if (deleted.error) {
        return Response.json({ error: '해시태그를 삭제하지 못했습니다.' }, { status: 500 });
      }
    }

    for (const item of updates) {
      const updated = await access.supabaseAdmin
        .from('blog_hashtags')
        .update({ label: item.label, label_key: getHashtagKey(item.label), updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('site_id', access.siteId);

      if (updated.error) {
        return Response.json(
          {
            error:
              updated.error.code === '23505' ? '이미 등록된 해시태그입니다.' : '해시태그를 수정하지 못했습니다.',
          },
          { status: 500 },
        );
      }
    }

    if (creates.length > 0) {
      const inserted = await access.supabaseAdmin.from('blog_hashtags').insert(
        creates.map((label) => ({
          site_id: access.siteId,
          label,
          label_key: getHashtagKey(label),
          created_by: access.stigmaId,
        })),
      );

      if (inserted.error) {
        return Response.json(
          {
            error:
              inserted.error.code === '23505' ? '이미 등록된 해시태그입니다.' : '해시태그를 추가하지 못했습니다.',
          },
          { status: 500 },
        );
      }
    }

    const [hashtags, nextCounts] = await Promise.all([getSiteHashtags(access.siteId), getUsageCounts(access.siteId)]);

    return Response.json({
      canManage: true,
      hashtags: hashtags.map((hashtag) => ({ ...hashtag, postCount: nextCounts.get(hashtag.id) ?? 0 })),
    });
  } catch (error) {
    return errorResponse(error, '해시태그를 저장하지 못했습니다.');
  }
}
