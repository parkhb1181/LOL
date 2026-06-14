import { NextRequest, NextResponse } from 'next/server';

// R2 pub-*.r2.dev URL만 허용 — SSRF 방지
const ALLOWED_HOST_RE = /^pub-[\w-]+\.r2\.dev$/;

// 배틀 캔버스용 이미지 프록시 — R2 dev URL은 CORS 미설정이라 캔버스 직접 접근 차단됨
// GET /battle/img?url=<R2 이미지 URL> → 서버에서 fetch 후 동일 origin 응답
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');

  if (!raw) {
    return new NextResponse('url 파라미터 없음', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new NextResponse('잘못된 URL 형식', { status: 400 });
  }

  if (!ALLOWED_HOST_RE.test(parsed.hostname)) {
    return new NextResponse('허용되지 않은 호스트', { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(raw);
  } catch {
    return new NextResponse('R2 fetch 실패', { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse('R2 응답 실패', { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/webp',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
