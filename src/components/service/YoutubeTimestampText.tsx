'use client';

import { Fragment } from 'react';
import styles from '@/app/youtube.module.sass';

type Props = {
  value: string;
  onTimestampClick: (seconds: number) => void;
};

const timestampPattern = /(^|[^\d:])(?:(\d+):)?([0-5]?\d):([0-5]\d)(?![\d:])/g;

export default function YoutubeTimestampText({ value, onTimestampClick }: Props) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = timestampPattern.exec(value)) !== null) {
    const prefix = match[1];
    const startIndex = match.index + prefix.length;
    const endIndex = match.index + match[0].length;
    const timestamp = value.slice(startIndex, endIndex);
    const hours = Number(match[2] ?? 0);
    const minutes = Number(match[3]);
    const seconds = Number(match[4]);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (startIndex > lastIndex) {
      parts.push(<Fragment key={`text-${lastIndex}`}>{value.slice(lastIndex, startIndex)}</Fragment>);
    }

    parts.push(
      <button
        type="button"
        key={`timestamp-${startIndex}`}
        className={styles['timestamp-link']}
        onClick={() => onTimestampClick(totalSeconds)}
      >
        {timestamp}
      </button>,
    );

    lastIndex = endIndex;
  }

  if (lastIndex < value.length) {
    parts.push(<Fragment key={`text-${lastIndex}`}>{value.slice(lastIndex)}</Fragment>);
  }

  return parts;
}
