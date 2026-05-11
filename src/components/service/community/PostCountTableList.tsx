'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Anchor from '@/components/Anchor';
import { normalizeText } from '@/lib/utils';
import styles from '@/app/aside.module.sass';

type PostCountItem = {
  id: string;
  slug: string;
  subject: string;
  board_key: string;
  post_count: number;
  comment_count: number;
};

type PostCountResponse = {
  contents?: PostCountItem[];
  error?: string;
};

export default function PostCountTableList() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [contents, setContents] = useState<PostCountItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadContents() {
      try {
        setErrorMessage('');

        const response = await fetch(
          `/api/boards/all?siteName=${siteName}&page=1&size=10&sort=post_count&includePin=false`,
          {
            method: 'GET',
            credentials: 'include',
          },
        );

        const result = (await response.json()) as PostCountResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '게시글 목록을 불러오지 못했습니다.');
        }

        setContents(Array.isArray(result.contents) ? result.contents : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시글 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시글 목록을 불러오지 못했습니다.');
        }
      }
    }

    if (!siteName) {
      return;
    }

    void loadContents();
  }, [siteName]);

  if (errorMessage) {
    return <p>{errorMessage}</p>;
  }

  if (contents.length === 0) {
    return null;
  }

  return (
    <div className={`${styles['post-count-list']} paper`}>
      <strong>이 커뮤니티 인기글</strong>
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
