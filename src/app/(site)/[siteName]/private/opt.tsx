'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Chip, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PostCountTableList from '@/components/service/community/PostCountTableList';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import TableListMobile from '@/components/service/community/TableListMobile';
import UserInfo from '@/components/service/community/UserInfo';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/board.module.sass';

type Filter = 'all' | 'unanswered' | 'answered';
type Post = {
  id: string;
  categoryLabel: string;
  subject: string;
  authorName: string;
  hasAnswer: boolean;
  createdAt: string;
};
type Response = { board?: { board_label: string }; isStaff?: boolean; posts?: Post[]; total?: number; error?: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(value),
  );
}

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<Response>({});
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isNotTablet = useMediaQuery(theme.breakpoints.up('xl'));
  const isMobile = !isNotMobile;
  const isTablet = !isNotTablet;

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const response = await fetch(`/api/private-board?siteName=${siteName}&filter=${filter}&page=${page}`, {
        credentials: 'include',
      });
      const result = (await response.json()) as Response;

      if (response.status === 401) {
        router.replace(`/auth/sign-in?next=/${siteName}/private`);
        return;
      }

      setData(result);
      setIsLoading(false);
    }

    void load();
  }, [filter, page, router, siteName]);

  if (isLoading)
    return (
      <div className="container">
        <div className={`${styles.content} content`}>
          <h2>
            <LockOutlinedIcon />
            <span>비공개 게시판</span>
          </h2>
          <div className="paper">
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        </div>
      </div>
    );
  if (data.error)
    return (
      <div className="container">
        <div className={`${styles.content} content`}>
          <h2>
            <LockOutlinedIcon />
            <span>비공개 게시판</span>
          </h2>
          <div className="paper page-error">{data.error}</div>
        </div>
      </div>
    );

  const totalPages = Math.max(1, Math.ceil((data.total ?? 0) / 20));

  return (
    <div className="container">
      {!isMobile ? (
        <aside>
          <SiteInfo />
          <TableList writeHref={`/${siteName}/private/new`} />
        </aside>
      ) : null}
      <div
        className={`${styles.content} content`}
        style={{
          flex: isMobile ? 'none' : '1 0',
          maxWidth: isMobile ? 992 : 'none',
          width: isMobile ? '100%' : 'auto',
        }}
      >
        {isMobile ? <TableListMobile isCommunity writeHref={`/${siteName}/private/new`} /> : null}
        <h2>
          <LockOutlinedIcon />
          <span>{data.board?.board_label}</span>
        </h2>
        <Stack gap={3}>
          {data.isStaff ? (
            <Stack direction="row" gap={1}>
              {(
                [
                  ['all', '전체'],
                  ['unanswered', '미답변'],
                  ['answered', '답변'],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={`button small ${filter === value ? 'submit' : 'action'}`}
                  onClick={() => {
                    setFilter(value);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </Stack>
          ) : null}
          <div className={styles['privates']}>
            {(data.posts ?? []).map((post) => (
              <Anchor key={post.id} href={`/${siteName}/private/${post.id}`} className="paper">
                <div>
                  <Chip label={post.categoryLabel} size="small" />
                </div>
                <Typography variant="subtitle2">{post.subject}</Typography>
                <Typography variant="body2">
                  {post.authorName} / {post.hasAnswer ? '답변 존재' : '답변 없음'} / {formatDate(post.createdAt)}
                </Typography>
              </Anchor>
            ))}
            {(data.posts ?? []).length === 0 ? <ScreenState>등록된 글이 없습니다.</ScreenState> : null}
          </div>
          {totalPages > 1 ? (
            <Stack direction="row" justifyContent="center" gap={1}>
              <button
                type="button"
                className="button small action"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                이전
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="button small action"
                disabled={page === totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                다음
              </button>
            </Stack>
          ) : null}
        </Stack>
        {isMobile ? (
          <Stack direction="row" gap={1} justifyContent="space-between" sx={{ pt: 3 }}>
            <SiteInfo />
            <UserInfo />
          </Stack>
        ) : null}
      </div>
      {!isTablet ? (
        <aside>
          <UserInfo />
          <PostCountTableList />
        </aside>
      ) : null}
    </div>
  );
}
