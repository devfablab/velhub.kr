'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import { formatDateSimple, normalizeText } from '@/lib/utils';
import Container from './menu';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/manage.module.sass';

type StaffResponse = {
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

type TabItems = {
  label: string;
  href: string;
  startsWith?: boolean;
};

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [siteAvatar, setSiteAvatar] = useState<string | null>(null);
  const [siteType, setSiteType] = useState('');
  const [siteNameText, setSiteNameText] = useState('');
  const [siteCreatedAt, setSiteCreatedAt] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [postCount, setPostCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/manage?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as StaffResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '정보를 불러오지 못했습니다.');
        }

        setSiteAvatar(result.site?.avatar ?? null);
        setSiteNameText(result.site?.name ?? '');
        setSiteType(result.site?.siteType ?? '');
        setSiteCreatedAt(result.site?.createdAt ?? null);
        setOwnerName(result.site?.ownerName ?? '');
        setMemberCount(result.stats?.memberCount ?? 0);
        setPostCount(result.stats?.postCount ?? 0);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadData();
  }, [siteName]);

  const tabItems: TabItems[] = [
    { label: siteType === 'blog' ? '블로그 정보' : '커뮤니티 정보', href: `/${siteName}/manage/settings` },
    ...(siteType === 'community' ? [{ label: '가입 관리', href: `/${siteName}/manage/join` }] : []),
    {
      label: siteType === 'blog' ? '팀원 관리' : '멤버 관리',
      href: siteType === 'blog' ? `/${siteName}/manage/team` : `/${siteName}/manage/members`,
    },
    { label: '콘텐츠 관리', href: `/${siteName}/manage/contents` },
    ...(siteType === 'community' ? [{ label: '제한된 콘텐츠', href: `/${siteName}/manage/filtered` }] : []),
    {
      label: '디자인',
      href: siteType === 'blog' ? `/${siteName}/manage/design/blog/fonts` : `/${siteName}/manage/design/community/home`,
    },
    {
      label: '결제',
      href: `/${siteName}/manage/payments/billing`,
    },
    { label: '통계', href: `/${siteName}/manage/stats` },
  ];

  if (isLoading) {
    return (
      <Container pageEnterance>
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (errorMessage) {
    return (
      <Container pageEnterance>
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper paper-error ${styles.paper}`}>
              {errorMessage || '사이트 정보를 불러오지 못했습니다'}
            </div>
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
              {tabItems.map((tabItem) => (
                <li key={tabItem.href}>
                  <Anchor href={tabItem.href}>
                    <span>{tabItem.label}</span>
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
