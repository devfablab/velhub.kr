import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: '사이트 요금제는 폐지되었습니다.' }, { status: 410 });
}
