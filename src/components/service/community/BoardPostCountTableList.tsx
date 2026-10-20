'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/aside.module.sass';

type BoardPostCountItem = {
  id: string;
  slug: string;
  subject: string;
  board_key: string;
  post_count: number;
  comment_count: number;
};

type BoardItem = {
  board_label: string;
};

export type BoardPostCountResponse = {
  contents?: BoardPostCountItem[];
  board: BoardItem;
  error?: string;
};

export default function BoardPostCountTableList({ initialData }: { initialData?: BoardPostCountResponse | null }) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);
  const [data, setData] = useState(initialData);
  const contents = data?.contents ?? [];
  const boards = data?.board;

  useEffect(() => {
    if (!siteName || !boardName || contents.length > 0) {
      return;
    }

    void fetch(
      `/api/boards/${encodeURIComponent(boardName)}?siteName=${encodeURIComponent(siteName)}&page=1&size=10&sort=post_count&includePin=false`,
      { credentials: 'include' },
    )
      .then(async (response) => (response.ok ? ((await response.json()) as BoardPostCountResponse) : null))
      .then((nextData) => {
        if (nextData) {
          setData(nextData);
        }
      })
      .catch(() => undefined);
  }, [boardName, contents.length, siteName]);

  return (
    <div className={`${styles['post-count-list']} paper`}>
      <strong>{boards?.board_label} 인기글</strong>

      {contents.length > 0 ? (
        <ol>
          {contents.map((content) => (
            <li key={content.id}>
              <Anchor href={`/${siteName}/${content.board_key}/${content.slug}`} data-count={content.post_count}>
                {content.subject}
              </Anchor>
              {content.comment_count > 0 ? <em>({content.comment_count.toLocaleString()})</em> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p>인기글이 없습니다.</p>
      )}
    </div>
  );
}
