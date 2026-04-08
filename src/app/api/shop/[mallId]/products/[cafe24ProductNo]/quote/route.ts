import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preflight, withCors } from "@/lib/cors";
import { calculateQuote } from "@/lib/pricing/calculate";
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
      }),
    )
    .max(50),
});

export async function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"));
}

export async function POST(
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

  const mall = await prisma.cafe24Mall.findUnique({ where: { mallId } });
  if (!mall) {
    return withCors({ error: "mall not found" }, origin, { status: 404 });
  }
  if (!isOriginAllowed(mall, origin)) {
    return withCors({ error: "origin not allowed" }, origin, { status: 403 });
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
    return withCors({ ok: false, ...quote }, origin, { status: 422 });
  }
  // 음수여도 quote 단계에서는 통과시켜 실시간 표시. checkout 에서만 거부.
  // visibleGroupIds 도 함께 내려서 embed.js 가 동기화하게 한다.
  return withCors(
    {
      ok: true,
      ...quote,
      warning: quote.finalPrice < 0 ? "negative_total" : undefined,
    },
    origin,
  );
}
