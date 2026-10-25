'use client';

import { type ReactNode, useState } from 'react';
import { useParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import ScreenState from '@/components/service/ScreenState';
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

export type DashboardResponse = {
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
  return Number(value ?? 0).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <dl className={`paper ${styles.paper} ${styles.summary}`}>
      <dt>{label}</dt>
      <dd>
        {value} <span>명</span>
      </dd>
    </dl>
  );
}

function getPostHref(siteName: string, post: PopularPost) {
  if (!post.boardKey) {
    return null;
  }

  return `/${siteName}/${post.boardKey}/${post.slug}`;
}

type OptProps = { initialData: DashboardResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [errorMessage] = useState(initialError);
  const [dashboard] = useState<DashboardResponse | null>(initialData);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));

  if (!dashboard?.site || !dashboard.visits) {
    return (
      <Container pageTitle="통계" pageBack={`/${siteName}/manage`} menu="stats">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <ScreenState kind="error">{errorMessage || '통계 정보를 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog
              open={isErrorDialogOpen}
              onClose={() => setIsErrorDialogOpen(false)}
              title={errorMessage ? '통계' : null}
              messages={[errorMessage || '통계 정보를 불러오지 못했습니다.']}
            />
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
            <StatCard label="오늘 접속자 수" value={formatNumber(dashboard.visits.today)} />
            <StatCard label="일주일 접속자 수" value={formatNumber(dashboard.visits.week)} />
            <StatCard label="30일 접속자 수" value={formatNumber(dashboard.visits.month)} />
            <StatCard label="총 접속자 수" value={formatNumber(dashboard.visits.total)} />
          </div>

          {siteType === 'community' && dashboard.community ? (
            <>
              <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
                가입자수 통계
              </Typography>

              <div className={`paper ${styles['stack-paper']}`}>
                <dl className={`paper ${styles.paper} ${styles.summary}`}>
                  <dt>오늘 신규 가입자 수</dt>
                  <dd>
                    <p>
                      {formatNumber(dashboard.community.todayJoin.approved)} <span>명</span>
                    </p>
                    <p className={styles.sub}>
                      (비승인 {formatNumber(dashboard.community.todayJoin.unapproved)} 명 포함)
                    </p>
                  </dd>
                </dl>
                <StatCard label="일주일 가입자 수" value={formatNumber(dashboard.community.approvedJoin.week)} />
                <StatCard label="30일 가입자 수" value={formatNumber(dashboard.community.approvedJoin.month)} />
                <StatCard label="총 가입자 수" value={formatNumber(dashboard.community.approvedJoin.total)} />
              </div>
              <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
                비활동 유저 통계
              </Typography>

              <div className={`paper ${styles['stack-paper']}`}>
                <StatCard
                  label="일주일 전 마지막 접속 유저 수"
                  value={formatNumber(dashboard.community.inactiveMembers.week)}
                />
                <StatCard
                  label="30일 이전 마지막 접속 유저 수"
                  value={formatNumber(dashboard.community.inactiveMembers.month)}
                />
              </div>
            </>
          ) : null}

          {siteType === 'blog' && dashboard.blog ? (
            <>
              <dl className={`paper ${styles.paper} ${styles.summary}`}>
                <dt>재방문율</dt>
                <dd>
                  <p>
                    {formatPercent(dashboard.blog.revisit.rate)} <span>%</span>
                  </p>
                  <p className={styles.sub}>
                    (재방문 {formatNumber(dashboard.blog.revisit.revisitVisitors)} 명 / 전체
                    {formatNumber(dashboard.blog.revisit.totalVisitors)} 명)
                  </p>
                </dd>
              </dl>

              <div className={`paper ${styles['paper-table']}`}>
                <Typography variant="subtitle2">인기글 순위</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'center' }}>순위</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>글</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>조회수</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dashboard.blog.popularPosts.length > 0 ? (
                        dashboard.blog.popularPosts.map((post, index) => {
                          const href = getPostHref(siteName, post);
                          return (
                            <TableRow key={post.id}>
                              <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'center' }}>{index + 1}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {href ? <Anchor href={href}>{post.subject}</Anchor> : post.subject}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                                {formatNumber(post.postCount)} 회
                              </TableCell>
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
