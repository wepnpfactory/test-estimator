// Cafe24 주문 동기화
// docs: https://developers.cafe24.com/docs/en/api/admin/?version=2025-12-01#retrieve-a-list-of-orders
//
// 운영 정책:
// - 웹훅 미사용. 관리자가 명시적으로 동기화 호출.
// - 최근 N일치 주문을 가져와 우리 동적 상품(custom_product_code prefix `DYN-`)이 포함된
//   주문만 골라 DynamicProduct 상태를 ORDERED 로 전이.
// - 전이 후 해당 Cafe24 일회용 상품을 selling=F 로 비활성화.

import { cafe24Fetch } from "@/lib/cafe24/client";
import { prisma } from "@/lib/prisma";
import { deactivateDynamicProduct } from "@/lib/cafe24/dynamic-product";
import type { Cafe24Mall } from "@/generated/prisma/client";

export interface SyncOrdersParams {
  mall: Cafe24Mall;
  startDate: Date;
  endDate: Date;
  /** 한 번에 가져올 페이지 크기 (Cafe24 limit, 최대 100) */
  limit?: number;
}

export interface SyncOrdersResult {
  fetchedOrders: number;
  matchedDynamicProducts: number;
  newlyOrdered: number;
  deactivated: number;
  errors: string[];
}

/**
 * KST(UTC+9) 기준 YYYY-MM-DD 포맷
 */
function formatKstDate(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

interface Cafe24Order {
  order_id: string;
  order_date?: string;
  payment_date?: string;
  buyer_name?: string;
  buyer_email?: string;
  member_id?: string;
  items?: Array<{
    product_no?: number;
    custom_product_code?: string;
    additional_option_values?: Array<{
      additional_option_name?: string;
      additional_option_value?: string;
    }>;
  }>;
}

export async function syncOrders(params: SyncOrdersParams): Promise<SyncOrdersResult> {
  const { mall, startDate, endDate, limit = 100 } = params;
  const start = formatKstDate(startDate);
  const end = formatKstDate(endDate);

  const errors: string[] = [];
  const allOrders: Cafe24Order[] = [];

  let offset = 0;
  // 최대 1000건까지 페이징 (10페이지). 그 이상은 다음 동기화에 미룸.
  const HARD_LIMIT = 1000;
  while (offset < HARD_LIMIT) {
    let page: { orders?: Cafe24Order[] } = {};
    try {
      page = await cafe24Fetch<{ orders?: Cafe24Order[] }>(mall, "/api/v2/admin/orders", {
        method: "GET",
        query: {
          start_date: start,
          end_date: end,
          limit,
          offset,
          embed: "items,buyer",
        },
      });
    } catch (e) {
      errors.push(`fetch failed at offset=${offset}: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
    const fetched = page.orders ?? [];
    allOrders.push(...fetched);
    if (fetched.length < limit) break;
    offset += limit;
  }

  let matched = 0;
  let newlyOrdered = 0;
  let deactivated = 0;

  for (const order of allOrders) {
    const items = order.items ?? [];
    for (const item of items) {
      const code = item.custom_product_code;
      if (!code || !code.startsWith("DYN-")) continue;
      matched++;

      const dynId = code.slice(4);
      const dyn = await prisma.dynamicProduct.findUnique({
        where: { id: dynId },
      });
      if (!dyn) continue;

      // 이미 처리됨
      if (dyn.status === "ORDERED" || dyn.status === "DEACTIVATED" || dyn.cafe24OrderId === order.order_id) {
        continue;
      }

      try {
        await prisma.dynamicProduct.update({
          where: { id: dyn.id },
          data: {
            status: "ORDERED",
            cafe24OrderId: order.order_id,
            orderedAt: order.payment_date
              ? new Date(order.payment_date)
              : order.order_date
                ? new Date(order.order_date)
                : new Date(),
            customerEmail: dyn.customerEmail ?? order.buyer_email ?? null,
            customerName: dyn.customerName ?? order.buyer_name ?? null,
            customerId: dyn.customerId ?? order.member_id ?? null,
            rawOrderSnapshot: order as unknown as object,
          },
        });
        newlyOrdered++;
      } catch (e) {
        errors.push(`db update failed for ${dyn.id}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      // 비활성화 (selling=F)
      if (dyn.cafe24ProductNo) {
        try {
          await deactivateDynamicProduct(mall, dyn.cafe24ProductNo);
          await prisma.dynamicProduct.update({
            where: { id: dyn.id },
            data: { status: "DEACTIVATED" },
          });
          deactivated++;
        } catch (e) {
          errors.push(
            `deactivate failed for product_no=${dyn.cafe24ProductNo}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }
  }

  return {
    fetchedOrders: allOrders.length,
    matchedDynamicProducts: matched,
    newlyOrdered,
    deactivated,
    errors,
  };
}
