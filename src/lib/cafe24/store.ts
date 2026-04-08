// Cafe24 Store(쇼핑몰 정보) API
// docs: https://developers.cafe24.com/docs/en/api/admin/?version=2025-12-01#retrieve-store-information

import { cafe24Fetch } from "@/lib/cafe24/client";
import type { Cafe24Mall } from "@/generated/prisma/client";

interface StoreResponse {
  store: {
    shop_no: number;
    shop_name?: string;
    primary_domain?: string;
    base_domain?: string;
    company_name?: string;
    [k: string]: unknown;
  };
}

/**
 * 몰의 storefront origin (https 포함)을 best-effort로 알아낸다.
 * 우선순위: primary_domain > base_domain > {mallId}.cafe24.com
 */
export async function fetchStorefrontOrigin(
  mall: Cafe24Mall,
): Promise<string> {
  try {
    const res = await cafe24Fetch<StoreResponse>(mall, "/api/v2/admin/store");
    const domain =
      res.store?.primary_domain ||
      res.store?.base_domain ||
      `${mall.mallId}.cafe24.com`;
    return normalizeOrigin(domain);
  } catch {
    return `https://${mall.mallId}.cafe24.com`;
  }
}

function normalizeOrigin(domainOrUrl: string): string {
  const trimmed = domainOrUrl.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
