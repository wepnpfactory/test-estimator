import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeUrl } from "@/lib/cafe24/oauth";

// Cafe24 앱스토어에서 "앱 실행"을 누르면 mall_id 쿼리와 함께 호출됨
// → authorize URL로 302 리다이렉트
export async function GET(req: NextRequest) {
  const mallId = req.nextUrl.searchParams.get("mall_id");
  if (!mallId) {
    return NextResponse.json({ error: "mall_id is required" }, { status: 400 });
  }
  if (!/^[a-z0-9_-]{1,40}$/i.test(mallId)) {
    return NextResponse.json({ error: "invalid mall_id" }, { status: 400 });
  }

  const clientId = process.env.CAFE24_CLIENT_ID;
  const redirectUri = process.env.CAFE24_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Cafe24 app is not configured on the server" },
      { status: 500 },
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = authorizeUrl({ mallId, clientId, redirectUri, state });

  const res = NextResponse.redirect(url);
  // mall 별로 쿠키명 분리해서 동일 브라우저로 여러 몰을 동시 설치해도 충돌하지 않게 한다.
  // 콜백에서는 cafe24_oauth_state_<mallId> 쿠키를 읽어 검증한다.
  res.cookies.set(`cafe24_oauth_state_${mallId}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return res;
}
