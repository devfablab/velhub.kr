'use client';

import Anchor from '@/components/Anchor';
import Container from '../../menu';

type Props = { siteName: string; boardName: string; seriesName: string; errorMessage: string };

export default function Opt({ siteName, boardName, seriesName, errorMessage }: Props) {
  return (
    <Container pageBack={`/${siteName}`} pageTitle="후원" pageFin>
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          {errorMessage ? (
            <>
              <h2>후원 결제를 완료하지 못했습니다.</h2>
              <div className="paper" style={{ marginTop: 12, marginBottom: 12 }}>
                <p>{errorMessage}</p>
              </div>
            </>
          ) : (
            <>
              <h2>후원 완료되었습니다.</h2>
              <div className="paper" style={{ marginTop: 12, marginBottom: 12 }}>
                <p>응원해 주셔서 감사합니다.</p>
              </div>
            </>
          )}
          {boardName && seriesName ? (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <Anchor type="button" className="button medium action" href={`/${siteName}/s/${seriesName}`}>
                연재로 돌아가기
              </Anchor>
              <Anchor type="button" className="button medium submit" href={`/${siteName}`}>
                메인으로 이동
              </Anchor>
            </div>
          ) : (
            <Anchor type="button" className="button medium submit" href={`/${siteName}`}>
              메인으로 이동
            </Anchor>
          )}
        </div>
      </div>
    </Container>
  );
}
