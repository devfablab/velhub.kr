'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Button, Stack, Typography } from '@mui/material';

type Props = { siteName: string; boardName: string; contentId: string; message: string; logErrorMessage: string };

export default function Opt({ siteName, boardName, contentId, message, logErrorMessage }: Props) {
  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper">
            <Stack gap={3} alignItems="center">
              <Typography variant="h6" component="h1">
                글 후원 실패
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
              <Button type="button" className="button medium submit" href={`/${siteName}/${boardName}/${contentId}`}>
                글로 이동
              </Button>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
