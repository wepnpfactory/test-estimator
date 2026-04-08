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
import { Prisma } from "@/generated/prisma/client";

type GroupKindStr =
  | "NORMAL"
  | "SHEET_COUNT"
  | "QUANTITY"
  | "DIMENSIONS"
  | "INNER_PAPER"
  | "COVER_PAPER";

// ─── server actions ─────────────────────────────────────────

// 서버 액션 소유권 검증 헬퍼.
// 임의 groupId/itemId 가 다른 상품의 데이터에 접근하지 못하도록 productId 와 묶어서만 조작한다.
async function assertGroupOwned(
  productId: string,
  groupId: string,
): Promise<boolean> {
  const g = await prisma.optionGroup.findFirst({
    where: { id: groupId, productId },
    select: { id: true },
  });
  return !!g;
}

async function assertItemOwned(
  productId: string,
  itemId: string,
): Promise<boolean> {
  const i = await prisma.optionItem.findFirst({
    where: { id: itemId, group: { productId } },
    select: { id: true },
  });
  return !!i;
}

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
  if (!(await assertGroupOwned(productId, groupId))) return;
  const kindRaw = String(formData.get("kind") || "NORMAL") as GroupKindStr;
  const required = formData.get("required") === "on";
  const name = String(formData.get("name") || "").trim();
  const value = String(formData.get("value") || "").trim();
  const showWhenText = String(formData.get("showWhen") || "").trim();
  let showWhen: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  if (showWhenText) {
    try {
      const parsed = JSON.parse(showWhenText);
      if (Array.isArray(parsed)) showWhen = parsed as Prisma.InputJsonValue;
    } catch {
      // 형식 오류면 null 유지
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
  const multiSelect = formData.get("multiSelect") === "on";
  const minDirectRaw = String(formData.get("minDirectInput") || "").trim();
  const maxDirectRaw = String(formData.get("maxDirectInput") || "").trim();
  const minDirectInput = minDirectRaw === "" ? null : Number(minDirectRaw);
  const maxDirectInput = maxDirectRaw === "" ? null : Number(maxDirectRaw);
  const displayTypeRaw = String(formData.get("displayType") || "SELECT");
  const displayType:
    | "SELECT"
    | "RADIO"
    | "SWATCH"
    | "NUMBER"
    | "CHECKBOX"
    | "CASCADE" =
    displayTypeRaw === "RADIO" ||
    displayTypeRaw === "SWATCH" ||
    displayTypeRaw === "NUMBER" ||
    displayTypeRaw === "CHECKBOX" ||
    displayTypeRaw === "CASCADE"
      ? (displayTypeRaw as "RADIO" | "SWATCH" | "NUMBER" | "CHECKBOX" | "CASCADE")
      : "SELECT";
  const facetALabel = String(formData.get("facetALabel") || "").trim() || null;
  const facetBLabel = String(formData.get("facetBLabel") || "").trim() || null;
  await prisma.optionGroup.update({
    where: { id: groupId },
    data: {
      ...(name ? { name } : {}),
      ...(value ? { value } : {}),
      kind: kindRaw,
      displayType,
      required,
      perSheet,
      perQuantity,
      perArea,
      allowDirectInput,
      multiSelect,
      facetALabel,
      facetBLabel,
      minDirectInput:
        minDirectInput !== null && Number.isFinite(minDirectInput)
          ? minDirectInput
          : null,
      maxDirectInput:
        maxDirectInput !== null && Number.isFinite(maxDirectInput)
          ? maxDirectInput
          : null,
      showWhen,
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
  // 소유권 검증 + delete 를 단일 쿼리로 — deleteMany 는 매칭 0건이면 no-op.
  await prisma.optionGroup.deleteMany({
    where: { id: groupId, productId },
  });
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
  const leadRaw = String(formData.get("leadTimeDays") || "").trim();
  const leadTimeDays = Number(leadRaw);
  const data: {
    baseAreaMm2?: number;
    bleedMm?: number;
    leadTimeDays?: number;
  } = {};
  if (Number.isFinite(baseAreaMm2) && baseAreaMm2 > 0) {
    data.baseAreaMm2 = Math.round(baseAreaMm2);
  }
  if (Number.isFinite(bleedMm) && bleedMm >= 0) {
    data.bleedMm = Math.round(bleedMm);
  }
  if (Number.isFinite(leadTimeDays) && leadTimeDays >= 0) {
    data.leadTimeDays = Math.round(leadTimeDays);
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
  if (!(await assertGroupOwned(productId, groupId))) return;
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
  if (!(await assertGroupOwned(productId, groupId))) return;
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
  if (!(await assertItemOwned(productId, itemId))) return;
  // patch 스타일 — formData 에 존재하는 key 만 업데이트, 나머지는 유지
  const data: Record<string, unknown> = {};

  const setOptStr = (key: string, mapper?: (v: string) => unknown) => {
    if (!formData.has(key)) return;
    const raw = String(formData.get(key) ?? "").trim();
    data[key] = mapper ? mapper(raw) : raw || null;
  };
  const setOptInt = (key: string, opts: { nullable?: boolean; positive?: boolean; min?: number } = {}) => {
    if (!formData.has(key)) return;
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") {
      data[key] = opts.nullable ? null : 0;
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (opts.positive && n <= 0) {
      data[key] = opts.nullable ? null : 0;
      return;
    }
    if (opts.min != null && n < opts.min) return;
    data[key] = Math.round(n);
  };
  const setOptFloat = (key: string, opts: { positive?: boolean } = {}) => {
    if (!formData.has(key)) return;
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") {
      data[key] = null;
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (opts.positive && n <= 0) {
      data[key] = null;
      return;
    }
    data[key] = n;
  };

  // label/value/addPrice
  if (formData.has("label")) {
    const label = String(formData.get("label") ?? "").trim();
    if (label) data.label = label;
  }
  if (formData.has("value")) {
    const value = String(formData.get("value") ?? "").trim();
    if (value) data.value = value;
  }
  setOptInt("addPrice");

  setOptInt("multiplier");
  setOptInt("widthMm", { nullable: true, positive: true });
  setOptInt("heightMm", { nullable: true, positive: true });
  setOptInt("minRange", { nullable: true });
  setOptInt("maxRange", { nullable: true });
  setOptFloat("thicknessMm", { positive: true });
  setOptInt("leadTimeDays", { min: 0 });
  // imageUrl 은 http(s) 만 허용 — javascript:, data:, file: 등 차단 (XSS 방지)
  if (formData.has("imageUrl")) {
    const raw = String(formData.get("imageUrl") ?? "").trim();
    if (raw === "") {
      data.imageUrl = null;
    } else if (/^https?:\/\//i.test(raw)) {
      data.imageUrl = raw;
    }
    // 그 외 스킴은 무시 — 기존 값 유지
  }

  if (formData.has("facetA")) {
    const raw = String(formData.get("facetA") ?? "").trim();
    data.facetA = raw || null;
  }
  if (formData.has("facetB")) {
    const raw = String(formData.get("facetB") ?? "").trim();
    data.facetB = raw || null;
  }

  if (formData.has("disabledWhen")) {
    const raw = String(formData.get("disabledWhen") ?? "").trim();
    let parsed: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) parsed = p as Prisma.InputJsonValue;
      } catch {}
    }
    data.disabledWhen = parsed;
  }

  if (Object.keys(data).length === 0) return;
  try {
    await prisma.optionItem.update({ where: { id: itemId }, data });
  } catch {
    // value 중복 등은 silent — UI 가 revalidate 로 원복
  }
  revalidatePath(`/admin/products/${productId}`);
}

async function deleteOptionItem(productId: string, itemId: string) {
  "use server";
  await prisma.optionItem.deleteMany({
    where: { id: itemId, group: { productId } },
  });
  revalidatePath(`/admin/products/${productId}`);
}

async function moveOptionItem(
  productId: string,
  groupId: string,
  itemId: string,
  direction: "up" | "down",
) {
  "use server";
  if (
    !(await assertGroupOwned(productId, groupId)) ||
    !(await assertItemOwned(productId, itemId))
  ) {
    return;
  }
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
  if (!(await assertGroupOwned(productId, groupId))) return;
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
        className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        연동 상품 목록
      </Link>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
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
            leadTimeDays={product.leadTimeDays ?? 1}
            template={product.template ?? "NONE"}
            action={updateProductMeta}
          />
          <span
            className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
              product.status === "PUBLISHED"
                ? "bg-success/10 text-success"
                : "bg-muted text-text-secondary"
            }`}
          >
            {product.status}
          </span>
        </div>
        {product.status !== "PUBLISHED" && (
          <form action={publishProduct.bind(null, product.id)}>
            <button className="inline-flex h-8 items-center rounded-md bg-success px-3 text-xs font-medium text-success-foreground shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
              게시
            </button>
          </form>
        )}
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold">옵션 그룹</h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              그룹 머리글을 클릭해 값 목록을 펼치거나 접을 수 있습니다. 접힌
              상태는 브라우저에 기억됩니다.
            </p>
          </div>
          <div className="text-[11px] text-text-tertiary">총 {groupCount}개</div>
        </div>

        <div className="mt-4 space-y-3">
          {product.optionGroups.map((g, gi) => (
            <OptionGroupCard
              key={g.id}
              productId={product.id}
              group={g}
              index={gi}
              total={groupCount}
              allGroups={product.optionGroups}
              actions={optionGroupActions}
            />
          ))}
        </div>

        <AddOptionGroupForm productId={product.id} action={addOptionGroup} />
      </section>
    </div>
  );
}

