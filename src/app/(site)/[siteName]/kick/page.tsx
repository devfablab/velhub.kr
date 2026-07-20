'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import { Stack, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import { formatDate, normalizeText } from '@/lib/utils';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type UserInfoData = {
  kickedAt: string | null;
  kickReason: string | null;
  kickTerm: string | null;
};

type UserInfoResponse = {
  userInfo?: UserInfoData;
  error?: string;
};

export default function Page() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const [userInfo, setUserInfo] = useState<UserInfoData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const canRejoin = Boolean(userInfo?.kickTerm && new Date(userInfo.kickTerm).getTime() <= Date.now());

  useEffect(() => {
    if (!siteName) return;

    async function loadUserInfo() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/users/${siteName}/[userId]`, {
          method: 'GET',
          credentials: 'include',
        });
        const result = (await response.json()) as UserInfoResponse;

        if (!response.ok || !result.userInfo) {
          throw new Error(result.error ?? '강제 탈퇴 정보를 불러오지 못했습니다.');
        }

        setUserInfo(result.userInfo);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '강제 탈퇴 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('강제 탈퇴 정보를 불러오지 못했습니다.');
        }
      }
    }

    void loadUserInfo();
  }, [siteName]);

  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>강제 탈퇴</h2>

            {errorMessage ? (
              <p className="alert error">
                <span>{errorMessage}</span>
              </p>
            ) : null}

            {userInfo ? (
              <Stack direction="column" gap={1}>
                <div className="paper">
                  <Typography variant="subtitle2">강제 탈퇴 날짜</Typography>
                  <Typography variant="body2">{formatDate(userInfo.kickedAt)}</Typography>
                </div>
                <div className="paper">
                  <Typography variant="subtitle2">강제 탈퇴 사유</Typography>
                  <Typography variant="body2">{normalizeText(userInfo.kickReason)}</Typography>
                </div>
                <div className="paper">
                  <Typography variant="subtitle2">재가입 가능 날짜</Typography>
                  <Typography variant="body2">
                    {canRejoin ? '가입 가능' : userInfo.kickTerm ? formatDate(userInfo.kickTerm) : '재가입 불가'}
                  </Typography>
                </div>
              </Stack>
            ) : null}
            {userInfo ? (
              <>
                {canRejoin ? (
                  <Anchor href={`/${siteName}/join`} className="button medium submit">
                    가입하기
                  </Anchor>
                ) : (
                  <Anchor href="/concierge/rights" className="button medium submit">
                    소명하기
                  </Anchor>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Container>
  );
}
