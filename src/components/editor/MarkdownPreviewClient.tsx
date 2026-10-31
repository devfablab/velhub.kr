'use client';

import MDEditor from '@uiw/react-md-editor';

type Props = {
  source: string;
  themeMode?: 'light' | 'dark';
};

const Markdown = MDEditor.Markdown;

export default function MarkdownPreviewClient({ source, themeMode = 'light' }: Props) {
  return (
    <div data-color-mode={themeMode}>
      <Markdown source={source} />
    </div>
  );
}
