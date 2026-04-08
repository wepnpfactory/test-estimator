import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CAFE24_SCOPES, exchangeCodeForToken } from "@/lib/cafe24/oauth";
import { fetchStorefrontOrigin } from "@/lib/cafe24/store";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  // Cafe24 콜백은 mall_id 도 함께 전달한다 (앱스토어 install 흐름)
  const mallId = req.nextUrl.searchParams.get("mall_id");
  if (!code || !state || !mallId) {
    return NextResponse.json(
      { error: "code, state, mall_id are required" },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9_-]{1,40}$/i.test(mallId)) {
    return NextResponse.json({ error: "invalid mall_id" }, { status: 400 });
  }

  const cookieName = `cafe24_oauth_state_${mallId}`;
  const cookie = req.cookies.get(cookieName)?.value;
  if (!cookie || !timingSafeEqualStr(cookie, state)) {
    return NextResponse.json({ error: "state mismatch" }, { status: 400 });
  }

  const clientId = process.env.CAFE24_CLIENT_ID;
  const clientSecret = process.env.CAFE24_CLIENT_SECRET;
  const redirectUri = process.env.CAFE24_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Cafe24 app is not configured on the server" },
      { status: 500 },
    );
  }

  try {
    const token = await exchangeCodeForToken({
      mallId,
      clientId,
      clientSecret,
      redirectUri,
      code,
    });

    // 신규 몰이면 embedSecret 자동 발급
    const newEmbedSecret = crypto.randomBytes(32).toString("base64url");

    const mall = await prisma.cafe24Mall.upsert({
      where: { mallId },
      update: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenExpiresAt: new Date(token.expires_at),
        scopes: token.scopes ?? Array.from(CAFE24_SCOPES),
        clientId,
        clientSecret,
      },
      create: {
        mallId,
        name: mallId,
        clientId,
        clientSecret,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenExpiresAt: new Date(token.expires_at),
        scopes: token.scopes ?? Array.from(CAFE24_SCOPES),
        embedSecret: newEmbedSecret,
      },
    });
    // 기존 몰인데 embedSecret이 비어 있으면 채워준다
    if (!mall.embedSecret) {
      await prisma.cafe24Mall.update({
        where: { id: mall.id },
        data: { embedSecret: newEmbedSecret },
      });
    }

    // best-effort: 실제 storefront 도메인 알아내서 저장 (실패해도 OAuth 자체는 성공)
    try {
      const origin = await fetchStorefrontOrigin(mall);
      await prisma.cafe24Mall.update({
        where: { id: mall.id },
        data: { storefrontOrigin: origin },
      });
    } catch (e) {
      console.warn("[oauth] failed to fetch storefront origin:", e);
    }

    const res = NextResponse.redirect(new URL("/admin/malls", req.url));
    res.cookies.delete(cookieName);
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "token exchange failed" },
      { status: 500 },
    );
  }
}
