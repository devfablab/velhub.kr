'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Button, styled } from '@mui/material';
import AwsS3 from '@uppy/aws-s3';
import Uppy, { type UppyFile } from '@uppy/core';
import styles from '@/app/board.module.sass';

const MAX_FILE_COUNT = 5;
const MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024;

export type PostAttachmentValue = {
  fileName: string;
  fileSize: number;
  storagePath: string;
  url?: string;
};

type Props = {
  boardName: string;
  disabled?: boolean;
  onChange: (attachments: PostAttachmentValue[]) => void;
  onUploadStateChange: (hasIncompleteUpload: boolean) => void;
  siteName: string;
  value: PostAttachmentValue[];
};

type UploadResponseBody = {
  key?: string;
};

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
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))}KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function getUploadStoragePath(file: UppyFile<Record<string, never>, UploadResponseBody>) {
  const key = file.response?.body?.key;

  return typeof key === 'string' ? key : '';
}

function getFileStatus(file: UppyFile<Record<string, never>, UploadResponseBody>, isActivelyUploading: boolean) {
  if (file.progress.uploadComplete) {
    return '업로드 완료';
  }

  if (file.error) {
    return '업로드 실패';
  }

  if (file.isPaused) {
    return '일시 중지';
  }

  return isActivelyUploading ? '업로드 중' : '대기 중';
}

export default function PostAttachmentUploader({
  boardName,
  disabled = false,
  onChange,
  onUploadStateChange,
  siteName,
  value,
}: Props) {
  const [activeUploadFileIds, setActiveUploadFileIds] = useState<string[]>([]);
  const [deletingStoragePaths, setDeletingStoragePaths] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [uppyFiles, setUppyFiles] = useState<UppyFile<Record<string, never>, UploadResponseBody>[]>([]);
  const existingAttachmentsReference = useRef(value);
  const activeUploadFileIdsReference = useRef(new Set<string>());
  const onChangeReference = useRef(onChange);
  const onUploadStateChangeReference = useRef(onUploadStateChange);
  const uppyReference = useRef<Uppy<Record<string, never>, UploadResponseBody> | null>(null);
  const attachmentCount = existingAttachmentsReference.current.length + uppyFiles.length;

  useEffect(() => {
    const uploadingStoragePaths = new Set(
      (uppyReference.current?.getFiles() ?? []).map((file) => getUploadStoragePath(file)).filter(Boolean),
    );

    existingAttachmentsReference.current = value.filter(
      (attachment) => !uploadingStoragePaths.has(attachment.storagePath),
    );
  }, [value]);

  useEffect(() => {
    onChangeReference.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onUploadStateChangeReference.current = onUploadStateChange;
  }, [onUploadStateChange]);

  useEffect(() => {
    const updateActiveUploadFile = (fileId: string, isActive: boolean) => {
      if (isActive) {
        activeUploadFileIdsReference.current.add(fileId);
      } else {
        activeUploadFileIdsReference.current.delete(fileId);
      }

      setActiveUploadFileIds([...activeUploadFileIdsReference.current]);
    };

    const syncFiles = () => {
      const files = uppyReference.current?.getFiles() ?? [];
      const completedAttachments = files.flatMap((file) => {
        const storagePath = getUploadStoragePath(file);

        return file.progress.uploadComplete && storagePath
          ? [
              {
                fileName: file.name,
                fileSize: file.size ?? 0,
                storagePath,
              },
            ]
          : [];
      });

      setUppyFiles(files);
      onChangeReference.current([...existingAttachmentsReference.current, ...completedAttachments]);
      onUploadStateChangeReference.current(files.some((file) => !file.progress.uploadComplete));
    };
    const uppy = new Uppy<Record<string, never>, UploadResponseBody>({
      allowMultipleUploadBatches: true,
      autoProceed: true,
      onBeforeFileAdded(currentFile, files) {
        const fileName = currentFile.name.toLowerCase();
        const isAllowedFile = fileName.endsWith('.7z') || fileName.endsWith('.zip');

        if (!isAllowedFile) {
          setErrorMessage('7z, zip 파일만 첨부할 수 있습니다.');
          return false;
        }

        if (existingAttachmentsReference.current.length + Object.keys(files).length >= MAX_FILE_COUNT) {
          setErrorMessage('첨부 파일은 최대 5개까지 등록할 수 있습니다.');
          return false;
        }

        const totalSize =
          existingAttachmentsReference.current.reduce((total, attachment) => total + attachment.fileSize, 0) +
          Object.values(files).reduce((total, file) => total + (file.size ?? 0), 0) +
          (currentFile.size ?? 0);

        if (totalSize > MAX_TOTAL_FILE_SIZE) {
          setErrorMessage('첨부 파일의 전체 용량은 10MB 이하만 가능합니다.');
          return false;
        }

        setErrorMessage('');
        return true;
      },
      restrictions: {
        allowedFileTypes: ['.7z', '.zip'],
        maxNumberOfFiles: MAX_FILE_COUNT,
      },
    }).use(AwsS3, {
      generateObjectKey: (file) => file.name,
      limit: 1,
      shouldUseMultipart: true,
      signRequest: async (request) => {
        const response = await fetch('/api/attachment/add/post/attachment/sign', {
          body: JSON.stringify({
            boardName,
            request,
            siteName,
          }),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });
        const result = (await response.json()) as {
          error?: string;
          headers?: Record<string, string>;
          key?: string;
          url?: string;
        };

        if (!response.ok || !result.url) {
          throw new Error(result.error ?? '파일 업로드를 준비하지 못했습니다.');
        }

        return {
          ...(result.headers ? { headers: result.headers } : {}),
          ...(result.key ? { key: result.key } : {}),
          url: result.url,
        };
      },
    });

    uppyReference.current = uppy;
    uppy.on('file-added', syncFiles);
    uppy.on('file-removed', (file) => {
      updateActiveUploadFile(file.id, false);
      syncFiles();
    });
    uppy.on('upload-start', syncFiles);
    uppy.on('upload-error', (file, error) => {
      if (file) {
        updateActiveUploadFile(file.id, false);
      }
      setErrorMessage(error.message || `${file?.name ?? '첨부'} 파일 업로드에 실패했습니다.`);
      syncFiles();
    });
    uppy.on('upload-pause', (file) => {
      if (file) {
        updateActiveUploadFile(file.id, false);
      }
      syncFiles();
    });
    uppy.on('upload-progress', (file) => {
      if (file) {
        updateActiveUploadFile(file.id, true);
      }
      syncFiles();
    });
    uppy.on('upload-retry', syncFiles);
    uppy.on('upload-success', (file) => {
      if (file) {
        updateActiveUploadFile(file.id, false);
      }
      syncFiles();
    });

    return () => {
      uppy.destroy();
      uppyReference.current = null;
    };
  }, [boardName, siteName]);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    const uppy = uppyReference.current;

    if (!uppy || files.length === 0) {
      event.currentTarget.value = '';
      return;
    }

    for (const file of files) {
      try {
        uppy.addFile({
          data: file,
          name: file.name,
          source: 'post-attachment',
          type: file.type,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Cannot add the file because onBeforeFileAdded returned false.'
        ) {
          continue;
        }

        setErrorMessage(error instanceof Error ? error.message : '파일을 추가하지 못했습니다.');
      }
    }

    event.currentTarget.value = '';
  }

  function handleRemoveExistingAttachment(storagePath: string) {
    setDeletingStoragePaths((currentPaths) => [...currentPaths, storagePath]);

    const nextAttachments = existingAttachmentsReference.current.filter(
      (attachment) => attachment.storagePath !== storagePath,
    );

    existingAttachmentsReference.current = nextAttachments;
    onChange(
      nextAttachments.concat(
        uppyFiles.flatMap((file) => {
          const uploadedPath = getUploadStoragePath(file);

          return file.progress.uploadComplete && uploadedPath
            ? [{ fileName: file.name, fileSize: file.size ?? 0, storagePath: uploadedPath }]
            : [];
        }),
      ),
    );
    setDeletingStoragePaths((currentPaths) => currentPaths.filter((path) => path !== storagePath));
  }

  async function handleRemoveUploadedFile(file: UppyFile<Record<string, never>, UploadResponseBody>) {
    const storagePath = getUploadStoragePath(file);

    if (!storagePath) {
      uppyReference.current?.removeFile(file.id);
      return;
    }

    setDeletingStoragePaths((currentPaths) => [...currentPaths, storagePath]);

    try {
      const response = await fetch('/api/attachment/delete/post/attachment', {
        body: JSON.stringify({ boardName, path: storagePath, siteName }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };

        setErrorMessage(result.error ?? '첨부 파일을 삭제하지 못했습니다.');
        return;
      }

      uppyReference.current?.removeFile(file.id);
    } finally {
      setDeletingStoragePaths((currentPaths) => currentPaths.filter((path) => path !== storagePath));
    }
  }

  return (
    <section className={styles['attachment-uploader']}>
      <h3>첨부 파일</h3>
      <div className={styles['attachment-uploader-header']}>
        <div className={styles['attachment-uploader-headline']}>
          <p>7z, zip 파일을 최대 5개, 전체 10MB까지 첨부할 수 있습니다.</p>
          {errorMessage ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}
        </div>
        <div className={styles['attachment-uploader-picker']}>
          <Button
            component="label"
            className="button small action"
            disabled={disabled || attachmentCount >= MAX_FILE_COUNT}
          >
            파일 첨부
            <VisuallyHiddenInput
              accept=".7z,.zip"
              disabled={disabled || attachmentCount >= MAX_FILE_COUNT}
              multiple
              onChange={handleFilesChange}
              type="file"
            />
          </Button>
          <span>첨부 {attachmentCount}/5</span>
        </div>
      </div>

      {attachmentCount > 0 ? (
        <ul className={`${styles['attachment-uploader-list']} paper`}>
          {existingAttachmentsReference.current.map((attachment) => {
            const isDeleting = deletingStoragePaths.includes(attachment.storagePath);
            return (
              <li
                key={attachment.storagePath}
                className={`${styles['attachment-uploader-item']} ${isDeleting ? styles['attachment-deleting'] : ''}`}
              >
                <div>
                  <strong>{attachment.fileName}</strong>
                  <span>{formatFileSize(attachment.fileSize)} · 업로드 완료</span>
                </div>
                <button
                  type="button"
                  className="button small default"
                  disabled={disabled || isDeleting}
                  onClick={() => handleRemoveExistingAttachment(attachment.storagePath)}
                >
                  {isDeleting ? '삭제중' : '삭제'}
                </button>
              </li>
            );
          })}
          {uppyFiles.map((file) => {
            const uploaded = typeof file.progress.bytesUploaded === 'number' ? file.progress.bytesUploaded : 0;
            const total = typeof file.progress.bytesTotal === 'number' ? file.progress.bytesTotal : (file.size ?? 0);
            const progress = total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0;
            const status = getFileStatus(file, activeUploadFileIds.includes(file.id));
            const isComplete = file.progress.uploadComplete === true;
            const fileErrorMessage = file.error;
            const storagePath = getUploadStoragePath(file);
            const isDeleting = Boolean(storagePath && deletingStoragePaths.includes(storagePath));
            return (
              <li
                key={file.id}
                className={`${styles['attachment-uploader-item']} ${isDeleting ? styles['attachment-deleting'] : ''}`}
              >
                <div className={styles['attachment-uploader-status']}>
                  <strong>{file.name}</strong>
                  <span className={fileErrorMessage ? styles['upload-error'] : undefined}>
                    {fileErrorMessage ? fileErrorMessage : status} · {formatFileSize(uploaded)} /{' '}
                    {formatFileSize(total)} ({progress}%)
                  </span>
                  <progress
                    max="100"
                    value={progress}
                    className={fileErrorMessage ? styles['upload-error'] : undefined}
                  />
                </div>
                <div className={styles['attachment-uploader-actions']}>
                  {!isComplete && status !== '업로드 실패' ? (
                    <button
                      type="button"
                      className="button small action"
                      disabled={disabled}
                      onClick={() => uppyReference.current?.pauseResume(file.id)}
                    >
                      {status === '일시 중지' ? '재개' : '일시 중지'}
                    </button>
                  ) : null}
                  {status === '업로드 실패' ? (
                    <button
                      type="button"
                      className="button small action"
                      disabled={disabled}
                      onClick={() => uppyReference.current?.retryUpload(file.id)}
                    >
                      {uploaded > 0 ? '재개' : '다시 시도'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button small danger"
                    disabled={disabled || isDeleting}
                    onClick={() => void handleRemoveUploadedFile(file)}
                  >
                    {isDeleting ? '삭제중' : '삭제'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
