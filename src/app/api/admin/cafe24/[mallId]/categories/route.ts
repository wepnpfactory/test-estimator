import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listCategories } from "@/lib/cafe24/categories";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ mallId: string }> }) {
  const { mallId } = await params;
  const mall = await prisma.cafe24Mall.findUnique({ where: { id: mallId } });
  if (!mall) {
    return NextResponse.json({ error: "mall not found" }, { status: 404 });
  }
  if (!mall.accessToken) {
    return NextResponse.json({ error: "mall not connected" }, { status: 503 });
  }
  try {
    const categories = await listCategories(mall);
    return NextResponse.json({ categories });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
