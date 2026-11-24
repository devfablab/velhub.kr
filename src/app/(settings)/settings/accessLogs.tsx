'use client';

import { useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { Accordion, AccordionDetails, AccordionSummary, Divider, Grid, Stack, Typography } from '@mui/material';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/settings.module.sass';

type AccessLogItem = {
  id: string;
  createdAt: string;
  location: string;
  device: string;
  ipAddress: string;
};

export default function AccessLogs() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState<AccessLogItem[] | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function loadLogs() {
    setErrorMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/access-logs', { credentials: 'include', cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as { logs?: AccessLogItem[]; error?: string } | null;

      if (!response.ok || !result?.logs) {
        setErrorMessage(response.status >= 500 || !result?.error ? '접속 기록을 불러오지 못했습니다.' : result.error);
        return;
      }

      setLogs(result.logs);
    } catch {
      setErrorMessage('접속 기록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Grid size={12} className={styles.grid}>
      <Accordion
        expanded={isExpanded}
        onChange={(_event, expanded) => {
          setIsExpanded(expanded);

          if (expanded && !logs && !isLoading) {
            void loadLogs();
          }
        }}
        disableGutters
        variant="outlined"
        className={`paper ${styles.paper}`}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" component="strong">
            접속 기록
          </Typography>
        </AccordionSummary>

        <AccordionDetails>
          <Stack gap={1.5}>
            {isLoading ? (
              <Stack alignItems="center">
                <LoadingIndicator size={24} />
              </Stack>
            ) : errorMessage ? (
              <p className="alert error" role="alert">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : logs?.length ? (
              logs.map((log) => (
                <div key={log.id} className={styles['access-logs']}>
                  <dl>
                    <div>
                      <dt>일시</dt>
                      <dd>{log.createdAt}</dd>
                    </div>
                    <div>
                      <dt>위치</dt>
                      <dd>{log.location}</dd>
                    </div>
                    <div>
                      <dt>디바이스</dt>
                      <dd>{log.device}</dd>
                    </div>
                    <div>
                      <dt>IP</dt>
                      <dd>{log.ipAddress === '::1' ? '211.23.181.74' : log.ipAddress}</dd>
                    </div>
                  </dl>
                </div>
              ))
            ) : logs ? (
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>아직 남은 접속 기록이 없습니다.</span>
              </p>
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
