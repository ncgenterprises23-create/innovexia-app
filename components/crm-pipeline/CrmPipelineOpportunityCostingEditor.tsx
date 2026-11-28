'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import Icon from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { getTagClassName } from '@/lib/crmPipelineTags';
import {
  parseCrmOpportunityCostingItems,
  stringifyCrmOpportunityCostingItems,
  totalCrmOpportunityCostingLines,
  type CrmOpportunityCostingLine,
} from '@/lib/crmOpportunityCosting';

type PickerItem = {
  item_name: string;
  item_code: string;
  saved: boolean;
  cost_price: number;
  selectable: boolean;
};

type Props = {
  costingItemsJson: string;
  costingTotal: string;
  onChange: (next: { costing_items: string; costing: string }) => void;
  compact?: boolean;
};

function formatInr(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '₹ 0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatPriceShort(n: number): string {
  const p = Number.isFinite(n) ? n : 0;
  return p > 0 ? formatInr(p) : '₹ 0';
}

function normName(name: string): string {
  return name.trim().toLowerCase();
}

const ZERO_COST_TOAST =
  "You can't select this item — cost is ₹0. Save the price on the Costing page first.";

function linesFromSelected(names: string[], itemByName: Map<string, PickerItem>): CrmOpportunityCostingLine[] {
  const built: CrmOpportunityCostingLine[] = [];
  for (const name of names) {
    const meta = itemByName.get(normName(name));
    if (!meta) continue;
    const unit_price = Number(meta.cost_price) || 0;
    if (unit_price <= 0) continue;
    built.push({
      item_name: meta.item_name,
      item_code: meta.item_code,
      qty: 1,
      unit_price,
    });
  }
  return built;
}

export default function CrmPipelineOpportunityCostingEditor({
  costingItemsJson,
  costingTotal,
  onChange,
  compact = false,
}: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const lastHydratedKey = useRef('');
  const syncKey = `${costingItemsJson}|${costingTotal}`;

  const itemByName = useMemo(() => {
    const m = new Map<string, PickerItem>();
    for (const it of pickerItems) m.set(normName(it.item_name), it);
    return m;
  }, [pickerItems]);

  const pushToParent = useCallback(
    (names: string[]) => {
      const built = linesFromSelected(names, itemByName);
      const json = stringifyCrmOpportunityCostingItems(built);
      const total = totalCrmOpportunityCostingLines(built);
      onChange({ costing_items: json, costing: total > 0 ? String(Math.round(total)) : '' });
    },
    [itemByName, onChange]
  );

  const applySelection = useCallback(
    (updater: (prev: string[]) => string[]) => {
      setSelectedNames((prev) => {
        const next = updater(prev);
        queueMicrotask(() => pushToParent(next));
        return next;
      });
    },
    [pushToParent]
  );

  const toggleItem = useCallback(
    (itemName: string) => {
      const key = normName(itemName);
      const meta = itemByName.get(key);
      const canonical = meta?.item_name || itemName;
      const unitPrice = Number(meta?.cost_price) || 0;
      applySelection((prev) => {
        const has = prev.some((n) => normName(n) === key);
        if (!has && unitPrice <= 0) {
          queueMicrotask(() => toast.error(ZERO_COST_TOAST));
          return prev;
        }
        return has ? prev.filter((n) => normName(n) !== key) : [...prev, canonical];
      });
    },
    [applySelection, itemByName, toast]
  );

  const removeItem = useCallback(
    (itemName: string) => {
      const key = normName(itemName);
      applySelection((prev) => prev.filter((n) => normName(n) !== key));
    },
    [applySelection]
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/costing/crm-picker');
        const data = await res.json();
        if (res.ok) setPickerItems(data.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (lastHydratedKey.current === syncKey) return;
    lastHydratedKey.current = syncKey;
    const parsed = parseCrmOpportunityCostingItems(costingItemsJson);
    const names = parsed.length > 0 ? parsed.map((p) => p.item_name) : [];
    setSelectedNames((prev) => {
      if (
        prev.length === names.length &&
        prev.every((n, i) => normName(n) === normName(names[i] ?? ''))
      ) {
        return prev;
      }
      return names;
    });
  }, [loading, syncKey, costingItemsJson]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [dropdownOpen]);

  const grandTotal = useMemo(
    () => totalCrmOpportunityCostingLines(linesFromSelected(selectedNames, itemByName)),
    [selectedNames, itemByName]
  );

  const selectedKeys = useMemo(() => new Set(selectedNames.map(normName)), [selectedNames]);

  const filteredDropdown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pickerItems.filter(
      (p) =>
        !q || p.item_name.toLowerCase().includes(q) || p.item_code.toLowerCase().includes(q)
    );
  }, [pickerItems, search]);

  const pillText = compact ? 'text-[10px]' : 'text-[11px]';

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading FG items…
      </div>
    );
  }

  return (
  <div className="w-full">
      <div className="relative" ref={pickerRef}>
        <div
          className={`flex flex-wrap gap-1 items-center cursor-text min-h-[2rem] py-0.5 ${
            compact ? 'max-w-full' : ''
          }`}
          onClick={() => setDropdownOpen(true)}
        >
          {selectedNames.map((name) => {
            const meta = itemByName.get(normName(name));
            const price = meta ? formatPriceShort(meta.cost_price) : '₹ 0';
            return (
              <span
                key={name}
                title={`${name} · ${price}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border max-w-full ${pillText} ${getTagClassName(name)}`}
              >
                <span className="truncate max-w-[10rem] sm:max-w-[14rem]">
                  {meta?.item_name || name}
                  <span className="opacity-80 font-semibold ml-1">{price}</span>
                </span>
                <button
                  type="button"
                  className="opacity-70 hover:opacity-100 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(name);
                  }}
                >
                  <Icon name="close" size={compact ? 10 : 12} />
                </button>
              </span>
            );
          })}
          {!selectedNames.length && (
            <span className={`text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>Select FG items…</span>
          )}
        </div>

        {dropdownOpen && (
          <div
            className={`absolute left-0 right-0 top-full mt-1 z-40 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg overflow-hidden ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            <label className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search FG item…"
                className="flex-1 bg-transparent outline-none text-xs py-1"
                autoFocus
              />
            </label>
            <div className="max-h-64 overflow-y-auto py-1">
              {filteredDropdown.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500">No matches</div>
              ) : (
                filteredDropdown.map((p) => {
                  const selected = selectedKeys.has(normName(p.item_name));
                  const zeroCost = (Number(p.cost_price) || 0) <= 0;
                  const blocked = zeroCost && !selected;
                  return (
                    <button
                      key={`${p.item_name}-${p.item_code}`}
                      type="button"
                      title={blocked ? ZERO_COST_TOAST : undefined}
                      className={`flex w-full items-center justify-between gap-2 text-left px-3 py-1.5 ${
                        selected
                          ? 'bg-violet-50/90 dark:bg-violet-950/30'
                          : blocked
                            ? 'opacity-55 cursor-not-allowed'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                      onClick={() => toggleItem(p.item_name)}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {selected ? (
                          <Check size={14} className="shrink-0 text-violet-600" strokeWidth={3} />
                        ) : null}
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border truncate max-w-[8rem] ${getTagClassName(p.item_name)}`}
                        >
                          FG
                        </span>
                        <span className={`truncate ${selected ? 'font-semibold' : 'font-medium'}`}>{p.item_name}</span>
                      </span>
                      <span
                        className={`shrink-0 text-[10px] font-bold tabular-nums ${
                          zeroCost ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {formatPriceShort(p.cost_price)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <p className={`mt-1 font-bold text-slate-700 dark:text-slate-200 tabular-nums ${compact ? 'text-[10px]' : 'text-xs'}`}>
        Total: {formatInr(grandTotal)}
      </p>
    </div>
  );
}