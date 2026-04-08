import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteScriptTag, installScriptTag, listScriptTags } from "@/lib/cafe24/script-tags";

function buildEmbedSrc(req: NextRequest): string {
  const proto = req.nextUrl.protocol;
  const host = req.nextUrl.host;
  return `${proto}//${host}/embed.js`;
}

// 현재 몰에 등록된 우리 embed.js 상태 확인
export async function GET(req: NextRequest, { params }: { params: Promise<{ mallId: string }> }) {
  const { mallId } = await params;
  const mall = await prisma.cafe24Mall.findUnique({ where: { id: mallId } });
  if (!mall || !mall.accessToken) {
    return NextResponse.json({ error: "mall not connected" }, { status: 404 });
  }
  const targetSrc = buildEmbedSrc(req);
  const targetOrigin = new URL(targetSrc).origin;
  try {
    const tags = await listScriptTags(mall);
    const ours = tags.filter((t) => {
      try {
        return new URL(t.src).origin === targetOrigin;
      } catch {
        return false;
      }
    });
    return NextResponse.json({
      targetSrc,
      installed: ours.some((t) => t.src === targetSrc),
      ours,
      totalCount: tags.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}

// embed.js 설치 (idempotent)
export async function POST(req: NextRequest, { params }: { params: Promise<{ mallId: string }> }) {
  const { mallId } = await params;
  const mall = await prisma.cafe24Mall.findUnique({ where: { id: mallId } });
  if (!mall || !mall.accessToken) {
    return NextResponse.json({ error: "mall not connected" }, { status: 404 });
  }
  const targetSrc = buildEmbedSrc(req);
  // 수동 호출은 항상 강제 재설치 (있는 것을 모두 지우고 새로 등록)
  try {
    const result = await installScriptTag({
      mall,
      src: targetSrc,
      locations: ["PRODUCT_DETAIL"],
      force: true,
    });
    return NextResponse.json({ ok: true, src: targetSrc, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "install failed" }, { status: 502 });
  }
}

// embed.js 제거 (우리 origin 항목 전체 삭제)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ mallId: string }> }) {
  const { mallId } = await params;
  const mall = await prisma.cafe24Mall.findUnique({ where: { id: mallId } });
  if (!mall || !mall.accessToken) {
    return NextResponse.json({ error: "mall not connected" }, { status: 404 });
  }
  const targetSrc = buildEmbedSrc(req);
  const targetOrigin = new URL(targetSrc).origin;
  try {
    const tags = await listScriptTags(mall);
    let removed = 0;
    for (const t of tags) {
      try {
        if (new URL(t.src).origin === targetOrigin) {
          await deleteScriptTag(mall, t.scriptNo);
          removed++;
        }
      } catch {}
    }
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "delete failed" }, { status: 502 });
  }
}
