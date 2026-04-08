import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewProductForm } from "./_components/new-product-form";

async function createProduct(formData: FormData) {
  "use server";
  const mallId = String(formData.get("mallId") || "");
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const cafe24ProductNo = Number(formData.get("cafe24ProductNo") || 0);
  const basePrice = Number(formData.get("basePrice") || 0);

  if (!mallId || !name || !slug || !Number.isInteger(cafe24ProductNo) || cafe24ProductNo <= 0) {
    throw new Error("필수 입력값이 누락되었습니다.");
  }

  const product = await prisma.product.create({
    data: {
      mallId,
      name,
      slug,
      cafe24ProductNo,
      basePrice: Math.max(0, basePrice),
      status: "DRAFT",
    },
  });
  redirect(`/admin/products/${product.id}`);
}

export default async function NewProductPage() {
  const malls = await prisma.cafe24Mall.findMany({
    where: { accessToken: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, mallId: true },
  });

  if (malls.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">새 상품 연결</h1>
        <p className="mt-6 text-sm text-zinc-500">
          먼저{" "}
          <a className="underline" href="/admin/malls">
            몰 연동
          </a>
          에서 Cafe24 몰을 등록해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">새 상품 연결</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          쇼핑몰에 등록된 상품을 선택하면 견적 엔진(test-estimator)에 연결됩니다.
        </p>
      </header>

      <div className="mt-6">
        <NewProductForm malls={malls} action={createProduct} />
      </div>
    </div>
  );
}
