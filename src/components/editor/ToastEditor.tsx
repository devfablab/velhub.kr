'use client';

import dynamic from 'next/dynamic';

const ToastEditorClient = dynamic(() => import('@/components/editor/ToastEditorClient'), {
  ssr: false,
});

type Props = {
  initialValue: string | null;
  initialMarkdown: string | null;
  initialEditType?: 'markdown' | 'wysiwyg';
  themeMode?: 'light' | 'dark';
  hideModeSwitch?: boolean;
  markdownStatus?: string | null;
  onHtmlChange: (value: string) => void;
  onMarkdownChange: (value: string) => void;
  onUploadImage?: (file: Blob | File) => Promise<string>;
};

export default function ToastEditor({
  initialValue,
  initialMarkdown,
  initialEditType = 'markdown',
  themeMode = 'light',
  hideModeSwitch = false,
  markdownStatus = null,
  onHtmlChange,
  onMarkdownChange,
  onUploadImage,
}: Props) {
  const normalizedMarkdownStatus = markdownStatus ?? '';
  const effectiveInitialEditType =
    normalizedMarkdownStatus === 'markdown_off'
      ? 'wysiwyg'
      : normalizedMarkdownStatus === 'markdown_on' || normalizedMarkdownStatus === 'markdown_default'
        ? 'markdown'
        : initialEditType;
  const effectiveHideModeSwitch =
    normalizedMarkdownStatus === 'markdown_on'
      ? false
      : normalizedMarkdownStatus === 'markdown_off' || normalizedMarkdownStatus === 'markdown_default'
        ? true
        : hideModeSwitch;

  return (
    <ToastEditorClient
      initialValue={initialValue}
      initialMarkdown={initialMarkdown}
      initialEditType={effectiveInitialEditType}
      themeMode={themeMode}
      hideModeSwitch={effectiveHideModeSwitch}
      onHtmlChange={onHtmlChange}
      onMarkdownChange={onMarkdownChange}
      markdownStatus={normalizedMarkdownStatus}
      onUploadImage={onUploadImage}
    />
  );
}
