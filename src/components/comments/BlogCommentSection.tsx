'use client';

import { useMemo } from 'react';
import Giscus from '@giscus/react';
import { DiscussionEmbed } from 'disqus-react';
import CommentSection from '@/components/comments/CommunityCommentSection';

type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';
type GiscusInputPosition = 'top' | 'bottom';
type GiscusFlag = '0' | '1';

type GiscusSettings = {
  repo: string;
  repoId: string;
  strict: GiscusFlag;
  reactionsEnabled: GiscusFlag;
  emitMetadata: GiscusFlag;
  inputPosition: GiscusInputPosition;
};

type Props = {
  siteName: string;
  boardName: string;
  contentId: string;
  postAuthorId: string;
  isCommentEnabled: boolean;
  commentProvider: CommentProvider;
  giscusSettings: GiscusSettings | null;
  themeMode: 'light' | 'dark';
  title: string;
  slug: string;
};

const DISQUS_SHORTNAME = process.env.NEXT_PUBLIC_DISQUS_SHORTNAME ?? '';

export default function BlogCommentSection({
  siteName,
  boardName,
  contentId,
  postAuthorId,
  isCommentEnabled,
  commentProvider,
  giscusSettings,
  themeMode,
  title,
  slug,
}: Props) {
  const disqusUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return `${window.location.origin}/${siteName}/${boardName}/${slug}`;
  }, [siteName, boardName, slug]);

  if (!isCommentEnabled || commentProvider === 'none') {
    return null;
  }

  if (commentProvider === 'velhub') {
    return (
      <CommentSection
        siteName={siteName}
        boardName={boardName}
        contentId={contentId}
        postAuthorId={postAuthorId}
        isCommentEnabled={isCommentEnabled}
      />
    );
  }

  if (commentProvider === 'giscus') {
    if (!giscusSettings?.repo || !giscusSettings.repoId) {
      return null;
    }

    return (
      <div className="paper">
        <Giscus
          id="comments"
          repo={giscusSettings.repo as `${string}/${string}`}
          repoId={giscusSettings.repoId}
          category="Q&A"
          categoryId="DIC_kwDORtqOzM4C5BNp"
          mapping="pathname"
          strict={giscusSettings.strict}
          reactionsEnabled={giscusSettings.reactionsEnabled}
          emitMetadata={giscusSettings.emitMetadata}
          inputPosition={giscusSettings.inputPosition}
          theme={themeMode === 'dark' ? 'dark' : 'light'}
          lang="ko"
          loading="lazy"
        />
      </div>
    );
  }

  if (commentProvider === 'disqus') {
    if (!DISQUS_SHORTNAME || !disqusUrl) {
      return null;
    }

    return (
      <div className="paper" style={{ colorScheme: themeMode }}>
        <DiscussionEmbed
          shortname={DISQUS_SHORTNAME}
          config={{
            url: disqusUrl,
            identifier: `${siteName}/${boardName}/${slug}`,
            title,
            language: 'ko',
          }}
        />
      </div>
    );
  }

  return null;
}
