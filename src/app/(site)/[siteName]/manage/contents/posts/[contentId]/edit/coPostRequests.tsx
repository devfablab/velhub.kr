'use client';

import { useEffect, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Stack, Typography } from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import PopupMessage from '@/components/PopupMessage';

type RequestType = 'publish' | 'reschedule' | 'apply_revision' | 'unpublish';

type RequestItem = {
  id: string;
  type: RequestType;
  isMine: boolean;
  publishAt: string | null;
  createdAt: string;
};

type RequestsResponse = {
  publishState?: { state: 'draft' | 'scheduled' | 'published'; publishedAt: string | null; isClosed: boolean };
  hasUnappliedRevision?: boolean;
  requests?: RequestItem[];
  error?: string;
};

function formatTime(value: string | null) {
  return value ? format(new Date(value), 'yyyy년 M월 d일 HH:mm') : '';
}

function describeRequest(item: RequestItem) {
  if (item.type === 'publish') return `${formatTime(item.publishAt)}에 공개`;
  if (item.type === 'reschedule') return `공개 일시를 ${formatTime(item.publishAt)}(으)로 변경`;
  if (item.type === 'apply_revision') return '수정본을 공개 글에 반영';

  return '글 삭제';
}

export default function CoPostRequests({
  coPostId,
  otherName,
  reloadKey,
  listHref,
}: {
  coPostId: string;
  otherName: string;
  reloadKey: number;
  listHref: string;
}) {
  const [data, setData] = useState<RequestsResponse | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [localReloadKey, setLocalReloadKey] = useState(0);
  const [agreedMessage, setAgreedMessage] = useState('');
  const requestsApi = `/api/co-posts/${coPostId}/requests`;

  useEffect(() => {
    let isActive = true;

    fetch(requestsApi, { credentials: 'include' })
      .then((response) => (response.ok ? (response.json() as Promise<RequestsResponse>) : null))
      .then((result) => {
        if (!isActive) return;

        setData(result);

        const receivedTimeRequest = result?.requests?.find(
          (item) => !item.isMine && item.publishAt && (item.type === 'publish' || item.type === 'reschedule'),
        );

        if (receivedTimeRequest?.publishAt) {
          const proposedTime = new Date(receivedTimeRequest.publishAt);
          setSelectedTime((current) => current ?? proposedTime);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [requestsApi, reloadKey, localReloadKey]);

  async function send(
    url: string,
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>,
    agreedPublishAt: string | null = null,
  ) {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string; status?: string };

      if (!response.ok) throw new Error(result.error ?? '요청을 처리하지 못했습니다.');

      const agreedTime =
        result.status === 'agreed' && typeof body.publishAt === 'string' ? body.publishAt : agreedPublishAt;

      if (agreedTime) {
        setAgreedMessage(`공개 일정이 확정되었습니다. ${formatTime(agreedTime)}에 공개됩니다.`);
        return;
      }

      setSelectedTime(null);
      setLocalReloadKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!data?.publishState) {
    return null;
  }

  const { publishState } = data;
  const requests = data.requests ?? [];
  const timeRequestType: RequestType | null =
    publishState.state === 'draft' ? 'publish' : publishState.state === 'scheduled' ? 'reschedule' : null;
  const hasPendingUnpublish = requests.some((item) => item.type === 'unpublish');
  const hasPendingRevision = requests.some((item) => item.type === 'apply_revision');

  return (
    <Stack gap={1.5} className="paper">
      <Typography variant="subtitle2">공개</Typography>
      <Typography variant="body2">
        {publishState.isClosed
          ? '삭제된 글입니다.'
          : publishState.state === 'draft'
            ? `아직 공개 일시가 정해지지 않았습니다. 공개 일시를 정해 ${otherName || '상대'} 님에게 협의를 요청하세요.`
            : publishState.state === 'scheduled'
              ? `${formatTime(publishState.publishedAt)}에 공개됩니다.`
              : `공개된 글입니다. (${formatTime(publishState.publishedAt)})`}
      </Typography>

      {timeRequestType && !publishState.isClosed ? (
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DateTimePicker
              value={selectedTime}
              onChange={(value) => setSelectedTime(value)}
              ampm={false}
              disablePast
              slotProps={{ textField: { size: 'small' } }}
            />
          </LocalizationProvider>
          <button
            type="button"
            className="button small action"
            disabled={isSubmitting || !selectedTime}
            onClick={() =>
              void send(requestsApi, 'POST', { type: timeRequestType, publishAt: selectedTime?.toISOString() })
            }
          >
            {timeRequestType === 'publish' ? '공개 협의 요청' : '일시 변경 요청'}
          </button>
        </Stack>
      ) : null}

      {publishState.state !== 'draft' && !publishState.isClosed ? (
        <Stack direction="row" gap={1} flexWrap="wrap">
          {data.hasUnappliedRevision && !hasPendingRevision ? (
            <button
              type="button"
              className="button small action"
              disabled={isSubmitting}
              onClick={() => void send(requestsApi, 'POST', { type: 'apply_revision' })}
            >
              수정본 반영 요청
            </button>
          ) : null}
          {hasPendingUnpublish ? null : (
            <button
              type="button"
              className="button small cancel"
              disabled={isSubmitting}
              onClick={() => void send(requestsApi, 'POST', { type: 'unpublish' })}
            >
              삭제 요청
            </button>
          )}
        </Stack>
      ) : null}

      {requests.map((item) => (
        <Stack
          key={item.id}
          direction={{ xs: 'column', md: 'row' }}
          gap={1}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
        >
          <Typography variant="body2">
            {item.isMine
              ? `내 요청: ${describeRequest(item)} · ${otherName || '상대'} 님의 응답을 기다리는 중`
              : `${otherName || '상대'} 님의 요청: ${describeRequest(item)}`}
          </Typography>
          <Stack direction="row" gap={1} flexShrink={0}>
            {item.isMine ? (
              <button
                type="button"
                className="button small cancel"
                disabled={isSubmitting}
                onClick={() => void send(`${requestsApi}/${item.id}`, 'PATCH', { action: 'cancel' })}
              >
                요청 취소
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="button small cancel"
                  disabled={isSubmitting}
                  onClick={() => void send(`${requestsApi}/${item.id}`, 'PATCH', { action: 'decline' })}
                >
                  거절
                </button>
                <button
                  type="button"
                  className="button small action"
                  disabled={isSubmitting}
                  onClick={() =>
                    void send(
                      `${requestsApi}/${item.id}`,
                      'PATCH',
                      { action: 'accept' },
                      item.type === 'publish' || item.type === 'reschedule' ? item.publishAt : null,
                    )
                  }
                >
                  동의
                </button>
              </>
            )}
          </Stack>
        </Stack>
      ))}

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      <PopupMessage
        open={Boolean(agreedMessage)}
        message={agreedMessage}
        onClose={() => {
          window.location.href = listHref;
        }}
      />
    </Stack>
  );
}
