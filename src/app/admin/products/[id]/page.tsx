import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { updateFacadeProductPrice } from "@/lib/cafe24/products";
import { CollapsibleSection } from "./_components/collapsible-section";
import {
  OptionBulkPaste,
  type ParsedItem,
} from "./_components/option-bulk-paste";

type GroupKindStr = "NORMAL" | "SHEET_COUNT" | "QUANTITY";

// ─── server actions ─────────────────────────────────────────

async function addOptionGroup(productId: string, formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const count = await prisma.optionGroup.count({ where: { productId } });
  await prisma.optionGroup.create({
    data: { productId, name, sortOrder: count },
  });
  revalidatePath(`/admin/products/${productId}`);
}

async function updateOptionGroup(
  productId: string,
  groupId: string,
  formData: FormData,
) {
  "use server";
  const kindRaw = String(formData.get("kind") || "NORMAL") as GroupKindStr;
  const required = formData.get("required") === "on";
  const showWhenText = String(formData.get("showWhen") || "").trim();
  let showWhen: unknown = null;
  if (showWhenText) {
    try {
      const parsed = JSON.parse(showWhenText);
      if (Array.isArray(parsed)) showWhen = parsed;
    } catch {
      // 형식 오류면 무시 (아래 try-catch 에서 silent fail)
    }
  }
  const maxWidthRaw = String(formData.get("maxWidthMm") || "").trim();
  const maxHeightRaw = String(formData.get("maxHeightMm") || "").trim();
  const maxWidthMm = maxWidthRaw === "" ? null : Number(maxWidthRaw);
  const maxHeightMm = maxHeightRaw === "" ? null : Number(maxHeightRaw);
  await prisma.optionGroup.update({
    where: { id: groupId },
    data: {
      kind: kindRaw,
      required,
      showWhen: showWhen as never,
      maxWidthMm:
        maxWidthMm !== null && Number.isFinite(maxWidthMm) && maxWidthMm > 0
          ? maxWidthMm
          : null,
      maxHeightMm:
        maxHeightMm !== null && Number.isFinite(maxHeightMm) && maxHeightMm > 0
          ? maxHeightMm
          : null,
    },
  });
  revalidatePath(`/admin/products/${productId}`);
}

async function deleteOptionGroup(productId: string, groupId: string) {
  "use server";
  await prisma.optionGroup.delete({ where: { id: groupId } });
  revalidatePath(`/admin/products/${productId}`);
}

async function moveOptionGroup(
  productId: string,
  groupId: string,
  direction: "up" | "down",
) {
  "use server";
  const groups = await prisma.optionGroup.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= groups.length) return;
  const a = groups[idx];
  const b = groups[swapIdx];
  await prisma.$transaction([
    prisma.optionGroup.update({
      where: { id: a.id },
      data: { sortOrder: b.sortOrder },
    }),
    prisma.optionGroup.update({
      where: { id: b.id },
      data: { sortOrder: a.sortOrder },
    }),
  ]);
  revalidatePath(`/admin/products/${productId}`);
}

async function addOptionItem(
  groupId: string,
  productId: string,
  formData: FormData,
) {
  "use server";
  const label = String(formData.get("label") || "").trim();
  const value = String(formData.get("value") || "").trim();
  const addPrice = Number(formData.get("addPrice") || 0);
  if (!label || !value) return;
  const count = await prisma.optionItem.count({ where: { groupId } });
  await prisma.optionItem.create({
    data: { groupId, label, value, addPrice, sortOrder: count },
  });
  revalidatePath(`/admin/products/${productId}`);
}

async function updateOptionItem(
  productId: string,
  itemId: string,
  formData: FormData,
) {
  "use server";
  const multiplier = Number(formData.get("multiplier") || 1);
  const perSheet = formData.get("perSheet") === "on";
  const perQuantity = formData.get("perQuantity") === "on";
  const widthRaw = String(formData.get("widthMm") || "").trim();
  const heightRaw = String(formData.get("heightMm") || "").trim();
  const widthMm = widthRaw === "" ? null : Number(widthRaw);
  const heightMm = heightRaw === "" ? null : Number(heightRaw);
  await prisma.optionItem.update({
    where: { id: itemId },
    data: {
      multiplier: Number.isFinite(multiplier) ? multiplier : 1,
      perSheet,
      perQuantity,
      widthMm:
        widthMm !== null && Number.isFinite(widthMm) && widthMm > 0
          ? widthMm
          : null,
      heightMm:
        heightMm !== null && Number.isFinite(heightMm) && heightMm > 0
          ? heightMm
          : null,
    },
  });
  revalidatePath(`/admin/products/${productId}`);
}

async function deleteOptionItem(productId: string, itemId: string) {
  "use server";
  await prisma.optionItem.delete({ where: { id: itemId } });
  revalidatePath(`/admin/products/${productId}`);
}

async function moveOptionItem(
  productId: string,
  groupId: string,
  itemId: string,
  direction: "up" | "down",
) {
  "use server";
  const items = await prisma.optionItem.findMany({
    where: { groupId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return;
  const a = items[idx];
  const b = items[swapIdx];
  await prisma.$transaction([
    prisma.optionItem.update({
      where: { id: a.id },
      data: { sortOrder: b.sortOrder },
    }),
    prisma.optionItem.update({
      where: { id: b.id },
      data: { sortOrder: a.sortOrder },
    }),
  ]);
  revalidatePath(`/admin/products/${productId}`);
}

async function bulkAddOptionItems(
  groupId: string,
  productId: string,
  items: ParsedItem[],
) {
  "use server";
  if (items.length === 0) return;
  const start = await prisma.optionItem.count({ where: { groupId } });
  await prisma.optionItem.createMany({
    data: items.map((it, i) => ({
      groupId,
      label: it.label,
      value: it.value,
      addPrice: it.addPrice,
      sortOrder: start + i,
    })),
    skipDuplicates: true,
  });
  revalidatePath(`/admin/products/${productId}`);
}

// 게시 — 옵션 최저가 동기화
function calcMinPossiblePrice(product: {
  basePrice: number;
  optionGroups: {
    required: boolean;
    items: { addPrice: number; enabled: boolean }[];
  }[];
}): number {
  let total = product.basePrice;
  for (const g of product.optionGroups) {
    if (!g.required) continue;
    const candidates = g.items.filter((i) => i.enabled);
    if (candidates.length === 0) continue;
    total += Math.min(...candidates.map((i) => i.addPrice));
  }
  return Math.max(0, total);
}

async function publishProduct(productId: string) {
  "use server";
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { mall: true, optionGroups: { include: { items: true } } },
  });
  if (!product) return;
  const minPrice = calcMinPossiblePrice(product);
  if (product.cafe24ProductNo && product.mall.accessToken) {
    try {
      await updateFacadeProductPrice({
        mall: product.mall,
        productNo: product.cafe24ProductNo,
        price: minPrice,
      });
    } catch (e) {
      console.warn(
        "[publish] Cafe24 price sync failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }
  await prisma.product.update({
    where: { id: productId },
    data: { status: "PUBLISHED", basePrice: minPrice },
  });
  redirect(`/admin/products/${productId}`);
}

// ─── UI ───────────────────────────────────────────────

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      mall: true,
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!product) notFound();

  const groupCount = product.optionGroups.length;

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {product.mall.name} · Cafe24 #{product.cafe24ProductNo} · 기본가{" "}
            {product.basePrice.toLocaleString()}원
          </p>
          <span
            className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
              product.status === "PUBLISHED"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {product.status}
          </span>
        </div>
        {product.status !== "PUBLISHED" && (
          <form action={publishProduct.bind(null, product.id)}>
            <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
              게시
            </button>
          </form>
        )}
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold">옵션 그룹</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              그룹 머리글을 클릭해 값 목록을 펼치거나 접을 수 있습니다. 접힌
              상태는 브라우저에 기억됩니다.
            </p>
          </div>
          <div className="text-[11px] text-zinc-500">총 {groupCount}개</div>
        </div>

        <div className="mt-4 space-y-3">
          {product.optionGroups.map((g, gi) => {
            const showWhenStr = g.showWhen ? JSON.stringify(g.showWhen) : "";
            const itemCount = g.items.length;
            const addPrices = g.items.map((i) => i.addPrice);
            const minAdd = addPrices.length ? Math.min(...addPrices) : 0;
            const maxAdd = addPrices.length ? Math.max(...addPrices) : 0;
            const priceRange = !itemCount
              ? "—"
              : minAdd === maxAdd
                ? `+${minAdd.toLocaleString()}원`
                : `+${minAdd.toLocaleString()} ~ +${maxAdd.toLocaleString()}원`;

            const summary = (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {g.name}
                </span>
                <KindBadge kind={g.kind} />
                {g.required && (
                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                    필수
                  </span>
                )}
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {itemCount}개
                </span>
                <span className="ms-auto tabular-nums text-[11px] font-medium text-zinc-500">
                  {priceRange}
                </span>
              </div>
            );

            return (
              <div
                key={g.id}
                className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-1 px-3 py-2.5">
                  {/* 순서 변경 */}
                  <div className="flex items-center">
                    <form
                      action={moveOptionGroup.bind(
                        null,
                        product.id,
                        g.id,
                        "up",
                      )}
                    >
                      <button
                        type="submit"
                        disabled={gi === 0}
                        className="flex size-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-zinc-800"
                        aria-label="위로"
                      >
                        <ChevronUp className="size-3.5" aria-hidden />
                      </button>
                    </form>
                    <form
                      action={moveOptionGroup.bind(
                        null,
                        product.id,
                        g.id,
                        "down",
                      )}
                    >
                      <button
                        type="submit"
                        disabled={gi === groupCount - 1}
                        className="flex size-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-zinc-800"
                        aria-label="아래로"
                      >
                        <ChevronDown className="size-3.5" aria-hidden />
                      </button>
                    </form>
                  </div>

                  <div className="min-w-0 flex-1">
                    <CollapsibleSection
                      storageKey={`optgrp:${product.id}:${g.id}`}
                      summary={summary}
                    >
                      <div className="space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                        {/* 고급 설정 (접힘 기본) */}
                        <details className="rounded-md bg-zinc-50/70 open:pb-3 dark:bg-zinc-950/40">
                          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">
                            <span>고급 설정 (역할 · 필수 · 노출 조건)</span>
                            <span className="text-zinc-400">＋</span>
                          </summary>
                          <form
                            action={updateOptionGroup.bind(
                              null,
                              product.id,
                              g.id,
                            )}
                            className="grid grid-cols-1 gap-3 px-3 pt-2 text-[11px] sm:grid-cols-3"
                          >
                            <label className="flex flex-col gap-1">
                              <span className="text-zinc-500">
                                역할 (kind)
                              </span>
                              <select
                                name="kind"
                                defaultValue={g.kind}
                                className={smallInputCls}
                              >
                                <option value="NORMAL">일반</option>
                                <option value="SHEET_COUNT">
                                  페이지수 (sheet)
                                </option>
                                <option value="QUANTITY">
                                  부수 (quantity)
                                </option>
                                <option value="DIMENSIONS">
                                  사이즈 (가로×세로)
                                </option>
                              </select>
                            </label>
                            <label className="flex items-center gap-1.5 pt-4">
                              <input
                                type="checkbox"
                                name="required"
                                defaultChecked={g.required}
                              />
                              <span className="text-zinc-600">필수 그룹</span>
                            </label>
                            <div className="sm:col-span-3">
                              <label className="flex flex-col gap-1">
                                <span className="text-zinc-500">
                                  보이는 조건 (JSON, 없으면 항상 노출)
                                  <span className="ms-1 text-zinc-400">
                                    예: [
                                    {`{"groupId":"abc","itemId":"xyz"}`}]
                                  </span>
                                </span>
                                <textarea
                                  name="showWhen"
                                  defaultValue={showWhenStr}
                                  rows={2}
                                  spellCheck={false}
                                  className={smallInputCls + " font-mono"}
                                />
                              </label>
                            </div>
                            {g.kind === "DIMENSIONS" && (
                              <div className="grid grid-cols-2 gap-2 sm:col-span-3">
                                <label className="flex flex-col gap-1">
                                  <span className="text-zinc-500">
                                    허용 최대 가로 (mm)
                                  </span>
                                  <input
                                    type="number"
                                    name="maxWidthMm"
                                    defaultValue={g.maxWidthMm ?? ""}
                                    placeholder="비우면 가장 큰 옵션 기준"
                                    className={smallInputCls}
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-zinc-500">
                                    허용 최대 세로 (mm)
                                  </span>
                                  <input
                                    type="number"
                                    name="maxHeightMm"
                                    defaultValue={g.maxHeightMm ?? ""}
                                    placeholder="비우면 가장 큰 옵션 기준"
                                    className={smallInputCls}
                                  />
                                </label>
                              </div>
                            )}
                            <div className="flex justify-between gap-2 sm:col-span-3">
                              <form
                                action={deleteOptionGroup.bind(
                                  null,
                                  product.id,
                                  g.id,
                                )}
                              >
                                <button
                                  type="submit"
                                  className="rounded-md border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                                >
                                  그룹 삭제
                                </button>
                              </form>
                              <button
                                type="submit"
                                className="rounded-md bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white dark:bg-white dark:text-zinc-900"
                              >
                                설정 저장
                              </button>
                            </div>
                          </form>
                        </details>

                        {/* 옵션 아이템 목록 */}
                        {itemCount === 0 ? (
                          <div className="rounded-md border border-dashed border-zinc-200 px-3 py-6 text-center text-[11px] text-zinc-400 dark:border-zinc-800">
                            아직 추가된 값이 없습니다
                          </div>
                        ) : (
                          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-md border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
                            {g.items.map((it, ii) => (
                              <li
                                key={it.id}
                                className="bg-zinc-50/40 px-3 py-2 text-xs dark:bg-zinc-950/20"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center">
                                    <form
                                      action={moveOptionItem.bind(
                                        null,
                                        product.id,
                                        g.id,
                                        it.id,
                                        "up",
                                      )}
                                    >
                                      <button
                                        type="submit"
                                        disabled={ii === 0}
                                        className="flex size-5 items-center justify-center text-zinc-400 hover:text-zinc-700 disabled:pointer-events-none disabled:opacity-30"
                                        aria-label="위로"
                                      >
                                        <ChevronUp
                                          className="size-3"
                                          aria-hidden
                                        />
                                      </button>
                                    </form>
                                    <form
                                      action={moveOptionItem.bind(
                                        null,
                                        product.id,
                                        g.id,
                                        it.id,
                                        "down",
                                      )}
                                    >
                                      <button
                                        type="submit"
                                        disabled={ii === itemCount - 1}
                                        className="flex size-5 items-center justify-center text-zinc-400 hover:text-zinc-700 disabled:pointer-events-none disabled:opacity-30"
                                        aria-label="아래로"
                                      >
                                        <ChevronDown
                                          className="size-3"
                                          aria-hidden
                                        />
                                      </button>
                                    </form>
                                  </div>
                                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-800 dark:text-zinc-100">
                                    {it.label}
                                  </span>
                                  <span className="font-mono text-[10px] text-zinc-400">
                                    {it.value}
                                  </span>
                                  <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                                    {it.addPrice >= 0 ? "+" : ""}
                                    {it.addPrice.toLocaleString()}
                                    {it.perSheet && " ×장"}
                                    {it.perQuantity && " ×부"}
                                    원
                                  </span>
                                  <form
                                    action={deleteOptionItem.bind(
                                      null,
                                      product.id,
                                      it.id,
                                    )}
                                  >
                                    <button
                                      type="submit"
                                      aria-label="삭제"
                                      className="flex size-5 items-center justify-center text-zinc-400 hover:text-rose-600"
                                    >
                                      <X className="size-3.5" aria-hidden />
                                    </button>
                                  </form>
                                </div>
                                <form
                                  action={updateOptionItem.bind(
                                    null,
                                    product.id,
                                    it.id,
                                  )}
                                  className="mt-1.5 flex flex-wrap items-center gap-3 ps-7 text-[10px] text-zinc-500"
                                >
                                  <label className="flex items-center gap-1">
                                    mult
                                    <input
                                      type="number"
                                      name="multiplier"
                                      defaultValue={it.multiplier}
                                      className="w-16 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                                    />
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      name="perSheet"
                                      defaultChecked={it.perSheet}
                                    />
                                    ×장
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      name="perQuantity"
                                      defaultChecked={it.perQuantity}
                                    />
                                    ×부
                                  </label>
                                  {g.kind === "DIMENSIONS" && (
                                    <>
                                      <label className="flex items-center gap-1">
                                        W
                                        <input
                                          type="number"
                                          name="widthMm"
                                          defaultValue={it.widthMm ?? ""}
                                          className="w-16 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                                        />
                                        mm
                                      </label>
                                      <label className="flex items-center gap-1">
                                        H
                                        <input
                                          type="number"
                                          name="heightMm"
                                          defaultValue={it.heightMm ?? ""}
                                          className="w-16 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                                        />
                                        mm
                                      </label>
                                    </>
                                  )}
                                  <button className="ms-auto rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">
                                    저장
                                  </button>
                                </form>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* 새 아이템 추가 */}
                        <form
                          action={addOptionItem.bind(null, g.id, product.id)}
                          className="flex gap-2"
                        >
                          <input
                            name="label"
                            placeholder="표시명"
                            className={smallInputCls + " flex-1"}
                          />
                          <input
                            name="value"
                            placeholder="value"
                            className={smallInputCls + " flex-1"}
                          />
                          <input
                            name="addPrice"
                            type="number"
                            placeholder="추가금액"
                            className={smallInputCls + " w-28"}
                          />
                          <button className="rounded-md bg-zinc-200 px-3 py-1 text-xs font-medium dark:bg-zinc-700">
                            추가
                          </button>
                        </form>
                        <OptionBulkPaste
                          groupId={g.id}
                          productId={product.id}
                          bulkAction={bulkAddOptionItems}
                        />
                      </div>
                    </CollapsibleSection>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <form
          action={addOptionGroup.bind(null, product.id)}
          className="mt-4 flex gap-2"
        >
          <input
            name="name"
            placeholder="새 옵션 그룹 이름 (예: 표지 재질)"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
            + 그룹 추가
          </button>
        </form>
      </section>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  if (kind === "NORMAL") return null;
  const cls =
    kind === "SHEET_COUNT"
      ? "bg-blue-50 text-blue-700"
      : kind === "QUANTITY"
        ? "bg-amber-50 text-amber-700"
        : "bg-violet-50 text-violet-700";
  const label =
    kind === "SHEET_COUNT"
      ? "페이지수"
      : kind === "QUANTITY"
        ? "부수"
        : "사이즈";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

const smallInputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900";
