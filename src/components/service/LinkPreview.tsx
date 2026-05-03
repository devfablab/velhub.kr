'use client';

import { useEffect, useState } from 'react';
import { getLinkPreview, type LinkPreviewData } from '@/lib/service/getLinkPreview';
import LinkPreviewCard from '@/components/service/LinkPreviewCard';

type LinkPreviewProps = {
  href: string;
};

export default function LinkPreview({ href }: LinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadPreview() {
      if (!href) {
        setPreview(null);
        return;
      }

      setIsLoading(true);

      const result = await getLinkPreview(href);

      if (ignore) return;

      if (result.ok) {
        setPreview(result.data);
      } else {
        setPreview(null);
      }

      setIsLoading(false);
    }

    loadPreview();

    return () => {
      ignore = true;
    };
  }, [href]);

  if (isLoading) {
    return null;
  }

  if (!preview) {
    return null;
  }

  return (
    <LinkPreviewCard
      href={href}
      siteName={preview.siteName}
      url={preview.url}
      title={preview.title}
      description={preview.description}
      image={preview.image}
    />
  );
}
