'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchableDropdown from '@/components/SearchableDropdown';
import { useToast } from '@/components/ToastProvider';
import { getNextPlannedTime, O2D_CUSTOMER_TYPES } from '@/lib/o2dPlannedTime';
import { parseCrmOpportunityCostingItems } from '@/lib/crmOpportunityCosting';
import { Loader2, X } from 'lucide-react';

export type CrmOpportunityForO2d = {
  id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
  state?: string;
  country?: string;
  salesperson?: string;
  costing_items?: string;
};

type OrderItemRow = { id: number; item: string; qty: string };

type StepConfig = {
  step: number;
  tatValue: number;
  tatUnit: 'hours' | 'days';
};

type Props = {
  open: boolean;
  opportunity: CrmOpportunityForO2d | null;
  onClose: () => void;
  onO2dCreated: () => Promise<boolean>;
};

function defaultPartyName(opp: CrmOpportunityForO2d): string {
  const company = String(opp.company || '').trim();
  const name = String(opp.name || '').trim();
  return company || name;
}

export default function CrmO2dWonModal({ open, opportunity, onClose, onO2dCreated }: Props) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [costingItems, setCostingItems] = useState<string[]>([]);
  const [dropdownParties, setDropdownParties] = useState<string[]>([]);
  const [stepConfig, setStepConfig] = useState<StepConfig[]>([]);
  const [systemUsers, setSystemUsers] = useState<{ username: string }[]>([]);

  const [formData, setFormData] = useState({
    party_name: '',
    type: 'DEALER' as string,
    contact_person: '',
    email: '',
    contact_no_1: '',
    contact_no_2: '',
    location: '',
    state: '',
    field_person_name: '',
    status: 'Pending',
  });
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([
    { id: Date.now(), item: '', qty: '' },
  ]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [itemsRes, partiesRes, configRes, usersRes] = await Promise.all([
          fetch('/api/costing-items'),
          fetch('/api/o2d-dropdown'),
          fetch('/api/o2d-config'),
          fetch('/api/users'),
        ]);
        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setCostingItems(data.items || []);
        }
        if (partiesRes.ok) {
          const data = await partiesRes.json();
          setDropdownParties(data.parties || []);
        }
        if (configRes.ok) {
          const data = await configRes.json();
          const cfg = (data.config || []) as StepConfig[];
          setStepConfig(cfg.length > 0 ? cfg : [{ step: 1, tatValue: 1, tatUnit: 'hours' }]);
        } else {
          setStepConfig([{ step: 1, tatValue: 1, tatUnit: 'hours' }]);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setSystemUsers(data.users || []);
        }
      } catch {
        setStepConfig([{ step: 1, tatValue: 1, tatUnit: 'hours' }]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !opportunity) return;
    const location = [opportunity.city, opportunity.country].filter(Boolean).join(', ');
    setFormData({
      party_name: defaultPartyName(opportunity),
      type: 'DEALER',
      contact_person: String(opportunity.contact_name || '').trim(),
      email: String(opportunity.email || '').trim(),
      contact_no_1: String(opportunity.phone || '').trim(),
      contact_no_2: '',
      location,
      state: String(opportunity.state || '').trim(),
      field_person_name: String(opportunity.salesperson || '').trim(),
      status: 'Pending',
    });
    const parsed = parseCrmOpportunityCostingItems(opportunity.costing_items);
    if (parsed.length > 0) {
      setOrderItems(
        parsed.map((line, i) => ({
          id: Date.now() + i,
          item: line.item_name,
          qty: String(line.qty || 1),
        }))
      );
    } else {
      setOrderItems([{ id: Date.now(), item: '', qty: '' }]);
    }
  }, [open, opportunity]);

  const itemOptions = useMemo(() => {
    const names = new Set<string>();
    for (const n of costingItems) {
      const t = String(n || '').trim();
      if (t) names.add(t);
    }
    for (const row of orderItems) {
      const t = String(row.item || '').trim();
      if (t) names.add(t);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [costingItems, orderItems]);

  const partyOptions = useMemo(
    () => dropdownParties.filter(Boolean).map((name) => ({ id: name, name })),
    [dropdownParties]
  );

  const representativeOptions = useMemo(
    () => systemUsers.map((u) => ({ id: u.username, name: u.username })),
    [systemUsers]
  );

  const handleItemChange = (id: number, field: 'item' | 'qty', value: string) => {
    setOrderItems((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity || submitting) return;

    const party = formData.party_name.trim();
    if (!party) {
      toast.error('Party name is required');
      return;
    }

    const formattedItems = orderItems.filter((i) => i.item && i.qty);
    if (formattedItems.length === 0) {
      toast.error('At least one item with quantity is required');
      return;
    }

    const step1Config = stepConfig.find((c) => c.step === 1);
    const nextTime = getNextPlannedTime(
      new Date(),
      step1Config?.tatValue || 1,
      step1Config?.tatUnit || 'hours'
    );

    const payload = {
      ...formData,
      party_name: party,
      items: formattedItems.map(({ item, qty }) => ({ item, qty })),
      Planned_1: nextTime.toISOString(),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/o2d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to create O2D order');
        return;
      }
      toast.success('O2D order created');
      const wonLogged = await onO2dCreated();
      if (wonLogged) onClose();
      else toast.error('O2D saved but could not mark lead as Won — try again or update manually');
    } catch {
      toast.error('Error saving O2D order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!opportunity) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !submitting && onClose()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold">Start O2D FMS — Mark Won</h2>
                <p className="text-xs opacity-90 mt-0.5">
                  Fill the O2D form to create the order, then this lead is marked Won in the pipeline.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <SearchableDropdown
                    label="PARTY NAME"
                    options={partyOptions}
                    value={formData.party_name}
                    allowCustomValue
                    onChange={(val) => setFormData({ ...formData, party_name: val as string })}
                    placeholder="Select or enter party name"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Customer type</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                  >
                    {O2D_CUSTOMER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contact person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    value={formData.contact_no_1}
                    onChange={(e) => setFormData({ ...formData, contact_no_1: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <SearchableDropdown
                    label="REPRESENTATIVE"
                    options={representativeOptions}
                    value={formData.field_person_name}
                    onChange={(val) => setFormData({ ...formData, field_person_name: val as string })}
                    placeholder="Select representative"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Order items</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setOrderItems((prev) => [...prev, { id: Date.now(), item: '', qty: '' }])
                    }
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    + Add row
                  </button>
                </div>
                <div className="space-y-2">
                  {orderItems.map((row) => (
                    <div key={row.id} className="flex gap-2 items-center">
                      <select
                        required
                        value={row.item}
                        onChange={(e) => handleItemChange(row.id, 'item', e.target.value)}
                        className="flex-[2] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm"
                      >
                        <option value="">Select item</option>
                        {itemOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <input
                        required
                        type="text"
                        value={row.qty}
                        onChange={(e) => handleItemChange(row.id, 'qty', e.target.value)}
                        placeholder="Qty"
                        className="w-24 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm text-center"
                      />
                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setOrderItems((prev) => prev.filter((r) => r.id !== row.id))}
                          className="p-2 text-slate-400 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create O2D &amp; Mark Won
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}