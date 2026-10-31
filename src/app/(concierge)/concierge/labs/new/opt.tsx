'use client';

import { SyntheticEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormControl, FormHelperText, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LABS_CATEGORIES, LabsCategory } from '@/lib/github/labs';
import Anchor from '@/components/Anchor';
import MarkdownEditor, { IMAGE_INPUT_ID } from '@/components/editor/MarkdownEditor';
import FormErrorDialog from '@/components/FormErrorDialog';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export default function Opt() {
  const router = useRouter();
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<LabsCategory | ''>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<Map<string, File>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function handleAddFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const newFilesMap = new Map(attachedFiles);
    let updatedContent = content || '';

    for (const file of fileArray) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setErrorMessage(`지원하지 않는 이미지 형식입니다: ${file.name}`);
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setErrorMessage(`이미지 용량은 10MB 이하여야 합니다: ${file.name}`);
        return;
      }

      const placeholder = `__PENDING_IMAGE_${Date.now()}_${Math.random().toString(36).slice(2, 7)}__`;
      newFilesMap.set(placeholder, file);

      const markdownImage = `\n![${file.name}](${placeholder})\n`;
      updatedContent += markdownImage;
    }

    setAttachedFiles(newFilesMap);
    setContent(updatedContent);
  }

  function handlePaste(event: React.ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      handleAddFiles(files);
    }
  }

  function handleDrop(event: React.DragEvent) {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        imageFiles.push(files[i]);
      }
    }

    if (imageFiles.length > 0) {
      event.preventDefault();
      handleAddFiles(imageFiles);
    }
  }

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();

    if (!category) {
      setErrorMessage('카테고리를 선택해 주세요.');
      return;
    }

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
      const formData = new FormData();
      formData.set('title', title.trim());
      formData.set('category', category);
      formData.set('content', content.trim());

      const placeholderMap: Record<string, string> = {};
      let fileIndex = 0;
      attachedFiles.forEach((file, placeholder) => {
        formData.append('images', file);
        placeholderMap[file.name] = placeholder;
        placeholderMap[String(fileIndex)] = placeholder;
        fileIndex++;
      });

      formData.set('placeholderMap', JSON.stringify(placeholderMap));

      const response = await fetch('/api/concierge/labs', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '제안 등록에 실패했습니다.');
      }

      router.push(`/concierge/labs/${result.issueNumber}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '등록 중 오류가 발생했습니다.');
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
            id={IMAGE_INPUT_ID}
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) {
                handleAddFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <MarkdownEditor
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
          <Anchor href="/concierge/labs" className="button medium close">
            취소
          </Anchor>
          <button
            type="submit"
            disabled={isSubmitting || !category || !title.trim() || !content.trim()}
            className="button medium submit"
          >
            {isSubmitting ? '등록 중...' : '제안 등록하기'}
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
