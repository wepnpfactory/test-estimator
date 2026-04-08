import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preflight, withCors } from "@/lib/cors";
import { calculateQuote } from "@/lib/pricing/calculate";

const Body = z.object({
  selections: z
    .array(z.object({ groupId: z.string(), itemId: z.string() }))
    .max(50),
});

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
      optionGroups: { include: { items: true } },
    },
  });
  if (!product) {
    return withCors({ error: "not found" }, origin, { status: 404 });
  }

  const quote = calculateQuote(product, parsed.selections);
  if (quote.errors.length > 0) {
    return withCors(
      { ok: false, ...quote },
      origin,
      { status: 422 },
    );
  }
  return withCors({ ok: true, ...quote }, origin);
}
