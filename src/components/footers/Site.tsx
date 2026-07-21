'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { normalizeText } from '@/lib/utils';
import Anchor from '../Anchor';
import styles from '@/app/footer.module.sass';

type SiteInfo = {
  site_label: string | null;
};

type SiteProfileResponse = {
  siteInfo?: SiteInfo;
  error?: string;
};

type OwnerTransferItem = {
  id: string;
  created_at: string;
};

type OwnerTransferResponse = {
  ok?: boolean;
  transfer?: OwnerTransferItem | null;
  error?: string;
};

type SiteHeaderResponse = {
  invite?: boolean;
  inviteHref?: string | null;
};

export default function FooterSite() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('lg'));

  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [ownerTransfer, setOwnerTransfer] = useState<OwnerTransferItem | null>(null);
  const [inviteHref, setInviteHref] = useState<string | null>(null);
  const [isInvitePromptOpen, setIsInvitePromptOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [ownerTransferError, setOwnerTransferError] = useState('');

  useEffect(() => {
    async function loadSiteProfile() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/site/public?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SiteProfileResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '사이트 정보를 불러오지 못했습니다.');
        }

        if (!result.siteInfo) {
          throw new Error('사이트 정보를 불러오지 못했습니다.');
        }

        setSiteInfo(result.siteInfo);

        const transferResponse = await fetch(`/api/site/owner-transfer?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });
        const transferResult = (await transferResponse.json()) as OwnerTransferResponse;

        if (!transferResponse.ok) {
          throw new Error(transferResult.error ?? '운영자 교체 요청을 불러오지 못했습니다.');
        }

        setOwnerTransfer(transferResult.transfer ?? null);

        const headerResponse = await fetch(`/api/header/site?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });
        const headerResult = (await headerResponse.json()) as SiteHeaderResponse;

        if (headerResponse.ok && headerResult.invite && headerResult.inviteHref) {
          const currentPathname = window.location.pathname;
          const isInvitePage =
            currentPathname.startsWith(`/${siteName}/invite-blog/`) ||
            currentPathname.startsWith(`/${siteName}/invite-community/`);

          setInviteHref(headerResult.inviteHref);
          setIsInvitePromptOpen(!isInvitePage);
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '사이트 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('사이트 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadSiteProfile();
  }, [siteName]);

  async function handleOwnerTransferDecision(decision: 'accepted' | 'rejected') {
    if (!ownerTransfer || isResponding) {
      return;
    }

    try {
      setOwnerTransferError('');
      setIsResponding(true);

      const response = await fetch('/api/site/owner-transfer', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          transferId: ownerTransfer.id,
          decision,
        }),
      });
      const result = (await response.json()) as OwnerTransferResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '운영자 교체 요청을 처리하지 못했습니다.');
      }

      setOwnerTransfer(null);

      if (decision === 'accepted') {
        window.location.reload();
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setOwnerTransferError(unknownError.message || '운영자 교체 요청을 처리하지 못했습니다.');
      } else {
        setOwnerTransferError('운영자 교체 요청을 처리하지 못했습니다.');
      }
    } finally {
      setIsResponding(false);
    }
  }

  if (isLoading || errorMessage || !siteInfo) {
    return null;
  }

  return (
    <>
      <footer className={styles.footer}>
        <div className="container">
          <div className={`content ${styles.content}`}>
            <div className={`${styles.loves} ${styles['loves-site']}`}>
              <p className={styles.copyright}>
                <span>&copy;</span> <strong>{siteInfo.site_label}</strong> <span>All rights reserved.</span>
              </p>
              <p className={styles.love}>
                <Anchor href="/" style={{ color: 'hotpink' }}>
                  <FavoriteRoundedIcon /> <span>velhub</span>
                </Anchor>
              </p>
            </div>
          </div>
        </div>
      </footer>

      {isMobile ? (
        <Drawer anchor="bottom" open={Boolean(ownerTransfer)} className="VhiDrawer-bottom">
          <h2>운영자 교체</h2>
          <Stack gap={3}>
            <Typography variant="body2">운영자 요청을 받았습니다.</Typography>
            {ownerTransferError ? <p className="alert error">{ownerTransferError}</p> : null}
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={() => void handleOwnerTransferDecision('rejected')}
                disabled={isResponding}
              >
                거절
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void handleOwnerTransferDecision('accepted')}
                disabled={isResponding}
              >
                수락
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={Boolean(ownerTransfer)} fullWidth maxWidth="xs" className="VhiDialog">
          <DialogTitle>운영자 교체</DialogTitle>
          <DialogContent>
            <Typography variant="body2">운영자 요청을 받았습니다.</Typography>
            {ownerTransferError ? <p className="alert error">{ownerTransferError}</p> : null}
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={() => void handleOwnerTransferDecision('rejected')}
              disabled={isResponding}
            >
              거절
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleOwnerTransferDecision('accepted')}
              disabled={isResponding}
            >
              수락
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isInvitePromptOpen && !ownerTransfer}
          onClose={() => setIsInvitePromptOpen(false)}
          className="VhiDrawer-bottom"
        >
          <h2>가입</h2>
          <Stack gap={3}>
            <Typography variant="body2">초대에 응하시겠어요?</Typography>
            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium cancel" onClick={() => setIsInvitePromptOpen(false)}>
                둘러보기
              </button>
              {inviteHref ? (
                <Anchor className="button medium submit" href={inviteHref}>
                  가입하기
                </Anchor>
              ) : null}
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isInvitePromptOpen && !ownerTransfer}
          onClose={() => setIsInvitePromptOpen(false)}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>가입</DialogTitle>
          <DialogContent>
            <Typography variant="body2">초대에 응하시겠어요?</Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={() => setIsInvitePromptOpen(false)}>
              둘러보기
            </button>
            {inviteHref ? (
              <Anchor className="button medium submit" href={inviteHref}>
                가입하기
              </Anchor>
            ) : null}
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
