// Cafe24 상품 조회·관리
// docs: https://developers.cafe24.com/docs/en/api/admin/?version=2025-12-01#products

import { cafe24Fetch } from "@/lib/cafe24/client";
import type { Cafe24Mall } from "@/generated/prisma/client";

export interface Cafe24ProductSummary {
  shopNo: number;
  productNo: number;
  productCode: string;
  productName: string;
  price: string;
  display: string; // T/F
  selling: string; // T/F
  detailImage?: string | null;
  listImage?: string | null;
  createdDate?: string;
}

interface RawCafe24Product {
  shop_no?: number;
  product_no: number;
  product_code: string;
  product_name: string;
  price?: string;
  display?: string;
  selling?: string;
  detail_image?: string | null;
  list_image?: string | null;
  created_date?: string;
}

interface ListResponse {
  products?: RawCafe24Product[];
}

export interface ListProductsParams {
  mall: Cafe24Mall;
  search?: string; // product_name 부분일치
  limit?: number; // 기본 20, 최대 100
  offset?: number;
  shopNo?: number;
  display?: "T" | "F";
  selling?: "T" | "F";
}

function normalize(p: RawCafe24Product): Cafe24ProductSummary {
  return {
    shopNo: p.shop_no ?? 1,
    productNo: p.product_no,
    productCode: p.product_code,
    productName: p.product_name,
    price: p.price ?? "0",
    display: p.display ?? "T",
    selling: p.selling ?? "T",
    detailImage: p.detail_image ?? null,
    listImage: p.list_image ?? null,
    createdDate: p.created_date,
  };
}

export async function listProducts(
  params: ListProductsParams,
): Promise<Cafe24ProductSummary[]> {
  const { mall, search, limit = 20, offset = 0, shopNo, display, selling } = params;
  const query: Record<string, string | number | undefined> = {
    shop_no: shopNo ?? mall.defaultShopNo ?? 1,
    limit: Math.min(Math.max(limit, 1), 100),
    offset: Math.max(offset, 0),
  };
  if (search && search.trim()) query.product_name = search.trim();
  if (display) query.display = display;
  if (selling) query.selling = selling;

  const res = await cafe24Fetch<ListResponse>(mall, "/api/v2/admin/products", {
    method: "GET",
    query,
  });
  return (res.products ?? []).map(normalize);
}

export async function getProduct(
  mall: Cafe24Mall,
  productNo: number,
  shopNo?: number,
): Promise<Cafe24ProductSummary | null> {
  try {
    const res = await cafe24Fetch<{ product?: RawCafe24Product }>(
      mall,
      `/api/v2/admin/products/${productNo}`,
      {
        method: "GET",
        query: { shop_no: shopNo ?? mall.defaultShopNo ?? 1 },
      },
    );
    return res.product ? normalize(res.product) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 디스플레이 상품 신규 등록 (관리자가 직접 Cafe24에 진열용 상품 생성)
// ─────────────────────────────────────────────
export interface CreateFacadeProductInput {
  mall: Cafe24Mall;
  productName: string;
  price: number;
  /** 진열 여부 (default T) */
  display?: boolean;
  /** 판매 여부 (default T) */
  selling?: boolean;
  summaryDescription?: string;
  description?: string;
  detailImageUrl?: string;
  categoryNo?: number;
  shopNo?: number;
}

export async function createFacadeProduct(
  input: CreateFacadeProductInput,
): Promise<Cafe24ProductSummary> {
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error(`invalid price: ${input.price}`);
  }
  if (!input.productName.trim()) {
    throw new Error("productName is required");
  }

  const request: Record<string, unknown> = {
    product_name: input.productName.slice(0, 250),
    price: String(Math.floor(input.price)),
    retail_price: "0",
    supply_price: "0",
    supply_price_controlled: "F",
    display: input.display === false ? "F" : "T",
    selling: input.selling === false ? "F" : "T",
    has_option: "F",
    product_condition: "N",
    tax_type: "A",
    member_group_list_use: "F",
    mobile_use: "T",
    // 명시적으로 facade 임을 표시
    custom_product_code: `FCD-${Date.now().toString(36)}`,
  };
  if (input.summaryDescription) {
    request.summary_description = input.summaryDescription;
  }
  if (input.description) {
    request.description = input.description;
  }
  if (input.detailImageUrl) {
    request.detail_image = input.detailImageUrl;
  }
  if (typeof input.categoryNo === "number" && input.categoryNo > 0) {
    request.add_category_no = [
      { category_no: input.categoryNo, recommend: "F", new: "T" },
    ];
  }

  const body = {
    shop_no: input.shopNo ?? input.mall.defaultShopNo ?? 1,
    request,
  };

  const res = await cafe24Fetch<{ product: RawCafe24Product }>(
    input.mall,
    "/api/v2/admin/products",
    { method: "POST", body },
  );
  return normalize(res.product);
}
