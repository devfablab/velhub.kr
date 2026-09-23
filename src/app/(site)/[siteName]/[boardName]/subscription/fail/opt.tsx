'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Button, Stack, Typography } from '@mui/material';

type Props = { siteName: string; boardName: string; message: string; logErrorMessage: string };

export default function Opt({ siteName, boardName, message, logErrorMessage }: Props) {
  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper">
            <Stack gap={3} alignItems="center">
              <Typography variant="h6" component="h1">
                연재 구독 실패
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
              <Button type="button" variant="contained" href={`/${siteName}/${boardName}`}>
                게시판으로 이동
              </Button>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
