'use client';

import { useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '../Anchor';
import { useSiteHeader } from '@/app/(site)/[siteName]/SiteHeaderContext';
import { useSiteInitialData } from '@/app/(site)/[siteName]/SiteInitialDataContext';
import styles from '@/app/footer.module.sass';

type SiteInfo = {
  site_label: string | null;
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

function openTerms(url: string) {
  window.open(
    url,
    'terms-post',
    [
      'popup=yes',
      'width=960',
      'height=760',
      'left=80',
      'top=80',
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
    ].join(','),
  );
}

export default function FooterSite() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const pathname = usePathname();
  const initialData = useSiteInitialData();
  const header = useSiteHeader();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const siteInfo = initialData?.footerSiteInfo as SiteInfo | null;
  const [ownerTransfer, setOwnerTransfer] = useState<OwnerTransferItem | null>(initialData?.ownerTransfer ?? null);
  const inviteHref = header?.invite ? (header.inviteHref ?? null) : null;
  const isInvitePage =
    pathname.startsWith(`/${siteName}/invite-blog/`) || pathname.startsWith(`/${siteName}/invite-community/`);
  const [isInvitePromptOpen, setIsInvitePromptOpen] = useState(Boolean(inviteHref && !isInvitePage));
  const [isResponding, setIsResponding] = useState(false);
  const [ownerTransferError, setOwnerTransferError] = useState('');

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

  if (!siteInfo) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={`content ${styles.content}`}>
          <div className={styles.pages}>
            <div className={styles.copyrights}>
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
              <p className={styles.note}>
                {siteInfo.site_label}에 게시된 콘텐츠의 저작권은 각 작성자 또는 별도 표시된 권리자에게 있습니다.
              </p>
            </div>
            <ul className={styles['parents-items']}>
              <li className={styles['parents-item']}>
                <ul className={styles.children}>
                  <li>
                    <Anchor href="/">데브허브 라운지</Anchor>
                  </li>
                </ul>
              </li>
              <li className={styles['parents-item']}>
                <ul className={styles.children}>
                  <li>
                    <button type="button" onClick={() => openTerms('/luvelhub/b/3220865262')}>
                      데브허브 이용약관
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => openTerms('/luvelhub/b/3220865264')}>
                      데브허브 개인정보처리방침
                    </button>
                  </li>
                </ul>
              </li>
            </ul>
          </div>
          <div className={styles.legals}>
            <dl>
              <div>
                <div>
                  <dt>플랫폼 운영</dt>
                  <dd>데브런닷스튜디오</dd>
                </div>
                <div>
                  <dt>호스팅서비스제공자</dt>
                  <dd>Vercel Inc. & Supabase Inc.</dd>
                </div>
              </div>
              <div>
                <div>
                  <dt>사업자등록번호</dt>
                  <dd>319-21-01382</dd>
                </div>
                <div>
                  <dt>통신판매업 신고번호</dt>
                  <dd>2026-서울관악-</dd>
                </div>
              </div>
              <div>
                <div>
                  <dt>데브런닷스튜디오 대표</dt>
                  <dd>고종길</dd>
                </div>
                <div>
                  <dt>주소</dt>
                  <dd>
                    <address>서울시 관악구 조원로 20길 10 204호</address>
                  </dd>
                </div>
              </div>
              <div>
                <div>
                  <dt>대표 전화</dt>
                  <dd>070-4577-7513</dd>
                </div>
                <div>
                  <dt>대표 이메일</dt>
                  <dd>chloe@dev1stud.io</dd>
                </div>
              </div>
            </dl>
            <div>
              <p>이 사이트는 데브허브(velhub) 플랫폼에서 운영됩니다.</p>
              <p>
                데브허브 플랫폼 내 서비스 명칭, 로고, 디자인 및 화면 구성의 무단 복제 · 전송 · 배포 · 스크래핑 등은 관련
                법령에 따라 금지됩니다.
              </p>
              <p>{siteInfo.site_label} 및 작성자/작가가 게시한 콘텐츠의 권리는 해당 권리자에게 있습니다.</p>
              <p>
                유료 콘텐츠 등 입점 판매자와의 거래에서 데브허브 플랫폼 운영사인 데브런닷스튜디오는 플랫폼 운영, 결제 ·
                환불 · 정산 지원 및 고객 문의 · 분쟁 처리를 담당합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(ownerTransfer)}
          onClose={() => !isResponding && setOwnerTransfer(null)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>운영자 교체</h2>
          <button
            type="button"
            className="close-button"
            onClick={() => setOwnerTransfer(null)}
            disabled={isResponding}
            aria-label="닫기"
          >
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <Typography variant="body2">운영자 요청을 받았습니다.</Typography>
            {ownerTransferError ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{ownerTransferError}</span>
              </p>
            ) : null}
          </div>
          <div className="drawer-dialog-actions">
            <button
              type="button"
              className="button small cancel"
              onClick={() => void handleOwnerTransferDecision('rejected')}
              disabled={isResponding}
            >
              거절
            </button>
            <button
              type="button"
              className="button small submit"
              onClick={() => void handleOwnerTransferDecision('accepted')}
              disabled={isResponding}
            >
              수락
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(ownerTransfer)}
          onClose={() => !isResponding && setOwnerTransfer(null)}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>운영자 교체</DialogTitle>
          <button
            type="button"
            className="close-button"
            onClick={() => setOwnerTransfer(null)}
            disabled={isResponding}
            aria-label="닫기"
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="body2">운영자 요청을 받았습니다.</Typography>
            {ownerTransferError ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{ownerTransferError}</span>
              </p>
            ) : null}
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="cancel-button"
              onClick={() => void handleOwnerTransferDecision('rejected')}
              disabled={isResponding}
            >
              거절
            </button>
            <button type="button" onClick={() => void handleOwnerTransferDecision('accepted')} disabled={isResponding}>
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
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>가입</h2>
          <button type="button" className="close-button" onClick={() => setIsInvitePromptOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <Typography variant="body2">초대에 응하시겠어요?</Typography>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button small cancel" onClick={() => setIsInvitePromptOpen(false)}>
              둘러보기
            </button>
            {inviteHref ? (
              <Anchor className="button small submit" href={inviteHref}>
                가입하기
              </Anchor>
            ) : null}
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isInvitePromptOpen && !ownerTransfer}
          onClose={() => setIsInvitePromptOpen(false)}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>가입</DialogTitle>
          <button type="button" className="close-button" onClick={() => setIsInvitePromptOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="body2">초대에 응하시겠어요?</Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={() => setIsInvitePromptOpen(false)}>
              둘러보기
            </button>
            {inviteHref ? <Anchor href={inviteHref}>가입하기</Anchor> : null}
          </DialogActions>
        </Dialog>
      )}
    </footer>
  );
}
