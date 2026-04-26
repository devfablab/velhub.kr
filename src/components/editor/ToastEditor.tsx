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
  onHtmlChange,
  onMarkdownChange,
  onUploadImage,
}: Props) {
  return (
    <ToastEditorClient
      initialValue={initialValue}
      initialMarkdown={initialMarkdown}
      initialEditType={initialEditType}
      themeMode={themeMode}
      hideModeSwitch={hideModeSwitch}
      onHtmlChange={onHtmlChange}
      onMarkdownChange={onMarkdownChange}
      onUploadImage={onUploadImage}
    />
  );
}
