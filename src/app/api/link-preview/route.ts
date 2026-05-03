import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

type LinkPreviewResponse = {
  siteName: string | null;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  href: string;
  debug?: {
    stage: string;
    message: string;
    requestUrl?: string;
    finalUrl?: string;
    externalStatus?: number;
    externalStatusText?: string;
    externalContentType?: string | null;
    externalBodySample?: string;
  };
};

function createFallbackPreview(url: URL, debug?: LinkPreviewResponse['debug']): LinkPreviewResponse {
  return {
    siteName: null,
    url: url.href,
    title: null,
    description: null,
    image: null,
    href: url.href,
    debug,
  };
}

function isPrivateHostname(hostname: string) {
  const lower = hostname.toLowerCase();

  if (lower === 'localhost' || lower.endsWith('.localhost') || lower === '0.0.0.0') {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    const parts = lower.split('.').map(Number);

    if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
      return true;
    }

    const [a, b] = parts;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;

    return false;
  }

  return false;
}

function getMetaContent($: cheerio.CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const content = $(selector).attr('content')?.trim();

    if (content) {
      return content;
    }
  }

  return null;
}

function resolveMetaUrl(value: string | null, baseUrl: string) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json(
      {
        error: 'URL이 없습니다.',
        debug: {
          stage: 'request-validation',
          message: 'url search param is missing.',
        },
      },
      { status: 400 },
    );
  }

  let targetUrl: URL;

  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json(
      {
        error: 'URL 형식이 올바르지 않습니다.',
        debug: {
          stage: 'url-parse',
          message: 'new URL(rawUrl) failed.',
          requestUrl: rawUrl,
        },
      },
      { status: 400 },
    );
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return NextResponse.json(
      {
        error: '허용되지 않는 URL 프로토콜입니다.',
        debug: {
          stage: 'protocol-validation',
          message: 'Only http and https protocols are allowed.',
          requestUrl: targetUrl.href,
        },
      },
      { status: 400 },
    );
  }

  if (isPrivateHostname(targetUrl.hostname)) {
    return NextResponse.json(
      {
        error: '허용되지 않는 호스트입니다.',
        debug: {
          stage: 'ssrf-validation',
          message: 'Private or local hostname is blocked.',
          requestUrl: targetUrl.href,
        },
      },
      { status: 400 },
    );
  }

  let response: Response;

  try {
    response = await fetch(targetUrl.href, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(7000),
    });
  } catch (error) {
    return NextResponse.json(
      createFallbackPreview(targetUrl, {
        stage: 'external-fetch',
        message: error instanceof Error ? error.message : 'External fetch failed.',
        requestUrl: targetUrl.href,
      }),
      { status: 200 },
    );
  }

  const contentType = response.headers.get('content-type');

  if (response.status >= 300 && response.status < 400) {
    return NextResponse.json(
      createFallbackPreview(targetUrl, {
        stage: 'external-redirect-blocked',
        message: 'External site returned redirect response. Redirect is blocked by policy.',
        requestUrl: targetUrl.href,
        finalUrl: response.headers.get('location') || undefined,
        externalStatus: response.status,
        externalStatusText: response.statusText,
        externalContentType: contentType,
      }),
      { status: 200 },
    );
  }

  let html = '';

  try {
    html = await response.text();
  } catch (error) {
    return NextResponse.json(
      createFallbackPreview(targetUrl, {
        stage: 'external-body-read',
        message: error instanceof Error ? error.message : 'External response body read failed.',
        requestUrl: targetUrl.href,
        externalStatus: response.status,
        externalStatusText: response.statusText,
        externalContentType: contentType,
      }),
      { status: 200 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      createFallbackPreview(targetUrl, {
        stage: 'external-response',
        message: 'External site returned non-OK response.',
        requestUrl: targetUrl.href,
        externalStatus: response.status,
        externalStatusText: response.statusText,
        externalContentType: contentType,
        externalBodySample: html.slice(0, 1000),
      }),
      { status: 200 },
    );
  }

  if (contentType && !contentType.toLowerCase().includes('text/html')) {
    return NextResponse.json(
      createFallbackPreview(targetUrl, {
        stage: 'content-type-validation',
        message: 'External response is not text/html.',
        requestUrl: targetUrl.href,
        externalStatus: response.status,
        externalStatusText: response.statusText,
        externalContentType: contentType,
        externalBodySample: html.slice(0, 1000),
      }),
      { status: 200 },
    );
  }

  try {
    const $ = cheerio.load(html);

    const siteName = getMetaContent($, ['meta[property="og:site_name"]']);

    const title =
      getMetaContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      $('title').first().text().trim() ||
      null;

    const description = getMetaContent($, [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
    ]);

    const imageRaw = getMetaContent($, [
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[name="twitter:image"]',
    ]);

    const image = resolveMetaUrl(imageRaw, targetUrl.href);

    return NextResponse.json(
      {
        siteName,
        url: targetUrl.href,
        title,
        description,
        image,
        href: targetUrl.href,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      createFallbackPreview(targetUrl, {
        stage: 'meta-parse',
        message: error instanceof Error ? error.message : 'Metadata parse failed.',
        requestUrl: targetUrl.href,
        externalStatus: response.status,
        externalStatusText: response.statusText,
        externalContentType: contentType,
        externalBodySample: html.slice(0, 1000),
      }),
      { status: 200 },
    );
  }
}
