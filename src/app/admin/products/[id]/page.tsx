import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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

async function publishProduct(productId: string) {
  "use server";
  await prisma.product.update({
    where: { id: productId },
    data: { status: "PUBLISHED" },
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
              <div className="text-sm font-medium">{g.name}</div>
              <ul className="mt-2 space-y-1 text-sm">
                {g.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex justify-between text-zinc-600 dark:text-zinc-400"
                  >
                    <span>
                      {it.label}{" "}
                      <span className="text-zinc-400">({it.value})</span>
                    </span>
                    <span>
                      {it.addPrice >= 0 ? "+" : ""}
                      {it.addPrice.toLocaleString()}원
                    </span>
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
