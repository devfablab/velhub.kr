'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Button, styled } from '@mui/material';
import AwsS3 from '@uppy/aws-s3';
import Uppy, { type UppyFile } from '@uppy/core';
import styles from '@/app/concierge.module.sass';

export type ConciergeUploadPurpose =
  | 'appeal_opinion'
  | 'contact_evidence'
  | 'family_relation_certificate'
  | 'legal_report'
  | 'minor_family_relation_certificate'
  | 'rights_report';

export type ConciergeUploadedFile = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
};

type UploadResponseBody = { key?: string };

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

function formatFileSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

function getStoragePath(file: UppyFile<Record<string, never>, UploadResponseBody>) {
  const key = file.response?.body?.key;
  return typeof key === 'string' ? key : '';
}

function getStatus(file: UppyFile<Record<string, never>, UploadResponseBody>, isUploading: boolean) {
  if (file.progress.uploadComplete) return '업로드 완료';
  if (file.error) return '업로드 실패';
  if (file.isPaused) return '일시 중지';
  return isUploading ? '업로드 중' : '대기 중';
}

export default function ConciergeFileUploader({
  accept,
  addLabel = '파일 추가',
  disabled = false,
  maxFiles = 1,
  maxTotalFileSize,
  onChange,
  onUploadStateChange,
  purpose,
  value,
}: {
  accept: string;
  addLabel?: string;
  disabled?: boolean;
  maxFiles?: number;
  maxTotalFileSize?: number;
  onChange: (files: ConciergeUploadedFile[]) => void;
  onUploadStateChange: (hasIncompleteUpload: boolean) => void;
  purpose: ConciergeUploadPurpose;
  value: ConciergeUploadedFile[];
}) {
  const [activeUploadFileIds, setActiveUploadFileIds] = useState<string[]>([]);
  const [deletingStoragePaths, setDeletingStoragePaths] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [uppyFiles, setUppyFiles] = useState<UppyFile<Record<string, never>, UploadResponseBody>[]>([]);
  const existingFilesReference = useRef(value);
  const activeUploadFileIdsReference = useRef(new Set<string>());
  const onChangeReference = useRef(onChange);
  const onUploadStateChangeReference = useRef(onUploadStateChange);
  const uppyReference = useRef<Uppy<Record<string, never>, UploadResponseBody> | null>(null);
  const pendingUppyFiles = uppyFiles.filter((file) => !file.progress.uploadComplete);
  const fileCount = value.length + pendingUppyFiles.length;

  useEffect(() => {
    const uploadingStoragePaths = new Set((uppyReference.current?.getFiles() ?? []).map(getStoragePath).filter(Boolean));
    existingFilesReference.current = value.filter((file) => !uploadingStoragePaths.has(file.storagePath));
  }, [value]);

  useEffect(() => {
    onChangeReference.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onUploadStateChangeReference.current = onUploadStateChange;
  }, [onUploadStateChange]);

  useEffect(() => {
    const updateActiveUploadFile = (fileId: string, isActive: boolean) => {
      if (isActive) activeUploadFileIdsReference.current.add(fileId);
      else activeUploadFileIdsReference.current.delete(fileId);
      setActiveUploadFileIds([...activeUploadFileIdsReference.current]);
    };
    const syncFiles = () => {
      const files = uppyReference.current?.getFiles() ?? [];
      const uploadedFiles = files.flatMap((file) => {
        const storagePath = getStoragePath(file);
        return file.progress.uploadComplete && storagePath
          ? [{ fileName: file.name, fileSize: file.size ?? 0, mimeType: file.type, storagePath }]
          : [];
      });
      setUppyFiles(files);
      onChangeReference.current([...existingFilesReference.current, ...uploadedFiles]);
      onUploadStateChangeReference.current(files.some((file) => !file.progress.uploadComplete));
    };
    const uppy = new Uppy<Record<string, never>, UploadResponseBody>({
      allowMultipleUploadBatches: true,
      autoProceed: true,
      onBeforeFileAdded(currentFile, files) {
        if (existingFilesReference.current.length + Object.keys(files).length >= maxFiles) {
          setErrorMessage(`파일은 최대 ${maxFiles}개까지 첨부할 수 있습니다.`);
          return false;
        }
        const totalSize =
          existingFilesReference.current.reduce((total, file) => total + file.fileSize, 0) +
          Object.values(files).reduce((total, file) => total + (file.size ?? 0), 0) +
          (currentFile.size ?? 0);
        if (maxTotalFileSize && totalSize > maxTotalFileSize) {
          setErrorMessage(`첨부 파일의 전체 용량은 ${formatFileSize(maxTotalFileSize)} 이하만 가능합니다.`);
          return false;
        }
        setErrorMessage('');
        return true;
      },
    }).use(AwsS3, {
      generateObjectKey: (file) => file.name,
      limit: 1,
      shouldUseMultipart: true,
      signRequest: async (request) => {
        const file = uppy.getFile(request.key);
        const response = await fetch('/api/attachment/add/concierge/file/sign', {
          body: JSON.stringify({
            file: file ? { name: file.name, size: file.size, type: file.type } : undefined,
            purpose,
            request,
          }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });
        const result = (await response.json()) as { error?: string; headers?: Record<string, string>; key?: string; url?: string };
        if (!response.ok || !result.url) throw new Error(result.error ?? '파일 업로드를 준비하지 못했습니다.');
        return { ...(result.headers ? { headers: result.headers } : {}), ...(result.key ? { key: result.key } : {}), url: result.url };
      },
    });
    uppyReference.current = uppy;
    uppy.on('file-added', syncFiles);
    uppy.on('file-removed', (file) => {
      updateActiveUploadFile(file.id, false);
      syncFiles();
    });
    uppy.on('upload-start', syncFiles);
    uppy.on('upload-progress', (file) => {
      if (file) updateActiveUploadFile(file.id, true);
      syncFiles();
    });
    uppy.on('upload-pause', (file) => {
      if (file) updateActiveUploadFile(file.id, false);
      syncFiles();
    });
    uppy.on('upload-error', (file, error) => {
      if (file) updateActiveUploadFile(file.id, false);
      setErrorMessage(error.message || `${file?.name ?? '첨부'} 파일 업로드에 실패했습니다.`);
      syncFiles();
    });
    uppy.on('upload-success', (file) => {
      if (file) updateActiveUploadFile(file.id, false);
      syncFiles();
    });
    uppy.on('upload-retry', syncFiles);
    return () => {
      uppy.destroy();
      uppyReference.current = null;
    };
  }, [maxFiles, maxTotalFileSize, purpose]);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    const uppy = uppyReference.current;
    if (!uppy || files.length === 0) {
      event.currentTarget.value = '';
      return;
    }
    for (const file of files) {
      try {
        uppy.addFile({ data: file, name: file.name, source: 'concierge-file', type: file.type });
      } catch (error) {
        if (error instanceof Error && error.message === 'Cannot add the file because onBeforeFileAdded returned false.') continue;
        setErrorMessage(error instanceof Error ? error.message : '파일을 추가하지 못했습니다.');
      }
    }
    event.currentTarget.value = '';
  }

  async function removeFile(storagePath: string, fileId?: string) {
    setDeletingStoragePaths((paths) => [...paths, storagePath]);
    try {
      const signResponse = await fetch('/api/attachment/add/concierge/file/sign', {
        body: JSON.stringify({ purpose, request: { key: storagePath, method: 'DELETE' } }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const signed = (await signResponse.json()) as { error?: string; url?: string };
      if (!signResponse.ok || !signed.url) throw new Error(signed.error ?? '파일 삭제를 준비하지 못했습니다.');
      const deleteResponse = await fetch(signed.url, { method: 'DELETE' });
      if (!deleteResponse.ok) throw new Error('파일을 삭제하지 못했습니다.');
      if (fileId) uppyReference.current?.removeFile(fileId);
      else {
        existingFilesReference.current = existingFilesReference.current.filter((file) => file.storagePath !== storagePath);
        const uploadedFile = uppyReference.current?.getFiles().find((file) => getStoragePath(file) === storagePath);
        if (uploadedFile) uppyReference.current?.removeFile(uploadedFile.id);
        onChangeReference.current([...existingFilesReference.current]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '파일을 삭제하지 못했습니다.');
    } finally {
      setDeletingStoragePaths((paths) => paths.filter((path) => path !== storagePath));
    }
  }

  return (
    <div className={styles['concierge-file-uploader']}>
      <div className={styles['concierge-file-uploader-picker']}>
        {fileCount < maxFiles ? (
          <Button component="label" className="button small action" disabled={disabled}>
            {addLabel}
            <VisuallyHiddenInput accept={accept} disabled={disabled} multiple={maxFiles > 1} onChange={handleFilesChange} type="file" />
          </Button>
        ) : null}
        <span>{`첨부 ${fileCount}/${maxFiles}`}</span>
      </div>
      {errorMessage ? <p className="alert error"><ErrorOutlineRoundedIcon /><span>{errorMessage}</span></p> : null}
      {fileCount > 0 ? (
        <ul className={`${styles['concierge-file-list']} paper`}>
          {value.map((file) => {
            const isDeleting = deletingStoragePaths.includes(file.storagePath);
            return <li key={file.storagePath}><div className={styles['concierge-file-link']}><strong>{file.fileName}</strong><span>{`${formatFileSize(file.fileSize)} · 업로드 완료`}</span></div><div className={styles['concierge-file-actions']}><button type="button" className="button small danger" disabled={disabled || isDeleting} onClick={() => void removeFile(file.storagePath)}>{isDeleting ? '삭제중' : '삭제'}</button></div></li>;
          })}
          {pendingUppyFiles.map((file) => {
            const uploaded = typeof file.progress.bytesUploaded === 'number' ? file.progress.bytesUploaded : 0;
            const total = typeof file.progress.bytesTotal === 'number' ? file.progress.bytesTotal : (file.size ?? 0);
            const progress = total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0;
            const status = getStatus(file, activeUploadFileIds.includes(file.id));
            const storagePath = getStoragePath(file);
            const isDeleting = Boolean(storagePath && deletingStoragePaths.includes(storagePath));
            return <li key={file.id}><div className={styles['concierge-file-link']}><strong>{file.name}</strong><span>{`${file.error || status} · ${formatFileSize(uploaded)} / ${formatFileSize(total)} (${progress}%)`}</span><progress max="100" value={progress} /></div><div className={styles['concierge-file-actions']}>{!file.progress.uploadComplete && status !== '업로드 실패' ? <button type="button" className="button small action" disabled={disabled} onClick={() => uppyReference.current?.pauseResume(file.id)}>{status === '일시 중지' ? '재개' : '일시 중지'}</button> : null}{status === '업로드 실패' ? <button type="button" className="button small action" disabled={disabled} onClick={() => uppyReference.current?.retryUpload(file.id)}>{uploaded > 0 ? '재개' : '다시 시도'}</button> : null}<button type="button" className="button small danger" disabled={disabled || isDeleting} onClick={() => storagePath ? void removeFile(storagePath, file.id) : uppyReference.current?.removeFile(file.id)}>{isDeleting ? '삭제중' : '삭제'}</button></div></li>;
          })}
        </ul>
      ) : null}
    </div>
  );
}
