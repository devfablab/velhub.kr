'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Stack, Typography } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { normalizeText } from '@/lib/utils';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';
import Anchor from '@/components/Anchor';

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const siteName = normalizeText(params.siteName);
  const message = normalizeText(searchParams.get('message'));

  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage/payments/billing`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack gap={3} alignItems="center">
            <Typography variant="h6" component="h1">
              결제수단 등록에 실패했습니다.
            </Typography>
            <Typography>결제수단을 다시 등록해 주세요.</Typography>
            {message ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{message}</span>
              </p>
            ) : null}
            <Anchor href={`/${siteName}/manage/payments/billing`} className="button medium submit">
              다시 등록하기
            </Anchor>
          </Stack>
        </div>
      </div>
    </Container>
  );
}
