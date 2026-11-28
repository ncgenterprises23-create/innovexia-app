'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import SearchableDropdown from '@/components/SearchableDropdown';
import { useToast } from '@/components/ToastProvider';
import { ensureSessionId } from '@/utils/session';
import { Loader2, Pencil, RefreshCcw, Save, Trash2, X } from 'lucide-react';

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';
const LIGHT_BG = 'bg-[var(--theme-light)] dark:bg-[var(--theme-primary)]/15';
const LIGHT_BORDER = 'border border-[var(--theme-primary)]/25';
const LIGHT_SURFACE = `${LIGHT_BG} ${LIGHT_BORDER} ${DASH_SHADOW}`;

const FIELD =
  'w-full rounded-xl border border-[var(--theme-primary)]/25 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/40';
const TH =
  'px-2.5 py-2 text-left text-xs font-black uppercase tracking-widest text-gray-900 whitespace-nowrap';

type ImsItemCatalogEntry = {
  item_name: string;
  item_code: string;
  ims_type: 'fg' | 'rm';
};

type CostingRecord = {
  id: string;
  item_name: string;
  item_code: string;
  ims_type: string;
  cost_price: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
};

function catalogOptionId(entry: ImsItemCatalogEntry): string {
  return entry.item_name;
}

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

export default function CostingPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CostingRecord[]>([]);
  const [catalog, setCatalog] = useState<ImsItemCatalogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [username, setUsername] = useState('');

  const [selectedCatalogId, setSelectedCatalogId] = useState<string | number | null>(null);
  const [costPrice, setCostPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<CostingRecord | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const catalogById = useMemo(() => {
    const m = new Map<string, ImsItemCatalogEntry>();
    for (const c of catalog) m.set(catalogOptionId(c), c);
    return m;
  }, [catalog]);

  const dropdownOptions = useMemo(
    () =>
      catalog.map((c) => ({
        id: catalogOptionId(c),
        name: c.item_code ? `${c.item_name} (${c.item_code})` : c.item_name,
      })),
    [catalog]
  );

  const selectedCatalog = selectedCatalogId ? catalogById.get(String(selectedCatalogId)) : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, catRes] = await Promise.all([
        fetch('/api/costing', { cache: 'no-store' }),
        fetch('/api/costing?catalog=1', { cache: 'no-store' }),
      ]);
      const recJson = await recRes.json();
      const catJson = await catRes.json();
      if (!recRes.ok) throw new Error(recJson.error || 'Failed to load records');
      if (!catRes.ok) throw new Error(catJson.error || 'Failed to load IMS FG items');
      setRecords(recJson.records ?? []);
      setCatalog(catJson.catalog ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load costing');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const sessionId = ensureSessionId();
    if (sessionId) {
      void fetch('/api/auth', { headers: { 'x-session-id': sessionId } })
        .then((r) => r.json())
        .then((j) => setUsername(String(j?.user?.username || j?.username || '')))
        .catch(() => undefined);
    }
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.item_name, r.item_code, String(r.cost_price), r.created_by, r.updated_by].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [records, search]);

  const resetForm = () => {
    setSelectedCatalogId(null);
    setCostPrice('');
  };

  const handleCreate = async () => {
    const entry =
      selectedCatalog ?? (selectedCatalogId ? catalogById.get(String(selectedCatalogId)) : undefined);
    if (!entry) {
      toast.error('Select an item from IMS FG');
      return;
    }
    const price = Number(costPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid cost price');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/costing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: entry.item_name,
          item_code: entry.item_code,
          ims_type: 'fg',
          cost_price: price,
          user: username,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success('Cost saved');
      resetForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: CostingRecord) => {
    setEditing(row);
    setEditPrice(String(row.cost_price));
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid cost price');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/costing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          cost_price: price,
          user: username,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      toast.success('Updated');
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: CostingRecord) => {
    if (!confirm(`Delete cost for "${row.item_name}"?`)) return;
    try {
      const res = await fetch(`/api/costing?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      toast.success('Deleted');
      if (editing?.id === row.id) setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <LayoutWrapper>
      <div className="px-5 py-3 space-y-3">
        <motion.div
          className="flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mr-auto min-w-0">
            <h1 className="text-[26px] leading-none font-black text-slate-800 dark:text-white tracking-tight">
              Costing
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mt-1">
              FG item unit costs · Sheet tab Costing
            </p>
          </div>
          <label
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${LIGHT_BG} ${LIGHT_BORDER} ${DASH_SHADOW}`}
          >
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-36 sm:w-44 bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none"
            />
          </label>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 hidden sm:inline">
            {filtered.length} rows
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-[var(--theme-primary)]/20 ${LIGHT_SURFACE}`}
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </motion.div>

        <div className={`${LIGHT_SURFACE} rounded-3xl p-3`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1 mb-2">Add item cost</p>
          <div className="flex flex-col lg:flex-row flex-wrap lg:flex-nowrap items-end gap-2">
            <div className="flex-1 min-w-[12rem] w-full lg:w-auto">
              <SearchableDropdown
                label="Item name (IMS FG)"
                options={dropdownOptions}
                value={selectedCatalogId}
                onChange={setSelectedCatalogId}
                placeholder="Search FG item…"
              />
            </div>
            <div className="w-full sm:w-40 lg:w-36 shrink-0">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1 mb-1">
                Item code
              </label>
              <input
                readOnly
                className={`${FIELD} bg-slate-50 dark:bg-slate-800/80`}
                value={selectedCatalog?.item_code || '—'}
              />
            </div>
            <div className="w-full sm:w-36 lg:w-32 shrink-0">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1 mb-1">
                Cost price (₹)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={FIELD}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCreate()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--theme-primary)] text-gray-900 text-xs font-black uppercase tracking-widest shadow-sm disabled:opacity-50 shrink-0"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>

        <div className={`${LIGHT_SURFACE} rounded-3xl overflow-hidden`}>

          {loading ? (
            <div className="flex justify-center items-center gap-2 py-14 text-slate-500 text-xs font-semibold">
              <Loader2 className="animate-spin" size={18} />
              Loading…
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="whitespace-nowrap">
                  <tr className="bg-[var(--theme-primary)] border-b border-gray-200 dark:border-gray-600">
                    <th className={TH}>Item name</th>
                    <th className={TH}>Item code</th>
                    <th className={`${TH} text-right`}>Cost price</th>
                    <th className={TH}>Updated</th>
                    <th className={TH}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 whitespace-nowrap">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-500 font-semibold">
                        No costing rows yet.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`border-b border-[var(--theme-primary)]/10 ${
                          idx % 2 === 0 ? 'bg-white/60 dark:bg-slate-950/20' : 'bg-[var(--theme-light)]/40 dark:bg-slate-900/30'
                        } hover:bg-[var(--theme-primary)]/10`}
                      >
                        <td className="px-2.5 py-2 font-bold text-slate-800 dark:text-slate-100">{row.item_name}</td>
                        <td className="px-2.5 py-2 text-slate-600 dark:text-slate-400 tabular-nums">
                          {row.item_code || '—'}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums font-black text-slate-900 dark:text-white">
                          {formatInr(row.cost_price)}
                        </td>
                        <td className="px-2.5 py-2 text-[10px] text-slate-500 leading-snug max-w-[10rem]">
                          {row.updated_by ? <span className="font-semibold">{row.updated_by}</span> : null}
                          {row.updated_at ? (
                            <span className="block">
                              {new Date(row.updated_at).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="p-1.5 rounded-full border border-[var(--theme-primary)]/25 bg-white dark:bg-slate-900 text-slate-700 hover:bg-[var(--theme-primary)]/25"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row)}
                              className="p-1.5 rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      <AnimatePresence>
        {editing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className={`w-full max-w-sm rounded-3xl p-5 space-y-3 ${LIGHT_SURFACE} bg-white dark:bg-slate-900`}
            >
              <div className="flex justify-between items-start gap-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                  Edit cost
                </h3>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {editing.item_name}
                {editing.item_code ? ` · ${editing.item_code}` : ''}
              </p>
              <input
                type="number"
                min={0}
                step="0.01"
                className={FIELD}
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleUpdate()}
                className="w-full py-2.5 rounded-full bg-[var(--theme-primary)] text-gray-900 text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Update'}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </LayoutWrapper>
  );
}