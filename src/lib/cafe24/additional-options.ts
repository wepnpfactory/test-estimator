// Cafe24 추가옵션(additional_options) 등록 헬퍼
//
// 용도: 동적 상품에 wepnpSeqno(디자인 편집 번호), fileUpload(파일 링크) 같은
// 텍스트 입력 옵션을 부착해서, 주문 시 그 값이 주문서에 기록되도록 한다.
//
// 참고: dps/services/external/cafe24/index.ts:1614 (updateAddOption)
// 엔드포인트: POST /api/v2/admin/products/{product_no}/options
// 페이로드 형태:
//   { shop_no, requests: {
//       product_no, has_option, option_type, option_list_type,
//       options: [{ option_name, option_value:[{option_text}] }],
//       use_additional_option: "T",
//       additional_options: [{ additional_option_name, required_additional_option, additional_option_text_length }]
//   } }

import { cafe24Fetch } from "@/lib/cafe24/client";
import type { Cafe24Mall } from "@/generated/prisma/client";

export interface AdditionalOptionField {
  /** 표시 이름. embed/cart 에서 사용할 키와 동일하게 유지 권장. */
  name: string;
  /** 필수 입력 여부 */
  required?: boolean;
  /** 텍스트 길이 제한 (Cafe24 기본 20, 링크 보관 시 길게 잡음) */
  textLength?: number;
}

export interface AttachOptionsParams {
  mall: Cafe24Mall;
  productNo: number;
  shopNo?: number;
  /**
   * 동적 상품은 실제 옵션이 없지만, Cafe24의 옵션 등록 엔드포인트는
   * has_option=T + 단일 옵션 1개를 함께 요구하는 경우가 있다.
   * 기본은 "수량" 옵션 1개로 placeholder 처리.
   */
  dummyOption?: { name: string; value: string };
  additionalOptions: AdditionalOptionField[];
}

/**
 * 동적 상품에 추가옵션(텍스트 입력)을 부착한다.
 * 실패해도 throw 만 한다 (호출 측에서 보상 처리).
 */
export async function attachAdditionalOptions(
  params: AttachOptionsParams,
): Promise<void> {
  const {
    mall,
    productNo,
    shopNo,
    dummyOption = { name: "수량", value: "1" },
    additionalOptions,
  } = params;

  if (additionalOptions.length === 0) return;

  const requests = {
    product_no: productNo,
    has_option: "T",
    option_type: "T",
    option_list_type: "S",
    options: [
      {
        option_name: dummyOption.name,
        option_value: [{ option_text: dummyOption.value }],
      },
    ],
    use_additional_option: "T",
    additional_options: additionalOptions.map((o) => ({
      additional_option_name: o.name,
      required_additional_option: o.required ? "T" : "F",
      additional_option_text_length: o.textLength ?? 20,
    })),
  };

  await cafe24Fetch(
    mall,
    `/api/v2/admin/products/${productNo}/options`,
    {
      method: "POST",
      body: { shop_no: shopNo ?? mall.defaultShopNo ?? 1, requests },
    },
  );
}

/**
 * 카트 form 빌드 시 추가옵션 값을 묶어주기 위한 표준 키 빌더.
 * Cafe24 storefront `/exec/front/order/basket.html` 는
 * `option_add_text_required[<name>]=<value>` 형태로 추가옵션 입력값을 받는다.
 *
 * (비공식 — 테스트몰 검증 필요. 다른 키가 맞다면 이 함수만 수정하면 된다.)
 */
export function buildAdditionalOptionFormFields(
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    out[`option_add_text_required[${k}]`] = v;
  }
  return out;
}
