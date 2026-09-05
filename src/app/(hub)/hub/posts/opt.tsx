/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/hub.module.sass';

type Post = {
  id: string;
  subject: string;
  url: string;
  siteLabel: string;
  seriesLabel: string;
  publishedAt: string | null;
};
type Response = { posts: Post[]; total: number; page: number };

function openPost(url: string) {
  window.open(
    url,
    'creator-post',
    [
      'popup=yes',
      'width=960',
      'height=760',
      'left=80',
      'top=80',
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
    ].join(','),
  );
}

export default function Opt() {
  const [data, setData] = useState<Response | null>(null);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');

  const load = useCallback(async (nextPage: number) => {
    setMessage('');
    const response = await fetch(`/api/hub/posts?page=${nextPage}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? '내가 쓴 글을 불러오지 못했습니다.');
    setData(payload);
  }, []);

  useEffect(() => {
    load(page).catch((error) =>
      setMessage(error instanceof Error ? error.message : '내가 쓴 글을 불러오지 못했습니다.'),
    );
  }, [load, page]);

  if (message)
    return <ScreenState kind="error">{message}</ScreenState>;
  if (!data) return null;

  const totalPages = Math.ceil(data.total / 20);

  return (
    <section className={`paper ${styles.paper} ${styles.reports}`}>
      <div className={styles.headline}>
        <h2>내가 쓴 글</h2>
      </div>
      {data.posts.length ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>연재</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>제목</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>사이트</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>게시일</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell>{post.seriesLabel}</TableCell>
                <TableCell>
                  <button type="button" className="button small action" onClick={() => openPost(post.url)}>
                    {post.subject}
                  </button>
                </TableCell>
                <TableCell>{post.siteLabel}</TableCell>
                <TableCell>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ScreenState>작성한 글이 없습니다.</ScreenState>
      )}

      {totalPages > 1 ? (
        <Stack direction="row" justifyContent="center" gap={1}>
          <button
            type="button"
            className="button small action"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            이전
          </button>
          <Typography variant="body2">
            {page} / {totalPages}
          </Typography>
          <button
            type="button"
            className="button small action"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            다음
          </button>
        </Stack>
      ) : null}
    </section>
  );
}
