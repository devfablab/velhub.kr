import { createElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { ImageResponse } from 'next/og';
import { after } from 'next/server';
import crypto from 'crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import 'server-only';
import sharp from 'sharp';
import subsetFont from 'subset-font';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decryptNullable } from '@/lib/users/utils';
import { normalizeText } from '@/lib/utils';

const AUTO_OG_IMAGE_BUCKET = 'og-image';

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const BACKGROUND_COLOR = '#f8f8f8';
const ACCENT_COLOR = '#eeb400';
const TITLE_COLOR = '#181818';
const TEXT_COLOR = '#1f1f1f';
const AVATAR_PLACEHOLDER_COLOR = '#bdbdbd';
const SIDE_PADDING = 100;
const BOTTOM_PADDING = 70;
const IMAGE_FETCH_TIMEOUT_MS = 5000;

const PRETENDARD = 'Pretendard';
const NANUM_SQUARE_NEO = 'NanumSquareNeo';

type AutoOgTarget =
  | { type: 'site'; siteId: string }
  | { type: 'category'; categoryId: string | number }
  | { type: 'series'; seriesId: string | number }
  | { type: 'post'; postId: string | number };

type FontWeight = 400 | 600 | 800 | 900;

type FontUsage = {
  family: typeof PRETENDARD | typeof NANUM_SQUARE_NEO;
  weight: FontWeight;
  text: string;
};

type SiteRow = {
  id: string;
  site_key: string | null;
  site_label: string | null;
  summary: string | null;
  site_type: string | null;
  og_image: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  profile_logo_width: number | null;
  profile_logo_height: number | null;
  auto_og_image: string | null;
};

type SiteBrand = {
  label: string;
  logoUrl: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
  pictureUrl: string | null;
};

type ResolvedSiteBrand = {
  label: string;
  logo: { source: string; width: number; height: number } | null;
  picture: string | null;
};

const fontFileCache = new Map<string, Promise<Buffer>>();

function element(type: string, style: CSSProperties, ...children: ReactNode[]): ReactElement {
  return createElement(type, { style }, ...children);
}

function getFontFile(family: FontUsage['family']) {
  const fileName = family === PRETENDARD ? 'PretendardVariable.woff2' : 'NanumSquareNeoVF.woff2';
  const cached = fontFileCache.get(fileName);

  if (cached) {
    return cached;
  }

  const loaded = readFile(join(process.cwd(), 'src/app/fonts', fileName));
  fontFileCache.set(fileName, loaded);

  return loaded;
}

async function buildFonts(usages: FontUsage[]) {
  const textByFont = new Map<string, { family: FontUsage['family']; weight: FontWeight; text: string }>();

  for (const usage of usages) {
    const key = `${usage.family}:${usage.weight}`;
    const current = textByFont.get(key);

    textByFont.set(key, {
      family: usage.family,
      weight: usage.weight,
      text: `${current?.text ?? ''}${usage.text}`,
    });
  }

  return Promise.all(
    [...textByFont.values()].map(async (font) => {
      const fontFile = await getFontFile(font.family);
      const subset = await subsetFont(fontFile, `${font.text}…`, {
        targetFormat: 'sfnt',
        variationAxes: { wght: font.weight },
      });

      return {
        name: font.family,
        data: subset.buffer.slice(subset.byteOffset, subset.byteOffset + subset.byteLength) as ArrayBuffer,
        weight: font.weight,
        style: 'normal' as const,
      };
    }),
  );
}

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    return normalizedPath;
  }

  return r2Storage.from(bucket).getPublicUrl(normalizedPath).data.publicUrl || null;
}

async function loadImage(url: string | null, width: number, height: number, fit: 'cover' | 'contain' = 'cover') {
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });

    if (!response.ok) {
      return null;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const pngBuffer = await sharp(imageBuffer)
      .resize(width * 2, height * 2, { fit, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    return `data:image/png;base64,${pngBuffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function getSiteBrand(site: SiteRow): SiteBrand {
  return {
    label: normalizeText(site.site_label) || normalizeText(site.site_key),
    logoUrl: getPublicUrl('site-logo', site.profile_logo),
    logoWidth: site.profile_logo_width,
    logoHeight: site.profile_logo_height,
    pictureUrl: getPublicUrl('avatar', site.profile_picture),
  };
}

async function resolveSiteBrand(brand: SiteBrand, height: number): Promise<ResolvedSiteBrand> {
  if (brand.logoUrl && brand.logoWidth && brand.logoHeight) {
    const width = Math.min(Math.round((brand.logoWidth / brand.logoHeight) * height), IMAGE_WIDTH - SIDE_PADDING * 2);
    const source = await loadImage(brand.logoUrl, width, height, 'contain');

    if (source) {
      return { label: brand.label, logo: { source, width, height }, picture: null };
    }
  }

  return {
    label: brand.label,
    logo: null,
    picture: await loadImage(brand.pictureUrl, height, height),
  };
}

function renderSiteBrand(brand: ResolvedSiteBrand, size: { image: number; gap: number; fontSize: number }) {
  if (brand.logo) {
    return createElement('img', {
      src: brand.logo.source,
      width: brand.logo.width,
      height: brand.logo.height,
      style: { width: brand.logo.width, height: brand.logo.height, objectFit: 'contain' },
    });
  }

  return element(
    'div',
    { display: 'flex', alignItems: 'center', gap: size.gap, maxWidth: IMAGE_WIDTH - SIDE_PADDING * 2 },
    brand.picture
      ? createElement('img', {
          src: brand.picture,
          width: size.image,
          height: size.image,
          style: {
            width: size.image,
            height: size.image,
            borderRadius: Math.round(size.image * 0.3),
            objectFit: 'cover',
            flexShrink: 0,
          },
        })
      : null,
    element(
      'div',
      {
        display: 'block',
        fontFamily: NANUM_SQUARE_NEO,
        fontWeight: 900,
        fontSize: size.fontSize,
        color: TITLE_COLOR,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      brand.label,
    ),
  );
}

function clampedText(text: string, lines: number, style: CSSProperties) {
  return element(
    'div',
    {
      display: 'block',
      lineClamp: lines,
      overflow: style.textAlign === 'center' ? 'visible' : 'hidden',
      textOverflow: 'ellipsis',
      wordBreak: 'keep-all',
      ...style,
    },
    text,
  );
}

async function renderImage(content: ReactElement, fontUsages: FontUsage[]) {
  const fonts = await buildFonts(fontUsages.filter((usage) => usage.text));
  const response = new ImageResponse(content, { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, fonts });
  const pngBuffer = Buffer.from(await response.arrayBuffer());

  return sharp(pngBuffer).webp({ quality: 90 }).toBuffer();
}

function frame(...children: ReactNode[]) {
  return element(
    'div',
    {
      display: 'flex',
      position: 'relative',
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      backgroundColor: BACKGROUND_COLOR,
    },
    ...children,
  );
}

function bottomRightBrand(brand: ResolvedSiteBrand) {
  return element(
    'div',
    { display: 'flex', position: 'absolute', right: SIDE_PADDING, bottom: BOTTOM_PADDING },
    renderSiteBrand(brand, { image: 40, gap: 23, fontSize: 24 }),
  );
}

function getBrandFontUsages(brand: ResolvedSiteBrand): FontUsage[] {
  return brand.logo ? [] : [{ family: NANUM_SQUARE_NEO, weight: 900, text: brand.label }];
}

async function renderSiteImage(site: SiteRow) {
  const brand = await resolveSiteBrand(getSiteBrand(site), 95);
  const summary = normalizeText(site.summary);
  const content = frame(
    element(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 39,
        width: IMAGE_WIDTH - SIDE_PADDING * 2,
        height: IMAGE_HEIGHT,
        marginLeft: SIDE_PADDING,
      },
      renderSiteBrand(brand, { image: 95, gap: 27, fontSize: 64 }),
      summary
        ? clampedText(summary, 3, {
            fontFamily: PRETENDARD,
            fontWeight: 600,
            fontSize: 40,
            lineHeight: '57px',
            color: TEXT_COLOR,
            textAlign: 'center',
            maxWidth: IMAGE_WIDTH - SIDE_PADDING * 2,
          })
        : null,
    ),
  );

  return renderImage(content, [...getBrandFontUsages(brand), { family: PRETENDARD, weight: 600, text: summary }]);
}

async function renderCollectionImage(label: string, summary: string, site: SiteRow) {
  const brand = await resolveSiteBrand(getSiteBrand(site), 40);
  const content = frame(
    element(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 39,
        width: IMAGE_WIDTH - SIDE_PADDING * 2,
        height: IMAGE_HEIGHT,
        marginLeft: SIDE_PADDING,
      },
      clampedText(label, 2, {
        fontFamily: NANUM_SQUARE_NEO,
        fontWeight: 900,
        fontSize: 64,
        lineHeight: '80px',
        color: TITLE_COLOR,
        textAlign: 'center',
        maxWidth: IMAGE_WIDTH - SIDE_PADDING * 2,
      }),
      summary
        ? clampedText(summary, 3, {
            fontFamily: PRETENDARD,
            fontWeight: 600,
            fontSize: 40,
            lineHeight: '57px',
            color: TEXT_COLOR,
            textAlign: 'center',
            maxWidth: IMAGE_WIDTH - SIDE_PADDING * 2,
          })
        : null,
    ),
    bottomRightBrand(brand),
  );

  return renderImage(content, [
    { family: NANUM_SQUARE_NEO, weight: 900, text: label },
    { family: PRETENDARD, weight: 600, text: summary },
    ...getBrandFontUsages(brand),
  ]);
}

type PostImageInput = {
  subject: string;
  summary: string;
  categoryLabel: string;
  seriesLabel: string;
  authorName: string;
  authorAvatarUrl: string | null;
  dateText: string;
  site: SiteRow;
};

function badge(text: string) {
  return element(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      height: 46,
      paddingLeft: 23,
      paddingRight: 23,
      borderRadius: 23,
      backgroundColor: 'rgba(238, 180, 0, 0.3)',
      fontFamily: PRETENDARD,
      fontWeight: 800,
      fontSize: 24,
      color: TEXT_COLOR,
      whiteSpace: 'nowrap',
    },
    text,
  );
}

async function renderPostImage(input: PostImageInput) {
  const [brand, avatar] = await Promise.all([
    resolveSiteBrand(getSiteBrand(input.site), 40),
    loadImage(input.authorAvatarUrl, 60, 60),
  ]);
  const badges = [input.categoryLabel, input.seriesLabel].filter(Boolean);
  const contentWidth = IMAGE_WIDTH - SIDE_PADDING * 2;
  const content = frame(
    element('div', {
      position: 'absolute',
      left: 0,
      top: 0,
      width: IMAGE_WIDTH,
      height: 27,
      backgroundColor: ACCENT_COLOR,
    }),
    element(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        left: SIDE_PADDING,
        top: 120,
        width: contentWidth,
      },
      badges.length > 0
        ? element('div', { display: 'flex', gap: 27, marginBottom: 27 }, ...badges.map((text) => badge(text)))
        : null,
      clampedText(input.subject, 2, {
        fontFamily: NANUM_SQUARE_NEO,
        fontWeight: 900,
        fontSize: 64,
        lineHeight: '80px',
        color: TITLE_COLOR,
        width: contentWidth,
      }),
      input.summary
        ? clampedText(input.summary, 1, {
            marginTop: 17,
            fontFamily: PRETENDARD,
            fontWeight: 600,
            fontSize: 40,
            lineHeight: '48px',
            color: TEXT_COLOR,
            width: contentWidth,
          })
        : null,
    ),
    element('div', {
      position: 'absolute',
      left: SIDE_PADDING,
      bottom: 170,
      width: contentWidth,
      height: 3,
      backgroundColor: 'rgba(97, 97, 97, 0.5)',
    }),
    element(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        gap: 17,
        position: 'absolute',
        left: SIDE_PADDING,
        bottom: BOTTOM_PADDING,
        maxWidth: 560,
      },
      avatar
        ? createElement('img', {
            src: avatar,
            width: 60,
            height: 60,
            style: { width: 60, height: 60, borderRadius: 30, objectFit: 'cover', flexShrink: 0 },
          })
        : element('div', {
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: AVATAR_PLACEHOLDER_COLOR,
            flexShrink: 0,
          }),
      element(
        'div',
        { display: 'flex', flexDirection: 'column', gap: 10 },
        element(
          'div',
          {
            display: 'block',
            fontFamily: NANUM_SQUARE_NEO,
            fontWeight: 800,
            fontSize: 24,
            color: TITLE_COLOR,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 480,
          },
          input.authorName,
        ),
        element(
          'div',
          { display: 'flex', fontFamily: PRETENDARD, fontWeight: 400, fontSize: 20, color: TEXT_COLOR },
          input.dateText,
        ),
      ),
    ),
    bottomRightBrand(brand),
  );

  return renderImage(content, [
    { family: PRETENDARD, weight: 800, text: badges.join('') },
    { family: NANUM_SQUARE_NEO, weight: 900, text: input.subject },
    { family: PRETENDARD, weight: 600, text: input.summary },
    { family: NANUM_SQUARE_NEO, weight: 800, text: input.authorName },
    { family: PRETENDARD, weight: 400, text: input.dateText },
    ...getBrandFontUsages(brand),
  ]);
}

async function getSite(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const result = await supabaseAdmin
    .from('rhizomes')
    .select(
      'id, site_key, site_label, summary, site_type, og_image, profile_picture, profile_logo, profile_logo_width, profile_logo_height, auto_og_image',
    )
    .eq('id', siteId)
    .maybeSingle();

  return (result.data as SiteRow | null) ?? null;
}

async function getAuthor(siteId: string, stigmaId: string | null) {
  if (!stigmaId) {
    return { name: '', avatarUrl: null };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [stigmaResult, membershipResult] = await Promise.all([
    supabaseAdmin.from('stigmas').select('user_name, avatar').eq('id', stigmaId).maybeSingle(),
    supabaseAdmin
      .from('rhizome_stigmas')
      .select('nickname')
      .eq('site_id', siteId)
      .eq('user_id', stigmaId)
      .maybeSingle(),
  ]);

  return {
    name: normalizeText(membershipResult.data?.nickname) || decryptNullable(stigmaResult.data?.user_name ?? null) || '',
    avatarUrl: getPublicUrl('avatar', stigmaResult.data?.avatar ?? null),
  };
}

async function saveImage(table: string, id: string | number, previousPath: string | null, image: Buffer) {
  const filePath = `auto/${crypto.randomUUID()}.webp`;
  const storage = r2Storage.from(AUTO_OG_IMAGE_BUCKET);
  const uploadResult = await storage.upload(filePath, image, { contentType: 'image/webp', upsert: false });

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const updateResult = await supabaseAdmin.from(table).update({ auto_og_image: filePath }).eq('id', id);

  if (updateResult.error) {
    await storage.remove([filePath]);
    throw new Error(updateResult.error.message);
  }

  const normalizedPreviousPath = normalizeText(previousPath);

  if (normalizedPreviousPath) {
    await storage.remove([normalizedPreviousPath]);
  }
}

async function generateSiteImage(siteId: string) {
  const site = await getSite(siteId);

  if (!site || normalizeText(site.og_image)) {
    return;
  }

  await saveImage('rhizomes', site.id, site.auto_og_image, await renderSiteImage(site));
}

async function generateCollectionImage(table: 'board_categories' | 'board_series', id: string | number) {
  const supabaseAdmin = getSupabaseAdmin();
  const labelColumn = table === 'board_categories' ? 'category_label' : 'series_label';
  const result = await supabaseAdmin
    .from(table)
    .select(`id, site_id, summary, thumbnail_image, auto_og_image, ${labelColumn}`)
    .eq('id', id)
    .maybeSingle();
  const row = result.data as Record<string, string | number | null> | null;

  if (!row || normalizeText(row.thumbnail_image as string | null)) {
    return;
  }

  const site = await getSite(String(row.site_id));

  if (!site) {
    return;
  }

  if (table === 'board_categories' && site.site_type !== 'blog') {
    return;
  }

  const label = normalizeText(row[labelColumn] as string | null);

  if (!label) {
    return;
  }

  const image = await renderCollectionImage(label, normalizeText(row.summary as string | null), site);

  await saveImage(table, id, row.auto_og_image as string | null, image);
}

async function generatePostImage(postId: string | number) {
  const supabaseAdmin = getSupabaseAdmin();
  const postResult = await supabaseAdmin
    .from('posts')
    .select(
      'id, site_id, board_id, user_id, subject, summary, thumbnail_image, categories, series_id, published_at, created_at, auto_og_image',
    )
    .eq('id', postId)
    .maybeSingle();
  const post = postResult.data;

  if (!post || normalizeText(post.thumbnail_image)) {
    return;
  }

  const subject = normalizeText(post.subject);

  if (!subject) {
    return;
  }

  const boardResult = await supabaseAdmin.from('boards').select('board_type').eq('id', post.board_id).maybeSingle();

  if (boardResult.data?.board_type !== 'blog') {
    return;
  }

  const site = await getSite(post.site_id);

  if (!site || site.site_type !== 'blog') {
    return;
  }

  const categoryIds = Array.isArray(post.categories) ? (post.categories as (string | number)[]) : [];
  const [categoryResult, seriesResult, author] = await Promise.all([
    categoryIds.length > 0
      ? supabaseAdmin.from('board_categories').select('category_label').eq('id', categoryIds[0]).maybeSingle()
      : Promise.resolve({ data: null }),
    post.series_id
      ? supabaseAdmin.from('board_series').select('series_label').eq('id', post.series_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getAuthor(site.id, post.user_id),
  ]);

  const image = await renderPostImage({
    subject,
    summary: normalizeText(post.summary),
    categoryLabel: normalizeText(categoryResult.data?.category_label),
    seriesLabel: normalizeText(seriesResult.data?.series_label),
    authorName: author.name,
    authorAvatarUrl: author.avatarUrl,
    dateText: formatDate(post.published_at ?? post.created_at),
    site,
  });

  await saveImage('posts', post.id, post.auto_og_image, image);
}

export async function generateAutoOgImage(target: AutoOgTarget) {
  if (target.type === 'site') {
    return generateSiteImage(target.siteId);
  }

  if (target.type === 'category') {
    return generateCollectionImage('board_categories', target.categoryId);
  }

  if (target.type === 'series') {
    return generateCollectionImage('board_series', target.seriesId);
  }

  return generatePostImage(target.postId);
}

export function scheduleAutoOgImage(target: AutoOgTarget) {
  after(async () => {
    try {
      await generateAutoOgImage(target);
    } catch (error) {
      console.error('자동 오픈그래프 이미지 생성 실패', target, error);
    }
  });
}
