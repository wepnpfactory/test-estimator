import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { preflight, withCors } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

// GET — 겉보기 상품번호로 바인딩된 옵션 스키마 반환
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cafe24ProductNo: string }> },
) {
  const origin = req.headers.get("origin");
  const { cafe24ProductNo } = await params;
  const productNo = Number(cafe24ProductNo);
  if (!Number.isFinite(productNo)) {
    return withCors({ error: "invalid product no" }, origin, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { cafe24ProductNo: productNo, status: "PUBLISHED" },
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
      name: product.name,
      basePrice: product.basePrice,
      optionGroups: product.optionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        displayType: g.displayType,
        required: g.required,
        items: g.items.map((i) => ({
          id: i.id,
          label: i.label,
          value: i.value,
          addPrice: i.addPrice,
        })),
      })),
    },
    origin,
  );
}
