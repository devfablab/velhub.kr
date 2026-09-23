'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import Anchor from '@/components/Anchor';
import Container from '@/app/(site)/[siteName]/menu';

type Props = { siteName: string; boardName: string; contentId: string; errorMessage: string };

export default function Opt({ siteName, boardName, contentId, errorMessage }: Props) {
  return (
    <Container pageBack={`/${siteName}/${boardName}/${contentId}`} pageTitle="포스팅 구매" pageFin>
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <h2>포스팅 구매</h2>
          <div className="paper" style={{ marginTop: 12 }}>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : (
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>포스팅 구매가 완료되었습니다.</span>
              </p>
            )}
            <Anchor type="button" className="button medium submit" href={`/${siteName}/${boardName}/${contentId}`}>
              포스팅으로 이동
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
