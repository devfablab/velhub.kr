export type LinkPreviewData = {
  siteName: string | null;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
};

export type LinkPreviewResult =
  | {
      ok: true;
      data: LinkPreviewData;
    }
  | {
      ok: false;
      error: string;
    };

export async function getLinkPreview(targetUrl: string): Promise<LinkPreviewResult> {
  try {
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(targetUrl)}`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error || '링크 정보를 불러오지 못했습니다.',
      };
    }

    return {
      ok: true,
      data: {
        siteName: data.siteName ?? null,
        url: data.url,
        title: data.title ?? null,
        description: data.description ?? null,
        image: data.image ?? null,
      },
    };
  } catch {
    return {
      ok: false,
      error: '링크 정보를 불러오지 못했습니다.',
    };
  }
}
