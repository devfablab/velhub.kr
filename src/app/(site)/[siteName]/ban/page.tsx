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
  bannedAt: string | null;
  banReason: string | null;
  banTerm: string | null;
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
  const canRejoin = Boolean(userInfo?.banTerm && new Date(userInfo.banTerm).getTime() <= Date.now());

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

        if (!response.ok || result.status !== 'banned' || !result.userInfo) {
          throw new Error(result.error ?? '가입 불가 정보를 불러오지 못했습니다.');
        }

        setUserInfo(result.userInfo);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '가입 불가 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('가입 불가 정보를 불러오지 못했습니다.');
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
            <h2>가입 불가</h2>

            {errorMessage ? (
              <p className="alert error">
                <span>{errorMessage}</span>
              </p>
            ) : null}

            {userInfo ? (
              <Stack direction="column" gap={1}>
                <div className="paper">
                  <Typography variant="subtitle2">가입 불가 처리일</Typography>
                  <Typography variant="body2">{formatDate(userInfo.bannedAt)}</Typography>
                </div>
                <div className="paper">
                  <Typography variant="subtitle2">가입 불가 사유</Typography>
                  <Typography variant="body2">{normalizeText(userInfo.banReason)}</Typography>
                </div>
                <div className="paper">
                  <Typography variant="subtitle2">재가입 가능 날짜</Typography>
                  <Typography variant="body2">
                    {canRejoin ? '가입 가능' : userInfo.banTerm ? formatDate(userInfo.banTerm) : '재가입 불가'}
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
              endpoint={`/api/users/${siteName}/restriction-messages/ban`}
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
