'use client';

import { SyntheticEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormControl, FormHelperText, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LABS_CATEGORIES, LabsCategory } from '@/lib/github/labs';
import Anchor from '@/components/Anchor';
import LabsMarkdownEditor, { LABS_IMAGE_INPUT_ID } from '@/components/editor/LabsMarkdownEditor';
import FormErrorDialog from '@/components/FormErrorDialog';
import type { LabsIssueRow } from '../../page';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

type Props = {
  issueNumber: number;
  initialDbIssue: LabsIssueRow;
  initialGitHubIssue?: {
    title: string;
    body: string;
  };
};

export default function Opt({ issueNumber, initialDbIssue, initialGitHubIssue }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<LabsCategory>(initialDbIssue.category);
  const [title, setTitle] = useState(initialGitHubIssue?.title || initialDbIssue.title);
  const [content, setContent] = useState<string>(initialGitHubIssue?.body || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleUploadImageDirect(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage(`지원하지 않는 이미지 형식입니다: ${file.name}`);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setErrorMessage(`이미지 용량은 10MB 이하여야 합니다: ${file.name}`);
      return;
    }

    // When editing existing issue, upload image immediately via API or client
    // We can upload via existing issue upload helper
    const formData = new FormData();
    formData.append('images', file);
    formData.set('issueNumber', String(issueNumber));

    // We can insert a temporary markdown text while uploading
    const placeholder = `![${file.name}](업로드 중...)`;
    setContent((prev) => (prev || '') + `\n${placeholder}\n`);

    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}/images`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '이미지 업로드에 실패했습니다.');

      const realMarkdown = `![${file.name}](${result.rawUrl})`;
      setContent((prev) => (prev || '').replace(placeholder, realMarkdown));
    } catch (err) {
      setContent((prev) => (prev || '').replace(placeholder, ''));
      setErrorMessage(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) void handleUploadImageDirect(file);
      }
    }
  }

  function handleDrop(event: React.DragEvent) {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        event.preventDefault();
        void handleUploadImageDirect(files[i]);
      }
    }
  }

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();

    if (!title.trim()) {
      setErrorMessage('제목을 입력해 주세요.');
      return;
    }

    if (!content.trim()) {
      setErrorMessage('내용을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/concierge/labs/${issueNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          content: content.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '수정에 실패했습니다.');
      }

      router.push(`/concierge/labs/${issueNumber}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '수정 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Stack gap={2.5}>
        <FormControl fullWidth size="small">
          <Select value={category} onChange={(e) => setCategory(e.target.value as LabsCategory)} displayEmpty>
            <MenuItem value="" disabled>
              카테고리 선택
            </MenuItem>
            {LABS_CATEGORIES.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="제안 제목을 입력해 주세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          fullWidth
        />

        <Stack gap={1}>
          <Typography variant="subtitle2">내용</Typography>
          <input
            id={LABS_IMAGE_INPUT_ID}
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) {
                Array.from(e.target.files).forEach((file) => void handleUploadImageDirect(file));
                e.target.value = '';
              }
            }}
          />

          <LabsMarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="제안하실 상세 내용을 작성해 주세요. 이미지를 복사/붙여넣기하거나 드래그하여 첨부할 수 있습니다."
            themeMode={theme.palette.mode}
            onPaste={handlePaste}
            onDrop={handleDrop}
          />
          <FormHelperText>이미지는 최대 10MB (PNG, JPG, WEBP, GIF) 지원됩니다.</FormHelperText>
        </Stack>

        <Stack direction="row" justifyContent="flex-end" gap={2}>
          <Anchor href={`/concierge/labs/${issueNumber}`} className="button medium close">
            취소
          </Anchor>
          <button
            type="submit"
            disabled={isSubmitting || !category || !title.trim() || !content.trim()}
            className="button medium submit"
          >
            {isSubmitting ? '수정 중...' : '수정 완료'}
          </button>
        </Stack>
      </Stack>

      <FormErrorDialog
        open={Boolean(errorMessage)}
        title="오류"
        messages={[errorMessage]}
        onClose={() => setErrorMessage('')}
      />
    </form>
  );
}
