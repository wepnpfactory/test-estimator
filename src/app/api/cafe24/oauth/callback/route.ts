import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CAFE24_SCOPES, exchangeCodeForToken } from "@/lib/cafe24/oauth";
import { fetchStorefrontOrigin } from "@/lib/cafe24/store";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json(
      { error: "code and state are required" },
      { status: 400 },
    );
  }

  const cookie = req.cookies.get("cafe24_oauth_state")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "state cookie missing" }, { status: 400 });
  }
  const [cookieState, mallId] = cookie.split(":");
  if (cookieState !== state || !mallId) {
    return NextResponse.json({ error: "state mismatch" }, { status: 400 });
  }

  const clientId = process.env.CAFE24_CLIENT_ID!;
  const clientSecret = process.env.CAFE24_CLIENT_SECRET!;
  const redirectUri = process.env.CAFE24_REDIRECT_URI!;

  try {
    const token = await exchangeCodeForToken({
      mallId,
      clientId,
      clientSecret,
      redirectUri,
      code,
    });

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
      },
    });

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
    res.cookies.delete("cafe24_oauth_state");
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "token exchange failed" },
      { status: 500 },
    );
  }
}
