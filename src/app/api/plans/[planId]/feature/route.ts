import { NextResponse } from 'next/server';

function retiredResponse() {
  return NextResponse.json({ message: '기존 요금제 기능은 폐지되었습니다.' }, { status: 410 });
}

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}

export async function PATCH() {
  return retiredResponse();
}
