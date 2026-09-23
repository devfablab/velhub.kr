'use client';

import { useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { formatDate, normalizeText } from '@/lib/utils';
import MemberRestrictionMessageDialog from '@/components/service/community/MemberRestrictionMessageDialog';
import ScreenState from '@/components/service/ScreenState';
import { ServiceErrorIcon } from '@/components/Svgs';
import Container from '../menu';
import styles from '@/app/board.module.sass';

export type UserInfoResponse = {
  status?: string;
  isBlock?: boolean;
  blockReason?: string | null;
  blockedAt?: string | null;
  blockTerm?: string | null;
  blockCount?: number;
  error?: string;
};

export default function Opt({
  siteName,
  initialData,
  initialError,
}: {
  siteName: string;
  initialData: UserInfoResponse | null;
  initialError: string;
}) {
  const [messageOpen, setMessageOpen] = useState(false);
  const blockReason = normalizeText(initialData?.blockReason) || '등록된 사유가 없습니다.';

  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper page-error">
            <ServiceErrorIcon />

            <h2>활동 정지</h2>

            {initialError ? <ScreenState kind="error">{initialError}</ScreenState> : null}

            {!initialError ? (
              <Stack direction="column" gap={1}>
                <div className="paper">
                  <Typography variant="subtitle2">활동 정지일</Typography>
                  <Typography variant="body2">{formatDate(initialData?.blockedAt ?? null)}</Typography>
                </div>

                <div className="paper">
                  <Typography variant="subtitle2">활동 정지 사유</Typography>
                  <Typography variant="body2">{blockReason}</Typography>
                </div>

                {initialData?.blockTerm ? (
                  <div className="paper">
                    <Typography variant="subtitle2">활동 정지 해제일</Typography>
                    <Typography variant="body2">{formatDate(initialData.blockTerm)}</Typography>
                  </div>
                ) : null}
              </Stack>
            ) : null}

            <button type="button" className="button medium submit" onClick={() => setMessageOpen(true)}>
              소명하기
            </button>

            <MemberRestrictionMessageDialog
              open={messageOpen}
              endpoint={`/api/users/${siteName}/restriction-messages/block`}
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
