import crypto from 'crypto';
import path from 'path';
import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type ServiceValue = 'toonation' | 'kakaotalk' | 'discord';

type CommunityLinkRow = {
  id: string;
  created_at: string;
  service: ServiceValue;
  account: string;
  image: string | null;
  community_id: string;
  sort_order: number | string;
};

type LinkPayload = {
  localId?: string | null;
  service?: string | null;
  account?: string | null;
  image?: string | null;
};

const BUCKET_NAME = 'community_links';
const MAX_FILE_SIZE = 1024 * 1024;
const ALLOWED_SERVICES: ServiceValue[] = ['toonation', 'kakaotalk', 'discord'];
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/png', new Set(['.png'])],
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/webp', new Set(['.webp'])],
]);

function isAllowedService(value: string): value is ServiceValue {
  return ALLOWED_SERVICES.includes(value as ServiceValue);
}

function getPublicImageUrl(image: string | null | undefined) {
  const normalizedImage = normalizeText(image);

  if (!normalizedImage) {
    return '';
  }

  const publicUrl = getSupabaseAdmin().storage.from(BUCKET_NAME).getPublicUrl(normalizedImage);
  return publicUrl.data.publicUrl ?? '';
}

function serializeLink(link: CommunityLinkRow) {
  return {
    ...link,
    sort_order: Number(link.sort_order),
    image_url: getPublicImageUrl(link.image),
  };
}

async function getCommunity(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return { ok: false, status: 404, error: '사이트를 찾을 수 없습니다.' } as const;
  }

  if (siteResult.data.site_type !== 'community') {
    return { ok: false, status: 403, error: '커뮤니티만 사용할 수 있습니다.' } as const;
  }

  const communityResult = await supabaseAdmin
    .from('communities')
    .select('id')
    .eq('site_id', siteResult.data.id)
    .maybeSingle();

  if (communityResult.error || !communityResult.data) {
    return { ok: false, status: 404, error: '커뮤니티 정보를 찾을 수 없습니다.' } as const;
  }

  return {
    ok: true,
    communityId: communityResult.data.id as string,
    supabaseAdmin,
  } as const;
}

async function getLinks(communityId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const linksResult = await supabaseAdmin
    .from('community_links')
    .select('id, created_at, service, account, image, community_id, sort_order')
    .eq('community_id', communityId)
    .order('sort_order', { ascending: true });

  if (linksResult.error) {
    return { ok: false, error: '커뮤니티 링크를 불러오지 못했습니다.' } as const;
  }

  return {
    ok: true,
    links: ((linksResult.data ?? []) as CommunityLinkRow[]).map(serializeLink),
  } as const;
}

async function checkManageAccess(siteName: string) {
  try {
    const access = await getCommunityManagerAccess(siteName);

    if (!access.actor.permissions.site_edit) {
      return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
    }

    return { ok: true, access } as const;
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError.message : '';
    return { ok: false, status: 403, error: error || '접근 권한이 없습니다.' } as const;
  }
}

function validateImage(file: File) {
  const mimeType = file.type.toLowerCase();
  const extension = path.extname(file.name).toLowerCase();
  const allowedExtensions = ALLOWED_IMAGE_TYPES.get(mimeType);

  if (!allowedExtensions?.has(extension)) {
    return 'PNG, JPEG, WEBP 이미지만 업로드할 수 있습니다.';
  }

  if (file.size >= MAX_FILE_SIZE) {
    return '이미지는 1MB 미만만 업로드할 수 있습니다.';
  }

  return '';
}

async function removeImages(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  await getSupabaseAdmin().storage.from(BUCKET_NAME).remove(paths);
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const communityResult = await getCommunity(siteName);

    if (!communityResult.ok) {
      return Response.json({ error: communityResult.error }, { status: communityResult.status });
    }

    const linksResult = await getLinks(communityResult.communityId);

    if (!linksResult.ok) {
      return Response.json({ error: linksResult.error }, { status: 500 });
    }

    return Response.json({ ok: true, links: linksResult.links });
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: error || '커뮤니티 링크를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const uploadedImages: string[] = [];

  try {
    const formData = await request.formData();
    const siteNameValue = formData.get('siteName');
    const linksValue = formData.get('links');
    const siteName = normalizeText(typeof siteNameValue === 'string' ? siteNameValue : '').toLowerCase();
    const rawLinks = normalizeText(typeof linksValue === 'string' ? linksValue : '');

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    let links: LinkPayload[] = [];

    try {
      const parsedLinks = JSON.parse(rawLinks) as unknown;
      links = Array.isArray(parsedLinks) ? (parsedLinks as LinkPayload[]) : [];
    } catch {
      return Response.json({ error: '링크 데이터가 유효하지 않습니다.' }, { status: 400 });
    }

    const accessResult = await checkManageAccess(siteName);

    if (!accessResult.ok) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const { access } = accessResult;
    const communityId = access.community.id;
    const currentLinksResult = await access.supabaseAdmin
      .from('community_links')
      .select('image')
      .eq('community_id', communityId);

    if (currentLinksResult.error) {
      return Response.json({ error: '기존 커뮤니티 링크를 확인하지 못했습니다.' }, { status: 500 });
    }

    const currentImages = new Set(
      (currentLinksResult.data ?? []).map((link) => normalizeText(link.image)).filter(Boolean),
    );
    const nextRows: {
      service: ServiceValue;
      account: string;
      image: string | null;
      community_id: string;
      sort_order: number;
    }[] = [];

    for (const [index, link] of links.entries()) {
      const localId = normalizeText(link.localId);
      const service = normalizeText(link.service);
      const account = normalizeText(link.account);

      if (!localId || !service || !account) {
        await removeImages(uploadedImages);
        return Response.json({ error: '빈 데이터가 있습니다.' }, { status: 400 });
      }

      if (!isAllowedService(service)) {
        await removeImages(uploadedImages);
        return Response.json({ error: '서비스 값이 유효하지 않습니다.' }, { status: 400 });
      }

      const fileValue = formData.get(`image-${localId}`);
      let image = normalizeText(link.image) || null;

      if (fileValue instanceof File && fileValue.size > 0) {
        const validationError = validateImage(fileValue);

        if (validationError) {
          await removeImages(uploadedImages);
          return Response.json({ error: validationError }, { status: 400 });
        }

        const extension = path.extname(fileValue.name).toLowerCase();
        const imagePath = `${communityId}/${crypto.randomUUID()}${extension}`;
        const uploadResult = await access.supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(imagePath, Buffer.from(await fileValue.arrayBuffer()), {
            contentType: fileValue.type,
            upsert: false,
          });

        if (uploadResult.error) {
          await removeImages(uploadedImages);
          return Response.json({ error: '링크 이미지 업로드에 실패했습니다.' }, { status: 500 });
        }

        uploadedImages.push(imagePath);
        image = imagePath;
      } else if (image && !currentImages.has(image)) {
        await removeImages(uploadedImages);
        return Response.json({ error: '링크 이미지 경로가 유효하지 않습니다.' }, { status: 400 });
      }

      nextRows.push({
        service,
        account,
        image,
        community_id: communityId,
        sort_order: index + 1,
      });
    }

    const deleteResult = await access.supabaseAdmin.from('community_links').delete().eq('community_id', communityId);

    if (deleteResult.error) {
      await removeImages(uploadedImages);
      return Response.json({ error: '커뮤니티 링크 저장에 실패했습니다.' }, { status: 500 });
    }

    if (nextRows.length > 0) {
      const insertResult = await access.supabaseAdmin.from('community_links').insert(nextRows);

      if (insertResult.error) {
        await removeImages(uploadedImages);
        return Response.json({ error: '커뮤니티 링크 저장에 실패했습니다.' }, { status: 500 });
      }
    }

    const retainedImages = new Set(nextRows.map((link) => link.image).filter((image): image is string => Boolean(image)));
    await removeImages([...currentImages].filter((image) => !retainedImages.has(image)));

    const linksResult = await getLinks(communityId);

    if (!linksResult.ok) {
      return Response.json({ error: linksResult.error }, { status: 500 });
    }

    return Response.json({ ok: true, links: linksResult.links });
  } catch (unknownError) {
    await removeImages(uploadedImages);
    const error = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: error || '커뮤니티 링크 저장에 실패했습니다.' }, { status: 500 });
  }
}
