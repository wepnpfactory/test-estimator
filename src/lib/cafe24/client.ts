// Cafe24 Admin API 호출 래퍼
//
// 책임:
// - 토큰 만료 임박 시 mall 단위 단일화된 refresh
// - 토큰이 서버측에서 폐기되어 401이 떨어지면 1회 강제 refresh + 재시도
// - 동일 프로세스 내 동시 요청을 in-process promise 캐시로 직렬화
// - DB compare-and-swap 으로 다른 프로세스(서버리스 인스턴스)와도 충돌 회피

import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/cafe24/oauth";
import type { Cafe24Mall } from "@/generated/prisma/client";

// 만료 5분 전부터 미리 갱신 (Vercel 콜드스타트·클럭 스큐 마진)
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// 같은 프로세스 안에서 동일 mall에 대한 refresh를 하나로 합친다.
const refreshInFlight = new Map<string, Promise<Cafe24Mall>>();

function tokenIsFresh(mall: Cafe24Mall): boolean {
  if (!mall.accessToken || !mall.tokenExpiresAt) return false;
  return new Date(mall.tokenExpiresAt).getTime() - Date.now() > TOKEN_REFRESH_MARGIN_MS;
}

async function refreshOnce(mall: Cafe24Mall): Promise<Cafe24Mall> {
  if (!mall.refreshToken) {
    throw new Error(`Mall ${mall.mallId} has no refresh token`);
  }
  const oldRefresh = mall.refreshToken;

  const token = await refreshAccessToken({
    mallId: mall.mallId,
    clientId: mall.clientId,
    clientSecret: mall.clientSecret,
    refreshToken: oldRefresh,
  });

  // Compare-and-swap: 다른 인스턴스가 이미 갱신했다면 우리 결과를 덮어쓰지 않는다.
  const updated = await prisma.cafe24Mall.updateMany({
    where: { id: mall.id, refreshToken: oldRefresh },
    data: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(token.expires_at),
    },
  });

  if (updated.count === 0) {
    // 다른 인스턴스가 먼저 갱신함 — DB 의 최신 값을 사용
    const fresh = await prisma.cafe24Mall.findUniqueOrThrow({
      where: { id: mall.id },
    });
    return fresh;
  }
  return prisma.cafe24Mall.findUniqueOrThrow({ where: { id: mall.id } });
}

async function ensureFreshToken(mall: Cafe24Mall): Promise<Cafe24Mall> {
  if (tokenIsFresh(mall)) return mall;

  const key = mall.id;
  const inflight = refreshInFlight.get(key);
  if (inflight) return inflight;

  const p = refreshOnce(mall).finally(() => {
    refreshInFlight.delete(key);
  });
  refreshInFlight.set(key, p);
  return p;
}

/** 외부에서 401 받은 후 강제 갱신용 */
async function forceRefresh(mall: Cafe24Mall): Promise<Cafe24Mall> {
  // tokenExpiresAt 을 무시하고 무조건 한 번 갱신
  const key = mall.id;
  const inflight = refreshInFlight.get(key);
  if (inflight) return inflight;
  const p = refreshOnce(mall).finally(() => {
    refreshInFlight.delete(key);
  });
  refreshInFlight.set(key, p);
  return p;
}

export interface Cafe24FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function cafe24Fetch<T = unknown>(
  mallInput: Cafe24Mall | string,
  path: string,
  options: Cafe24FetchOptions = {}
): Promise<T> {
  let mall: Cafe24Mall;
  if (typeof mallInput === "string") {
    const found = await prisma.cafe24Mall.findUnique({
      where: { mallId: mallInput },
    });
    if (!found) throw new Error(`Mall not found: ${mallInput}`);
    mall = found;
  } else {
    mall = mallInput;
  }
  mall = await ensureFreshToken(mall);

  const doFetch = async (token: string): Promise<Response> => {
    const url = new URL(`https://${mall.mallId}.cafe24api.com${path}`);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Content-Type", "application/json");
    headers.set("X-Cafe24-Api-Version", "2026-03-01");
    return fetch(url, {
      ...options,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  };

  let res = await doFetch(mall.accessToken!);

  // 401: 서버측에서 토큰 폐기됨 → 강제 refresh 후 1회 재시도
  if (res.status === 401) {
    try {
      mall = await forceRefresh(mall);
      res = await doFetch(mall.accessToken!);
    } catch (refreshErr) {
      throw new Error(
        `Cafe24 401 + refresh failed: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`
      );
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {}
    throw new Cafe24ApiError(res.status, path, text, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class Cafe24ApiError extends Error {
  status: number;
  path: string;
  body: unknown;
  constructor(status: number, path: string, raw: string, body: unknown) {
    super(`Cafe24 API ${status} ${path}: ${raw}`);
    this.name = "Cafe24ApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}
