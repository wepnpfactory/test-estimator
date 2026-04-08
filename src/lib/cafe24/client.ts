// Cafe24 Admin API 호출 래퍼
// 토큰 만료 시 자동 refresh 후 재시도

import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/cafe24/oauth";
import type { Cafe24Mall } from "@/generated/prisma/client";

const TOKEN_REFRESH_MARGIN_MS = 60 * 1000; // 1분 여유

async function ensureFreshToken(mall: Cafe24Mall): Promise<Cafe24Mall> {
  if (
    mall.accessToken &&
    mall.tokenExpiresAt &&
    new Date(mall.tokenExpiresAt).getTime() - Date.now() > TOKEN_REFRESH_MARGIN_MS
  ) {
    return mall;
  }
  if (!mall.refreshToken) {
    throw new Error(`Mall ${mall.mallId} has no refresh token`);
  }
  const token = await refreshAccessToken({
    mallId: mall.mallId,
    clientId: mall.clientId,
    clientSecret: mall.clientSecret,
    refreshToken: mall.refreshToken,
  });
  return prisma.cafe24Mall.update({
    where: { id: mall.id },
    data: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(token.expires_at),
    },
  });
}

export interface Cafe24FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function cafe24Fetch<T = unknown>(
  mallInput: Cafe24Mall | string,
  path: string,
  options: Cafe24FetchOptions = {},
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

  const url = new URL(`https://${mall.mallId}.cafe24api.com${path}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${mall.accessToken}`);
  headers.set("Content-Type", "application/json");
  headers.set("X-Cafe24-Api-Version", "2024-06-01");

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cafe24 API ${res.status} ${path}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
