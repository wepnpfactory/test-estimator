// Cafe24 카테고리 트리 조회
// docs: https://developers.cafe24.com/docs/en/api/admin/?version=2025-12-01#retrieve-a-list-of-categories

import { cafe24Fetch } from "@/lib/cafe24/client";
import type { Cafe24Mall } from "@/generated/prisma/client";

export interface Cafe24Category {
  shopNo: number;
  categoryNo: number;
  categoryName: string;
  categoryDepth: number;
  parentCategoryNo: number;
}

interface RawCategory {
  shop_no?: number;
  category_no: number;
  category_name: string;
  category_depth: number;
  parent_category_no: number;
}

interface ListResponse {
  categories?: RawCategory[];
}

export async function listCategories(mall: Cafe24Mall, shopNo?: number): Promise<Cafe24Category[]> {
  // Cafe24 categories API 는 limit 100 단위 페이지네이션 — MVP는 단일 페이지
  const res = await cafe24Fetch<ListResponse>(mall, "/api/v2/admin/categories", {
    method: "GET",
    query: {
      shop_no: shopNo ?? mall.defaultShopNo ?? 1,
      limit: 100,
    },
  });
  return (res.categories ?? []).map((c) => ({
    shopNo: c.shop_no ?? 1,
    categoryNo: c.category_no,
    categoryName: c.category_name,
    categoryDepth: c.category_depth,
    parentCategoryNo: c.parent_category_no,
  }));
}
