'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Anchor from '@/components/Anchor';
import ReportButton from '@/components/service/common/ReportButton';
import styles from '@/app/header.module.sass';

type Props = {
  siteName: string;
  isBlog: boolean;
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
  privateBoard?: { label: string } | null;
  error?: string;
};

function getMenuHref(siteName: string, menu: MenuRow) {
  return `/${siteName}/${menu.slug}`;
}

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavMenu({ siteName, isBlog }: Props) {
  const pathname = usePathname();

  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [privateBoardLabel, setPrivateBoardLabel] = useState('');

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
          setPrivateBoardLabel('');
          return;
        }

        setMenus(Array.isArray(result.menus) ? result.menus : []);
        setPrivateBoardLabel(isBlog ? '' : (result.privateBoard?.label ?? ''));
      } catch {
        setMenus([]);
        setPrivateBoardLabel('');
      }
    }

    if (!siteName) {
      return;
    }

    void loadMenus();
  }, [isBlog, siteName]);

  const homeHref = `/${siteName}`;
  const isHomeCurrent = pathname === homeHref;

  const allHref = `/${siteName}/board`;
  const isAllHrefCurrent = pathname === allHref || pathname.startsWith(`${allHref}/`);
  const hasCommunityBoard = menus.some((menu) => menu.board_type !== 'page');
  const privateBoardHref = `/${siteName}/private`;
  const isPrivateBoardCurrent = isCurrentPath(pathname, privateBoardHref);

  const infoHref = `/${siteName}/info-blog`;
  const isInfoBlogHrefCurrent = pathname === infoHref;

  const categoryHref = `/${siteName}/c`;
  const isCategoryHrefCurrent = pathname === categoryHref || pathname.startsWith(`${categoryHref}/`);

  const seriesHref = `/${siteName}/s`;
  const isSeriesHrefCurrent = pathname === seriesHref || pathname.startsWith(`${seriesHref}/`);

  return (
    <div className={styles.navigationbar}>
      <nav>
        <ol>
          <li className={isHomeCurrent ? styles.current : undefined} aria-current={isHomeCurrent ? 'page' : false}>
            <Anchor href={homeHref}>
              <span>홈</span>
              <i />
            </Anchor>
          </li>

          {isBlog ? (
            <>
              <li
                className={isInfoBlogHrefCurrent ? styles.current : undefined}
                aria-current={isInfoBlogHrefCurrent ? 'page' : false}
              >
                <Anchor href={infoHref}>
                  <span>블로그 소개</span>
                  <i />
                </Anchor>
              </li>
              <li
                className={isCategoryHrefCurrent ? styles.current : undefined}
                aria-current={isCategoryHrefCurrent ? 'page' : false}
              >
                <Anchor href={categoryHref}>
                  <span>카테고리</span>
                  <i />
                </Anchor>
              </li>
              <li
                className={isSeriesHrefCurrent ? styles.current : undefined}
                aria-current={isSeriesHrefCurrent ? 'page' : false}
              >
                <Anchor href={seriesHref}>
                  <span>연재</span>
                  <i />
                </Anchor>
              </li>
            </>
          ) : hasCommunityBoard ? (
            <li
              className={isAllHrefCurrent ? styles.current : undefined}
              aria-current={isAllHrefCurrent ? 'page' : false}
            >
              <Anchor href={allHref}>
                <span>게시판</span>
                <i />
              </Anchor>
            </li>
          ) : null}

          {menus.map((menu) => {
            const href = getMenuHref(siteName, menu);
            const isCurrent = isCurrentPath(pathname, href);

            return (
              <li
                key={menu.id}
                className={isCurrent ? styles.current : undefined}
                aria-current={isCurrent ? 'page' : false}
              >
                <Anchor href={href}>
                  <span>{menu.display_label}</span>
                  <i />
                </Anchor>
              </li>
            );
          })}
          {!isBlog && privateBoardLabel ? (
            <li
              className={isPrivateBoardCurrent ? styles.current : undefined}
              aria-current={isPrivateBoardCurrent ? 'page' : false}
            >
              <Anchor href={privateBoardHref}>
                <span>{privateBoardLabel}</span>
                <i />
              </Anchor>
            </li>
          ) : null}
          <li>
            <ReportButton targetType="site" siteName={siteName} />
          </li>
        </ol>
      </nav>
    </div>
  );
}
