'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CropOriginalOutlinedIcon from '@mui/icons-material/CropOriginalOutlined';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import styles from '@/app/board.module.sass';

const MAX_FILE_SIZE = 1024 * 1024;

type Props = {
  disabled?: boolean;
  value: string;
  previewUrl?: string;
  onUpload: (file: File) => Promise<{ path: string; url: string }>;
  onChange: (value: { path: string; url: string }) => void;
  onError: (message: string) => void;
};

export default function BlogAdImageDialog({
  disabled = false,
  value,
  previewUrl = '',
  onUpload,
  onChange,
  onError,
}: Props) {
  const inputReference = useRef<HTMLInputElement | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState('');
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(selectedPreviewUrl);
    };
  }, [selectedPreviewUrl]);

  function resetDialog() {
    setSelectedFile(null);
    setMessage('');
    setSelectedPreviewUrl('');
    if (inputReference.current) inputReference.current.value = '';
  }

  function closeDialog() {
    if (isUploading) return;
    setOpen(false);
    resetDialog();
  }

  function openDialog() {
    setSelectedPreviewUrl(previewUrl);
    setMessage('');
    setOpen(true);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/webp'].includes(file.type) || file.size >= MAX_FILE_SIZE) {
      setMessage('1MB 미만의 PNG 또는 WEBP 이미지만 등록할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }

    if (selectedPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(selectedPreviewUrl);
    setSelectedFile(file);
    setSelectedPreviewUrl(URL.createObjectURL(file));
    setMessage('');
  }

  async function applyImage() {
    if (!selectedFile) {
      setMessage('업로드할 이미지를 선택해주세요.');
      return;
    }

    setIsUploading(true);
    try {
      onChange(await onUpload(selectedFile));
      setOpen(false);
      resetDialog();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '상품 썸네일 업로드에 실패했습니다.';
      setMessage(errorMessage);
      onError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }

  const content = (
    <>
      {message ? <DialogContentText className={styles['thumbnail-dialog-message']}>{message}</DialogContentText> : null}
      <div className={styles['thumbnail-uploader']}>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputReference.current?.click()}
          className={styles['thumbnail-upload-button']}
        >
          <span>이미지를 선택해주세요</span>
          <CropOriginalOutlinedIcon />
        </button>
        <input
          ref={inputReference}
          type="file"
          accept="image/png,image/webp"
          className={styles['thumbnail-file-input']}
          onChange={handleFileChange}
        />
      </div>
      {selectedPreviewUrl ? (
        <div className={styles['thumbnail-dialog-preview']}>
          <img src={selectedPreviewUrl} alt="" />
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <button type="button" disabled={disabled} onClick={openDialog} className="button small action">
        이미지 {value ? '변경' : '등록'}
      </button>
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={open}
          onClose={closeDialog}
          className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['thumbnail-dialog']}`}
        >
          <h2>상품 이미지 업로드</h2>
          <button type="button" className="close-button" onClick={closeDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className={`VhiDrawer-bottom-content ${styles['thumbnail-dialog-content']}`}>{content}</div>
          <div className="drawer-dialog-actions">
            <button type="button" onClick={closeDialog} disabled={isUploading} className="button small cancel">
              취소
            </button>
            <button
              type="button"
              onClick={() => void applyImage()}
              disabled={!selectedFile || isUploading}
              className="button small submit"
            >
              {isUploading ? '업로드 중' : '이미지 업로드'}
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={open} onClose={closeDialog} className={`vh-dialog vh-alert-dialog ${styles['thumbnail-dialog']}`}>
          <DialogTitle>상품 이미지 업로드</DialogTitle>
          <button type="button" className="close-button" onClick={closeDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent className={styles['thumbnail-dialog-content']}>{content}</DialogContent>
          <DialogActions>
            <button type="button" onClick={closeDialog} disabled={isUploading} className="cancel-button">
              취소
            </button>
            <button type="button" onClick={() => void applyImage()} disabled={!selectedFile || isUploading}>
              {isUploading ? '업로드 중' : '이미지 업로드'}
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
