'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';

type Props = {
  onTimestampAdd?: (timestamp: string) => void;
  validationResult: ValidationResult | null;
};

function formatTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(remainingSeconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${formattedMinutes}:${formattedSeconds}` : `${formattedMinutes}:${formattedSeconds}`;
}

export type ValidationResult = {
  status: 'available' | 'empty' | 'unavailable';
  videoId?: string;
};

export async function validateYoutubeVideo(videoId: string): Promise<ValidationResult> {
  if (!videoId) return { status: 'unavailable' };
  try {
    const response = await fetch(`/api/youtube/${encodeURIComponent(videoId)}`);
    const result = (await response.json()) as { exists?: boolean };
    return { status: result.exists === true ? 'available' : 'unavailable', videoId };
  } catch {
    return { status: 'unavailable' };
  }
}

export default function YoutubePreview({ onTimestampAdd, validationResult }: Props) {
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
