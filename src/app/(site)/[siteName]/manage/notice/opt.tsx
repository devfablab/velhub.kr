'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { FormControlLabel, Stack } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import { IOSSwitch } from '@/components/customUI/CustomizedSwitches';
import FormErrorDialog from '@/components/FormErrorDialog';
import ScreenState from '@/components/service/ScreenState';
import Container from '../menu';
import styles from '@/app/manage.module.sass';

export type NoticeManageResponse = {
  isEnabled?: boolean;
  boardLabel?: string;
  error?: string;
};

type OptProps = { initialData: NoticeManageResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const [isEnabled, setIsEnabled] = useState(initialData?.isEnabled === true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleChange(nextEnabled: boolean) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/manage/notice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteName, isEnabled: nextEnabled }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; isEnabled?: boolean } | null;

      if (!response.ok) {
        throw new Error(result?.error || '공지 설정을 저장하지 못했습니다.');
      }

      setIsEnabled(result?.isEnabled === true);
      // 서비스 메뉴 노출 상태 갱신
      router.refresh();
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '공지 설정을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  if (initialError) {
    return (
      <Container pageEnterance>
        <ScreenState kind="error">{initialError}</ScreenState>
      </Container>
    );
  }

  return (
    <Container pageTitle="공지 관리" pageBack={`/${siteName}/manage`} menu="notice">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Stack gap={2}>
            <p className="alert info" style={{ paddingTop: 23 }}>
              <InfoOutlineRoundedIcon />
              <span>
                공지 게시판을 사용하면 블로그 메뉴에 공지가 나타납니다. 메뉴 이름은 ‘디자인 - 메뉴’에서 변경할 수
                있습니다.
              </span>
            </p>
            <Stack sx={{ p: 2 }}>
              <FormControlLabel
                label="공지 게시판 사용"
                disabled={isSaving}
                control={
                  <IOSSwitch
                    sx={{ m: 1 }}
                    checked={isEnabled}
                    disabled={isSaving}
                    onChange={(event) => void handleChange(event.currentTarget.checked)}
                  />
                }
              />
            </Stack>
          </Stack>
        </div>
      </div>
      <FormErrorDialog
        open={Boolean(errorMessage)}
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => setErrorMessage('')}
      />
    </Container>
  );
}
