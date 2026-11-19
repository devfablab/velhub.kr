'use client';

import type { ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { Box, Chip, Pagination, useMediaQuery, useTheme } from '@mui/material';
import type { OnePickListType, OnePickSiteCard } from '@/lib/service/lounge/loungeMoments';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/customUI/AppIconAvatar';
import OptimizedImage from '@/components/OptimizedImage';
import styles from '@/app/page.module.sass';

type Props = {
  type: OnePickListType;
  sites: OnePickSiteCard[];
  page: number;
  pageCount: number;
};

function SiteTail({ site }: { site: OnePickSiteCard }) {
  return (
    <>
      <AppIconAvatar site={site.site_type} src={site.profile_picture || null} alt="" size={24} />
      <strong>{site.site_label}</strong>
      {site.latest_published_at ? (
        <>
          <ScheduleRoundedIcon />
          <time>{formatTimeAgo(site.latest_published_at)}</time>
        </>
      ) : null}
    </>
  );
}

function SiteThumbnail({ site }: { site: OnePickSiteCard }) {
  return site.promotion_image ? (
    <div className={styles.thumbnail}>
      <OptimizedImage src={site.promotion_image} sizes="172px" />
    </div>
  ) : null;
}

export default function OnePickList({ type, sites, page, pageCount }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('lg'));

  function handlePageChange(_event: ChangeEvent<unknown>, nextPage: number) {
    router.push(`/lounge/moments/all?type=${type}${nextPage > 1 ? `&page=${nextPage}` : ''}`);
  }

  return (
    <>
      {sites.length ? (
        <div className={`${styles.list} ${styles['list-newest']}`}>
          {sites.map((site) => (
            <div key={site.site_key} className={`paper ${styles.item}`}>
              <Anchor href={site.site_url}>
                {isMobile ? (
                  <div className={`${styles['description-item']} ${styles['description-item-mini']}`}>
                    <div className={styles.description}>
                      <Box sx={{ mb: 1 }}>
                        <Chip
                          label={site.site_type === 'blog' ? '블로그' : '커뮤니티'}
                          size="small"
                          className="chip success"
                        />
                      </Box>
                      <div className={styles.info}>
                        <strong>{site.site_label}</strong>
                        <p>{site.summary}</p>
                      </div>
                      <div className={styles.tail}>
                        <div className={styles['tail-site']}>
                          <SiteTail site={site} />
                        </div>
                      </div>
                    </div>
                    <SiteThumbnail site={site} />
                  </div>
                ) : (
                  <>
                    <div className={styles['description-item']}>
                      <div className={styles.description}>
                        <Box sx={{ mb: 1 }}>
                          <Chip
                            label={site.site_type === 'blog' ? '블로그' : '커뮤니티'}
                            size="small"
                            className="chip success"
                          />
                        </Box>
                        <div className={styles.info}>
                          <strong>{site.site_label}</strong>
                          <p>{site.summary}</p>
                        </div>
                      </div>
                      <SiteThumbnail site={site} />
                    </div>
                    <div className={styles.tail}>
                      <div className={styles['tail-container']}>
                        <SiteTail site={site} />
                      </div>
                    </div>
                  </>
                )}
              </Anchor>
            </div>
          ))}
        </div>
      ) : null}
      {pageCount > 1 ? (
        <div className={styles['one-pick-pagination']}>
          <Pagination
            page={page}
            count={pageCount}
            className="pagination"
            siblingCount={1}
            boundaryCount={1}
            size="small"
            onChange={handlePageChange}
          />
        </div>
      ) : null}
    </>
  );
}
