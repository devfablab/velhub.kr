'use client';

import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { useMediaQuery, useTheme } from '@mui/material';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import SiteProfile from '@/components/service/blog/SiteProfile';
import PostCountTableList from '@/components/service/community/PostCountTableList';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import UserInfo from '@/components/service/community/UserInfo';
import { ServiceNoDataIcon } from '@/components/Svgs';
import styles from '@/app/board.module.sass';

export type SeriesItem = {
  id: string;
  series_key: string;
  series_label: string;
  summary: string | null;
  imageUrl: string;
  last_published_at: string | null;
  is_completed: boolean;
};

type Props = {
  siteName: string;
  isCommunity: boolean;
  rows: SeriesItem[];
};

export default function Opt({ siteName, isCommunity, rows }: Props) {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isNotTablet = useMediaQuery(theme.breakpoints.up('xl'));
  const isMobile = !isNotMobile;
  const isTablet = !isNotTablet;
  return (
    <div className="container">
      {isCommunity && !isMobile ? (
        <aside>
          <SiteInfo />
          <TableList />
        </aside>
      ) : null}
      <div className={`content ${styles['blog-list']} ${styles.content}`}>
        {isCommunity ? (
          <h2>
            <LibraryBooksOutlinedIcon fontSize="small" />
            <span>연재</span>
          </h2>
        ) : (
          <SiteProfile />
        )}
        <div className="paper">
          {rows.length > 0 ? (
            <div className={`${styles['series-items']} ${styles['blog-items']}`}>
              {rows.map((item) => (
                <Anchor href={`/${siteName}/s/${item.series_key}`} key={item.id}>
                  <div className={styles.thumbnail}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" />
                    ) : (
                      <div className={styles.dummy}>
                        <MenuBookRoundedIcon />
                      </div>
                    )}
                  </div>
                  <div className={styles.info}>
                    <strong>{item.series_label}</strong>
                    {item.is_completed ? <em>완결</em> : null}
                    {item.summary ? <p>{item.summary}</p> : null}
                    {item.last_published_at ? <time>{formatTimeAgo(item.last_published_at)}</time> : null}
                  </div>
                </Anchor>
              ))}
            </div>
          ) : (
            <div className="paper page-info">
              <ServiceNoDataIcon />
              <p>연재물이 없습니다. 😭</p>
            </div>
          )}
        </div>
      </div>
      {isCommunity && !isTablet ? (
        <aside>
          <UserInfo />
          <PostCountTableList />
        </aside>
      ) : null}
    </div>
  );
}
