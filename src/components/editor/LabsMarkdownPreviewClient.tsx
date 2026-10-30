'use client';

import MarkdownPreview from '@uiw/react-markdown-preview';

type Props = {
  source: string;
  themeMode?: 'light' | 'dark';
};

export default function LabsMarkdownPreviewClient({ source, themeMode = 'light' }: Props) {
  return (
    <div data-color-mode={themeMode}>
      <MarkdownPreview source={source} />
    </div>
  );
}
