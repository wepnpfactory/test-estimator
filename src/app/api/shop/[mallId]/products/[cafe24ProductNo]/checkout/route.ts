import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preflight, withCors } from "@/lib/cors";
import { calculateQuote } from "@/lib/pricing/calculate";
import {
  attachDynamicProductAdditionalOptions,
  buildAddToCartUrl,
  createDynamicProduct,
  deleteDynamicProduct,
} from "@/lib/cafe24/dynamic-product";
import { buildAdditionalOptionFormFields } from "@/lib/cafe24/additional-options";
import { isOriginAllowed } from "@/lib/shop-auth";

const Body = z.object({
  selections: z
    .array(
      z.object({
        groupId: z.string().min(1).max(64),
        itemId: z.string().min(1).max(64).optional(),
        directValue: z.number().int().min(0).max(1_000_000).optional(),
        widthMm: z.number().int().min(0).max(10_000).optional(),
        heightMm: z.number().int().min(0).max(10_000).optional(),
      })
    )
    .max(50),
  customer: z
    .object({
      id: z.string().max(128).optional(),
      email: z.string().max(254).optional(),
      name: z.string().max(64).optional(),
    })
    .optional(),
  designNo: z.string().max(64).optional(),
  file: z
    .object({
      url: z.string().url().max(2048),
      name: z.string().max(255).optional(),
    })
    .optional(),
});

const DYNAMIC_PRODUCT_TTL_MINUTES = 60;

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mallId: string; cafe24ProductNo: string }> }
) {
  const origin = req.headers.get("origin");
  const { mallId, cafe24ProductNo } = await params;

  const productNo = Number(cafe24ProductNo);
  if (!Number.isInteger(productNo) || productNo <= 0) {
    return withCors({ error: "invalid product no" }, origin, { status: 400 });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return withCors({ error: "invalid body", detail: e instanceof Error ? e.message : null }, origin, { status: 400 });
  }

  const mall = await prisma.cafe24Mall.findUnique({ where: { mallId } });
  if (!mall) {
    return withCors({ error: "mall not found" }, origin, { status: 404 });
  }
  if (!isOriginAllowed(mall, origin)) {
    return withCors({ error: "origin not allowed" }, origin, { status: 403 });
  }
  if (!mall.accessToken) {
    return withCors({ error: "mall not connected" }, origin, { status: 503 });
  }

  const product = await prisma.product.findFirst({
    where: { mallId: mall.id, cafe24ProductNo: productNo, status: "PUBLISHED" },
    include: { optionGroups: { include: { items: true } } },
  });
  if (!product) {
    return withCors({ error: "not found" }, origin, { status: 404 });
  }

  const quote = calculateQuote(product, parsed.selections);
  if (quote.errors.length > 0) {
    return withCors({ error: "invalid selections", quote }, origin, {
      status: 422,
    });
  }
  if (quote.finalPrice < 0) {
    return withCors({ error: "finalPrice negative", quote }, origin, { status: 422 });
  }

  const summary = quote.resolvedItems.map((r) => `${r.groupName}: ${r.label}`).join(" / ");

  // 1) DynamicProduct row 선기록
  const dyn = await prisma.dynamicProduct.create({
    data: {
      mallId: mall.id,
      sourceProductId: product.id,
      selectedOptions: parsed.selections,
      finalPrice: quote.finalPrice,
      customerId: parsed.customer?.id,
      customerEmail: parsed.customer?.email,
      customerName: parsed.customer?.name,
      designNo: parsed.designNo,
      fileUrl: parsed.file?.url,
      fileName: parsed.file?.name,
      status: "CREATED",
      expiresAt: new Date(Date.now() + DYNAMIC_PRODUCT_TTL_MINUTES * 60 * 1000),
    },
  });

  // 2) Cafe24 일회용 상품 등록
  let createdProductNo: number | null = null;
  let createdProductCode: string | null = null;
  try {
    const created = await createDynamicProduct({
      mall,
      productName: `${product.name} #${dyn.id.slice(-6)}`,
      price: quote.finalPrice,
      summary,
      customCode: `DYN-${dyn.id}`,
      categoryNo: mall.dynamicCategoryNo ?? undefined,
    });
    createdProductNo = created.productNo;
    createdProductCode = created.productCode;
  } catch (err) {
    await prisma.dynamicProduct.update({
      where: { id: dyn.id },
      data: { status: "FAILED" },
    });
    return withCors(
      {
        error: "cafe24 product creation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      origin,
      { status: 502 }
    );
  }

  // 3) 추가옵션(wepnpSeqno / fileUpload) 부착 — 둘 중 하나라도 있을 때만
  const hasDesignNo = Boolean(parsed.designNo);
  const hasFile = Boolean(parsed.file?.url);
  if (hasDesignNo || hasFile) {
    try {
      await attachDynamicProductAdditionalOptions({
        mall,
        productNo: createdProductNo,
        hasDesignNo,
        hasFile,
      });
    } catch (err) {
      // 보상: 추가옵션 부착 실패면 동적 상품도 삭제하고 FAILED
      try {
        await deleteDynamicProduct(mall, createdProductNo);
      } catch (cleanupErr) {
        console.error("[checkout] additional options + cleanup both failed", cleanupErr);
      }
      await prisma.dynamicProduct.update({
        where: { id: dyn.id },
        data: { status: "FAILED" },
      });
      return withCors(
        {
          error: "cafe24 additional options failed",
          detail: err instanceof Error ? err.message : String(err),
        },
        origin,
        { status: 502 }
      );
    }
  }

  // 4) DB 갱신
  try {
    await prisma.dynamicProduct.update({
      where: { id: dyn.id },
      data: {
        cafe24ProductNo: createdProductNo,
        cafe24ProductCode: createdProductCode,
        status: "IN_CART",
      },
    });
  } catch (err) {
    // 보상: DB 갱신 실패 → Cafe24 상품 삭제 시도
    try {
      await deleteDynamicProduct(mall, createdProductNo);
    } catch (cleanupErr) {
      console.error("[checkout] db update failed; cleanup also failed", cleanupErr);
    }
    return withCors(
      {
        error: "db update failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      origin,
      { status: 500 }
    );
  }

  // 5) 장바구니 페이로드 생성
  const storefrontOrigin = mall.storefrontOrigin || `https://${mall.mallId}.cafe24.com`;
  const cartUrl = buildAddToCartUrl({
    storefrontOrigin,
    productNo: createdProductNo,
  });

  // 추가옵션 값(wepnpSeqno, fileUpload)을 cart form 필드 형태로 패키징
  const additionalOptionValues: Record<string, string> = {};
  if (parsed.designNo) additionalOptionValues.wepnpSeqno = parsed.designNo;
  if (parsed.file?.url) {
    const label = parsed.file.name || parsed.file.url;
    // dps 패턴: a 링크로 보관 → 주문서에 클릭 가능한 형태로 노출
    additionalOptionValues.fileUpload = `<a href="${parsed.file.url}" target="_blank" rel="noopener">${escapeText(label)}</a>`;
  }
  const cartFormFields = buildAdditionalOptionFormFields(additionalOptionValues);

  return withCors(
    {
      ok: true,
      dynamicProductId: dyn.id,
      cafe24ProductNo: createdProductNo,
      finalPrice: quote.finalPrice,
      cartUrl,
      cartForm: {
        action: new URL("/exec/front/order/basket.html", storefrontOrigin).toString(),
        method: "POST",
        fields: {
          product_no: String(createdProductNo),
          quantity: "1",
          basket_type: "A0000",
          ...cartFormFields,
        },
      },
    },
    origin
  );
}

function escapeText(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c;
  });
}
