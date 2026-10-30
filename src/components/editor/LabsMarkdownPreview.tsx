'use client';

import dynamic from 'next/dynamic';

const LabsMarkdownPreviewClient = dynamic(() => import('./LabsMarkdownPreviewClient'), {
  ssr: false,
});

type Props = {
  source: string;
  themeMode?: 'light' | 'dark';
};

export default function LabsMarkdownPreview(props: Props) {
  return <LabsMarkdownPreviewClient {...props} />;
}
