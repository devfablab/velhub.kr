'use client';

import dynamic from 'next/dynamic';

const MarkdownPreviewClient = dynamic(() => import('./MarkdownPreviewClient'), {
  ssr: false,
});

type Props = {
  source: string;
  themeMode?: 'light' | 'dark';
};

export default function MarkdownPreview(props: Props) {
  return <MarkdownPreviewClient {...props} />;
}
