import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

async function createProduct(formData: FormData) {
  "use server";
  const mallId = String(formData.get("mallId") || "");
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const cafe24ProductNo = Number(formData.get("cafe24ProductNo") || 0);
  const basePrice = Number(formData.get("basePrice") || 0);

  if (!mallId || !name || !slug || !cafe24ProductNo) {
    throw new Error("필수 입력값이 누락되었습니다.");
  }

  const product = await prisma.product.create({
    data: {
      mallId,
      name,
      slug,
      cafe24ProductNo,
      basePrice,
      status: "DRAFT",
    },
  });
  redirect(`/admin/products/${product.id}`);
}

export default async function NewProductPage() {
  const malls = await prisma.cafe24Mall.findMany({ orderBy: { name: "asc" } });

  if (malls.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold">새 상품 연결</h1>
        <p className="mt-6 text-sm text-zinc-500">
          먼저 <a className="underline" href="/admin/malls">몰 연동</a>에서 Cafe24 몰을 등록해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold">새 상품 연결</h1>
      <form action={createProduct} className="mt-6 space-y-4">
        <Field label="몰">
          <select
            name="mallId"
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {malls.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.mallId})
              </option>
            ))}
          </select>
        </Field>
        <Field label="상품명 (관리용)">
          <input name="name" required className={inputCls} />
        </Field>
        <Field label="slug (URL용)">
          <input name="slug" required className={inputCls} />
        </Field>
        <Field label="Cafe24 겉보기 상품번호">
          <input
            name="cafe24ProductNo"
            type="number"
            required
            className={inputCls}
          />
        </Field>
        <Field label="기본가 (원)">
          <input name="basePrice" type="number" defaultValue={0} className={inputCls} />
        </Field>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
        >
          생성
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
