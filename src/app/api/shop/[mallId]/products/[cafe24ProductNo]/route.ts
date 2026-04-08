import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { preflight, withCors } from "@/lib/cors";
import { isOriginAllowed } from "@/lib/shop-auth";

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

// GET — (mallId, cafe24ProductNo) 로 식별된 facade 상품의 옵션 스키마 반환
export async function GET(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ mallId: string; cafe24ProductNo: string }> },
) {
  const origin = req.headers.get("origin");
  const { mallId, cafe24ProductNo } = await params;

  const productNo = Number(cafe24ProductNo);
  if (!Number.isInteger(productNo) || productNo <= 0) {
    return withCors({ error: "invalid product no" }, origin, { status: 400 });
  }

  const mall = await prisma.cafe24Mall.findUnique({ where: { mallId } });
  if (!mall) {
    return withCors({ error: "mall not found" }, origin, { status: 404 });
  }
  if (!isOriginAllowed(mall, origin)) {
    return withCors({ error: "origin not allowed" }, origin, { status: 403 });
  }

  const product = await prisma.product.findFirst({
    where: { mallId: mall.id, cafe24ProductNo: productNo, status: "PUBLISHED" },
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { enabled: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
  if (!product) {
    return withCors({ error: "not found" }, origin, { status: 404 });
  }

  return withCors(
    {
      id: product.id,
      mallId: mall.mallId,
      name: product.name,
      basePrice: product.basePrice,
      optionGroups: product.optionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        displayType: g.displayType,
        required: g.required,
        kind: g.kind,
        showWhen: g.showWhen ?? null,
        items: g.items.map((i) => ({
          id: i.id,
          label: i.label,
          value: i.value,
          addPrice: i.addPrice,
          multiplier: i.multiplier,
          perSheet: i.perSheet,
          perQuantity: i.perQuantity,
          widthMm: i.widthMm,
          heightMm: i.heightMm,
        })),
      })),
    },
    origin,
  );
}
