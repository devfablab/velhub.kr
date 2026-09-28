import type { Metadata } from 'next';
import { Stack } from '@mui/material';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../../menu';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '문의등록 결과 - 데브허브',
  description: '데브허브 문의 등록 결과',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ attachment?: string }> }) {
  const { attachment } = await searchParams;
  const isAttachmentFailed = attachment === 'failed';

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>문의등록 결과</h1>
          <div className="paper">
            <ScreenState kind={isAttachmentFailed ? 'error' : undefined}>
              {isAttachmentFailed
                ? '문의하기 등록은 완료되었지만 첨부파일을 등록하지 못했습니다. 문의 내역에서 다시 첨부해 주세요.'
                : '문의하기 등록이 완료 되었습니다.\n컨시어지팀이 확인 후 답변 드리겠습니다.'}
            </ScreenState>
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Anchor href="/concierge/contact/inquiries" className="button medium action">
                목록이동
              </Anchor>
            </Stack>
          </div>
        </div>
      </div>
    </Container>
  );
}
