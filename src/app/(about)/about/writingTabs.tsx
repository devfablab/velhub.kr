'use client';

import { useState } from 'react';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import DynamicFeedRoundedIcon from '@mui/icons-material/DynamicFeedRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PollRoundedIcon from '@mui/icons-material/PollRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import SpellcheckRoundedIcon from '@mui/icons-material/SpellcheckRounded';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import Anchor from '@/components/Anchor';
import styles from '@/app/about.module.sass';

type WritingTab = 'blog' | 'community';

const writingItems = {
  blog: [
    { title: '글 정리', description: '카테고리와 연재, 해시태그로 글을 정리해요.', icon: <CategoryRoundedIcon /> },
    { title: '예약 출간', description: '날짜와 시간을 정해 두면 그때 글이 올라가요.', icon: <ScheduleRoundedIcon /> },
    {
      title: '구독자용 본문',
      description: '구독 연재 글은 미리보기와 구독자용 본문을 따로 써요.',
      icon: <LockRoundedIcon />,
    },
    {
      title: '맞춤법 검사기',
      description: '저장하기 전에 맞춤법을 검사해요. 고치고 싶지 않은 단어는 검사에서 빼둘 수 있어요.',
      icon: <SpellcheckRoundedIcon />,
      href: '/luvelhub/b/966019338679',
    },
  ],
  community: [
    {
      title: '네 가지 게시판',
      description: '일반, 갤러리, 유튜브, 피드 게시판 중에서 골라 써요.',
      icon: <ArticleRoundedIcon />,
    },
    { title: '투표', description: '글에 투표를 붙여요. 항목마다 이미지를 넣을 수 있어요.', icon: <PollRoundedIcon /> },
    {
      title: '추첨 이벤트',
      description: '선착순 또는 마감 후 무작위로 당첨자를 뽑아요.',
      icon: <EmojiEventsRoundedIcon />,
    },
    {
      title: '링크 미리보기',
      description: '피드 게시판에 링크를 넣으면 미리보기가 함께 보여요.',
      icon: <DynamicFeedRoundedIcon />,
    },
  ],
};

export default function WritingTabs() {
  const [writingTab, setWritingTab] = useState<WritingTab>('blog');

  return (
    <>
      <ToggleButtonGroup
        exclusive
        value={writingTab}
        size="small"
        onChange={(_, value: WritingTab | null) => {
          if (value) {
            setWritingTab(value);
          }
        }}
        className={styles.segment}
        aria-label="글쓰기 기능 구분"
      >
        <ToggleButton value="blog">블로그</ToggleButton>
        <ToggleButton value="community">커뮤니티</ToggleButton>
      </ToggleButtonGroup>
      <ul key={writingTab} className={`${styles.cards} ${styles['cards-four']} ${styles['cards-swap']}`}>
        {writingItems[writingTab].map((item, index) => (
          <li key={item.title} className={styles.card} style={{ '--reveal-order': index } as React.CSSProperties}>
            <span className={styles.tile}>{item.icon}</span>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            {'href' in item && item.href ? (
              <Anchor href={item.href} className={styles.more}>
                자세히 보기 <span aria-hidden="true">→</span>
              </Anchor>
            ) : null}
          </li>
        ))}
      </ul>
      <div className={styles.footnote}>
        <Anchor href="/luvelhub/b/699462996604" className={styles.more}>
          글쓰기 자세히 보기 <span aria-hidden="true">→</span>
        </Anchor>
      </div>
    </>
  );
}
