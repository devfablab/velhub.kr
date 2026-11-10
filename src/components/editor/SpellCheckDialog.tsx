'use client';

import { type ReactNode, type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Collapse,
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
import {
  locateCorrection,
  rebuildText,
  SPELL_CHECK_PLACEHOLDER,
  type SpellCheckBlock,
  type SpellCheckSectionKind,
  splitSpellCheckBlocks,
} from '@/lib/spellCheck/markdownBlocks';
import { LoadingIndicator } from '../LoadingIndicator';
import styles from '@/app/manage.module.sass';

export type SpellCheckSection = { key: string; label: string; kind: SpellCheckSectionKind; value: string };
export type SpellCheckDialogHandle = { requestSave: (sections: SpellCheckSection[]) => boolean };

type ItemStatus = 'pending' | 'applied' | 'ignored';
type CachedItem = { start: number; end: number; origin: string; revised: string; reason: string; status: ItemStatus };
type Item = CachedItem & { id: string; sectionIndex: number; blockIndex: number };
type SessionSection = SpellCheckSection & { blocks: SpellCheckBlock[] };
type Session = { sections: SessionSection[]; items: Item[] };
type UncheckedBlock = { id: string; sectionIndex: number; blockIndex: number };
type Step = 'closed' | 'ask' | 'checking' | 'results';
type InfoResponse = { dailyLimit?: number; remainingCount?: number; canManageExclusions?: boolean; error?: string };
type CheckResponse = {
  corrections?: Array<{ id: string; origin: string; revised: string; reason: string }>;
  remainingCount?: number;
  error?: string;
};

type Props = {
  ref?: Ref<SpellCheckDialogHandle>;
  siteName: string;
  onApplySection: (key: string, value: string) => void;
  onConfirmSave: () => void;
};

const CONTEXT_LENGTH = 15;
const MIN_CHECK_LENGTH = 170;

function serializeSections(sections: SpellCheckSection[]) {
  return JSON.stringify(sections.map((section) => [section.key, section.value]));
}

function getCacheKey(kind: SpellCheckSectionKind, text: string) {
  return `${kind}\u0000${text}`;
}

function pickItemText(item: CachedItem) {
  return item.status === 'applied' ? item.revised : item.origin;
}

function buildSectionValue(section: SessionSection, sectionIndex: number, items: Item[]) {
  let value = section.value;

  for (let blockIndex = section.blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
    const block = section.blocks[blockIndex];
    const blockItems = items.filter((item) => item.sectionIndex === sectionIndex && item.blockIndex === blockIndex);

    if (blockItems.length === 0) continue;

    const rebuilt = rebuildText(block.text, blockItems, pickItemText).text;
    value = value.slice(0, block.start) + rebuilt + value.slice(block.end);
  }

  return value;
}

function getItemContext(session: Session, item: Item) {
  const text = session.sections[item.sectionIndex].blocks[item.blockIndex].text;
  const before = text.slice(Math.max(item.start - CONTEXT_LENGTH, 0), item.start).replace(/\s+/g, ' ');
  const after = text.slice(item.end, item.end + CONTEXT_LENGTH).replace(/\s+/g, ' ');

  return {
    before: `${item.start > CONTEXT_LENGTH ? '…' : ''}${before}`,
    after: `${after}${item.end + CONTEXT_LENGTH < text.length ? '…' : ''}`,
  };
}

export default function SpellCheckDialog({ ref, siteName, onApplySection, onConfirmSave }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const cacheReference = useRef(new Map<string, CachedItem[]>());
  const snapshotReference = useRef<string | null>(null);
  const requestedSectionsReference = useRef<SpellCheckSection[]>([]);
  const uncheckedBlocksReference = useRef<UncheckedBlock[]>([]);
  const itemSequenceReference = useRef(0);
  const [step, setStep] = useState<Step>('closed');
  const [session, setSession] = useState<Session | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [remainingCount, setRemainingCount] = useState<number | null>(null);
  const [canManageExclusions, setCanManageExclusions] = useState(false);
  const [isIgnoredOpen, setIsIgnoredOpen] = useState(false);
  const [busyItemId, setBusyItemId] = useState('');

  useEffect(() => {
    let isActive = true;

    fetch(`/api/manage/spell-check?siteName=${encodeURIComponent(siteName)}`, { credentials: 'include' })
      .then((response) => response.json() as Promise<InfoResponse>)
      .then((result) => {
        if (!isActive || typeof result.remainingCount !== 'number') return;
        setDailyLimit(result.dailyLimit ?? null);
        setRemainingCount(result.remainingCount);
        setCanManageExclusions(result.canManageExclusions === true);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [siteName]);

  function createItemId() {
    itemSequenceReference.current += 1;

    return `spell-${itemSequenceReference.current}`;
  }

  function buildSession(sections: SpellCheckSection[]) {
    const sessionSections: SessionSection[] = sections.map((section) => ({
      ...section,
      blocks: splitSpellCheckBlocks(section.value, section.kind),
    }));
    const items: Item[] = [];
    const uncheckedBlocks: UncheckedBlock[] = [];

    sessionSections.forEach((section, sectionIndex) => {
      section.blocks.forEach((block, blockIndex) => {
        if (!block.isCheckable) return;

        const cached = cacheReference.current.get(getCacheKey(section.kind, block.text));

        if (!cached) {
          uncheckedBlocks.push({ id: `${sectionIndex}:${blockIndex}`, sectionIndex, blockIndex });
          return;
        }

        cached.forEach((item) => items.push({ ...item, id: createItemId(), sectionIndex, blockIndex }));
      });
    });

    return { session: { sections: sessionSections, items }, uncheckedBlocks };
  }

  function rememberSession(target: Session) {
    const finalSections = target.sections.map((section, sectionIndex) => {
      section.blocks.forEach((block, blockIndex) => {
        const blockItems = target.items.filter(
          (item) => item.sectionIndex === sectionIndex && item.blockIndex === blockIndex,
        );
        const cacheKey = getCacheKey(section.kind, block.text);

        if (!block.isCheckable || (!cacheReference.current.has(cacheKey) && blockItems.length === 0)) return;

        const rebuilt = rebuildText(block.text, blockItems, pickItemText);
        cacheReference.current.set(
          getCacheKey(section.kind, rebuilt.text),
          rebuilt.spans.map(({ start, end, origin, revised, reason, status }) => ({
            start,
            end,
            origin,
            revised,
            reason,
            status,
          })),
        );
      });

      return { ...section, value: buildSectionValue(section, sectionIndex, target.items) };
    });

    snapshotReference.current = serializeSections(finalSections);
  }

  useImperativeHandle(ref, () => ({
    requestSave(sections) {
      const serialized = serializeSections(sections);

      if (snapshotReference.current === serialized) {
        return true;
      }

      const built = buildSession(sections);

      const checkableLength = built.session.sections.reduce(
        (sectionTotal, section) =>
          sectionTotal +
          section.blocks
            .filter((block) => block.isCheckable)
            .reduce((total, block) => total + block.maskedText.split(SPELL_CHECK_PLACEHOLDER).join('').length, 0),
        0,
      );

      if (built.uncheckedBlocks.length === 0 || checkableLength < MIN_CHECK_LENGTH) {
        snapshotReference.current = serialized;
        return true;
      }

      requestedSectionsReference.current = sections;
      uncheckedBlocksReference.current = built.uncheckedBlocks;
      setSession(built.session);
      setErrorMessage('');
      setIsIgnoredOpen(false);
      setStep('ask');

      return false;
    },
  }));

  function closePopup() {
    setStep('closed');
    setBusyItemId('');
  }

  function skipAndSave() {
    snapshotReference.current = serializeSections(requestedSectionsReference.current);
    closePopup();
    onConfirmSave();
  }

  async function runCheck() {
    if (!session) return;

    const uncheckedBlocks = uncheckedBlocksReference.current;
    setStep('checking');
    setErrorMessage('');

    try {
      const response = await fetch('/api/manage/spell-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          blocks: uncheckedBlocks.map((block) => ({
            id: block.id,
            text: session.sections[block.sectionIndex].blocks[block.blockIndex].maskedText,
          })),
        }),
      });
      const result = (await response.json()) as CheckResponse;

      if (typeof result.remainingCount === 'number') setRemainingCount(result.remainingCount);
      if (!response.ok) throw new Error(result.error ?? '맞춤법 검사에 실패했습니다.');

      const items = [...session.items];

      for (const block of uncheckedBlocks) {
        const section = session.sections[block.sectionIndex];
        const sessionBlock = section.blocks[block.blockIndex];
        const blockItems: Item[] = [];
        let cursor = 0;

        for (const correction of (result.corrections ?? []).filter((item) => item.id === block.id)) {
          const located = locateCorrection(sessionBlock, correction.origin, cursor);

          if (!located) continue;
          if (blockItems.some((item) => located.start < item.end && located.end > item.start)) continue;

          cursor = located.maskedEnd;
          blockItems.push({
            id: createItemId(),
            sectionIndex: block.sectionIndex,
            blockIndex: block.blockIndex,
            start: located.start,
            end: located.end,
            origin: correction.origin,
            revised: correction.revised,
            reason: correction.reason,
            status: 'pending',
          });
        }

        cacheReference.current.set(
          getCacheKey(section.kind, sessionBlock.text),
          blockItems.map(({ start, end, origin, revised, reason, status }) => ({
            start,
            end,
            origin,
            revised,
            reason,
            status,
          })),
        );
        items.push(...blockItems);
      }

      setSession({ ...session, items });
      setStep('results');
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '맞춤법 검사에 실패했습니다.');
      setStep('ask');
    }
  }

  function updateItemStatus(itemId: string, status: ItemStatus) {
    if (!session) return;

    const target = session.items.find((item) => item.id === itemId);

    if (!target) return;

    const items = session.items.map((item) => (item.id === itemId ? { ...item, status } : item));
    const nextSession = { ...session, items };
    setSession(nextSession);

    if (pickItemText(target) !== pickItemText({ ...target, status })) {
      const section = session.sections[target.sectionIndex];
      onApplySection(section.key, buildSectionValue(section, target.sectionIndex, items));
    }
  }

  async function addExclusion(item: Item) {
    if (!session || busyItemId) return;

    setBusyItemId(item.id);
    setErrorMessage('');

    try {
      const response = await fetch('/api/manage/spell-check-exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteName, word: item.origin }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok && response.status !== 409) {
        throw new Error(result.error ?? '검사 제외 목록에 추가하지 못했습니다.');
      }

      setSession({
        ...session,
        items: session.items.filter((current) => current.status === 'applied' || !current.origin.includes(item.origin)),
      });
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '검사 제외 목록에 추가하지 못했습니다.');
    } finally {
      setBusyItemId('');
    }
  }

  function finishResults(shouldSave: boolean) {
    if (session) rememberSession(session);
    closePopup();
    if (shouldSave) onConfirmSave();
  }

  const itemButtonClass = isMobile ? 'button medium action' : 'button small action';
  const visibleItems = session?.items.filter((item) => item.status !== 'ignored') ?? [];
  const ignoredItems = session?.items.filter((item) => item.status === 'ignored') ?? [];
  const sectionsWithItems = new Set(visibleItems.map((item) => item.sectionIndex));
  const hasNoRemaining = remainingCount === 0;

  function renderItemText(item: Item) {
    if (!session) return null;

    const context = getItemContext(session, item);

    return (
      <div className={styles['spell-item']}>
        <div className={`paper ${styles['spell-context']}`}>
          <p>{context.before}</p>
          <p>
            <mark>{pickItemText(item)}</mark>
          </p>
          <p>{context.after}</p>
        </div>
        <div className={styles.divider} />
        {item.status === 'applied' ? (
          <div className={`${styles['spell-after']} ${styles['spell-revision']}`}>
            <div className="paper">
              <strong>수정 전</strong>
              <p>{item.origin}</p>
            </div>
            <EastRoundedIcon />
            <div className="paper">
              <strong>수정 후</strong>
              <p>{item.revised}</p>
            </div>
          </div>
        ) : (
          <div className={`${styles['spell-before']} ${styles['spell-revision']}`}>
            <div className="paper">
              <strong>적용 전</strong>
              <p>{item.origin}</p>
            </div>
            <EastRoundedIcon />
            <div className="paper">
              <strong>적용 후</strong>
              <p>{item.revised}</p>
            </div>
          </div>
        )}
        {item.reason ? (
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>{item.reason}</span>
          </p>
        ) : null}
      </div>
    );
  }

  function renderResults() {
    if (!session) return null;

    return (
      <Stack gap={2} sx={{ m: 1, mt: 0, mb: 0 }}>
        {visibleItems.length === 0 ? (
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>고칠 곳을 찾지 못했어요.</span>
          </p>
        ) : null}

        {session.sections.map((section, sectionIndex) =>
          sectionsWithItems.has(sectionIndex) ? (
            <Stack key={section.key} gap={1.5} className={styles['spell-results']}>
              {sectionsWithItems.size > 1 ? <Typography variant="subtitle2">{section.label} 수정</Typography> : null}
              {visibleItems
                .filter((item) => item.sectionIndex === sectionIndex)
                .map((item) => (
                  <div key={item.id} className="paper">
                    {renderItemText(item)}
                    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                      {item.status === 'applied' ? (
                        <>
                          <Typography variant="subtitle2">적용함</Typography>
                          <button
                            type="button"
                            className={itemButtonClass}
                            onClick={() => updateItemStatus(item.id, 'pending')}
                          >
                            적용 취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={itemButtonClass}
                            onClick={() => updateItemStatus(item.id, 'applied')}
                          >
                            적용
                          </button>
                          <button
                            type="button"
                            className={itemButtonClass}
                            onClick={() => updateItemStatus(item.id, 'ignored')}
                          >
                            이번 글에서 무시
                          </button>
                          {canManageExclusions ? (
                            <button
                              type="button"
                              className={itemButtonClass}
                              disabled={Boolean(busyItemId)}
                              onClick={() => void addExclusion(item)}
                            >
                              검사 제외 목록에 추가
                            </button>
                          ) : null}
                        </>
                      )}
                    </Stack>
                  </div>
                ))}
            </Stack>
          ) : null,
        )}

        {ignoredItems.length > 0 ? (
          <Stack gap={1}>
            <div>
              <button type="button" className={itemButtonClass} onClick={() => setIsIgnoredOpen((open) => !open)}>
                의도된 맞춤법 무시 케이스 ({ignoredItems.length})
              </button>
            </div>
            <Collapse in={isIgnoredOpen}>
              <Stack gap={1.5}>
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>
                    {canManageExclusions
                      ? '검사 제외 목록의 수정과 삭제는 글 목록의 "맞춤법 검사 설정"에서 할 수 있어요.'
                      : '검사 제외 목록에 넣고 싶다면 운영자나 매니저에게 요청해 주세요.'}
                  </span>
                </p>
                {ignoredItems.map((item) => (
                  <Stack key={item.id} gap={0.75} className="paper">
                    {renderItemText(item)}
                    {canManageExclusions ? (
                      <Stack direction="row">
                        <button
                          type="button"
                          className={itemButtonClass}
                          disabled={Boolean(busyItemId)}
                          onClick={() => void addExclusion(item)}
                        >
                          검사 제외 목록에 추가
                        </button>
                      </Stack>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            </Collapse>
          </Stack>
        ) : null}

        {errorMessage ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}
      </Stack>
    );
  }

  function renderAsk() {
    return (
      <Stack gap={1.5}>
        <p>
          {hasNoRemaining
            ? '오늘 맞춤법 검사 횟수를 모두 사용했어요. 검사 없이 저장할까요?'
            : '저장하기 전에 맞춤법 검사를 할까요?'}
        </p>
        {remainingCount !== null && dailyLimit !== null ? (
          <Typography variant="body2">
            오늘 남은 맞춤법 검사 {remainingCount}회 / {dailyLimit}회
          </Typography>
        ) : null}
        {errorMessage ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}
      </Stack>
    );
  }

  let title = '맞춤법 검사';
  let content: ReactNode = null;
  let actions: ReactNode = null;
  let onClose = closePopup;

  if (step === 'ask') {
    content = renderAsk();
    actions = hasNoRemaining ? (
      <>
        <button type="button" className="button medium close" onClick={closePopup}>
          취소
        </button>
        <button type="button" className="button medium submit" onClick={skipAndSave}>
          저장하기
        </button>
      </>
    ) : (
      <>
        <button type="button" className="button medium action" onClick={skipAndSave}>
          건너뛰고 저장
        </button>
        <button type="button" className="button medium submit" onClick={() => void runCheck()}>
          검사하기
        </button>
      </>
    );
  }

  if (step === 'checking') {
    content = (
      <Stack direction="row" gap={1.5} alignItems="center">
        <LoadingIndicator size={20} />
        <Typography variant="body2">맞춤법을 검사하고 있어요.</Typography>
      </Stack>
    );
    onClose = () => undefined;
  }

  if (step === 'results') {
    title = '맞춤법 검사 결과';
    content = renderResults();
    onClose = () => finishResults(false);
    actions = (
      <>
        <button type="button" className="button medium close" onClick={() => finishResults(false)}>
          에디터로 돌아가서 더 고치기
        </button>
        <button type="button" className="button medium submit" onClick={() => finishResults(true)}>
          저장하기
        </button>
      </>
    );
  }

  const isOpen = step !== 'closed';

  return (
    <>
      {remainingCount !== null && dailyLimit !== null ? (
        <Typography variant="body2">
          오늘 남은 맞춤법 검사 {remainingCount}회 / {dailyLimit}회
        </Typography>
      ) : null}

      {isMobile ? (
        <Drawer anchor="bottom" open={isOpen} onClose={onClose} className="VhiDrawer-bottom">
          <h2>{title}</h2>
          {step !== 'checking' ? (
            <button type="button" className="close-button" onClick={onClose} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
          ) : null}
          <div className="VhiDrawer-bottom-content">{content}</div>
          {actions ? <div className="drawer-dialog-actions">{actions}</div> : null}
        </Drawer>
      ) : (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm" className="VhiDialog">
          <DialogTitle>{title}</DialogTitle>
          {step !== 'checking' ? (
            <button type="button" className="close-button" onClick={onClose} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
          ) : null}
          <DialogContent>{content}</DialogContent>
          {actions ? <DialogActions>{actions}</DialogActions> : null}
        </Dialog>
      )}
    </>
  );
}
