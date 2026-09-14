import { NextResponse } from 'next/server';

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export async function GET(_: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
    return NextResponse.json({ exists: false });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, {
      next: { revalidate: 300 },
    });

    return NextResponse.json({ exists: response.ok });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
