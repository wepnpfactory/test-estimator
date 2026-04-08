// Cafe24 Script Tags API
// docs: https://developers.cafe24.com/docs/en/api/admin/?version=2025-12-01#script-tags
//
// 용도: 쇼핑몰 테마(스킨)에 embed.js 같은 외부 스크립트를 코드 수정 없이 주입한다.
// 등록한 script_tag 는 display_location 에서 지정한 페이지가 렌더될 때 자동 삽입된다.
//
// 우리 프로젝트는 PRODUCT_DETAIL 에 embed.js 를 설치한다.
// 동일 src 가 이미 있으면 중복 등록하지 않는다 (idempotent).

import { Cafe24ApiError, cafe24Fetch } from "@/lib/cafe24/client";
import type { Cafe24Mall } from "@/generated/prisma/client";

interface AlreadyExistsBody {
  error?: {
    code?: number;
    message?: string;
    more_info?: {
      script_no?: number | string;
      src?: string;
      display_location?: string[];
    };
  };
}

function parseAlreadyExists(body: unknown): {
  scriptNo: number;
  src?: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const e = (body as AlreadyExistsBody).error;
  if (!e || e.code !== 422) return null;
  if (!e.message?.includes("already has the script")) return null;
  const raw = e.more_info?.script_no;
  const scriptNo = typeof raw === "string" ? Number(raw) : raw;
  if (!scriptNo || !Number.isFinite(scriptNo)) return null;
  return { scriptNo, src: e.more_info?.src };
}

export type ScriptTagLocation =
  | "BEFORE_BODY_TAG"
  | "AFTER_BODY_TAG"
  | "PRODUCT_DETAIL"
  | "PRODUCT_LIST"
  | "MAIN"
  | "ORDER_BASKET"
  | "MY_PAGE";

export interface Cafe24ScriptTag {
  scriptNo: number;
  src: string;
  displayLocation: string[];
  client_id?: string;
}

interface RawScriptTag {
  shop_no?: number;
  script_no: number;
  src: string;
  display_location: string[] | string;
  client_id?: string;
}

interface ListResponse {
  scripttags?: RawScriptTag[];
}

function normalize(t: RawScriptTag): Cafe24ScriptTag {
  return {
    scriptNo: t.script_no,
    src: t.src,
    displayLocation: Array.isArray(t.display_location) ? t.display_location : [t.display_location],
    client_id: t.client_id,
  };
}

export async function listScriptTags(mall: Cafe24Mall, shopNo?: number): Promise<Cafe24ScriptTag[]> {
  const res = await cafe24Fetch<ListResponse>(mall, "/api/v2/admin/scripttags", {
    method: "GET",
    query: { shop_no: shopNo ?? mall.defaultShopNo ?? 1 },
  });
  return (res.scripttags ?? []).map(normalize);
}

export async function deleteScriptTag(mall: Cafe24Mall, scriptNo: number, shopNo?: number): Promise<void> {
  await cafe24Fetch(mall, `/api/v2/admin/scripttags/${scriptNo}`, {
    method: "DELETE",
    query: { shop_no: shopNo ?? mall.defaultShopNo ?? 1 },
  });
}

export interface InstallScriptTagInput {
  mall: Cafe24Mall;
  src: string;
  /** 기본 PRODUCT_DETAIL */
  locations?: ScriptTagLocation[];
  shopNo?: number;
  /**
   * 동일 origin 의 stale 스크립트(다른 src)를 제거 후 등록한다.
   * exact match 가 이미 있으면 그대로 둔다 (idempotent 자동 설치 모드).
   */
  replaceSameOrigin?: boolean;
  /**
   * exact match 까지 포함해서 같은 origin 의 모든 스크립트를 지우고
   * 새로 설치한다 (수동 재설치 모드).
   */
  force?: boolean;
}

export interface InstallScriptTagResult {
  installed: boolean;
  scriptNo?: number;
  removedCount: number;
  alreadyExisted: boolean;
}

export async function installScriptTag(input: InstallScriptTagInput): Promise<InstallScriptTagResult> {
  const { mall, src, locations = ["PRODUCT_DETAIL"], shopNo, replaceSameOrigin = true, force = false } = input;
  const targetOrigin = new URL(src).origin;

  const existing = await listScriptTags(mall, shopNo);

  // exactMatch 도 제거 대상에 포함시킬지 여부
  const exactMatch = existing.find((t) => t.src === src && locations.every((loc) => t.displayLocation.includes(loc)));
  if (exactMatch && !force) {
    return {
      installed: false,
      scriptNo: exactMatch.scriptNo,
      removedCount: 0,
      alreadyExisted: true,
    };
  }

  // 같은 origin 의 스크립트 제거
  // - replaceSameOrigin: 다른 src 만 제거 (exactMatch 는 위에서 이미 early return)
  // - force: exactMatch 포함 모두 제거
  let removedCount = 0;
  if (force || replaceSameOrigin) {
    const sameOrigin = existing.filter((t) => {
      try {
        return new URL(t.src).origin === targetOrigin;
      } catch {
        return false;
      }
    });
    for (const t of sameOrigin) {
      try {
        await deleteScriptTag(mall, t.scriptNo, shopNo);
        removedCount++;
      } catch (e) {
        console.warn(`[script-tags] failed to delete ${t.scriptNo}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  async function postCreate() {
    return cafe24Fetch<{ scripttag: RawScriptTag }>(mall, "/api/v2/admin/scripttags", {
      method: "POST",
      body: {
        shop_no: shopNo ?? mall.defaultShopNo ?? 1,
        request: { src, display_location: locations },
      },
    });
  }

  try {
    const res = await postCreate();
    return {
      installed: true,
      scriptNo: res.scripttag?.script_no,
      removedCount,
      alreadyExisted: false,
    };
  } catch (err) {
    // Cafe24 list 가 stale 해서 exact-match 를 못 찾았어도, POST 시점에 422가 나오면
    // 응답 본문의 script_no 를 그대로 사용해 처리한다.
    if (err instanceof Cafe24ApiError && err.status === 422) {
      const existing = parseAlreadyExists(err.body);
      if (existing) {
        if (force) {
          // 강제 재설치 — 기존 것 삭제 후 재생성
          try {
            await deleteScriptTag(mall, existing.scriptNo, shopNo);
            removedCount++;
          } catch (delErr) {
            console.warn(
              "[script-tags] failed to delete existing during force:",
              delErr instanceof Error ? delErr.message : delErr
            );
          }
          const res = await postCreate();
          return {
            installed: true,
            scriptNo: res.scripttag?.script_no,
            removedCount,
            alreadyExisted: false,
          };
        }
        // 이미 존재 → idempotent 성공
        return {
          installed: false,
          scriptNo: existing.scriptNo,
          removedCount,
          alreadyExisted: true,
        };
      }
    }
    throw err;
  }
}
