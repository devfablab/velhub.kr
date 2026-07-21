'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Dialog from '@mui/material/Dialog';
import { DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { formatDate, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import styles from '@/app/aside.module.sass';

type SiteInfoData = {
  siteType: string;
  siteLabel: string;
  createdAt: string;
  summary: string | null;
  profilePictureUrl: string;
  ownerNickname: string;
  memberCount: number;
  joinAcceptStatus: string;
  joinType: string;
  managerNicknames: string[];
};

type SiteInfoResponse = {
  ok?: boolean;
  siteInfo?: SiteInfoData;
  error?: string;
};

type HeaderSiteResponse = {
  siteRole: string | null;
  error?: string;
};

type CommunityLinkService = 'toonation' | 'kakaotalk' | 'discord';

type CommunityLink = {
  id: string;
  service: CommunityLinkService;
  account: string;
  image: string | null;
  image_url: string;
  sort_order: number;
};

type CommunityLinksResponse = {
  links?: CommunityLink[];
};

const COMMUNITY_LINK_OPTIONS: {
  value: CommunityLinkService;
  label: string;
  prefix: string;
}[] = [
  { value: 'toonation', label: '투네이션', prefix: 'https://toon.at/donate/' },
  { value: 'kakaotalk', label: '카카오톡', prefix: 'https://open.kakao.com/o/' },
  { value: 'discord', label: '디스코드', prefix: 'https://discord.com/invite/' },
];

function getSiteTypeLabel(siteType: string) {
  if (siteType === 'community') {
    return '커뮤니티';
  }

  return siteType;
}

function getJoinAcceptStatusLabel(joinAcceptStatus: string) {
  if (joinAcceptStatus === 'enabled') {
    return '가능';
  }

  if (joinAcceptStatus === 'disabled') {
    return '불가능';
  }

  if (joinAcceptStatus === 'period') {
    return '기간 설정';
  }

  return joinAcceptStatus;
}

function getJoinTypeLabel(joinType: string) {
  if (joinType === 'open') {
    return '자유 가입';
  }

  if (joinType === 'invite') {
    return '초대 가입';
  }

  return joinType;
}

function isManagerRole(siteRole: string | null) {
  return siteRole === 'owner' || siteRole === 'manager';
}

export default function SiteInfo() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [siteInfo, setSiteInfo] = useState<SiteInfoData | null>(null);
  const [communityLinks, setCommunityLinks] = useState<CommunityLink[]>([]);
  const [siteRole, setSiteRole] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    async function loadSiteInfo() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/site/community?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SiteInfoResponse;

        if (!response.ok || !result.siteInfo) {
          throw new Error(result.error ?? '커뮤니티 정보를 불러오지 못했습니다.');
        }

        setSiteInfo(result.siteInfo);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '커뮤니티 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('커뮤니티 정보를 불러오지 못했습니다.');
        }
      }
    }

    async function loadHeader() {
      const response = await fetch(`/api/header/site?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderSiteResponse;

      if (!response.ok) {
        setSiteRole(null);
        return;
      }

      setSiteRole(result.siteRole ?? null);
    }

    async function loadCommunityLinks() {
      try {
        const response = await fetch(`/api/manage/design/community/links?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          setCommunityLinks([]);
          return;
        }

        const result = (await response.json()) as CommunityLinksResponse;
        setCommunityLinks(Array.isArray(result.links) ? result.links : []);
      } catch {
        setCommunityLinks([]);
      }
    }

    if (!siteName) {
      return;
    }

    void loadSiteInfo();
    void loadHeader();
    void loadCommunityLinks();
  }, [siteName]);

  if (!siteInfo) {
    return errorMessage ? (
      <div className={`${styles['site-info']} paper`}>
        <p>{errorMessage}</p>
      </div>
    ) : null;
  }

  return (
    <div className={`${styles['site-info']} paper`}>
      <div className={styles.avatar}>
        <AppIconAvatar src={siteInfo.profilePictureUrl || null} alt={siteInfo.siteLabel || ''} size={58} />
      </div>
      <div className={styles.info}>
        <div className={styles['info-detail']}>
          <cite>{siteInfo.siteLabel}</cite>
          <span>{formatDate(siteInfo.createdAt)} 개설</span>
        </div>

        <div className={styles.button}>
          {isManagerRole(siteRole) ? (
            <Anchor href={`/${siteName}/manage`}>커뮤니티 관리</Anchor>
          ) : (
            <button type="button" onClick={() => setIsDialogOpen(true)}>
              커뮤니티 정보
            </button>
          )}
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        className={`vh-dialog vh-alert-dialog ${styles['info-dialog']}`}
      >
        <DialogTitle>커뮤니티 정보</DialogTitle>
        <DialogContent className={styles['info-content']}>
          <div className={styles['info-site-name']}>
            <em>{getSiteTypeLabel(siteInfo.siteType)}</em> <strong>{siteInfo.siteLabel}</strong>
          </div>
          {communityLinks.length > 0 ? (
            <div className={styles['info-site-links']}>
              {communityLinks.map((link) => {
                const option = COMMUNITY_LINK_OPTIONS.find((item) => item.value === link.service);
                const account = normalizeText(link.account);

                if (!option || !account) {
                  return null;
                }

                return (
                  <Anchor
                    key={link.id}
                    href={`${option.prefix}${account}`}
                    aria-label={option.label}
                    title={option.label}
                  >
                    {link.image_url ? <img src={link.image_url} alt={option.label} /> : <span>{option.label}</span>}
                  </Anchor>
                );
              })}
            </div>
          ) : null}
          <dl className={styles['info-site-detail']}>
            <div>
              <dt>커뮤니티 개설</dt>
              <dd>{formatDate(siteInfo.createdAt)}</dd>
            </div>

            <div>
              <dt>커뮤니티 설명</dt>
              <dd>{siteInfo.summary ? siteInfo.summary : '설명글 등록 안됨'}</dd>
            </div>

            <div>
              <dt>가입신청</dt>
              <dd>{getJoinAcceptStatusLabel(siteInfo.joinAcceptStatus)}</dd>
            </div>

            <div>
              <dt>가입방식</dt>
              <dd>{getJoinTypeLabel(siteInfo.joinType)}</dd>
            </div>

            <div>
              <dt>커뮤니티 멤버</dt>
              <dd>{siteInfo.memberCount.toLocaleString()} 명</dd>
            </div>
          </dl>

          <dl className={styles['info-site-managers']}>
            <div>
              <dt>운영자</dt>
              <dd>
                <ul>
                  <li>{siteInfo.ownerNickname}</li>
                </ul>
              </dd>
            </div>

            <div>
              <dt>매니저</dt>
              <dd>
                {siteInfo.managerNicknames.length > 0 ? (
                  <ul>
                    {siteInfo.managerNicknames.map((managerNickname) => (
                      <li key={managerNickname}>{managerNickname}</li>
                    ))}
                  </ul>
                ) : (
                  '등록된 매니저 없음'
                )}
              </dd>
            </div>
          </dl>
        </DialogContent>
        <DialogActions>
          <button type="button" onClick={() => setIsDialogOpen(false)}>
            닫기
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
