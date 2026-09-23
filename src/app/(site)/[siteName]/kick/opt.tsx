'use client';

import { useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { formatDate, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import MemberRestrictionMessageDialog from '@/components/service/community/MemberRestrictionMessageDialog';
import ScreenState from '@/components/service/ScreenState';
import { ServiceErrorIcon } from '@/components/Svgs';
import Container from '../menu';
import styles from '@/app/board.module.sass';

export type UserInfoData = { kickedAt: string | null; kickReason: string | null; kickTerm: string | null };
export type UserInfoResponse = { status?: string; userInfo?: UserInfoData; error?: string };

export default function Opt({
  siteName,
  initialUserInfo,
  initialError,
  canRejoin,
}: {
  siteName: string;
  initialUserInfo: UserInfoData | null;
  initialError: string;
  canRejoin: boolean;
}) {
  const [messageOpen, setMessageOpen] = useState(false);

  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper page-error">
            <ServiceErrorIcon />
            <h2>강제 탈퇴</h2>
            {initialError ? <ScreenState kind="error">{initialError}</ScreenState> : null}
            {initialUserInfo ? (
              <Stack direction="column" gap={1}>
                <div className="paper">
                  <Typography variant="subtitle2">강제 탈퇴 날짜</Typography>
                  <Typography variant="body2">{formatDate(initialUserInfo.kickedAt)}</Typography>
                </div>
                <div className="paper">
                  <Typography variant="subtitle2">강제 탈퇴 사유</Typography>
                  <Typography variant="body2">{normalizeText(initialUserInfo.kickReason)}</Typography>
                </div>
                <div className="paper">
                  <Typography variant="subtitle2">재가입 가능 날짜</Typography>
                  <Typography variant="body2">
                    {canRejoin
                      ? '가입 가능'
                      : initialUserInfo.kickTerm
                        ? formatDate(initialUserInfo.kickTerm)
                        : '재가입 불가'}
                  </Typography>
                </div>
              </Stack>
            ) : null}
            {initialUserInfo ? (
              canRejoin ? (
                <Anchor href={`/${siteName}/join`} className="button medium submit">
                  가입하기
                </Anchor>
              ) : (
                <button type="button" className="button medium submit" onClick={() => setMessageOpen(true)}>
                  소명하기
                </button>
              )
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
