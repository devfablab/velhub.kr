'use client';

import { useEffect, useState } from 'react';
import Anchor from '@/components/Anchor';

type Preview = { title: string | null; href: string };

function truncate(value: string) {
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

export default function InlineLink({ href }: { href: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/link-preview?url=${encodeURIComponent(href)}`)
      .then(async (response) => (response.ok ? ((await response.json()) as Preview) : null))
      .then((nextPreview) => { if (!cancelled) setPreview(nextPreview); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [href]);

  let favicon = '';
  try { favicon = `${new URL(href).origin}/favicon.ico`; } catch { favicon = ''; }
  const title = preview?.title ? truncate(preview.title) : truncate(href);

  return <Anchor href={preview?.href || href}>{favicon ? <img src={favicon} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : null}<span>{title}</span></Anchor>;
}
