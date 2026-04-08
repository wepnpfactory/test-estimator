import type { OptionGroup, OptionItem } from "@/generated/prisma/client";
import type { ParsedItem } from "../option-bulk-paste";

export type OptionItemRow = OptionItem;
export type OptionGroupWithItems = OptionGroup & { items: OptionItemRow[] };

export interface OptionGroupActions {
  updateGroup: (productId: string, groupId: string, formData: FormData) => Promise<void>;
  deleteGroup: (productId: string, groupId: string) => Promise<void>;
  moveGroup: (productId: string, groupId: string, direction: "up" | "down") => Promise<void>;
  addItem: (groupId: string, productId: string, formData: FormData) => Promise<void>;
  updateItem: (productId: string, itemId: string, formData: FormData) => Promise<void>;
  deleteItem: (productId: string, itemId: string) => Promise<void>;
  moveItem: (productId: string, groupId: string, itemId: string, direction: "up" | "down") => Promise<void>;
  bulkAddItems: (groupId: string, productId: string, items: ParsedItem[]) => Promise<void>;
}
