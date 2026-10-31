'use client';

import MarkdownPreviewClient from './MarkdownPreviewClient';

type Props = {
  source: string;
  themeMode?: 'light' | 'dark';
};

export default function MarkdownPreview(props: Props) {
  return <MarkdownPreviewClient {...props} />;
}
