'use client';

import { useParams } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { useSiteInitialData } from '@/app/(site)/[siteName]/SiteInitialDataContext';
import styles from '@/app/aside.module.sass';

export default function PostCountTableList() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const initialData = useSiteInitialData();
  const contents = initialData?.postCountContents ?? [];

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
