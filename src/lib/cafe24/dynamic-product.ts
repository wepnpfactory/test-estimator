// 옵션 조합 + 최종가로 Cafe24에 미진열 일회용 상품을 등록한다
// docs: https://developers.cafe24.com/docs/api/admin/#create-a-product

import { cafe24Fetch } from "@/lib/cafe24/client";
import type { Cafe24Mall } from "@/generated/prisma/client";

export interface CreateDynamicProductInput {
  mall: Cafe24Mall;
  // 표시용 이름 (관리자에서 식별 가능하게)
  productName: string;
  // 최종 결정된 단가 (원)
  price: number;
  // 동적 상품임을 나타내는 짧은 설명 (옵션 조합 요약 등)
  summary: string;
}

export interface CreateDynamicProductResult {
  productNo: number;
  productCode: string;
}

export async function createDynamicProduct(
  input: CreateDynamicProductInput,
): Promise<CreateDynamicProductResult> {
  // Cafe24는 진열·검색·판매·전시 플래그가 분리되어 있다.
  // 일회용 상품이므로 진열 F, 검색 F, 판매 T 로 만든다.
  const body = {
    shop_no: 1,
    request: {
      // 표시 이름에 동적 식별자 prefix
      product_name: `[DYN] ${input.productName}`,
      // 한글 원가/판매가
      price: String(input.price),
      retail_price: "0",
      supply_price: "0",
      // 진열·노출 제어
      display: "F",
      selling: "T",
      product_condition: "N",
      summary_description: input.summary,
      // 검색 노출 차단
      search_engine_exposure: "F",
      // 회원 등급 노출 제한 등은 MVP에선 생략
      // 카테고리/제조사/공급사도 MVP는 생략
    },
  };

  const res = await cafe24Fetch<{
    product: { product_no: number; product_code: string };
  }>(input.mall, "/api/v2/admin/products", {
    method: "POST",
    body,
  });

  return {
    productNo: res.product.product_no,
    productCode: res.product.product_code,
  };
}

/**
 * 쇼핑몰 도메인 기준 장바구니 담기 딥링크 생성.
 * Cafe24 Admin API에는 cart 관련 엔드포인트가 없으므로,
 * 고객 브라우저에서 GET 으로 진입하면 해당 상품이 장바구니에 담긴다.
 */
export function buildAddToCartUrl(params: {
  mallId: string;
  productNo: number;
  quantity?: number;
}): string {
  const { mallId, productNo, quantity = 1 } = params;
  const u = new URL(`https://${mallId}.cafe24.com/order/basket.html`);
  u.searchParams.set("product_no", String(productNo));
  u.searchParams.set("quantity", String(quantity));
  return u.toString();
}
