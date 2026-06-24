'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type SiteType = 'blog' | 'community';

type PopularPost = {
  id: string;
  slug: string;
  subject: string;
  postCount: number;
  publishedAt: string | null;
  boardKey: string | null;
  boardLabel: string | null;
};

type DashboardResponse = {
  site?: {
    siteName: string;
    siteLabel: string | null;
    siteType: SiteType;
  };
  visits?: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  community?: {
    todayJoin: {
      approved: number;
      unapproved: number;
      total: number;
    };
    approvedJoin: {
      week: number;
      month: number;
      total: number;
    };
    inactiveMembers: {
      week: number;
      month: number;
    };
  } | null;
  blog?: {
    popularPosts: PopularPost[];
    revisit: {
      totalVisitors: number;
      revisitVisitors: number;
      rate: number;
    };
  } | null;
  error?: string;
};

type StatCardProps = {
  label: string;
  value: ReactNode;
  description?: string;
};

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className={`paper ${styles.paper}`}>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="body2" sx={{ textAlign: 'right' }}>
        {value}
      </Typography>
      {description ? <Typography variant="body2">{description}</Typography> : null}
    </div>
  );
}

function getPostHref(siteName: string, post: PopularPost) {
  if (!post.boardKey) {
    return null;
  }

  return `/${siteName}/${post.boardKey}/${post.slug}`;
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/manage/stats/dashboard?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as DashboardResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '통계 정보를 불러오지 못했습니다.');
        }

        setDashboard(result);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '통계 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('통계 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadDashboard();
  }, [siteName]);

  if (isLoading) {
    return (
      <Container pageTitle="통계" pageBack={`/${siteName}/manage`}>
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (errorMessage || !dashboard?.site || !dashboard.visits) {
    return (
      <Container pageTitle="통계" pageBack={`/${siteName}/manage`}>
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <div className={`paper paper-error ${styles.paper}`}>
              {errorMessage || '통계 정보를 불러오지 못했습니다.'}
            </div>
          </div>
        </div>
      </Container>
    );
  }

  const siteType = dashboard.site.siteType;

  return (
    <Container pageTitle="통계" pageBack={`/${siteName}/manage`} menu="stats">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
            접속자수 통계
          </Typography>
          <div className={`paper ${styles['stack-paper']}`}>
            <StatCard label="오늘 접속자 수" value={`${formatNumber(dashboard.visits.today)} 명`} />
            <StatCard label="일주일간 접속자 수" value={`${formatNumber(dashboard.visits.week)} 명`} />
            <StatCard label="30일간 접속자 수" value={`${formatNumber(dashboard.visits.month)} 명`} />
            <StatCard label="총 접속자 수" value={`${formatNumber(dashboard.visits.total)} 명`} />
          </div>

          {siteType === 'community' && dashboard.community ? (
            <>
              <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
                가입자수 통계
              </Typography>

              <div className={`paper ${styles['stack-paper']}`}>
                <div className={`paper ${styles.paper}`}>
                  <Typography variant="subtitle2">오늘 신규 가입자 수</Typography>
                  <Typography variant="body2">
                    {formatNumber(dashboard.community.todayJoin.approved)} 명 (비승인{' '}
                    {formatNumber(dashboard.community.todayJoin.unapproved)} 명 포함)
                  </Typography>
                </div>
                <StatCard
                  label="일주일간 가입자 수"
                  value={`${formatNumber(dashboard.community.approvedJoin.week)}명`}
                />
                <StatCard
                  label="30일간 가입자 수"
                  value={`${formatNumber(dashboard.community.approvedJoin.month)}명`}
                />
                <StatCard label="총 가입자 수" value={`${formatNumber(dashboard.community.approvedJoin.total)}명`} />
              </div>
              <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
                비활동 유저 통계
              </Typography>

              <div className={`paper ${styles['stack-paper']}`}>
                <StatCard
                  label="마지막 접속일 일주일 전 유저 수"
                  value={`${formatNumber(dashboard.community.inactiveMembers.week)}명`}
                />
                <StatCard
                  label="마지막 접속일 30일 이전 유저 수"
                  value={`${formatNumber(dashboard.community.inactiveMembers.month)}명`}
                />
              </div>
            </>
          ) : null}

          {siteType === 'blog' && dashboard.blog ? (
            <>
              <div className={`paper ${styles.paper}`}>
                <Typography variant="subtitle2">재방문율</Typography>
                <Typography variant="body2">
                  {formatPercent(dashboard.blog.revisit.rate)} (재방문{' '}
                  {formatNumber(dashboard.blog.revisit.revisitVisitors)} 명 / 전체
                  {formatNumber(dashboard.blog.revisit.totalVisitors)} 명)
                </Typography>
              </div>

              <div className={`paper ${styles['paper-table']}`}>
                <Typography variant="subtitle2">인기글 순위</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>순위</TableCell>
                        <TableCell>글</TableCell>
                        <TableCell align="right">조회수</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dashboard.blog.popularPosts.length > 0 ? (
                        dashboard.blog.popularPosts.map((post, index) => {
                          const href = getPostHref(siteName, post);
                          return (
                            <TableRow key={post.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{href ? <Anchor href={href}>{post.subject}</Anchor> : post.subject}</TableCell>
                              <TableCell align="right">{formatNumber(post.postCount)}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3}>인기글 정보가 없습니다.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
