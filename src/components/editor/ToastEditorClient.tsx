'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/theme/toastui-editor-dark.css';

type Props = {
  initialValue: string | null;
  initialMarkdown: string | null;
  initialEditType?: 'markdown' | 'wysiwyg';
  onHtmlChange: (value: string) => void;
  onMarkdownChange: (value: string) => void;
};

export default function ToastEditorClient({
  initialValue,
  initialMarkdown,
  initialEditType = 'markdown',
  onHtmlChange,
  onMarkdownChange,
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
      height="500px"
      language="ko-KR"
      usageStatistics={false}
      hideModeSwitch={false}
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
