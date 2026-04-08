// 쇼핑몰 도메인에서 호출하는 API 용 CORS 헬퍼
// MVP는 모든 출처 허용. 운영에서는 화이트리스트로 좁혀야 함.

import { NextResponse } from "next/server";

export function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
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
