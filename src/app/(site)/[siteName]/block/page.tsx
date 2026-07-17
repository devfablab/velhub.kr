'use client';

import { useEffect, useState } from 'react';

import { useParams } from 'next/navigation';

import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';

import { Stack, Typography } from '@mui/material';

import Anchor from '@/components/Anchor';
import { formatDate, normalizeText } from '@/lib/utils';

import Container from '../menu';

import styles from '@/app/board.module.sass';

type UserInfoResponse = {
  isBlock?: boolean;
  blockReason?: string | null;
  blockedAt?: string | null;
  blockCount?: number;
  error?: string;
};

export default function Page() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [blockedAt, setBlockedAt] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!siteName) {
      return;
    }

    async function loadUserInfo() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/users/${siteName}/[userId]`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as UserInfoResponse;

        if (!response.ok || result.isBlock !== true) {
          throw new Error(result.error ?? '차단 정보를 불러오지 못했습니다.');
        }

        setBlockedAt(result.blockedAt ?? null);
        setBlockReason(normalizeText(result.blockReason) || '등록된 사유가 없습니다.');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '차단 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('차단 정보를 불러오지 못했습니다.');
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

            <h2>활동 정지</h2>

            {errorMessage ? (
              <p className="alert error">
                <span>{errorMessage}</span>
              </p>
            ) : null}

            {!errorMessage ? (
              <Stack direction="column" gap={1}>
                <div className="paper">
                  <Typography variant="subtitle2">활동 정지일</Typography>
                  <Typography variant="body2">{formatDate(blockedAt)}</Typography>
                </div>

                <div className="paper">
                  <Typography variant="subtitle2">활동 정지 사유</Typography>
                  <Typography variant="body2">{blockReason}</Typography>
                </div>
              </Stack>
            ) : null}

            <Anchor href="/concierge/rights" className="button medium submit">
              소명하기
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
