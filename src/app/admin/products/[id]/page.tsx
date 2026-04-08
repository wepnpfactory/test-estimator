import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateFacadeProductPrice } from "@/lib/cafe24/products";
import {
  OptionBulkPaste,
  type ParsedItem,
} from "./_components/option-bulk-paste";

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

async function deleteOptionGroup(productId: string, groupId: string) {
  "use server";
  await prisma.optionGroup.delete({ where: { id: groupId } });
  revalidatePath(`/admin/products/${productId}`);
}

async function deleteOptionItem(productId: string, itemId: string) {
  "use server";
  await prisma.optionItem.delete({ where: { id: itemId } });
  revalidatePath(`/admin/products/${productId}`);
}

/**
 * 게시 시점의 "옵션 최저금액" 계산:
 *   basePrice + Σ(필수 그룹별 활성 아이템의 min(addPrice))
 * 옵셔널 그룹은 선택 안 함으로 가정.
 * 음수가 나오면 0 으로 floor (Cafe24 가 음수 가격 거부).
 */
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
    include: {
      mall: true,
      optionGroups: { include: { items: true } },
    },
  });
  if (!product) return;

  const minPrice = calcMinPossiblePrice(product);

  // Cafe24 facade 상품의 판매가도 최저가로 동기화
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
      // 게시 자체는 진행
    }
  }

  await prisma.product.update({
    where: { id: productId },
    data: { status: "PUBLISHED", basePrice: minPrice },
  });
  redirect(`/admin/products/${productId}`);
}

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
          {product.optionGroups.map((g) => (
            <div
              key={g.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{g.name}</div>
                <form action={deleteOptionGroup.bind(null, product.id, g.id)}>
                  <button
                    type="submit"
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    그룹 삭제
                  </button>
                </form>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {g.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-3 text-zinc-600 dark:text-zinc-400"
                  >
                    <span className="flex-1 truncate">
                      {it.label}{" "}
                      <span className="text-zinc-400">({it.value})</span>
                    </span>
                    <span className="tabular-nums">
                      {it.addPrice >= 0 ? "+" : ""}
                      {it.addPrice.toLocaleString()}원
                    </span>
                    <form action={deleteOptionItem.bind(null, product.id, it.id)}>
                      <button
                        type="submit"
                        aria-label="삭제"
                        className="text-zinc-400 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form
                action={addOptionItem.bind(null, g.id, product.id)}
                className="mt-3 flex gap-2"
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
          ))}
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

const smallInputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900";
