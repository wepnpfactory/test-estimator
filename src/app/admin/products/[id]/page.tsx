import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { updateFacadeProductPrice } from "@/lib/cafe24/products";
import { BaseAreaForm } from "./_components/base-area-form";
import { TemplatePicker } from "./_components/template-picker";
import { type ParsedItem } from "./_components/option-bulk-paste";
import {
  AddOptionGroupForm,
  OptionGroupCard,
  type OptionGroupActions,
} from "./_components/option-group";
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
  // 비활성 조건 JSON
  const disabledWhenRaw = String(formData.get("disabledWhen") || "").trim();
  let disabledWhen: unknown = null;
  if (disabledWhenRaw) {
    try {
      const parsed = JSON.parse(disabledWhenRaw);
      if (Array.isArray(parsed)) disabledWhen = parsed;
    } catch {}
  }
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
      disabledWhen: disabledWhen as never,
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

  const optionGroupActions: OptionGroupActions = {
    updateGroup: updateOptionGroup,
    deleteGroup: deleteOptionGroup,
    moveGroup: moveOptionGroup,
    addItem: addOptionItem,
    updateItem: updateOptionItem,
    deleteItem: deleteOptionItem,
    moveItem: moveOptionItem,
    bulkAddItems: bulkAddOptionItems,
  };

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
          {product.optionGroups.map((g, gi) => (
            <OptionGroupCard
              key={g.id}
              productId={product.id}
              group={g}
              index={gi}
              total={groupCount}
              actions={optionGroupActions}
            />
          ))}
        </div>

        <AddOptionGroupForm productId={product.id} action={addOptionGroup} />
      </section>
    </div>
  );
}

