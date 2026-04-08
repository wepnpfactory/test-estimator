import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ChevronDown, ChevronUp, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { updateFacadeProductPrice } from "@/lib/cafe24/products";
import { CollapsibleSection } from "./_components/collapsible-section";
import {
  buttonCls,
  buttonGhostCls,
  inputCls,
} from "./_components/form-styles";
import { BaseAreaForm } from "./_components/base-area-form";
import { TemplatePicker } from "./_components/template-picker";
import {
  OptionBulkPaste,
  type ParsedItem,
} from "./_components/option-bulk-paste";
import { scaffoldProductGroups } from "@/lib/product-templates";
import type { ProductTemplate } from "@/generated/prisma/client";

type GroupKindStr =
  | "NORMAL"
  | "SHEET_COUNT"
  | "QUANTITY"
  | "DIMENSIONS"
  | "INNER_PAPER"
  | "COVER_PAPER";

// ─── server actions ─────────────────────────────────────────

function slugifyValue(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function addOptionGroup(productId: string, formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const valueRaw = String(formData.get("value") || "").trim();
  if (!name) return;
  const count = await prisma.optionGroup.count({ where: { productId } });
  let value = valueRaw || slugifyValue(name);
  // 중복 회피
  const existing = await prisma.optionGroup.findFirst({
    where: { productId, value },
    select: { id: true },
  });
  if (existing) value = `${value}_${count + 1}`;
  await prisma.optionGroup.create({
    data: { productId, name, value, sortOrder: count },
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
  const name = String(formData.get("name") || "").trim();
  const value = String(formData.get("value") || "").trim();
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
  const perSheet = formData.get("perSheet") === "on";
  const perQuantity = formData.get("perQuantity") === "on";
  const perArea = formData.get("perArea") === "on";
  const allowDirectInput = formData.get("allowDirectInput") === "on";
  const minDirectRaw = String(formData.get("minDirectInput") || "").trim();
  const maxDirectRaw = String(formData.get("maxDirectInput") || "").trim();
  const minDirectInput = minDirectRaw === "" ? null : Number(minDirectRaw);
  const maxDirectInput = maxDirectRaw === "" ? null : Number(maxDirectRaw);
  // kind 가 INNER_PAPER/COVER_PAPER 면 boolean 도 자동으로 맞춰준다 (deprecated 호환)
  const isInnerPaper = kindRaw === "INNER_PAPER";
  const isCoverPaper = kindRaw === "COVER_PAPER";
  await prisma.optionGroup.update({
    where: { id: groupId },
    data: {
      ...(name ? { name } : {}),
      ...(value ? { value } : {}),
      kind: kindRaw,
      required,
      perSheet,
      perQuantity,
      perArea,
      allowDirectInput,
      isInnerPaper,
      isCoverPaper,
      minDirectInput:
        minDirectInput !== null && Number.isFinite(minDirectInput)
          ? minDirectInput
          : null,
      maxDirectInput:
        maxDirectInput !== null && Number.isFinite(maxDirectInput)
          ? maxDirectInput
          : null,
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

async function updateProductTemplate(
  productId: string,
  formData: FormData,
) {
  "use server";
  const raw = String(formData.get("template") || "NONE").toUpperCase();
  const template: ProductTemplate =
    raw === "BOOKLET" || raw === "FLAT_PRINT" ? raw : "NONE";

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { _count: { select: { optionGroups: true } } },
  });
  if (!product) return;

  await prisma.product.update({
    where: { id: productId },
    data: { template },
  });

  // 기존 그룹이 0개이고 template 이 NONE 이 아니면 스캐폴드
  if (
    product._count.optionGroups === 0 &&
    template !== "NONE"
  ) {
    await scaffoldProductGroups(productId, template);
  }

  revalidatePath(`/admin/products/${productId}`);
}

async function updateProductMeta(productId: string, formData: FormData) {
  "use server";
  const baseAreaRaw = String(formData.get("baseAreaMm2") || "").trim();
  const baseAreaMm2 = Number(baseAreaRaw);
  const bleedRaw = String(formData.get("bleedMm") || "").trim();
  const bleedMm = Number(bleedRaw);
  const data: { baseAreaMm2?: number; bleedMm?: number } = {};
  if (Number.isFinite(baseAreaMm2) && baseAreaMm2 > 0) {
    data.baseAreaMm2 = Math.round(baseAreaMm2);
  }
  if (Number.isFinite(bleedMm) && bleedMm >= 0) {
    data.bleedMm = Math.round(bleedMm);
  }
  if (Object.keys(data).length > 0) {
    await prisma.product.update({ where: { id: productId }, data });
  }
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
  const widthRaw = String(formData.get("widthMm") || "").trim();
  const heightRaw = String(formData.get("heightMm") || "").trim();
  const widthMm = widthRaw === "" ? null : Number(widthRaw);
  const heightMm = heightRaw === "" ? null : Number(heightRaw);
  const minRangeRaw = String(formData.get("minRange") || "").trim();
  const maxRangeRaw = String(formData.get("maxRange") || "").trim();
  const minRange = minRangeRaw === "" ? null : Number(minRangeRaw);
  const maxRange = maxRangeRaw === "" ? null : Number(maxRangeRaw);
  const thicknessRaw = String(formData.get("thicknessMm") || "").trim();
  const thicknessMm = thicknessRaw === "" ? null : Number(thicknessRaw);
  await prisma.optionItem.update({
    where: { id: itemId },
    data: {
      multiplier: Number.isFinite(multiplier) ? multiplier : 1,
      minRange:
        minRange !== null && Number.isFinite(minRange) ? minRange : null,
      maxRange:
        maxRange !== null && Number.isFinite(maxRange) ? maxRange : null,
      thicknessMm:
        thicknessMm !== null && Number.isFinite(thicknessMm) && thicknessMm > 0
          ? thicknessMm
          : null,
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
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        연동 상품 목록
      </Link>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {product.mall.name} · Cafe24 #{product.cafe24ProductNo} · 기본가{" "}
            {product.basePrice.toLocaleString()}원 · 기준 면적{" "}
            {(product.baseAreaMm2 ?? 62370).toLocaleString()}mm²
          </p>
          <TemplatePicker
            productId={product.id}
            current={product.template ?? "NONE"}
            hasGroups={product.optionGroups.length > 0}
            action={updateProductTemplate}
          />

          <BaseAreaForm
            productId={product.id}
            current={product.baseAreaMm2 ?? 62370}
            bleed={product.bleedMm ?? 3}
            template={product.template ?? "NONE"}
            action={updateProductMeta}
          />
          <span
            className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
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
            <button className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-emerald-700">
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
            const fmtSigned = (n: number) =>
              `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
            const priceRange = !itemCount
              ? "—"
              : minAdd === maxAdd
                ? `${fmtSigned(minAdd)}원`
                : `${fmtSigned(minAdd)} ~ ${fmtSigned(maxAdd)}원`;

            const summary = (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {g.name}
                </span>
                <KindBadge kind={g.kind} />
                {g.required && (
                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">
                    필수
                  </span>
                )}
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
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
                <div className="flex items-center gap-2 px-3 py-2.5">
                  {/* 순서 변경 */}
                  <div className="flex flex-col gap-1.5">
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
                        className="flex h-3.5 w-5 items-center justify-center text-zinc-400 hover:text-zinc-700 disabled:pointer-events-none disabled:opacity-30"
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
                        className="flex h-3.5 w-5 items-center justify-center text-zinc-400 hover:text-zinc-700 disabled:pointer-events-none disabled:opacity-30"
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
                        <details className="group rounded-md border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/40">
                          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">
                            <span>고급 설정 (역할 · 필수 · 노출 조건)</span>
                            <ChevronDown
                              className="size-3.5 text-zinc-400 transition-transform group-open:rotate-180"
                              aria-hidden
                            />
                          </summary>
                          <form
                            action={updateOptionGroup.bind(
                              null,
                              product.id,
                              g.id,
                            )}
                            className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <Field label="역할 (kind)">
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
                                  <option value="INNER_PAPER">
                                    내지 종이
                                  </option>
                                  <option value="COVER_PAPER">
                                    표지 종이
                                  </option>
                                </select>
                              </Field>
                              <Field label="필수 여부">
                                <label className="flex h-8 items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                  <input
                                    type="checkbox"
                                    name="required"
                                    defaultChecked={g.required}
                                    className="size-3.5"
                                  />
                                  필수 그룹
                                </label>
                              </Field>
                            </div>

                            {(g.kind === "NORMAL" ||
                              g.kind === "INNER_PAPER" ||
                              g.kind === "COVER_PAPER") && (
                              <Field label="곱셈 옵션">
                                <div className="flex flex-wrap gap-x-5 gap-y-2">
                                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                    <input
                                      type="checkbox"
                                      name="perSheet"
                                      defaultChecked={g.perSheet}
                                      className="size-3.5"
                                    />
                                    <b>장수</b>에 곱함
                                  </label>
                                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                    <input
                                      type="checkbox"
                                      name="perQuantity"
                                      defaultChecked={g.perQuantity}
                                      className="size-3.5"
                                    />
                                    <b>부수</b>에 곱함
                                  </label>
                                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                    <input
                                      type="checkbox"
                                      name="perArea"
                                      defaultChecked={g.perArea}
                                      className="size-3.5"
                                    />
                                    <b>면적</b>에 곱함 (사이즈 그룹 필요)
                                  </label>
                                </div>
                              </Field>
                            )}

                            {(g.kind === "SHEET_COUNT" ||
                              g.kind === "QUANTITY") && (
                              <Field label="직접 입력 모드">
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                    <input
                                      type="checkbox"
                                      name="allowDirectInput"
                                      defaultChecked={g.allowDirectInput}
                                      className="size-3.5"
                                    />
                                    사용자가 숫자 직접 입력 (옵션 셀렉트 대신)
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      name="minDirectInput"
                                      defaultValue={g.minDirectInput ?? ""}
                                      placeholder="최소"
                                      className={smallInputCls}
                                    />
                                    <input
                                      type="number"
                                      name="maxDirectInput"
                                      defaultValue={g.maxDirectInput ?? ""}
                                      placeholder="최대"
                                      className={smallInputCls}
                                    />
                                  </div>
                                  <div className="text-[10px] text-zinc-500">
                                    옵션 아이템에 minRange/maxRange 를 정의하면 입력값에 따라 자동 매칭됩니다.
                                  </div>
                                </div>
                              </Field>
                            )}

                            <Field
                              label="보이는 조건 (JSON)"
                              hint={`예: [{"groupId":"abc","itemId":"xyz"}] · 비우면 항상 노출`}
                            >
                              <textarea
                                name="showWhen"
                                defaultValue={showWhenStr}
                                rows={2}
                                spellCheck={false}
                                className={smallInputCls + " h-auto font-mono"}
                              />
                            </Field>

                            {g.kind === "DIMENSIONS" && (
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label="허용 최대 가로 (mm)">
                                  <input
                                    type="number"
                                    name="maxWidthMm"
                                    defaultValue={g.maxWidthMm ?? ""}
                                    placeholder="비우면 가장 큰 옵션 기준"
                                    className={smallInputCls}
                                  />
                                </Field>
                                <Field label="허용 최대 세로 (mm)">
                                  <input
                                    type="number"
                                    name="maxHeightMm"
                                    defaultValue={g.maxHeightMm ?? ""}
                                    placeholder="비우면 가장 큰 옵션 기준"
                                    className={smallInputCls}
                                  />
                                </Field>
                              </div>
                            )}

                            <div className="flex justify-end pt-1">
                              <button type="submit" className={buttonCls}>
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
                                  <span className="font-mono text-[11px] text-zinc-400">
                                    {it.value}
                                  </span>
                                  <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                                    {it.addPrice > 0 ? "+" : ""}
                                    {it.addPrice.toLocaleString()}
                                    {g.perSheet && " ×장"}
                                    {g.perQuantity && " ×부"}
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
                                {(() => {
                                  const isSheetQty =
                                    g.kind === "SHEET_COUNT" ||
                                    g.kind === "QUANTITY";
                                  const showMultiplier =
                                    isSheetQty && !g.allowDirectInput;
                                  const showRange =
                                    isSheetQty && g.allowDirectInput;
                                  const multLabel =
                                    g.kind === "SHEET_COUNT"
                                      ? "장수"
                                      : "부수";
                                  const showDims = g.kind === "DIMENSIONS";
                                  const showThickness =
                                    g.kind === "INNER_PAPER" ||
                                    g.kind === "COVER_PAPER";
                                  if (!showMultiplier && !showDims && !showRange && !showThickness) {
                                    return null;
                                  }
                                  return (
                                    <form
                                      action={updateOptionItem.bind(
                                        null,
                                        product.id,
                                        it.id,
                                      )}
                                      className="mt-2 flex flex-wrap items-center gap-2 ps-7 text-xs text-zinc-500"
                                    >
                                      {showMultiplier && (
                                        <label className="flex items-center gap-1">
                                          {multLabel}
                                          <input
                                            type="number"
                                            name="multiplier"
                                            defaultValue={it.multiplier}
                                            className={inputCls + " w-16 text-right"}
                                          />
                                        </label>
                                      )}
                                      {showRange && (
                                        <>
                                          <label className="flex items-center gap-1">
                                            범위
                                            <input
                                              type="number"
                                              name="minRange"
                                              defaultValue={it.minRange ?? ""}
                                              placeholder="min"
                                              className={inputCls + " w-16 text-right"}
                                            />
                                            ~
                                            <input
                                              type="number"
                                              name="maxRange"
                                              defaultValue={it.maxRange ?? ""}
                                              placeholder="max"
                                              className={inputCls + " w-16 text-right"}
                                            />
                                          </label>
                                        </>
                                      )}
                                      {showDims && (
                                        <>
                                          <label className="flex items-center gap-1">
                                            가로
                                            <input
                                              type="number"
                                              name="widthMm"
                                              defaultValue={it.widthMm ?? ""}
                                              className={inputCls + " w-16 text-right"}
                                            />
                                            mm
                                          </label>
                                          <label className="flex items-center gap-1">
                                            세로
                                            <input
                                              type="number"
                                              name="heightMm"
                                              defaultValue={it.heightMm ?? ""}
                                              className={inputCls + " w-16 text-right"}
                                            />
                                            mm
                                          </label>
                                        </>
                                      )}
                                      {showThickness && (
                                        <label className="flex items-center gap-1">
                                          두께
                                          <input
                                            type="number"
                                            step="0.001"
                                            name="thicknessMm"
                                            defaultValue={it.thicknessMm ?? ""}
                                            placeholder="장당"
                                            className={inputCls + " w-20 text-right"}
                                          />
                                          mm
                                        </label>
                                      )}
                                      <button className={buttonGhostCls + " ms-auto"}>
                                        저장
                                      </button>
                                    </form>
                                  );
                                })()}
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* 새 아이템 추가 */}
                        <form
                          action={addOptionItem.bind(null, g.id, product.id)}
                          className="grid grid-cols-[1fr_1fr_7rem_auto] gap-2"
                        >
                          <input
                            name="label"
                            placeholder="표시명"
                            className={smallInputCls}
                          />
                          <input
                            name="value"
                            placeholder="value"
                            className={smallInputCls}
                          />
                          <input
                            name="addPrice"
                            type="number"
                            placeholder="추가금액"
                            className={smallInputCls}
                          />
                          <button className={buttonGhostCls}>추가</button>
                        </form>
                        <OptionBulkPaste
                          groupId={g.id}
                          productId={product.id}
                          bulkAction={bulkAddOptionItems}
                        />
                      </div>
                    </CollapsibleSection>
                  </div>

                  <form
                    action={deleteOptionGroup.bind(null, product.id, g.id)}
                  >
                    <button
                      type="submit"
                      aria-label="그룹 삭제"
                      title="그룹 삭제"
                      className="flex size-7 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </form>
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
            className={inputCls + " flex-1"}
          />
          <button className={buttonCls}>+ 그룹 추가</button>
        </form>
      </section>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  if (kind === "NORMAL") return null;
  const MAP: Record<string, { cls: string; label: string }> = {
    SHEET_COUNT: { cls: "bg-blue-50 text-blue-700", label: "페이지수" },
    QUANTITY: { cls: "bg-amber-50 text-amber-700", label: "부수" },
    DIMENSIONS: { cls: "bg-violet-50 text-violet-700", label: "사이즈" },
    INNER_PAPER: { cls: "bg-emerald-50 text-emerald-700", label: "내지 종이" },
    COVER_PAPER: { cls: "bg-teal-50 text-teal-700", label: "표지 종이" },
  };
  const m = MAP[kind];
  if (!m) return null;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
    </div>
  );
}

const smallInputCls = inputCls + " w-full";
