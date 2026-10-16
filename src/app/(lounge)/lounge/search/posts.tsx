'use client';

import { useState } from 'react';
import ScreenState from '@/components/service/ScreenState';
import List from '../list';

type Props = {
  keyword: string;
  hasSiteResults: boolean;
};

export default function SearchPosts({ keyword, hasSiteResults }: Props) {
  const [postCount, setPostCount] = useState<number | null>(null);

  if (postCount === 0) {
    return hasSiteResults ? null : <ScreenState>검색 결과가 없습니다.</ScreenState>;
  }

  return (
    <section>
      <h2>{`${keyword} 글 검색 결과${postCount === null ? '' : ` (${postCount}건)`}`}</h2>
      <List
        key={keyword}
        orderType="newest"
        postsApiPath={`/api/home/posts?limit=20&sortBy=relevance&keyword=${encodeURIComponent(keyword)}`}
        onPostsLoaded={setPostCount}
      />
    </section>
  );
}
