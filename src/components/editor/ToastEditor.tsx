'use client';

import dynamic from 'next/dynamic';

const ToastEditorClient = dynamic(() => import('@/components/editor/ToastEditorClient'), {
  ssr: false,
});

type Props = {
  initialValue: string | null;
  initialMarkdown: string | null;
  initialEditType?: 'markdown' | 'wysiwyg';
  onHtmlChange: (value: string) => void;
  onMarkdownChange: (value: string) => void;
};

export default function ToastEditor({
  initialValue,
  initialMarkdown,
  initialEditType = 'markdown',
  onHtmlChange,
  onMarkdownChange,
}: Props) {
  return (
    <ToastEditorClient
      initialValue={initialValue}
      initialMarkdown={initialMarkdown}
      initialEditType={initialEditType}
      onHtmlChange={onHtmlChange}
      onMarkdownChange={onMarkdownChange}
    />
  );
}
