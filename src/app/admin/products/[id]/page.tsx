import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateFacadeProductPrice } from "@/lib/cafe24/products";
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
  await prisma.optionGroup.update({
    where: { id: groupId },
    data: {
      kind: kindRaw,
      required,
      showWhen: showWhen as never,
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
    <div className="max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {product.mall.name} · Cafe24 #{product.cafe24ProductNo} · 기본가{" "}
            {product.basePrice.toLocaleString()}원 · {product.status}
          </p>
        </div>
        {product.status !== "PUBLISHED" && (
          <form action={publishProduct.bind(null, product.id)}>
            <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              게시
            </button>
          </form>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold">옵션 그룹</h2>
        <div className="mt-3 space-y-4">
          {product.optionGroups.map((g, gi) => {
            const showWhenStr = g.showWhen
              ? JSON.stringify(g.showWhen)
              : "";
            return (
              <div
                key={g.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
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
                          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                          aria-label="위로"
                        >
                          ▲
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
                          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                          aria-label="아래로"
                        >
                          ▼
                        </button>
                      </form>
                    </div>
                    <div className="text-sm font-medium">{g.name}</div>
                    <KindBadge kind={g.kind} />
                  </div>
                  <form action={deleteOptionGroup.bind(null, product.id, g.id)}>
                    <button
                      type="submit"
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      그룹 삭제
                    </button>
                  </form>
                </div>

                {/* 그룹 설정 (kind / required / showWhen) */}
                <form
                  action={updateOptionGroup.bind(null, product.id, g.id)}
                  className="mt-3 grid grid-cols-1 gap-2 rounded-md bg-zinc-50/60 p-3 text-[11px] dark:bg-zinc-950/40 sm:grid-cols-3"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-zinc-500">역할 (kind)</span>
                    <select
                      name="kind"
                      defaultValue={g.kind}
                      className={smallInputCls}
                    >
                      <option value="NORMAL">일반</option>
                      <option value="SHEET_COUNT">페이지수 (sheet)</option>
                      <option value="QUANTITY">부수 (quantity)</option>
                      <option value="DIMENSIONS">사이즈 (가로×세로)</option>
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
                        <span className="ml-1 text-zinc-400">
                          예: [{`{"groupId":"abc","itemId":"xyz"}`}]
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
                  <div className="sm:col-span-3 flex justify-end">
                    <button className="rounded-md bg-zinc-200 px-3 py-1 text-[11px] dark:bg-zinc-700">
                      설정 저장
                    </button>
                  </div>
                </form>

                {/* 옵션 아이템 목록 */}
                <ul className="mt-3 space-y-1.5">
                  {g.items.map((it, ii) => (
                    <li
                      key={it.id}
                      className="rounded-md bg-zinc-50/40 p-2 text-xs dark:bg-zinc-950/20"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
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
                                className="leading-none text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                                aria-label="위로"
                              >
                                ▲
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
                                disabled={ii === g.items.length - 1}
                                className="leading-none text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                                aria-label="아래로"
                              >
                                ▼
                              </button>
                            </form>
                          </div>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {it.label}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            ({it.value})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
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
                              className="text-zinc-400 hover:text-rose-600"
                            >
                              ×
                            </button>
                          </form>
                        </div>
                      </div>
                      <form
                        action={updateOptionItem.bind(null, product.id, it.id)}
                        className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500"
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
                        <button className="ml-auto rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">
                          저장
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>

                {/* 새 아이템 추가 */}
                <form
                  action={addOptionItem.bind(null, g.id, product.id)}
                  className="mt-3 flex gap-2"
                >
                  <input name="label" placeholder="표시명" className={smallInputCls} />
                  <input name="value" placeholder="value" className={smallInputCls} />
                  <input
                    name="addPrice"
                    type="number"
                    placeholder="추가금액"
                    className={smallInputCls}
                  />
                  <button className="rounded-md bg-zinc-200 px-3 py-1 text-xs dark:bg-zinc-700">
                    추가
                  </button>
                </form>
                <div className="mt-2">
                  <OptionBulkPaste
                    groupId={g.id}
                    productId={product.id}
                    bulkAction={bulkAddOptionItems}
                  />
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
      : "bg-amber-50 text-amber-700";
  const label = kind === "SHEET_COUNT" ? "페이지수" : "부수";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

const smallInputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900";
