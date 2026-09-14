'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import YouTube, { type YouTubeEvent, type YouTubeProps } from 'react-youtube';
import { ServiceTimelineIcon } from '../Svgs';
import styles from '@/app/youtube.module.sass';

type Props = {
  videoId: string;
  thumbnailImage?: string;
  onTimestampAdd?: (seconds: number) => void;
};

export type YoutubePlayerHandle = {
  getCurrentTime: () => number | null;
};

const youtubeOptions: YouTubeProps['opts'] = {
  width: '100%',
  height: '100%',
  playerVars: {
    autoplay: 0,
    loop: 0,
    rel: 0,
    modestbranding: 1,
  },
};

const YoutubeEmbed = forwardRef<YoutubePlayerHandle, Props>(function YoutubeEmbed(
  { videoId, thumbnailImage, onTimestampAdd },
  reference,
) {
  const playerReference = useRef<YouTubeEvent['target'] | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isThumbnailVisible, setIsThumbnailVisible] = useState(Boolean(thumbnailImage));

  function handleReady(event: YouTubeEvent) {
    playerReference.current = event.target;
    setIsPlayerReady(true);
  }

  function handlePlayButtonClick() {
    setIsThumbnailVisible(false);
    playerReference.current?.playVideo();
  }

  function handleTimestampAdd() {
    const currentTime = getCurrentTime();

    if (typeof currentTime === 'number') {
      onTimestampAdd?.(Math.floor(currentTime));
    }
  }

  function getCurrentTime() {
    const currentTime = playerReference.current?.getCurrentTime();

    return typeof currentTime === 'number' ? Math.floor(currentTime) : null;
  }

  useImperativeHandle(reference, () => ({ getCurrentTime }));

  return (
    <>
      <div className={styles['youtube-embed']}>
        {thumbnailImage && isThumbnailVisible ? (
          <div className={styles.thumbnail}>
            <img src={thumbnailImage} alt="" />
            <button type="button" aria-label="영상 재생하기" onClick={handlePlayButtonClick}>
              <span>
                <PlayArrowRoundedIcon />
              </span>
            </button>
          </div>
        ) : null}

        <div className={styles.player}>
          <YouTube videoId={videoId} opts={youtubeOptions} onReady={handleReady} />
        </div>
      </div>

      {onTimestampAdd ? (
        <div>
          <button
            type="button"
            className={`button small action ${styles['timestamp-button']}`}
            disabled={!isPlayerReady}
            onClick={handleTimestampAdd}
          >
            <ServiceTimelineIcon />
            <span>타임스템프 추가</span>
          </button>
        </div>
      ) : null}
    </>
  );
});

export default YoutubeEmbed;
