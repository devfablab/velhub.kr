'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/theme/toastui-editor-dark.css';

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

export default function ToastEditorClient({
  initialValue,
  initialMarkdown,
  initialEditType = 'markdown',
  themeMode = 'light',
  hideModeSwitch = false,
  onHtmlChange,
  onMarkdownChange,
  onUploadImage,
}: Props) {
  const editorReference = useRef<Editor | null>(null);

  const editorInitialValue = useMemo(() => {
    if (initialEditType === 'markdown') {
      return initialMarkdown && initialMarkdown.trim() ? initialMarkdown : ' ';
    }

    return initialValue && initialValue.trim() ? initialValue : ' ';
  }, [initialEditType, initialMarkdown, initialValue]);

  useEffect(() => {
    if (!editorReference.current) {
      return;
    }

    const instance = editorReference.current.getInstance();

    onHtmlChange(instance.getHTML());
    onMarkdownChange(instance.getMarkdown());
  }, [editorInitialValue, onHtmlChange, onMarkdownChange]);

  return (
    <Editor
      ref={editorReference}
      initialValue={editorInitialValue}
      initialEditType={initialEditType}
      previewStyle="vertical"
      height="527px"
      language="ko-KR"
      placeholder="당신의 이야기에 모두가 귀 기울이고 있습니다..."
      usageStatistics={false}
      hideModeSwitch={hideModeSwitch}
      theme={themeMode === 'dark' ? 'dark' : undefined}
      hooks={
        onUploadImage
          ? {
              addImageBlobHook: async (blob, callback) => {
                const imageUrl = await onUploadImage(blob);

                if (!imageUrl) {
                  return false;
                }

                callback(imageUrl, 'image');
                return false;
              },
            }
          : undefined
      }
      onChange={() => {
        const instance = editorReference.current?.getInstance();

        if (!instance) {
          return;
        }

        onHtmlChange(instance.getHTML());
        onMarkdownChange(instance.getMarkdown());
      }}
    />
  );
}
