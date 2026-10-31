'use client';

import type React from 'react';
import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor';
import styles from '@/app/markdownEditor.module.sass';

export const IMAGE_INPUT_ID = 'labs-image-file-input';

const HeadingIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.75 2a.75.75 0 0 1 .75.75V7h7V2.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0V8.5h-7v4.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2Z" />
  </svg>
);

const BoldIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5.5a3.5 3.5 0 0 0 1.852-6.47A3.5 3.5 0 0 0 8.5 2H4Zm4.5 5H5V4h3.5a1.5 1.5 0 0 1 0 3ZM5 9h4.5a1.5 1.5 0 0 1 0 3H5V9Z" />
  </svg>
);

const ItalicIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-2.505l-3.83 9h2.335a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.505l3.83-9H6.75A.75.75 0 0 1 6 2.75Z" />
  </svg>
);

const QuoteIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1.75 2.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-1.5 0V3.25a.75.75 0 0 1 .75-.75Zm4 2a.75.75 0 0 1 .75-.75h8.75a.75.75 0 0 1 0 1.5H6.5a.75.75 0 0 1-.75-.75Zm0 4.5a.75.75 0 0 1 .75-.75h8.75a.75.75 0 0 1 0 1.5H6.5a.75.75 0 0 1-.75-.75Zm0 4.5a.75.75 0 0 1 .75-.75h8.75a.75.75 0 0 1 0 1.5H6.5a.75.75 0 0 1-.75-.75Z" />
  </svg>
);

const CodeIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.06 1.06L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25Z" />
  </svg>
);

const LinkIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.06 0 .751.751 0 0 1 0-1.06Zm-1.55 10.5a.75.75 0 0 1-.53-.22l-1.25-1.25a3.5 3.5 0 0 1 4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a2.002 2.002 0 0 0 2.83 2.83l1.25-1.25a.75.75 0 0 1 1.06 1.06l-1.25 1.25a3.5 3.5 0 0 1-2.475 1.025Z" />
  </svg>
);

const UnorderedListIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3.75-1.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM3 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
  </svg>
);

const OrderedListIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2.003 2.5a.5.5 0 0 0-.723-.447l-1.003.5a.5.5 0 0 0 .446.894l.28-.14V6H.5a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1h-.497V2.5ZM2 9.5a.5.5 0 0 1 .5.5v.06a1.5 1.5 0 0 1-.44 1.06L.94 12.24H2.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5v-.5a.5.5 0 0 1 .146-.354l1.554-1.553A.5.5 0 0 0 1.5 10H1a.5.5 0 0 1 0-1h.5a.5.5 0 0 1 .5.5Zm3.75-7.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" />
  </svg>
);

const TasklistIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2.5 1.75a.75.75 0 0 0-.75.75v11c0 .414.336.75.75.75h11a.75.75 0 0 0 .75-.75V2.5a.75.75 0 0 0-.75-.75h-11ZM1 2.5A2.25 2.25 0 0 1 3.25.25h9.5A2.25 2.25 0 0 1 15 2.5v11A2.25 2.25 0 0 1 12.75 15.75h-9.5A2.25 2.25 0 0 1 1 13.5v-11Zm10.03 4.28a.75.75 0 0 0-1.06-1.06L6.5 9.19 5.53 8.22a.75.75 0 0 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l4-4Z" />
  </svg>
);

const ImageIcon = () => (
  <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25H1.75ZM0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75Zm10.5 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM1.5 12l3.5-4.5 2.5 3 3-4 4 5.5H1.5Z" />
  </svg>
);

const tabWrite: ICommand = {
  name: 'tab-write',
  keyCommand: 'preview',
  value: 'edit',
  shortcuts: 'ctrlcmd+7',
  buttonProps: { 'aria-label': '작성화면 (Ctrl + 7)', title: '작성화면 (Ctrl + 7)' },
  icon: <span>작성화면</span>,
  execute: (_state, api, dispatch, executeCommandState, shortcuts) => {
    api?.textArea?.focus();
    if (shortcuts && dispatch && executeCommandState) {
      dispatch({ preview: 'edit' });
    }
  },
};

const tabPreview: ICommand = {
  name: 'tab-preview',
  keyCommand: 'preview',
  value: 'preview',
  shortcuts: 'ctrlcmd+9',
  buttonProps: { 'aria-label': '미리보기 (Ctrl + 9)', title: '미리보기 (Ctrl + 9)' },
  icon: <span>미리보기</span>,
  execute: (_state, api, dispatch, executeCommandState, shortcuts) => {
    api?.textArea?.focus();
    if (shortcuts && dispatch && executeCommandState) {
      dispatch({ preview: 'preview' });
    }
  },
};

const title1: ICommand = {
  ...commands.heading1,
  buttonProps: { 'aria-label': '제목 1 (H1)', title: '제목 1 (H1)' },
  icon: <span style={{ fontSize: 16, fontWeight: 700 }}>H1 제목 1</span>,
};

const title2: ICommand = {
  ...commands.heading2,
  buttonProps: { 'aria-label': '제목 2 (H2)', title: '제목 2 (H2)' },
  icon: <span style={{ fontSize: 15, fontWeight: 700 }}>H2 제목 2</span>,
};

const title3: ICommand = {
  ...commands.heading3,
  buttonProps: { 'aria-label': '제목 3 (H3)', title: '제목 3 (H3)' },
  icon: <span style={{ fontSize: 14, fontWeight: 600 }}>H3 제목 3</span>,
};

const title4: ICommand = {
  ...commands.heading4,
  buttonProps: { 'aria-label': '제목 4 (H4)', title: '제목 4 (H4)' },
  icon: <span style={{ fontSize: 13, fontWeight: 600 }}>H4 제목 4</span>,
};

const title5: ICommand = {
  ...commands.heading5,
  buttonProps: { 'aria-label': '제목 5 (H5)', title: '제목 5 (H5)' },
  icon: <span style={{ fontSize: 12, fontWeight: 500 }}>H5 제목 5</span>,
};

const title6: ICommand = {
  ...commands.heading6,
  buttonProps: { 'aria-label': '제목 6 (H6)', title: '제목 6 (H6)' },
  icon: <span style={{ fontSize: 12, fontWeight: 400 }}>H6 제목 6</span>,
};

const headingGroup: ICommand = commands.group([title1, title2, title3, title4, title5, title6], {
  name: 'heading',
  groupName: 'heading',
  buttonProps: { 'aria-label': '제목 (H)', title: '제목 (H)' },
  icon: <HeadingIcon />,
});

const boldCommand: ICommand = {
  ...commands.bold,
  buttonProps: { 'aria-label': '굵게 (Ctrl + B)', title: '굵게 (Ctrl + B)' },
  icon: <BoldIcon />,
};

const italicCommand: ICommand = {
  ...commands.italic,
  buttonProps: { 'aria-label': '기울임꼴 (Ctrl + I)', title: '기울임꼴 (Ctrl + I)' },
  icon: <ItalicIcon />,
};

const quoteCommand: ICommand = {
  ...commands.quote,
  buttonProps: { 'aria-label': '인용구 (Ctrl + Q)', title: '인용구 (Ctrl + Q)' },
  icon: <QuoteIcon />,
};

const codeCommand: ICommand = {
  ...commands.code,
  buttonProps: { 'aria-label': '코드 (Ctrl + J)', title: '코드 (Ctrl + J)' },
  icon: <CodeIcon />,
};

const linkCommand: ICommand = {
  ...commands.link,
  buttonProps: { 'aria-label': '링크 추가 (Ctrl + L)', title: '링크 추가 (Ctrl + L)' },
  icon: <LinkIcon />,
};

const unorderedListCommand: ICommand = {
  ...commands.unorderedListCommand,
  buttonProps: { 'aria-label': '글머리 기호 목록 (Ctrl + Shift + U)', title: '글머리 기호 목록 (Ctrl + Shift + U)' },
  icon: <UnorderedListIcon />,
};

const orderedListCommand: ICommand = {
  ...commands.orderedListCommand,
  buttonProps: { 'aria-label': '번호 매기기 목록 (Ctrl + Shift + O)', title: '번호 매기기 목록 (Ctrl + Shift + O)' },
  icon: <OrderedListIcon />,
};

const checkedListCommand: ICommand = {
  ...commands.checkedListCommand,
  buttonProps: { 'aria-label': '체크리스트 (Ctrl + Shift + C)', title: '체크리스트 (Ctrl + Shift + C)' },
  icon: <TasklistIcon />,
};

const imageCommand: ICommand = {
  ...commands.image,
  buttonProps: { 'aria-label': '이미지 첨부 (Ctrl + K)', title: '이미지 첨부 (Ctrl + K)' },
  icon: <ImageIcon />,
  execute: () => {
    if (typeof document !== 'undefined') {
      const input = document.getElementById(IMAGE_INPUT_ID) as HTMLInputElement | null;
      input?.click();
    }
  },
};

const githubCommands: ICommand[] = [tabWrite, tabPreview];

const githubExtraCommands: ICommand[] = [
  headingGroup,
  boldCommand,
  italicCommand,
  quoteCommand,
  codeCommand,
  linkCommand,
  commands.divider,
  unorderedListCommand,
  orderedListCommand,
  checkedListCommand,
  commands.divider,
  imageCommand,
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  themeMode?: 'light' | 'dark';
  onPaste?: (event: React.ClipboardEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
};

export default function MarkdownEditorClient({
  value,
  onChange,
  height = 400,
  placeholder = '제안하실 상세 내용을 작성해 주세요.',
  themeMode = 'light',
  onPaste,
  onDrop,
}: Props) {
  return (
    <div className={styles.editorWrapper} data-color-mode={themeMode} onPaste={onPaste} onDrop={onDrop}>
      <MDEditor
        commands={githubCommands}
        extraCommands={githubExtraCommands}
        data-color-mode={themeMode}
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        preview="edit"
        visibleDragbar={false}
        textareaProps={{
          placeholder,
        }}
        components={{
          preview: (source) => {
            if (!source || !source.trim()) {
              return <div className={styles.emptyPreview}>미리 볼 내용이 없습니다.</div>;
            }
            return <MDEditor.Markdown source={source} />;
          },
        }}
      />
    </div>
  );
}
