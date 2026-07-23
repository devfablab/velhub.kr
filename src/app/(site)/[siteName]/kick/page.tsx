'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import { Stack, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import MemberRestrictionMessageDialog from '@/components/service/community/MemberRestrictionMessageDialog';
import { formatDate, normalizeText } from '@/lib/utils';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type UserInfoData = {
  kickedAt: string | null;
  kickReason: string | null;
  kickTerm: string | null;
};

type UserInfoResponse = {
  status?: string;
  userInfo?: UserInfoData;
  error?: string;
};

export default function Page() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const [userInfo, setUserInfo] = useState<UserInfoData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [messageOpen, setMessageOpen] = useState(false);
  const canRejoin = Boolean(userInfo?.kickTerm && new Date(userInfo.kickTerm).getTime() <= Date.now());

  useEffect(() => {
    if (!siteName) return;

    async function loadUserInfo() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/users/${siteName}/me`, {
          method: 'GET',
          credentials: 'include',
        });
        const result = (await response.json()) as UserInfoResponse;

        if (!response.ok || result.status !== 'kicked' || !result.userInfo) {
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
                  <button type="button" className="button medium submit" onClick={() => setMessageOpen(true)}>
                    소명하기
                  </button>
                )}
              </>
            ) : null}

            <MemberRestrictionMessageDialog
              open={messageOpen}
              endpoint={`/api/users/${siteName}/restriction-messages/kick`}
              ownSenderType="appellant"
              inputPlaceholder="소명하세요"
              successMessage="소명 메시지를 보냈습니다."
              onClose={() => setMessageOpen(false)}
            />
          </div>
        </div>
      </div>
    </Container>
  );
}
