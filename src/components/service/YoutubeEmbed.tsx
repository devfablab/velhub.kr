'use client';

import { useRef, useState } from 'react';
import YouTube, { type YouTubeEvent, type YouTubeProps } from 'react-youtube';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import styles from '@/app/youtube.module.sass';

type Props = {
  videoId: string;
  thumbnailImage?: string;
};

const youtubeOptions: YouTubeProps['opts'] = {
  width: '100%',
  height: '100%',
  playerVars: {
    autoplay: 0,
    cc_load_policy: 0,
    loop: 0,
    rel: 0,
    modestbranding: 1,
  },
};

export default function YoutubeEmbed({ videoId, thumbnailImage }: Props) {
  const playerReference = useRef<YouTubeEvent['target'] | null>(null);
  const [isThumbnailVisible, setIsThumbnailVisible] = useState(Boolean(thumbnailImage));

  function handleReady(event: YouTubeEvent) {
    playerReference.current = event.target;
  }

  function handlePlayButtonClick() {
    setIsThumbnailVisible(false);
    playerReference.current?.playVideo();
  }

  return (
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
  );
}
