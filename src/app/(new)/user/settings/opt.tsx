'use client';

import { useEffect, useState } from 'react';
import { Stack, TextField, Typography } from '@mui/material';

export default function Opt() {
  const [handleName, setHandleName] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/creator/profile').then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? '작가 정보를 불러오지 못했습니다.');
      if (payload.creator?.handleName) window.location.replace(`/user/${payload.creator.handleName}`);
      setReady(true);
    }).catch((error) => setMessage(error instanceof Error ? error.message : '작가 정보를 불러오지 못했습니다.'));
  }, []);

  if (message) return <Typography variant="body2" color="error">{message}</Typography>;
  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/creator/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handleName, introduction: '', coverImage: '', links: [] }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? '핸들네임을 저장하지 못했습니다.');
      window.location.assign(`/user/${payload.creator.handleName}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '핸들네임을 저장하지 못했습니다.');
      setSaving(false);
    }
  };
  if (!ready) return null;
  return <Stack gap={3}><Typography variant="h6">유저 프로필 설정</Typography><Stack gap={1}><Typography variant="subtitle2">핸들네임</Typography><TextField size="small" value={handleName} onChange={(event) => setHandleName(event.target.value)} inputProps={{ maxLength: 15 }} helperText="영문 소문자, 숫자, 하이픈으로 3~15자 입력해 주세요." /></Stack>{message ? <Typography variant="body2" color="error">{message}</Typography> : null}<Stack direction="row" justifyContent="flex-end"><button type="button" className="button medium submit" onClick={save} disabled={saving}>{saving ? '저장 중' : '저장'}</button></Stack></Stack>;
}
