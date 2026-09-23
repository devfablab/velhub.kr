'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import Anchor from '@/components/Anchor';
import Container from '../../../menu';

type Props = { siteName: string; boardName: string; errorMessage: string };

export default function Opt({ siteName, boardName, errorMessage }: Props) {
  return (
    <Container pageBack={`/${siteName}/${boardName}`} pageTitle="연재 구독" pageFin>
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <h2>연재 구독</h2>
          <div className="paper" style={{ marginTop: 12 }}>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : (
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>연재 구독이 완료되었습니다.</span>
              </p>
            )}
            <Anchor type="button" className="button medium submit" href={`/${siteName}/${boardName}`}>
              포스팅으로 이동
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
