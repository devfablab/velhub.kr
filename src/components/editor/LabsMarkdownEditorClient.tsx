'use client';

import type React from 'react';
import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor';

export const LABS_IMAGE_INPUT_ID = 'labs-image-file-input';

const bold: ICommand = {
  ...commands.bold,
  buttonProps: { 'aria-label': '굵게 (Ctrl + B)', title: '굵게 (Ctrl + B)' },
};

const italic: ICommand = {
  ...commands.italic,
  buttonProps: { 'aria-label': '기울임꼴 (Ctrl + I)', title: '기울임꼴 (Ctrl + I)' },
};

const strikethrough: ICommand = {
  ...commands.strikethrough,
  buttonProps: { 'aria-label': '취소선 (Ctrl + Shift + X)', title: '취소선 (Ctrl + Shift + X)' },
};

const hr: ICommand = {
  ...commands.hr,
  buttonProps: { 'aria-label': '구분선 (Ctrl + H)', title: '구분선 (Ctrl + H)' },
};

const title1: ICommand = {
  ...commands.heading1,
  buttonProps: { 'aria-label': '제목 1 (H1)', title: '제목 1 (H1)' },
  icon: <div style={{ fontSize: 18, textAlign: 'left' }}>제목 1</div>,
};

const title2: ICommand = {
  ...commands.heading2,
  buttonProps: { 'aria-label': '제목 2 (H2)', title: '제목 2 (H2)' },
  icon: <div style={{ fontSize: 16, textAlign: 'left' }}>제목 2</div>,
};

const title3: ICommand = {
  ...commands.heading3,
  buttonProps: { 'aria-label': '제목 3 (H3)', title: '제목 3 (H3)' },
  icon: <div style={{ fontSize: 15, textAlign: 'left' }}>제목 3</div>,
};

const title4: ICommand = {
  ...commands.heading4,
  buttonProps: { 'aria-label': '제목 4 (H4)', title: '제목 4 (H4)' },
  icon: <div style={{ fontSize: 14, textAlign: 'left' }}>제목 4</div>,
};

const title5: ICommand = {
  ...commands.heading5,
  buttonProps: { 'aria-label': '제목 5 (H5)', title: '제목 5 (H5)' },
  icon: <div style={{ fontSize: 13, textAlign: 'left' }}>제목 5</div>,
};

const title6: ICommand = {
  ...commands.heading6,
  buttonProps: { 'aria-label': '제목 6 (H6)', title: '제목 6 (H6)' },
  icon: <div style={{ fontSize: 12, textAlign: 'left' }}>제목 6</div>,
};

const link: ICommand = {
  ...commands.link,
  buttonProps: { 'aria-label': '링크 추가 (Ctrl + L)', title: '링크 추가 (Ctrl + L)' },
};

const quote: ICommand = {
  ...commands.quote,
  buttonProps: { 'aria-label': '인용구 (Ctrl + Q)', title: '인용구 (Ctrl + Q)' },
};

const code: ICommand = {
  ...commands.code,
  buttonProps: { 'aria-label': '인라인 코드 (Ctrl + J)', title: '인라인 코드 (Ctrl + J)' },
};

const codeBlock: ICommand = {
  ...commands.codeBlock,
  buttonProps: { 'aria-label': '코드 블록 (Ctrl + Shift + J)', title: '코드 블록 (Ctrl + Shift + J)' },
};

const comment: ICommand = {
  ...commands.comment,
  buttonProps: { 'aria-label': '주석 (Ctrl + /)', title: '주석 (Ctrl + /)' },
};

const imageCommand: ICommand = {
  ...commands.image,
  buttonProps: { 'aria-label': '이미지 첨부 (Ctrl + K)', title: '이미지 첨부 (Ctrl + K)' },
  execute: () => {
    if (typeof document !== 'undefined') {
      const input = document.getElementById(LABS_IMAGE_INPUT_ID) as HTMLInputElement | null;
      input?.click();
    }
  },
};

const table: ICommand = {
  ...commands.table,
  buttonProps: { 'aria-label': '표 삽입', title: '표 삽입' },
};

const unorderedListCommand: ICommand = {
  ...commands.unorderedListCommand,
  buttonProps: { 'aria-label': '글머리 기호 목록 (Ctrl + Shift + U)', title: '글머리 기호 목록 (Ctrl + Shift + U)' },
};

const orderedListCommand: ICommand = {
  ...commands.orderedListCommand,
  buttonProps: { 'aria-label': '번호 매기기 목록 (Ctrl + Shift + O)', title: '번호 매기기 목록 (Ctrl + Shift + O)' },
};

const checkedListCommand: ICommand = {
  ...commands.checkedListCommand,
  buttonProps: { 'aria-label': '체크리스트 (Ctrl + Shift + C)', title: '체크리스트 (Ctrl + Shift + C)' },
};

const help: ICommand = {
  ...commands.help,
  buttonProps: { 'aria-label': '마크다운 도움말', title: '마크다운 도움말' },
};

const codeEdit: ICommand = {
  ...commands.codeEdit,
  buttonProps: { 'aria-label': '편집 모드 (Ctrl + 7)', title: '편집 모드 (Ctrl + 7)' },
};

const codeLive: ICommand = {
  ...commands.codeLive,
  buttonProps: { 'aria-label': '편집 및 미리보기 (Ctrl + 8)', title: '편집 및 미리보기 (Ctrl + 8)' },
};

const codePreview: ICommand = {
  ...commands.codePreview,
  buttonProps: { 'aria-label': '미리보기 모드 (Ctrl + 9)', title: '미리보기 모드 (Ctrl + 9)' },
};

const fullscreen: ICommand = {
  ...commands.fullscreen,
  buttonProps: { 'aria-label': '전체화면 (Ctrl + 0)', title: '전체화면 (Ctrl + 0)' },
};

const koreanCommands: ICommand[] = [
  bold,
  italic,
  strikethrough,
  hr,
  commands.group([title1, title2, title3, title4, title5, title6], {
    name: 'title',
    groupName: 'title',
    buttonProps: { 'aria-label': '제목 삽입', title: '제목 삽입' },
  }),
  commands.divider,
  link,
  quote,
  code,
  codeBlock,
  comment,
  imageCommand,
  table,
  commands.divider,
  unorderedListCommand,
  orderedListCommand,
  checkedListCommand,
  commands.divider,
  help,
];

const koreanExtraCommands: ICommand[] = [codeEdit, codeLive, codePreview, commands.divider, fullscreen];

type Props = {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  themeMode?: 'light' | 'dark';
  onPaste?: (event: React.ClipboardEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
};

export default function LabsMarkdownEditorClient({
  value,
  onChange,
  height = 400,
  placeholder = '제안하실 상세 내용을 작성해 주세요.',
  themeMode = 'light',
  onPaste,
  onDrop,
}: Props) {
  return (
    <div onPaste={onPaste} onDrop={onDrop} data-color-mode={themeMode}>
      <MDEditor
        commands={koreanCommands}
        extraCommands={koreanExtraCommands}
        data-color-mode={themeMode}
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        preview="live"
        textareaProps={{
          placeholder,
        }}
      />
    </div>
  );
}
