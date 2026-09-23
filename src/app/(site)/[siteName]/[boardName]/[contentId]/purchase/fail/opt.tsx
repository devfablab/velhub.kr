'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Stack, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';

type Props = { siteName: string; boardName: string; contentId: string; message: string; logErrorMessage: string };

export default function Opt({ siteName, boardName, contentId, message, logErrorMessage }: Props) {
  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper">
            <Stack gap={3} alignItems="center">
              <Typography variant="h6" component="h1">
                포스팅 구매 실패
              </Typography>
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{message}</span>
              </p>
              {logErrorMessage ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{logErrorMessage}</span>
                </p>
              ) : null}
              <Anchor type="button" className="button medium submit" href={`/${siteName}/${boardName}/${contentId}`}>
                글로 이동
              </Anchor>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
