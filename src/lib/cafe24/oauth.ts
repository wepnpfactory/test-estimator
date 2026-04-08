// Cafe24 OAuth 2.0 헬퍼
// docs: https://developers.cafe24.com/docs/api/admin/#oauth-2-0

export const CAFE24_SCOPES = [
  "mall.read_product",
  "mall.write_product",
  "mall.read_category",
  "mall.read_order",
  "mall.write_order",
  "mall.read_customer",
  "mall.read_store",
  "mall.read_notification",
  "mall.write_notification",
  // ScriptTag API (embed.js 자동 설치)
  "mall.read_application",
  "mall.write_application",
] as const;

export function authorizeUrl(params: {
  mallId: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: readonly string[];
}) {
  const u = new URL(
    `https://${params.mallId}.cafe24api.com/api/v2/oauth/authorize`,
  );
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("state", params.state);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("scope", (params.scope ?? CAFE24_SCOPES).join(","));
  return u.toString();
}

export interface Cafe24TokenResponse {
  access_token: string;
  expires_at: string; // ISO
  refresh_token: string;
  refresh_token_expires_at: string;
  client_id: string;
  mall_id: string;
  user_id?: string;
  scopes: string[];
  issued_at: string;
  shop_no?: string;
}

export async function exchangeCodeForToken(params: {
  mallId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<Cafe24TokenResponse> {
  const url = `https://${params.mallId}.cafe24api.com/api/v2/oauth/token`;
  const basic = Buffer.from(
    `${params.clientId}:${params.clientSecret}`,
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cafe24 token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as Cafe24TokenResponse;
}

export async function refreshAccessToken(params: {
  mallId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<Cafe24TokenResponse> {
  const url = `https://${params.mallId}.cafe24api.com/api/v2/oauth/token`;
  const basic = Buffer.from(
    `${params.clientId}:${params.clientSecret}`,
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cafe24 token refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as Cafe24TokenResponse;
}
