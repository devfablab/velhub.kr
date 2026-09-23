'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import Anchor from '@/components/Anchor';
import Container from '../../menu';

type Props = { siteName: string; errorMessage: string };

export default function Opt({ siteName, errorMessage }: Props) {
  return (
    <Container pageBack={`/${siteName}`} pageTitle="후원" pageFin>
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <h2>후원 결제에 실패했습니다.</h2>
          <div className="paper" style={{ marginTop: 12, marginBottom: 12 }}>
            <p>후원을 다시 시도해 주세요.</p>
          </div>
          {errorMessage ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}
          <Anchor type="button" className="button small submit" href={`/${siteName}`}>
            사이트로 이동
          </Anchor>
        </div>
      </div>
    </Container>
  );
}
