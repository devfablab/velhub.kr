'use client';

import { useEffect, useState } from 'react';
import { MenuItem } from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import LightOutlinedIcon from '@mui/icons-material/LightOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import InterestsRoundedIcon from '@mui/icons-material/InterestsRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import Anchor from '@/components/Anchor';

type Props = {
  siteName: string;
  isBlog: boolean;
  onClose: () => void;
};

type MenuRow = {
  id: string;
  board_type: string;
  board_label: string;
  slug: string;
  display_label: string;
  sort_order: number;
  is_renameable: boolean;
};

type MenuResponse = {
  menus?: MenuRow[];
  error?: string;
};

type BoardItem = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'blog' | 'page' | 'basic' | 'gallery' | 'youtube' | 'feed';
  is_active: boolean;
};

function getMenuHref(siteName: string, menu: MenuRow) {
  return `/${siteName}/${menu.slug}`;
}

function renderBoardTypeIcon(boardType: BoardItem['board_type']) {
  if (boardType === 'gallery') {
    return <CollectionsOutlinedIcon sx={{ width: 16, height: 16 }} />;
  }

  if (boardType === 'youtube') {
    return <OndemandVideoOutlinedIcon sx={{ width: 16, height: 16 }} />;
  }

  if (boardType === 'feed') {
    return <DynamicFeedOutlinedIcon sx={{ width: 16, height: 16 }} />;
  }

  return <FormatListNumberedOutlinedIcon sx={{ width: 16, height: 16 }} />;
}

export default function DrawerMenu({ siteName, isBlog, onClose }: Props) {
  const [menus, setMenus] = useState<MenuRow[]>([]);

  useEffect(() => {
    async function loadMenus() {
      try {
        const response = await fetch(`/api/site/public?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as MenuResponse;

        if (!response.ok) {
          setMenus([]);
          return;
        }

        setMenus(Array.isArray(result.menus) ? result.menus : []);
      } catch {
        setMenus([]);
      }
    }

    if (!siteName) {
      return;
    }

    void loadMenus();
  }, [siteName]);

  const allHref = `/${siteName}/board`;
  const infoHref = `/${siteName}/info-blog`;
  const categoryHref = `/${siteName}/c`;
  const seriesHref = `/${siteName}/s`;

  return (
    <>
      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}`}>
          {isBlog ? <MenuBookRoundedIcon fontSize="small" /> : <InterestsRoundedIcon fontSize="small" />}
          <span>{isBlog ? '블로그' : '커뮤니티'} 홈</span>
        </Anchor>
      </MenuItem>

      {isBlog ? (
        <>
          <MenuItem onClick={onClose}>
            <Anchor href={infoHref}>
              <LightOutlinedIcon fontSize="small" />
              <span>블로그 소개</span>
            </Anchor>
          </MenuItem>
          <MenuItem onClick={onClose}>
            <Anchor href={categoryHref}>
              <CategoryOutlinedIcon fontSize="small" />
              <span>카테고리</span>
            </Anchor>
          </MenuItem>
          <MenuItem onClick={onClose}>
            <Anchor href={seriesHref}>
              <LibraryBooksOutlinedIcon fontSize="small" />
              <span>연재</span>
            </Anchor>
          </MenuItem>
        </>
      ) : (
        <MenuItem onClick={onClose}>
          <Anchor href={allHref}>
            <ListAltOutlinedIcon fontSize="small" />
            <span>게시판</span>
          </Anchor>
        </MenuItem>
      )}

      {menus.map((menu) => {
        const href = getMenuHref(siteName, menu);

        return (
          <MenuItem onClick={onClose} key={menu.id}>
            <Anchor href={href}>
              {renderBoardTypeIcon(menu.board_type)}
              <span>{menu.display_label}</span>
            </Anchor>
          </MenuItem>
        );
      })}
    </>
  );
}
