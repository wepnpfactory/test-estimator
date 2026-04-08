// 옵션 조합 + 최종가로 Cafe24에 미진열 일회용 상품을 등록한다
// docs: https://developers.cafe24.com/docs/en/api/admin/?version=2025-12-01#create-a-product
//
// 페이로드 설계 메모:
// - wrapper 키는 단일 생성 시 `request`, 응답은 `product` (단수)
// - product_name 외에는 사실상 전부 옵셔널이지만, 일부 storefront 스킨이 카테고리 없는
//   상품의 basket 진입을 거부하는 사례가 있어 카테고리 지정이 가능하면 함께 보낸다
// - has_option: F → 단일가 동적 상품
// - tax_type: A → 과세 (대부분의 케이스)
// - selling: T 가 없으면 basket 진입 자체가 거부됨

import { cafe24Fetch } from "@/lib/cafe24/client";
import {
  attachAdditionalOptions,
  type AdditionalOptionField,
} from "@/lib/cafe24/additional-options";
import type { Cafe24Mall } from "@/generated/prisma/client";

export interface CreateDynamicProductInput {
  mall: Cafe24Mall;
  /** 표시용 이름 (관리자에서 식별 가능하게) */
  productName: string;
  /** 최종 결정된 단가 (원). 0 미만이면 거부 */
  price: number;
  /** 동적 상품임을 나타내는 짧은 설명 (옵션 조합 요약 등) */
  summary: string;
  /**
   * 우리쪽 식별자 (DynamicProduct.id 등). custom_product_code 로 전송되어
   * 후속 정리·매칭에 사용된다.
   */
  customCode?: string;
  /**
   * 일부 스킨에서 무카테고리 상품의 basket 진입을 거부하는 사례가 있어
   * 운영용 "동적상품" 카테고리 번호가 있으면 같이 묶는다.
   */
  categoryNo?: number;
  /** 멀티샵 환경의 경우 지정. 기본 1 */
  shopNo?: number;
}

export interface CreateDynamicProductResult {
  productNo: number;
  productCode: string;
}

export async function createDynamicProduct(
  input: CreateDynamicProductInput,
): Promise<CreateDynamicProductResult> {
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error(`invalid price: ${input.price}`);
  }
  if (!input.productName.trim()) {
    throw new Error("productName is required");
  }

  // 250자 제한 (Cafe24 product_name)
  const safeName = `[DYN] ${input.productName}`.slice(0, 250);

  const request: Record<string, unknown> = {
    product_name: safeName,
    price: String(input.price),
    retail_price: "0",
    supply_price: "0",
    supply_price_controlled: "F",
    // 진열·노출 제어 — 일회용이므로 목록/검색 노출 차단
    display: "F",
    selling: "T",
    search_engine_exposure: "F",
    // 단일가 일회용 상품
    has_option: "F",
    product_condition: "N",
    tax_type: "A",
    summary_description: input.summary,
    // 회원 등급 제한 해제 (모든 회원이 결제 가능해야 함)
    member_group_list_use: "F",
    // 모바일 결제 허용
    mobile_use: "T",
  };

  if (input.customCode) request.custom_product_code = input.customCode;
  if (typeof input.categoryNo === "number" && input.categoryNo > 0) {
    request.add_category_no = [
      { category_no: input.categoryNo, recommend: "F", new: "F" },
    ];
  }

  const body = {
    shop_no: input.shopNo ?? input.mall.defaultShopNo ?? 1,
    request,
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
 * 등록된 동적 상품을 Cafe24에서 삭제한다.
 * - 체크아웃 도중 보상 트랜잭션 (Cafe24엔 등록됐는데 DB 갱신 실패한 경우)
 * - 만료된 미결제 동적 상품 정리 배치
 */
export async function deleteDynamicProduct(
  mall: Cafe24Mall,
  productNo: number,
): Promise<void> {
  await cafe24Fetch(mall, `/api/v2/admin/products/${productNo}`, {
    method: "DELETE",
  });
}

/**
 * 주문이 완료된 동적 상품을 비활성화한다.
 * 삭제하면 주문서에서 상품 정보 조회가 불가능해지므로, 판매·진열만 끈다.
 */
export async function deactivateDynamicProduct(
  mall: Cafe24Mall,
  productNo: number,
): Promise<void> {
  await cafe24Fetch(mall, `/api/v2/admin/products/${productNo}`, {
    method: "PUT",
    body: {
      shop_no: mall.defaultShopNo ?? 1,
      request: {
        display: "F",
        selling: "F",
      },
    },
  });
}

/**
 * 동적 상품의 추가옵션 입력 필드를 등록한다.
 * - wepnpSeqno: jarvis 디자인 편집번호 (있으면 등록)
 * - fileUpload: S3 파일 a 링크 (있으면 등록)
 * 둘 중 하나라도 사용한다면 호출.
 */
export async function attachDynamicProductAdditionalOptions(params: {
  mall: Cafe24Mall;
  productNo: number;
  hasDesignNo: boolean;
  hasFile: boolean;
}): Promise<void> {
  const fields: AdditionalOptionField[] = [];
  if (params.hasDesignNo) {
    fields.push({ name: "wepnpSeqno", required: false, textLength: 64 });
  }
  if (params.hasFile) {
    // S3 a 링크 보관용 — 길어질 수 있어 충분히 잡음
    fields.push({ name: "fileUpload", required: false, textLength: 1024 });
  }
  if (fields.length === 0) return;

  await attachAdditionalOptions({
    mall: params.mall,
    productNo: params.productNo,
    additionalOptions: fields,
  });
}

/**
 * 쇼핑몰 storefront 도메인 기준 장바구니 담기 URL 생성.
 *
 * 주의:
 * - Cafe24 Admin API에는 서버에서 임의 브라우저 세션의 카트를 조작할 수 있는
 *   엔드포인트가 없다. Front API `POST /api/v2/carts`는 고객 OAuth 토큰을
 *   요구하므로 우리 서버 단독으로는 사용 불가.
 * - 따라서 고객 브라우저를 직접 storefront URL로 보내야 한다.
 * - `/order/basket.html?product_no=...` 패턴은 비공식이지만 사실상 안정적.
 *   ※ 단, 일부 스킨/몰에서 동작이 다르면 self-submit POST form 으로 전환 필요.
 *
 * @param storefrontOrigin 몰의 실제 storefront origin (예: https://hitedin.cafe24.com).
 *                        커스텀 도메인 사용 몰의 세션 분리 문제를 피하려면 반드시
 *                        실제 사용 중인 origin을 넣을 것.
 */
export function buildAddToCartUrl(params: {
  storefrontOrigin: string;
  productNo: number;
  quantity?: number;
}): string {
  const { storefrontOrigin, productNo, quantity = 1 } = params;
  const u = new URL("/order/basket.html", storefrontOrigin);
  u.searchParams.set("product_no", String(productNo));
  u.searchParams.set("quantity", String(quantity));
  return u.toString();
}

/**
 * 비공식 GET 딥링크가 동작하지 않는 몰을 위한 폴백.
 * 브라우저에서 form.submit() 으로 호출되도록 HTML 문자열을 생성한다.
 * 서버에서 직접 호출하지 말고 embed.js가 사용한다.
 */
export function buildAddToCartFormHtml(params: {
  storefrontOrigin: string;
  productNo: number;
  quantity?: number;
}): string {
  const { storefrontOrigin, productNo, quantity = 1 } = params;
  const action = new URL("/exec/front/order/basket.html", storefrontOrigin).toString();
  return `<form id="te-cart-form" method="POST" action="${escapeAttr(action)}">
    <input type="hidden" name="product_no" value="${productNo}">
    <input type="hidden" name="quantity" value="${quantity}">
    <input type="hidden" name="basket_type" value="A0000">
    <input type="hidden" name="duplicated_item_check" value="F">
  </form>
  <script>document.getElementById('te-cart-form').submit();</script>`;
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ||
      c
    );
  });
}
