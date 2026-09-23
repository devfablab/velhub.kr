import type { LinkPreviewData } from '@/lib/service/getLinkPreview';
import LinkPreviewCard from '@/components/service/LinkPreviewCard';

type LinkPreviewProps = {
  href: string;
  preview: LinkPreviewData | null;
};

export default function LinkPreview({ href, preview }: LinkPreviewProps) {
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
