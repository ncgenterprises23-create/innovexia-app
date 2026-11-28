import { getIMSFGItemCatalog, type ImsItemCatalogEntry } from '@/lib/sheets';
import { listCostingRecords } from '@/lib/costingSheets';

export type CrmCostingPickerItem = ImsItemCatalogEntry & {
  saved: boolean;
  cost_price: number;
  selectable: boolean;
};

export type CrmCostingPickerPayload = {
  items: CrmCostingPickerItem[];
  priceByName: Record<string, number>;
};

function normName(name: string): string {
  return name.trim().toLowerCase();
}

export async function buildCrmCostingPickerPayload(): Promise<CrmCostingPickerPayload> {
  const [catalog, records] = await Promise.all([getIMSFGItemCatalog(), listCostingRecords()]);
  const priceByName: Record<string, number> = {};
  for (const rec of records) {
    const key = normName(rec.item_name);
    if (!key) continue;
    const p = Number(rec.cost_price);
    if (Number.isFinite(p) && p > 0) priceByName[key] = p;
  }

  const items: CrmCostingPickerItem[] = catalog.map((entry) => {
    const key = normName(entry.item_name);
    const cost_price = key ? priceByName[key] ?? 0 : 0;
    const saved = records.some((r) => normName(r.item_name) === key);
    return {
      ...entry,
      saved,
      cost_price,
      selectable: cost_price > 0,
    };
  });

  items.sort((a, b) => a.item_name.localeCompare(b.item_name, undefined, { numeric: true, sensitivity: 'base' }));

  return { items, priceByName };
}