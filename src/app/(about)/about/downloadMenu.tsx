'use client';

import { useState } from 'react';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { Menu, MenuItem } from '@mui/material';
import Anchor from '@/components/Anchor';
import styles from '@/app/about.module.sass';

const brochures = [
  { href: '/velhub_branding.pdf', fileName: '데브허브 광고 제휴 소개서.pdf', label: '광고 제휴 소개서' },
  { href: '/velhub_partnership.pdf', fileName: '데브허브 기술 제휴 소개서.pdf', label: '기술 제휴 소개서' },
];

export default function DownloadMenu() {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

  function handleClose() {
    setAnchorElement(null);
  }

  return (
    <>
      <button
        type="button"
        className={styles['button-download']}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorElement)}
        onClick={(event) => setAnchorElement(event.currentTarget)}
      >
        서비스 소개서 내려받기
      </button>
      <Menu
        anchorEl={anchorElement}
        open={Boolean(anchorElement)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        className={styles['download-menu']}
      >
        {brochures.map((brochure) => (
          <MenuItem key={brochure.href} onClick={handleClose}>
            <Anchor href={brochure.href} download={brochure.fileName}>
              <DescriptionOutlinedIcon fontSize="small" />
              <span>{brochure.label}</span>
            </Anchor>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
