import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preflight, withCors } from "@/lib/cors";
import { calculateQuote } from "@/lib/pricing/calculate";
import {
  buildAddToCartUrl,
  createDynamicProduct,
} from "@/lib/cafe24/dynamic-product";

const Body = z.object({
  selections: z
    .array(z.object({ groupId: z.string(), itemId: z.string() }))
    .max(50),
});

const DYNAMIC_PRODUCT_TTL_MINUTES = 60;

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cafe24ProductNo: string }> },
) {
  const origin = req.headers.get("origin");
  const { cafe24ProductNo } = await params;
  const productNo = Number(cafe24ProductNo);
  if (!Number.isFinite(productNo)) {
    return withCors({ error: "invalid product no" }, origin, { status: 400 });
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return withCors(
      { error: "invalid body", detail: e instanceof Error ? e.message : null },
      origin,
      { status: 400 },
    );
  }

  const product = await prisma.product.findFirst({
    where: { cafe24ProductNo: productNo, status: "PUBLISHED" },
    include: {
      mall: true,
      optionGroups: { include: { items: true } },
    },
  });
  if (!product) {
    return withCors({ error: "not found" }, origin, { status: 404 });
  }
  if (!product.mall.accessToken) {
    return withCors(
      { error: "mall not connected" },
      origin,
      { status: 503 },
    );
  }

  const quote = calculateQuote(product, parsed.selections);
  if (quote.errors.length > 0) {
    return withCors({ error: "invalid selections", quote }, origin, {
      status: 422,
    });
  }

  // 1) DynamicProduct row 선기록 (CREATED)
  const summary = quote.resolvedItems
    .map((r) => `${r.groupName}: ${r.label}`)
    .join(" / ");

  const dyn = await prisma.dynamicProduct.create({
    data: {
      mallId: product.mall.id,
      sourceProductId: product.id,
      selectedOptions: parsed.selections,
      finalPrice: quote.finalPrice,
      status: "CREATED",
      expiresAt: new Date(
        Date.now() + DYNAMIC_PRODUCT_TTL_MINUTES * 60 * 1000,
      ),
    },
  });

  try {
    // 2) Cafe24에 일회용 상품 등록
    const created = await createDynamicProduct({
      mall: product.mall,
      productName: `${product.name} #${dyn.id.slice(-6)}`,
      price: quote.finalPrice,
      summary,
    });

    // 3) DB에 product_no 갱신 + 장바구니 URL 생성
    await prisma.dynamicProduct.update({
      where: { id: dyn.id },
      data: {
        cafe24ProductNo: created.productNo,
        cafe24ProductCode: created.productCode,
        status: "IN_CART",
      },
    });
    const cartUrl = buildAddToCartUrl({
      mallId: product.mall.mallId,
      productNo: created.productNo,
    });

    return withCors(
      {
        ok: true,
        dynamicProductId: dyn.id,
        cafe24ProductNo: created.productNo,
        finalPrice: quote.finalPrice,
        cartUrl,
      },
      origin,
    );
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
      { status: 502 },
    );
  }
}
