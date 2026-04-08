import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewProductForm } from "./_components/new-product-form";
import { FacadeCreateForm } from "./_components/facade-create-form";
import { ModeTabs } from "./_components/mode-tabs";
import { createFacadeProduct } from "@/lib/cafe24/products";

async function createProduct(formData: FormData) {
  "use server";
  const mallId = String(formData.get("mallId") || "");
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const cafe24ProductNo = Number(formData.get("cafe24ProductNo") || 0);
  const basePrice = Number(formData.get("basePrice") || 0);

  if (
    !mallId ||
    !name ||
    !slug ||
    !Number.isInteger(cafe24ProductNo) ||
    cafe24ProductNo <= 0
  ) {
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

async function createFacadeAndLink(formData: FormData) {
  "use server";
  const mallDbId = String(formData.get("mallId") || "");
  const productName = String(formData.get("productName") || "").trim();
  const price = Math.max(0, Number(formData.get("price") || 0));
  const summary = String(formData.get("summary") || "").trim() || undefined;
  const imageUrl = String(formData.get("imageUrl") || "").trim() || undefined;
  const categoryRaw = String(formData.get("categoryNo") || "");
  const categoryNo = categoryRaw ? Number(categoryRaw) : undefined;
  const display = String(formData.get("displayValue") || "T") === "T";

  if (!mallDbId || !productName) {
    throw new Error("필수 입력값이 누락되었습니다.");
  }

  const mall = await prisma.cafe24Mall.findUnique({ where: { id: mallDbId } });
  if (!mall || !mall.accessToken) {
    throw new Error("연결된 몰을 찾을 수 없습니다.");
  }

  const created = await createFacadeProduct({
    mall,
    productName,
    price,
    summaryDescription: summary,
    detailImageUrl: imageUrl,
    categoryNo,
    display,
  });

  const slug = `${mall.mallId}-${created.productNo}`;
  const product = await prisma.product.create({
    data: {
      mallId: mall.id,
      name: productName,
      slug,
      cafe24ProductNo: created.productNo,
      basePrice: Math.floor(price),
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
          쇼핑몰에 등록된 상품을 선택하거나, 새 겉보기 상품을 직접 만들어 견적 엔진에 연결합니다.
        </p>
      </header>

      <div className="mt-6">
        <ModeTabs
          link={<NewProductForm malls={malls} action={createProduct} />}
          create={<FacadeCreateForm malls={malls} action={createFacadeAndLink} />}
        />
      </div>
    </div>
  );
}
