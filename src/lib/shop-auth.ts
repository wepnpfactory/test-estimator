// 쇼핑몰 → 우리 API 호출 시 Origin 화이트리스트 + HMAC 서명 검증
//
// 정책:
// - Origin 검증: Cafe24Mall.allowedOrigins (관리자 명시) + storefrontOrigin + {mallId}.cafe24.com 폴백
// - HMAC 서명 검증: x-te-ts + x-te-sig 헤더. 서버는 mall.embedSecret 으로 동일 메시지의 HMAC-SHA256 비교
// - 시간 윈도우: ±5분
// - 메시지 포맷: `${ts}.${method.toUpperCase()}.${pathname}.${body}`
//   (body 는 raw text, GET 등 본문이 없으면 빈 문자열)

import crypto from "node:crypto";
import type { Cafe24Mall } from "@/generated/prisma/client";

const TIME_WINDOW_MS = 5 * 60 * 1000;

export function isOriginAllowed(mall: Cafe24Mall, origin: string | null): boolean {
  if (!origin) return false;
  const normalized = origin.replace(/\/+$/, "").toLowerCase();
  const allowed = new Set<string>();
  for (const o of mall.allowedOrigins ?? []) {
    if (o) allowed.add(o.replace(/\/+$/, "").toLowerCase());
  }
  if (mall.storefrontOrigin) {
    allowed.add(mall.storefrontOrigin.replace(/\/+$/, "").toLowerCase());
  }
  allowed.add(`https://${mall.mallId.toLowerCase()}.cafe24.com`);
  return allowed.has(normalized);
}

export function signEmbedRequest(params: {
  secret: string;
  ts: number;
  method: string;
  pathname: string;
  body: string;
}): string {
  const msg = `${params.ts}.${params.method.toUpperCase()}.${params.pathname}.${params.body}`;
  return crypto.createHmac("sha256", params.secret).update(msg).digest("base64url");
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export function verifyEmbedRequest(params: {
  mall: Cafe24Mall;
  ts: string | null;
  sig: string | null;
  method: string;
  pathname: string;
  body: string;
}): VerifyResult {
  if (!params.mall.embedSecret) {
    return { ok: false, reason: "mall has no embedSecret" };
  }
  if (!params.ts || !params.sig) {
    return { ok: false, reason: "missing signature headers" };
  }
  const tsNum = Number(params.ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "invalid ts" };
  const drift = Math.abs(Date.now() - tsNum);
  if (drift > TIME_WINDOW_MS) return { ok: false, reason: "ts outside window" };

  const expected = signEmbedRequest({
    secret: params.mall.embedSecret,
    ts: tsNum,
    method: params.method,
    pathname: params.pathname,
    body: params.body,
  });

  const a = Buffer.from(expected);
  const b = Buffer.from(params.sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}
