'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import { formatDateSimple, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import ScreenState from '@/components/service/ScreenState';
import { useSiteHeader } from '../SiteHeaderContext';
import Container from './menu';
import styles from '@/app/manage.module.sass';

export type StaffResponse = {
  site?: {
    avatar: string | null;
    name: string | null;
    siteType: string;
    createdAt: string | null;
    ownerName: string | null;
  };
  stats?: {
    memberCount: number;
    postCount: number;
  };
  error?: string;
};

function canAccessAllManageMenus(siteType: string, siteRole: string | null, globalRole: string | null) {
  if (globalRole === 'admin') {
    return true;
  }

  if (siteType === 'blog') {
    return siteRole === 'owner' || siteRole === 'manager';
  }

  if (siteType === 'community') {
    return siteRole === 'owner' || siteRole === 'community-manager';
  }

  return false;
}

export default function Opt({ initialData, initialError }: { initialData: StaffResponse | null; initialError: string }) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const siteHeader = useSiteHeader();
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [siteAvatar, setSiteAvatar] = useState<string | null>(initialData?.site?.avatar ?? null);
  const [siteType, setSiteType] = useState(initialData?.site?.siteType ?? '');
  const [siteNameText, setSiteNameText] = useState(initialData?.site?.name ?? '');
  const [siteCreatedAt, setSiteCreatedAt] = useState<string | null>(initialData?.site?.createdAt ?? null);
  const [ownerName, setOwnerName] = useState(initialData?.site?.ownerName ?? '');
  const [memberCount, setMemberCount] = useState(initialData?.stats?.memberCount ?? 0);
  const [postCount, setPostCount] = useState(initialData?.stats?.postCount ?? 0);
  const [siteRole, setSiteRole] = useState<string | null>(siteHeader?.siteRole ?? null);
  const [globalRole, setGlobalRole] = useState<string | null>(siteHeader?.globalRole ?? null);

  const showAllManageMenus = canAccessAllManageMenus(siteType, siteRole, globalRole);
  const menuItems = [
    ...(showAllManageMenus
      ? [{ href: `/${siteName}/manage/settings`, label: siteType === 'blog' ? '블로그 정보' : '커뮤니티 정보' }]
      : []),
    ...(showAllManageMenus && siteType === 'community' ? [{ href: `/${siteName}/manage/join`, label: '가입 관리' }] : []),
    ...(showAllManageMenus
      ? [{ href: `/${siteName}/manage/${siteType === 'blog' ? 'team' : 'members'}`, label: siteType === 'blog' ? '팀원 관리' : '멤버 관리' }]
      : []),
    { href: `/${siteName}/manage/contents/posts`, label: '콘텐츠 관리' },
    ...(showAllManageMenus && siteType === 'community' ? [{ href: `/${siteName}/manage/private`, label: '비공개 게시판' }] : []),
    ...(showAllManageMenus
      ? [
          { href: `/${siteName}/manage/reports`, label: '신고 관리' },
          { href: siteType === 'blog' ? `/${siteName}/manage/design/blog/fonts` : `/${siteName}/manage/design/community/home`, label: '디자인' },
          { href: `/${siteName}/manage/payments`, label: '결제' },
          { href: `/${siteName}/manage/stats`, label: '통계' },
        ]
      : []),
  ];

  if (errorMessage) {
    return (
      <Container pageEnterance>
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <ScreenState kind="error">{errorMessage || '사이트 정보를 불러오지 못했습니다'}</ScreenState>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageEnterance>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <div className={`paper ${styles.paper} ${styles.profile}`}>
            <AppIconAvatar src={siteAvatar || null} alt={siteNameText} size={72} />
            <div className={styles.info}>
              <p className={styles.text}>{siteNameText}</p>
              <p>SINCE {formatDateSimple(siteCreatedAt)}</p>
            </div>
          </div>

          <div className={`paper ${styles.paper} ${styles.stat}`}>
            <dl>
              <div>
                <dt>활동 멤버</dt>
                <dd>{memberCount} 명</dd>
              </div>
              <div>
                <dt>전체 글</dt>
                <dd>{postCount} 개</dd>
              </div>
            </dl>
          </div>
          <div className={`paper ${styles.paper} ${styles.menu}`}>
            <ul>
              {menuItems.map((menuItem) => (
                <li key={menuItem.href}>
                  <Anchor href={menuItem.href}>
                    <span>{menuItem.label}</span>
                    <NavigateNextRoundedIcon />
                  </Anchor>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Container>
  );
}
