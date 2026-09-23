'use client';

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
  const contents = initialData?.contents ?? [];
  const boards = initialData?.board;

  if (contents.length === 0) {
    return null;
  }

  return (
    <div className={`${styles['post-count-list']} paper`}>
      <strong>{boards?.board_label} 인기글</strong>

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
    </div>
  );
}
