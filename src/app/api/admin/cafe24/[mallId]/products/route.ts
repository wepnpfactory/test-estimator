import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listProducts } from "@/lib/cafe24/products";

// 관리자 전용. MVP 단계에선 인증 없이 동작 (Phase B에서 보안 추가).
// Cafe24 상품 목록을 가져오는 프록시. mallId 는 우리 DB 의 Cafe24Mall.id (cuid).

export async function GET(req: NextRequest, { params }: { params: Promise<{ mallId: string }> }) {
  const { mallId } = await params;
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);

  const mall = await prisma.cafe24Mall.findUnique({ where: { id: mallId } });
  if (!mall) {
    return NextResponse.json({ error: "mall not found" }, { status: 404 });
  }
  if (!mall.accessToken) {
    return NextResponse.json({ error: "mall not connected" }, { status: 503 });
  }

  try {
    const products = await listProducts({
      mall,
      search,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
