'use client';

import { useEffect, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';

type Props = {
  onTimestampAdd?: (timestamp: string) => void;
  videoId: string;
  value: string;
};

function formatTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(remainingSeconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${formattedMinutes}:${formattedSeconds}` : `${formattedMinutes}:${formattedSeconds}`;
}

type ValidationResult = {
  status: 'available' | 'empty' | 'unavailable';
  videoId?: string;
};

export default function YoutubePreview({ onTimestampAdd, videoId, value }: Props) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      const timeoutId = window.setTimeout(() => setValidationResult({ status: 'empty' }), 3000);

      return () => window.clearTimeout(timeoutId);
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      if (!videoId) {
        if (!isCancelled) {
          setValidationResult({ status: 'unavailable' });
        }
        return;
      }

      try {
        const response = await fetch(`/api/youtube/${encodeURIComponent(videoId)}`);
        const result = (await response.json()) as { exists?: boolean };

        if (!isCancelled) {
          setValidationResult({ status: result.exists === true ? 'available' : 'unavailable', videoId });
        }
      } catch {
        if (!isCancelled) {
          setValidationResult({ status: 'unavailable' });
        }
      }
    }, 3000);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [value, videoId]);

  if (!validationResult || validationResult.status === 'empty') {
    return null;
  }

  if (validationResult.status === 'unavailable') {
    return (
      <p className="alert error">
        <ErrorOutlineRoundedIcon />
        <span>존재하지 않는 영상입니다. 주소를 확인해 주세요.</span>
      </p>
    );
  }

  return (
    <YoutubeEmbed
      videoId={validationResult.videoId ?? ''}
      onTimestampAdd={onTimestampAdd ? (seconds) => onTimestampAdd(formatTimestamp(seconds)) : undefined}
    />
  );
}
