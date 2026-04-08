// 쇼핑몰 도메인에서 호출하는 API 용 CORS 헬퍼
//
// 운영 정책:
// - Allow-Credentials 미사용. 따라서 Access-Control-Allow-Origin echo는 보안상 OK.
// - 단, x-te-ts / x-te-sig 헤더와 함께 호출하므로 헤더 화이트리스트에 포함.
// - 실제 권한 검사는 lib/shop-auth.ts 의 isOriginAllowed + verifyEmbedRequest 가 담당.

import { NextResponse } from "next/server";

export function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-te-ts, x-te-sig",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function withCors<T>(data: T, origin: string | null, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...corsHeaders(origin), ...(init?.headers || {}) },
  });
}

export function preflight(origin: string | null) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
