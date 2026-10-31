'use client';

import dynamic from 'next/dynamic';

export const IMAGE_INPUT_ID = 'labs-image-file-input';

const MarkdownEditorClient = dynamic(() => import('./MarkdownEditorClient'), {
  ssr: false,
});

type Props = {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  themeMode?: 'light' | 'dark';
  onPaste?: (event: React.ClipboardEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
};

export default function MarkdownEditor(props: Props) {
  return <MarkdownEditorClient {...props} />;
}
