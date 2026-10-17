'use client';

import { useState } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';
import styles from '@/app/footer.module.sass';

export default function HostingProviderInfo() {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <span className={styles['hosting-provider']}>
      <span>Vercel Inc. &amp; Supabase Inc.</span>
      <Tooltip
        arrow
        open={open}
        title={
          <>
            서울 리전을 사용합니다.
            <br />
            개인정보를 국외 이전하지 않습니다.
          </>
        }
        disableFocusListener
        disableHoverListener
        disableTouchListener
        onClose={close}
      >
        <button
          type="button"
          className={styles['hosting-provider-info']}
          aria-label="호스팅서비스 제공자 안내"
          aria-expanded={open}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setOpen(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') close();
          }}
          onClick={() => setOpen((previous) => !previous)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpen((previous) => !previous);
            }
          }}
        >
          <InfoOutlinedIcon />
        </button>
      </Tooltip>
    </span>
  );
}
