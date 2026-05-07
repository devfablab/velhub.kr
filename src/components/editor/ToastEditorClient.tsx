'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/theme/toastui-editor-dark.css';
import '@toast-ui/editor/dist/i18n/ko-kr';

import 'prismjs/themes/prism.css';
import '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight.css';
import codeSyntaxHighlight from '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight-all.js';

import { fontSizePlugin } from '@/lib/editor/createFontSizeToolbarItem';
import { markdownAlignPlugin } from '@/lib/editor/createMarkdownAlignToolbarItem';
import { textAlignPlugin } from '@/lib/editor/createTextAlignToolbarItem';
import { textColorPlugin } from '@/lib/editor/createTextColorToolbarItem';

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

export default function ToastEditorClient({
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
  const editorReference = useRef<Editor | null>(null);

  function syncEditorValue() {
    const instance = editorReference.current?.getInstance();

    if (!instance) {
      return;
    }

    onHtmlChange(instance.getHTML());
    onMarkdownChange(instance.getMarkdown());
  }

  const toolbarItems = useMemo(
    () => [
      ['bold', 'italic', 'strike'],
      ['hr', 'quote'],
      ['ul', 'ol', 'task'],
      ['table', 'image', 'link'],
      ['code', 'codeblock'],
    ],
    [],
  );

  const plugins = useMemo(() => {
    const nextPlugins = [fontSizePlugin, textColorPlugin, codeSyntaxHighlight];

    if (markdownStatus === 'markdown_off') {
      nextPlugins.push(textAlignPlugin);
    }

    if (markdownStatus === 'markdown_default') {
      nextPlugins.push(markdownAlignPlugin);
    }

    return nextPlugins;
  }, [markdownStatus]);

  const editorInitialValue = useMemo(() => {
    if (initialEditType === 'markdown') {
      return initialMarkdown && initialMarkdown.trim() ? initialMarkdown : ' ';
    }

    return initialValue && initialValue.trim() ? initialValue : ' ';
  }, [initialEditType, initialMarkdown, initialValue]);

  useEffect(() => {
    syncEditorValue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorInitialValue]);

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
      toolbarItems={toolbarItems}
      plugins={plugins}
      hooks={
        onUploadImage
          ? {
              addImageBlobHook: async (blob: Blob | File, callback: (url: string, altText?: string) => void) => {
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
      onChange={syncEditorValue}
    />
  );
}
