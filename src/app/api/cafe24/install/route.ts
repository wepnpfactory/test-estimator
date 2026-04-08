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
  // CSRF 방어용 state 쿠키 (콜백에서 비교)
  res.cookies.set("cafe24_oauth_state", `${state}:${mallId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return res;
}
