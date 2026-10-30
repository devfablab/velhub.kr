import Anchor from '@/components/Anchor';
import styles from '@/app/concierge.module.sass';

export type ConciergeFileItem = {
  id?: string;
  name: string;
  size?: number | null;
  href?: string | null;
};

function formatFileSize(size: number) {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export default function ConciergeFileList({
  files,
  onRemove,
  downloadLabel = '파일 내려받기',
}: {
  files: ConciergeFileItem[];
  onRemove?: (index: number) => void;
  downloadLabel?: string;
}) {
  if (files.length === 0) return null;

  return (
    <ul className={`${styles['concierge-file-list']} paper`}>
      {files.map((file, index) => (
        <li key={file.id ?? `${file.name}-${file.size ?? ''}-${index}`}>
          {file.href ? (
            <Anchor href={file.href} download={file.name} className={styles['concierge-file-link']}>
              <strong>{file.name}</strong>
              {typeof file.size === 'number' ? <span>{formatFileSize(file.size)}</span> : null}
            </Anchor>
          ) : (
            <div className={styles['concierge-file-link']}>
              <strong>{file.name}</strong>
              {typeof file.size === 'number' ? <span>{formatFileSize(file.size)}</span> : null}
            </div>
          )}
          <div className={styles['concierge-file-actions']}>
            {file.href ? (
              <Anchor href={file.href} download={file.name} className="button small action">
                {downloadLabel}
              </Anchor>
            ) : null}
            {onRemove ? (
              <button type="button" className="button small danger" onClick={() => onRemove(index)}>
                파일 삭제
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
