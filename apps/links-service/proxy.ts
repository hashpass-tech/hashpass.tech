import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = new Set((process.env.HASHPASS_LINKS_ALLOWED_ORIGINS || 'https://hashpass.club').split(',').map(value => value.trim()));

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) return new NextResponse('Origin not allowed', { status: 403 });
  const response = request.method === 'OPTIONS' ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  if (origin) {
    response.headers.set('access-control-allow-origin', origin);
    response.headers.set('vary', 'Origin');
    response.headers.set('access-control-allow-headers', 'authorization, content-type');
    response.headers.set('access-control-allow-methods', 'GET, POST, PATCH, OPTIONS');
  }
  return response;
}

export const config = { matcher: '/api/:path*' };
