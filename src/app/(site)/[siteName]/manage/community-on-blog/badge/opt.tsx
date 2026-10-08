'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import { Avatar, Stack, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import styles from '@/app/manage.module.sass';

const PERIODS = [0, 1, 3, 6, 12, 24, 36, 48, 60];
const label = (months: number) => (months >= 60 ? '5년 이상' : `${months}개월`);

export default function Opt({ badges }: { badges: Array<{ subscription_months: number; image_url: string }> }) {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const input = useRef<HTMLInputElement>(null);
  const [months, setMonths] = useState<number | null>(null);
  const [files, setFiles] = useState<Record<number, File>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    const target = months;
    event.currentTarget.value = '';
    if (!file || target === null) return;
    setFiles((current) => ({ ...current, [target]: file }));
  }

  async function save() {
    const entries = Object.entries(files)
      .map(([key, file]) => [Number(key), file] as const)
      .sort(([a], [b]) => a - b);
    if (!entries.length) return;
    const available = new Set([
      ...badges.map((badge) => badge.subscription_months),
      ...entries.map(([target]) => target),
    ]);
    const highest = Math.max(...available);
    const missing = PERIODS.find((period) => period <= highest && !available.has(period));
    if (missing !== undefined) {
      setError(`${label(missing)}차 배지 이미지를 등록해주세요.`);
      return;
    }
    setSaving(true);
    try {
      for (const [target, file] of entries) {
        const form = new FormData();
        form.set('months', String(target));
        form.set('image', file);
        const response = await fetch(`/api/site/${siteName}/blog-badges`, { method: 'POST', body: form });
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) throw new Error(result?.error ?? '배지 이미지를 저장하지 못했습니다.');
      }
      setFiles({});
      router.refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '배지 이미지를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(target: number) {
    const response = await fetch(`/api/site/${siteName}/blog-badges`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ months: target }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(result?.error ?? '배지 이미지를 삭제하지 못했습니다.');
      return;
    }
    router.refresh();
  }

  return (
    <>
      <input ref={input} hidden type="file" accept="image/png,image/webp" onChange={(event) => void onChange(event)} />
      <ul className={styles['badges']}>
        {PERIODS.map((value) => {
          const badge = badges.find((item) => item.subscription_months === value);
          return (
            <li key={value}>
              <Stack direction="row" spacing={1.5}>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => {
                    setMonths(value);
                    input.current?.click();
                  }}
                >
                  {badge || files[value]
                    ? `${label(value) === '0개월' ? '기본' : label(value)} 배지 아이콘 교체`
                    : `${label(value) === '0개월' ? '기본' : label(value)} 배지 아이콘 등록`}
                </button>
                {badge ? (
                  <button type="button" className="button small warning" onClick={() => void remove(value)}>
                    {label(value) === '0개월' ? '기본' : label(value)}배지 아이콘 삭제
                  </button>
                ) : null}
              </Stack>
              <div className="paper">
                <header className={styles['content-header']}>
                  <div className={styles['author-profile']}>
                    <div className={styles.avatar}>
                      <Avatar src="/broken-image.jpg" alt={''} />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>
                        <cite>본문 미리보기</cite>
                        {files[value] || badge ? (
                          <em>
                            <img
                              className={styles['membership-fan-badge']}
                              src={files[value] ? URL.createObjectURL(files[value]) : badge?.image_url}
                              alt="멤버십팬 배지"
                            />
                          </em>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </header>
              </div>
              <div className="paper">
                <div className={styles['comment-item']}>
                  <Avatar
                    src="/broken-image.jpg"
                    alt={''}
                    sx={{ width: 28, height: 28, position: 'relative', top: 5 }}
                  />
                  <div className={styles['comment-detail']}>
                    <div className={styles['comment-author-info']}>
                      <cite>
                        <span>댓글 미리보기</span>
                      </cite>
                      {files[value] || badge ? (
                        <img
                          className={styles['membership-fan-badge']}
                          src={files[value] ? URL.createObjectURL(files[value]) : badge?.image_url}
                          alt="멤버십팬 배지"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div>
        <button
          type="button"
          className="button medium submit"
          disabled={saving || !Object.keys(files).length}
          onClick={() => void save()}
        >
          저장
        </button>
      </div>
      <FormErrorDialog
        open={Boolean(error)}
        title="멤버십팬 배지"
        messages={error ? [error] : []}
        onClose={() => setError(null)}
      />
    </>
  );
}
