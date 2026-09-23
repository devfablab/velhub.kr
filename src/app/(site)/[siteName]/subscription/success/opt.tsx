'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import Typography from '@mui/material/Typography';
import Anchor from '@/components/Anchor';

type Props = { siteName: string; errorMessage: string };

export default function Opt({ siteName, errorMessage }: Props) {
  return (
    <div className="paper">
      <Typography variant="h1">블로그 구독 가입</Typography>
      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : (
        <p className="alert info">
          <InfoOutlineRoundedIcon />
          <span>블로그 구독 가입이 완료되었습니다.</span>
        </p>
      )}
      <Anchor href={`/${siteName}`} className="button medium submit">
        사이트로 이동
      </Anchor>
    </div>
  );
}
