'use client';

import dynamic from 'next/dynamic';

export const LABS_IMAGE_INPUT_ID = 'labs-image-file-input';

const LabsMarkdownEditorClient = dynamic(() => import('./LabsMarkdownEditorClient'), {
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

export default function LabsMarkdownEditor(props: Props) {
  return <LabsMarkdownEditorClient {...props} />;
}
