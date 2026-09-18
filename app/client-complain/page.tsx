'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Pencil, Trash2, X, Save, Loader2, AlertTriangle,
    MessageSquareWarning, Ban, RotateCcw
} from 'lucide-react';
import { useSetupViewFromQuery } from '@/hooks/useSetupViewFromQuery';

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface Complaint {
    id: string;
    'Client Name': string;
    'Complain Product': string;
    'Remark': string;
    'Timestamp'?: string;
    'Cancelled'?: string;
    _rowIndex: number;
    // Step Tracking Fields
    Planned_1?: string; Actual_1?: string; Status_1?: string;
    Planned_2?: string; Actual_2?: string; Status_2?: string;
    Planned_3?: string; Actual_3?: string; Status_3?: string;
    Planned_4?: string; Actual_4?: string; Status_4?: string;
    Planned_5?: string; Actual_5?: string; Status_5?: string;
    Planned_6?: string; Actual_6?: string; Status_6?: string;
    Planned_7?: string; Actual_7?: string; Status_7?: string;
    Planned_8?: string; Actual_8?: string; Status_8?: string;
}

const COMPLAINT_STAGES = [
    { step: 1, name: 'Message' },
    { step: 2, name: 'Pickup' },
    { step: 3, name: 'Received' },
    { step: 4, name: 'Credit Note' },
    { step: 5, name: 'Credit Sent' },
    { step: 6, name: 'R&D' },
    { step: 7, name: 'MD Approval' },
    { step: 8, name: 'Rectify' },
];

// ── Searchable Combobox ──────────────────────────────────────────────────────
function SearchableCombobox({
    value, onChange, options, placeholder, autoFocus,
}: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder?: string;
    autoFocus?: boolean;
}) {
    const [query, setQuery] = useState(value);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Keep query in sync when modal reopens with a prefilled value
    useEffect(() => { setQuery(value); }, [value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = query
        ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
        : options;

    const select = (opt: string) => { onChange(opt); setQuery(opt); setOpen(false); };
    const clear = () => { onChange(''); setQuery(''); setOpen(false); };

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    type="text"
                    autoFocus={autoFocus}
                    value={query}
                    placeholder={placeholder}
                    onFocus={() => setOpen(true)}
                    onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
                    className="w-full px-3 py-2.5 pr-8 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm"
                />
                {query ? (
                    <button type="button" onClick={clear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                ) : (
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </div>
            {open && filtered.length > 0 && (
                <ul className="absolute z-[10010] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                    {filtered.map(opt => (
                        <li key={opt}
                            onMouseDown={() => select(opt)}
                            className={`px-3 py-2 text-sm cursor-pointer transition-colors ${opt === value
                                ? 'bg-[var(--theme-primary)]/15 text-[var(--theme-primary)] font-bold'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}>
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
            {open && filtered.length === 0 && query && (
                <div className="absolute z-[10010] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl px-3 py-2.5 text-xs text-gray-400">
                    No matches for &ldquo;{query}&rdquo;
                </div>
            )}
        </div>
    );
}
// ─────────────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 15;
const emptyForm = { clientName: '', complainProduct: '', remark: '' };
type ViewMode = 'data' | 'cancelled' | 'setup';

const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
};

const getDelayInfo = (planned?: string, actual?: string) => {
    if (!planned) return null;
    const pDate = new Date(planned);
    const refDate = actual ? new Date(actual) : new Date();
    if (isNaN(pDate.getTime()) || isNaN(refDate.getTime())) return null;

    const diffMs = refDate.getTime() - pDate.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));

    if (diffMin > 0) {
        return { text: `${Math.floor(diffMin / 60)}h ${diffMin % 60}m Delay`, color: 'text-red-500 font-bold' };
    } else {
        const absMin = Math.abs(diffMin);
        return { text: `${Math.floor(absMin / 60)}h ${absMin % 60}m ${actual ? 'Ahead' : 'Left'}`, color: 'text-emerald-500 font-bold' };
    }
};

export default function ClientComplainPage() {
    const [data, setData] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('data');
    useSetupViewFromQuery(setViewMode);
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all'>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Complaint | null>(null);
    const [deletingItem, setDeletingItem] = useState<Complaint | null>(null);
    const [cancellingItem, setCancellingItem] = useState<Complaint | null>(null);

    const toast = useToast();
    const loader = useLoader();

    const [rows, setRows] = useState([emptyForm]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [itemsToMarkDone, setItemsToMarkDone] = useState<Set<string>>(new Set());
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id: string; name?: string } | null>(null);
    const [removeStep, setRemoveStep] = useState<number | 'all'>('all');


    // Setup View States
    const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);

    // Dropdown data from Dropdown sheet
    const [clientNameOptions, setClientNameOptions] = useState<string[]>([]);
    const [productOptions, setProductOptions] = useState<string[]>([]);

    const fetchDropdowns = async () => {
        try {
            const res = await fetch('/api/client-complain-dropdown');
            const json = await res.json();
            if (json.clientNames) setClientNameOptions(json.clientNames);
            if (json.productNames) setProductOptions(json.productNames);
        } catch (e) { console.error('Failed to fetch dropdowns', e); }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/client-complain-config');
            if (res.ok) {
                const data = await res.json();
                if (data.config && data.config.length > 0) {
                    const syncedConfig = data.config.map((c: any) => {
                        const stage = COMPLAINT_STAGES.find(s => s.step === Number(c.step));
                        return {
                            ...c,
                            stepName: stage ? stage.name : c.stepName
                        };
                    });
                    setStepConfigs(syncedConfig);
                } else {
                    const defaultConfig = COMPLAINT_STAGES.map(s => ({
                        step: s.step,
                        stepName: s.name,
                        doerName: '',
                        tatValue: 24,
                        tatUnit: 'hours' as const
                    }));
                    setStepConfigs(defaultConfig);
                }
            }
        } catch (error) {
            console.error('Error fetching config:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setSystemUsers(data.users || []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleSaveConfig = async () => {
        try {
            loader.showLoader();
            const res = await fetch('/api/client-complain-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: stepConfigs }),
            });
            if (res.ok) {
                toast.success('Configuration saved');
                setViewMode('data');
            } else {
                toast.error('Failed to save configuration');
            }
        } catch (error) {
            toast.error('Error saving configuration');
        } finally {
            loader.hideLoader();
        }
    };

    const getNextPlannedTime = (current: Date, value: number, unit: string) => {
        const next = new Date(current);
        if (unit === 'days') {
            let daysAdded = 0;
            while (daysAdded < value) {
                next.setDate(next.getDate() + 1);
                if (next.getDay() !== 0) { // Skip Sunday
                    daysAdded++;
                }
            }
        } else {
            next.setHours(next.getHours() + value);
        }

        if (next.getDay() === 0) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedItems(next);
    };

    const toggleAll = () => {
        if (selectedItems.size === activeData.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(activeData.map(d => d.id)));
        }
    };

    const getCurrentStep = (item: Complaint) => {
        let step = 1;
        for (let s = 1; s <= 8; s++) {
            if ((item as any)[`Actual_${s}`]) step = s + 1;
            else break;
        }
        return step;
    };

    const handleBulkUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.size === 0) return;

        try {
            loader.showLoader();
            const now = new Date().toISOString();
            const updatePromises = Array.from(selectedItems).map(id => {
                const item = data.find(d => d.id === id);
                if (!item) return Promise.resolve();

                const currentStep = getCurrentStep(item);
                const updatedData: any = { id: item.id };


                if (itemsToMarkDone.has(item.id) && currentStep <= 8) {
                    updatedData[`Actual_${currentStep}`] = now;
                    updatedData[`Status_${currentStep}`] = 'Completed';

                    if (currentStep < 8) {
                        const nextStep = currentStep + 1;
                        const nextConfig = stepConfigs.find(c => c.step === nextStep);
                        const nextPlanned = getNextPlannedTime(new Date(now), nextConfig?.tatValue || 24, nextConfig?.tatUnit || 'hours').toISOString();
                        updatedData[`Planned_${nextStep}`] = nextPlanned;
                    }
                }

                return fetch('/api/client-complain', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData),
                });
            });

            await Promise.all(updatePromises);
            toast.success('Bulk updates applied');
            setItemsToMarkDone(new Set());

            setSelectedItems(new Set());
            setIsBulkUpdateModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to apply bulk updates');
        } finally {
            loader.hideLoader();
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/client-complain');
            const json = await res.json();
            if (json.data) {
                // Filter out empty rows if any
                setData(json.data.filter((d: Complaint) => d['Client Name']?.trim()));
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchData();
        fetchDropdowns();
        fetchConfig();
        fetchUsers();
    }, []);

    const handleRemoveFollowUp = async () => {
        if (!removeTarget) return;
        try {
            loader.showLoader();
            const payload: any = { id: removeTarget.id };

            if (removeStep === 'all') {
                [1, 2, 3, 4, 5, 6, 7, 8].forEach(step => {
                    payload[`Actual_${step}`] = '';
                    payload[`Status_${step}`] = '';
                    if (step > 1) payload[`Planned_${step}`] = '';
                });
            } else {
                const stepNum = removeStep as number;
                [1, 2, 3, 4, 5, 6, 7, 8].forEach(step => {
                    if (step === stepNum) {
                        payload[`Actual_${step}`] = '';
                        payload[`Status_${step}`] = '';
                    } else if (step > stepNum) {
                        payload[`Planned_${step}`] = '';
                        payload[`Actual_${step}`] = '';
                        payload[`Status_${step}`] = '';
                    }
                });
            }

            const res = await fetch('/api/client-complain', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast.success('Follow-up details removed');
                setShowRemoveModal(false);
                setRemoveTarget(null);
                fetchData();
            } else {
                toast.error('Operation failed');
            }
        } catch (e) {
            toast.error('Error removing follow-up');
        } finally {
            loader.hideLoader();
        }
    };

    const openRemoveModal = (id: string, name?: string) => {
        setRemoveTarget({ id, name });
        setRemoveStep('all');
        setShowRemoveModal(true);
    };




    const activeData = useMemo(() => {
        let filtered = data.filter(d =>
            viewMode === 'cancelled'
                ? d['Cancelled']?.trim().toLowerCase() === 'yes'
                : !d['Cancelled'] || d['Cancelled'].trim().toLowerCase() !== 'yes'
        );

        if (viewMode === 'data' && activeStepFilter !== 'all') {
            filtered = filtered.filter(item => {
                const step = activeStepFilter;
                const isDone = !!(item as any)[`Actual_${step}`];
                const isPreviousDone = step === 1 || !!(item as any)[`Actual_${step - 1}`];
                return !isDone && isPreviousDone;
            });
        }

        if (viewMode === 'data' && activeTimeFilter) {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;

            filtered = filtered.filter(item => {
                let currentStep = 1;
                for (let s = 1; s <= 8; s++) {
                    if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                    else break;
                }
                if (currentStep > 8) return false;

                const plannedStr = (item as any)[`Planned_${currentStep}`];
                if (!plannedStr) return false;

                const pDate = new Date(plannedStr);
                const pTime = pDate.getTime();
                const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
                const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);

                switch (activeTimeFilter) {
                    case 'Delayed': return pTime < now.getTime();
                    case 'Today': return diffDays === 0;
                    case 'Tomorrow': return diffDays === 1;
                    case 'Next 3': return diffDays >= 0 && diffDays <= 3;
                    case 'Next 7': return diffDays >= 0 && diffDays <= 7;
                    case 'Next 15': return diffDays >= 0 && diffDays <= 15;
                    default: return true;
                }
            });
        }

        return filtered;
    }, [data, viewMode, activeStepFilter, activeTimeFilter]);

    const statusStats = useMemo(() => {
        const active = data.filter(d => !d['Cancelled'] || d['Cancelled'].trim().toLowerCase() !== 'yes');
        return {
            Total: active.length,
            Step1: active.filter(r => !r.Actual_1).length,
            Step2: active.filter(r => r.Actual_1 && !r.Actual_2).length,
            Step3: active.filter(r => r.Actual_2 && !r.Actual_3).length,
            Step4: active.filter(r => r.Actual_3 && !r.Actual_4).length,
            Step5: active.filter(r => r.Actual_4 && !r.Actual_5).length,
            Step6: active.filter(r => r.Actual_5 && !r.Actual_6).length,
            Step7: active.filter(r => r.Actual_6 && !r.Actual_7).length,
            Step8: active.filter(r => r.Actual_7 && !r.Actual_8).length,
        };
    }, [data]);

    const timeStats = useMemo(() => {
        const active = data.filter(d => !d['Cancelled'] || d['Cancelled'].trim().toLowerCase() !== 'yes');
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 7': 0, 'Next 15': 0 };

        active.forEach(item => {
            let currentStep = 1;
            for (let s = 1; s <= 8; s++) {
                if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                else break;
            }
            if (currentStep > 8) return;

            const plannedStr = (item as any)[`Planned_${currentStep}`];
            if (!plannedStr) return;

            const pDate = new Date(plannedStr);
            const pTime = pDate.getTime();
            const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
            const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);

            if (pTime < now.getTime()) stats['Delayed']++;
            if (diffDays === 0) stats['Today']++;
            if (diffDays === 1) stats['Tomorrow']++;
            if (diffDays >= 0 && diffDays <= 3) stats['Next 3']++;
            if (diffDays >= 0 && diffDays <= 7) stats['Next 7']++;
            if (diffDays >= 0 && diffDays <= 15) stats['Next 15']++;
        });

        return stats;
    }, [data]);

    const totalPages = Math.max(1, Math.ceil(activeData.length / ITEMS_PER_PAGE));
    const paginatedData = activeData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const switchView = (v: ViewMode) => {
        setViewMode(v);
        setCurrentPage(1);
        setSelectedItems(new Set());
    };

    const openAddModal = () => {
        setEditingItem(null);
        setRows([{ ...emptyForm }]);
        setIsModalOpen(true);
    };

    const openEditModal = (item: Complaint) => {
        setEditingItem(item);
        setRows([{
            clientName: item['Client Name'] || '',
            complainProduct: item['Complain Product'] || '',
            remark: item['Remark'] || ''
        }]);
        setIsModalOpen(true);
    };

    const addRow = () => setRows([...rows, { ...emptyForm }]);
    const removeRow = (index: number) => {
        if (rows.length > 1) {
            setRows(rows.filter((_, i) => i !== index));
        }
    };

    const updateRow = (index: number, field: keyof typeof emptyForm, value: string) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: value };
        setRows(newRows);
    };

    const handleSave = async () => {
        const validRows = rows.filter(r => r.clientName.trim());
        if (validRows.length === 0) return;

        setIsSaving(true);
        try {
            const method = editingItem ? 'PUT' : 'POST';
            const payload = editingItem
                ? { id: editingItem.id, ...validRows[0] }
                : validRows; // Send the whole array for new complaints

            const res = await fetch('/api/client-complain', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) { setIsModalOpen(false); fetchData(); }
        } catch (e) { console.error(e); }
        finally { setIsSaving(false); }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        setIsDeleting(true);
        try {
            const res = await fetch('/api/client-complain', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deletingItem.id }) });
            if (res.ok) { setIsDeleteModalOpen(false); fetchData(); }
        } catch (e) { console.error(e); }
        finally { setIsDeleting(false); }
    };

    const handleCancel = async () => {
        if (!cancellingItem) return;
        setIsCancelling(true);
        const isCancelled = cancellingItem['Cancelled']?.toLowerCase() === 'yes';
        try {
            const res = await fetch('/api/client-complain', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cancellingItem.id, cancelled: !isCancelled }),
            });
            if (res.ok) { setIsCancelModalOpen(false); fetchData(); }
        } catch (e) { console.error(e); }
        finally { setIsCancelling(false); }
    };

    const cancelledCount = data.filter(d => d['Cancelled']?.trim().toLowerCase() === 'yes').length;
    const activeCount = data.length - cancelledCount;

    return (
        <LayoutWrapper>
            <div className="p-3 space-y-2">

                {/* Factory-style Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[var(--theme-primary)]/15 rounded-xl">
                            <MessageSquareWarning size={22} className="text-[var(--theme-primary)]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wide leading-none">
                                CLIENT COMPLAIN
                            </h1>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                                CLIENT COMPLAINT MANAGEMENT & TRACKING
                            </p>
                        </div>
                    </div>

                    {/* Single unified pill container — exact factory page style */}
                    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700">
                        {[
                            {
                                id: 'data' as ViewMode,
                                label: 'Data View',
                                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
                            },
                            {
                                id: 'cancelled' as ViewMode,
                                label: 'Cancelled View',
                                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                            },
                            {
                                id: 'setup' as ViewMode,
                                label: 'Setup',
                                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                            },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => switchView(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === tab.id
                                    ? 'bg-[var(--theme-primary)] text-gray-900 shadow-lg shadow-[var(--theme-primary)]/25 scale-[1.02]'
                                    : 'text-[var(--theme-primary)]/60 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                        <div className="w-px h-8 bg-slate-100 dark:bg-slate-700 mx-1" />
                        <button
                            onClick={openAddModal}
                            className="bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] p-2.5 rounded-2xl hover:bg-[var(--theme-primary)] hover:text-white transition-all shadow-sm"
                            title="Add New"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>
                </div>

                {/* Table card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-white dark:border-slate-700 overflow-hidden">

                    {viewMode === 'setup' ? (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Step Configuration</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure workflow steps and turnaround times</p>
                                </div>
                                <button
                                    onClick={handleSaveConfig}
                                    className="bg-[var(--theme-primary)] text-gray-900 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
                                >
                                    Save Configuration
                                </button>
                            </div>

                            <div className="overflow-hidden border border-slate-100 dark:border-slate-700 rounded-[2rem]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Step</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Step Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Responsible</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] w-32">TAT Value</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] w-32">TAT Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                        {stepConfigs.map((config, index) => (
                                            <tr key={config.step} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                                <td className="px-6 py-3 font-black text-[var(--theme-primary)]">#{config.step}</td>
                                                <td className="px-6 py-5">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{config.stepName}</span>
                                                </td>
                                                <td className="px-6 py-5 text-sm">
                                                    <select
                                                        value={config.doerName}
                                                        onChange={(e) => {
                                                            const newConfigs = [...stepConfigs];
                                                            newConfigs[index].doerName = e.target.value;
                                                            setStepConfigs(newConfigs);
                                                        }}
                                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                                                    >
                                                        <option value="">Select User</option>
                                                        {systemUsers.map(u => (
                                                            <option key={u.id} value={u.username}>{u.username}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <input
                                                        type="number"
                                                        value={config.tatValue}
                                                        onChange={(e) => {
                                                            const newConfigs = [...stepConfigs];
                                                            newConfigs[index].tatValue = parseInt(e.target.value) || 0;
                                                            setStepConfigs(newConfigs);
                                                        }}
                                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <select
                                                        value={config.tatUnit}
                                                        onChange={(e) => {
                                                            const newConfigs = [...stepConfigs];
                                                            newConfigs[index].tatUnit = e.target.value as any;
                                                            setStepConfigs(newConfigs);
                                                        }}
                                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-[var(--theme-primary)] outline-none uppercase text-gray-900 dark:text-white"
                                                    >
                                                        <option value="hours">Hours</option>
                                                        <option value="days">Days</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Step Filter Tiles Moved Inside */}
                            <div className="overflow-x-auto pb-0 scroll-smooth -mx-0 px-4 pt-4 border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/10">
                                <div className="flex gap-2 min-w-max pr-2 pb-4">
                                    {[
                                        { step: 'all' as const, label: 'All Items', value: statusStats.Total, gradient: 'from-slate-50 to-slate-100', border: 'border-slate-200', iconBg: 'from-slate-500 to-slate-600', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                                        { step: 1 as const, label: `1. ${COMPLAINT_STAGES[0].name}`, value: statusStats.Step1, gradient: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', iconBg: 'from-indigo-500 to-indigo-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                                        { step: 2 as const, label: `2. ${COMPLAINT_STAGES[1].name}`, value: statusStats.Step2, gradient: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', iconBg: 'from-yellow-500 to-yellow-600', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
                                        { step: 3 as const, label: `3. ${COMPLAINT_STAGES[2].name}`, value: statusStats.Step3, gradient: 'from-orange-50 to-orange-100', border: 'border-orange-200', iconBg: 'from-orange-500 to-orange-600', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                        { step: 4 as const, label: `4. ${COMPLAINT_STAGES[3].name}`, value: statusStats.Step4, gradient: 'from-pink-50 to-pink-100', border: 'border-pink-200', iconBg: 'from-pink-500 to-pink-600', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                                        { step: 5 as const, label: `5. ${COMPLAINT_STAGES[4].name}`, value: statusStats.Step5, gradient: 'from-purple-50 to-purple-100', border: 'border-purple-200', iconBg: 'from-purple-500 to-purple-600', icon: 'M5 13l4 4L19 7' },
                                        { step: 6 as const, label: `6. ${COMPLAINT_STAGES[5].name}`, value: statusStats.Step6, gradient: 'from-blue-50 to-blue-100', border: 'border-blue-200', iconBg: 'from-blue-500 to-blue-600', icon: 'M9 17v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m3 2h12a3 3 0 110-6h-1m1 6V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2' },
                                        { step: 7 as const, label: `7. ${COMPLAINT_STAGES[6].name}`, value: statusStats.Step7, gradient: 'from-teal-50 to-teal-100', border: 'border-teal-200', iconBg: 'from-teal-500 to-teal-600', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                                        { step: 8 as const, label: `8. ${COMPLAINT_STAGES[7].name}`, value: statusStats.Step8, gradient: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200', iconBg: 'from-emerald-500 to-emerald-600', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                                    ].map((stat, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            whileHover={activeStepFilter === stat.step ? { scale: 1 } : { y: -1 }}
                                            onClick={() => {
                                                const nextStep = activeStepFilter === stat.step ? 'all' : stat.step;
                                                setActiveStepFilter(nextStep);
                                                if (nextStep === 'all') setActiveTimeFilter(null);
                                                setCurrentPage(1);
                                            }}
                                            className={`bg-gradient-to-br ${stat.gradient} p-2 rounded-xl border ${stat.border} shadow-sm flex items-center gap-2 transition-all min-w-[150px] cursor-pointer ${activeStepFilter === stat.step
                                                ? 'ring-2 ring-[var(--theme-primary)] shadow-md opacity-100'
                                                : 'opacity-75 hover:opacity-100 hover:-translate-y-px'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm transition-transform text-white`}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={stat.icon} /></svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[8px] font-black text-gray-500 uppercase tracking-wider truncate opacity-80">{stat.label}</p>
                                                <p className="text-base font-black text-gray-900 leading-none mt-0.5">{stat.value}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Pagination row — factory style */}
                            <div className="flex bg-[var(--theme-lighter)]/50 dark:bg-slate-900/50 p-2 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md sticky top-0 z-[20]">
                                <div className="flex-1 flex items-center justify-between px-3">
                                    <div className="flex items-center gap-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                            Showing{' '}
                                            <span className="text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>
                                            {' – '}
                                            <span className="text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, activeData.length)}</span>
                                            {' of '}
                                            <span className="text-slate-900 dark:text-white">{activeData.length}</span>
                                        </p>

                                        {selectedItems.size > 0 && (
                                            <button
                                                onClick={() => setIsBulkUpdateModalOpen(true)}
                                                className="h-8 px-4 rounded-xl bg-[var(--theme-primary)] text-gray-900 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all ml-2"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                Update Status ({selectedItems.size})
                                            </button>
                                        )}

                                        {/* Time-based Filter Pills */}
                                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                            {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                                                <button
                                                    key={filter}
                                                    onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                                                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative ${activeTimeFilter === filter
                                                        ? 'bg-[var(--theme-primary)] text-gray-900 shadow-md scale-[1.05]'
                                                        : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'
                                                        }`}
                                                >
                                                    {filter}
                                                    {((timeStats[filter as keyof typeof timeStats] ?? 0) > 0) && (
                                                        <sup className={`ml-1 text-[8px] ${activeTimeFilter === filter ? 'text-gray-900 border border-gray-900' : (filter === 'Delayed' ? 'text-red-500' : 'text-emerald-500')}`}>
                                                            {timeStats[filter as keyof typeof timeStats]}
                                                        </sup>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest"
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Prev
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {(() => {
                                                const pages = [];
                                                const windowSize = 5;
                                                let startPage = Math.max(1, currentPage - 2);
                                                let endPage = Math.min(totalPages, startPage + windowSize - 1);
                                                if (endPage === totalPages) startPage = Math.max(1, endPage - windowSize + 1);
                                                for (let i = startPage; i <= endPage; i++) {
                                                    pages.push(
                                                        <button
                                                            key={i}
                                                            onClick={() => setCurrentPage(i)}
                                                            className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${currentPage === i ? 'bg-[var(--theme-primary)] text-gray-900 shadow-md' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
                                                        >
                                                            {i}
                                                        </button>
                                                    );
                                                }
                                                return pages;
                                            })()}
                                        </div>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Last
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className={`text-[10px] font-bold text-gray-900 uppercase tracking-wider ${viewMode === 'cancelled' ? 'bg-red-400' : 'bg-[var(--theme-primary)]'}`}>
                                        <tr>
                                            <th className="px-3 py-2.5 text-center w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.size === activeData.length && activeData.length > 0}
                                                    onChange={toggleAll}
                                                    className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 checked:bg-[var(--theme-primary)] checked:border-[var(--theme-primary)] transition-all cursor-pointer accent-[var(--theme-primary)]"
                                                />
                                            </th>
                                            <th className="px-3 py-2.5 text-center w-24">Actions</th>
                                            <th className="px-3 py-2.5 w-10">#</th>
                                            <th className="px-3 py-2.5 min-w-[250px]">Complaint Details</th>
                                            <th className="px-3 py-2.5 whitespace-nowrap">Logged On</th>
                                            {COMPLAINT_STAGES.map(s => (
                                                <th key={s.step} className="px-3 py-2.5 text-center whitespace-nowrap min-w-[140px]">
                                                    <div className="flex flex-col items-center">
                                                        <span className="opacity-60 text-[8px] tracking-widest uppercase">Step {s.step}</span>
                                                        <span className="font-black text-[10px] uppercase">{s.name}</span>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <tr key={i} className="animate-pulse">
                                                    {Array.from({ length: 4 }).map((_, j) => (
                                                        <td key={j} className="px-3 py-3"><div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full" /></td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : paginatedData.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                                        {viewMode === 'cancelled' ? <Ban size={36} className="opacity-30" /> : <MessageSquareWarning size={36} className="opacity-30" />}
                                                        <p className="text-xs font-semibold">{viewMode === 'cancelled' ? 'No cancelled complaints' : 'No complaints found'}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedData.map((item, idx) => (
                                                <motion.tr key={item.id || item._rowIndex}
                                                    initial={{ opacity: 0, y: 3 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.02 }}
                                                    className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors ${viewMode === 'cancelled' ? 'opacity-70' : ''} ${selectedItems.has(item.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                                >
                                                    <td className="px-3 py-2 text-center border-r border-gray-100 dark:border-gray-700/50">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(item.id)}
                                                            onChange={() => toggleSelection(item.id)}
                                                            className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 checked:bg-[var(--theme-primary)] checked:border-[var(--theme-primary)] transition-all cursor-pointer accent-[var(--theme-primary)]"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {viewMode === 'data' && (
                                                                <>
                                                                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                        onClick={() => openEditModal(item)}
                                                                        className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit">
                                                                        <Pencil size={13} />
                                                                    </motion.button>
                                                                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                        onClick={() => { setCancellingItem(item); setIsCancelModalOpen(true); }}
                                                                        className="p-1 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors" title="Cancel">
                                                                        <Ban size={13} />
                                                                    </motion.button>
                                                                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                        onClick={() => openRemoveModal(item.id, item['Client Name'])}
                                                                        className="p-1 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors" title="Remove Follow Up">
                                                                        <RotateCcw size={13} />
                                                                    </motion.button>
                                                                </>
                                                            )}
                                                            {viewMode === 'cancelled' && (
                                                                <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                    onClick={() => { setCancellingItem(item); setIsCancelModalOpen(true); }}
                                                                    className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors" title="Restore">
                                                                    <RotateCcw size={13} />
                                                                </motion.button>
                                                            )}
                                                            <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                onClick={() => { setDeletingItem(item); setIsDeleteModalOpen(true); }}
                                                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                                                                <Trash2 size={13} />
                                                            </motion.button>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-400 font-bold">{item.id}</td>
                                                    {/* Combined Complaint Details column */}
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-start gap-2.5">
                                                            {/* Theme-based icon */}
                                                            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${viewMode === 'cancelled'
                                                                ? 'bg-red-100 dark:bg-red-500/10'
                                                                : 'bg-[var(--theme-primary)]/10'
                                                                }`}>
                                                                <svg className={`w-4 h-4 ${viewMode === 'cancelled' ? 'text-red-500' : 'text-[var(--theme-primary)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
                                                                </svg>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                {/* Client Name */}
                                                                <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{item['Client Name']}</p>
                                                                {/* Product badge */}
                                                                {item['Complain Product'] && (
                                                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${viewMode === 'cancelled'
                                                                        ? 'bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                                                        : 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] border border-[var(--theme-primary)]/20'
                                                                        }`}>
                                                                        {item['Complain Product']}
                                                                    </span>
                                                                )}
                                                                {/* Remark */}
                                                                {item['Remark'] && (
                                                                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 leading-snug">{item['Remark']}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap tabular-nums text-[11px]">
                                                        {item['Timestamp'] ? new Date(item['Timestamp']).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                    </td>
                                                    {COMPLAINT_STAGES.map(s => {
                                                        const planned = item[`Planned_${s.step}` as keyof Complaint] as string;
                                                        const actual = item[`Actual_${s.step}` as keyof Complaint] as string;
                                                        const status = item[`Status_${s.step}` as keyof Complaint] as string;
                                                        const delay = getDelayInfo(planned, actual);

                                                        return (
                                                            <td key={s.step} className="px-3 py-2 border-l border-gray-50 dark:border-gray-700/50">
                                                                <div className="flex flex-col gap-1">
                                                                    {/* Planned Row */}
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">P:</span>
                                                                        <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                                                                            {planned ? formatDateTime(planned) : '-'}
                                                                        </span>
                                                                    </div>
                                                                    {/* Actual Row */}
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">A:</span>
                                                                        {actual ? (
                                                                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                                                                {formatDateTime(actual)}
                                                                            </span>

                                                                        ) : (
                                                                            <span className="text-[10px] text-gray-300 dark:text-gray-600">-</span>
                                                                        )}
                                                                    </div>
                                                                    {/* Delay/Status Row */}
                                                                    {delay && (
                                                                        <div className={`text-[9px] text-right italic ${delay.color}`}>
                                                                            {delay.text}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </motion.tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* Add / Edit Modal */}
                    <AnimatePresence>
                        {isModalOpen && (
                            <>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100">
                                        <div className="p-5 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 bg-white/20 rounded-lg"><MessageSquareWarning size={18} /></div>
                                                <h2 className="text-base font-black uppercase tracking-tight">{editingItem ? 'Edit Complaint' : 'Add New Complaint'}</h2>
                                            </div>
                                            <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={16} /></button>
                                        </div>
                                        <div className="p-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
                                            {!editingItem && (
                                                <div className="hidden md:grid grid-cols-[40px_1fr_1fr_1.2fr_40px] gap-4 px-3 mb-3">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">#</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client Name <span className="text-red-500">*</span></span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Remark</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Action</span>
                                                </div>
                                            )}
                                            <div className="space-y-3">
                                                {rows.map((row, index) => (
                                                    <div key={index} className="grid grid-cols-1 md:grid-cols-[40px_1fr_1fr_1.2fr_40px] items-start gap-3 md:gap-4 p-3 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all group relative">
                                                        <div className="flex md:items-center justify-center md:pt-2.5">
                                                            <span className="w-5 h-5 rounded-full bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] flex items-center justify-center text-[10px] font-black">
                                                                {index + 1}
                                                            </span>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="md:hidden text-[9px] font-black text-gray-400 uppercase tracking-widest">Client Name</label>
                                                            <SearchableCombobox
                                                                value={row.clientName}
                                                                onChange={v => updateRow(index, 'clientName', v)}
                                                                options={clientNameOptions}
                                                                placeholder="Client..."
                                                                autoFocus={index === 0}
                                                            />
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="md:hidden text-[9px] font-black text-gray-400 uppercase tracking-widest">Product</label>
                                                            <SearchableCombobox
                                                                value={row.complainProduct}
                                                                onChange={v => updateRow(index, 'complainProduct', v)}
                                                                options={productOptions}
                                                                placeholder="Product..."
                                                            />
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="md:hidden text-[9px] font-black text-gray-400 uppercase tracking-widest">Remark</label>
                                                            <textarea
                                                                value={row.remark}
                                                                onChange={e => updateRow(index, 'remark', e.target.value)}
                                                                placeholder="Remark..."
                                                                rows={1}
                                                                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm resize-none transition-all"
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-center md:pt-1">
                                                            {(rows.length > 1 || editingItem) && (
                                                                <button
                                                                    onClick={() => editingItem ? setIsModalOpen(false) : removeRow(index)}
                                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                                    title={editingItem ? "Cancel" : "Remove Row"}
                                                                >
                                                                    {editingItem ? <X size={16} /> : <Trash2 size={16} />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {!editingItem && (
                                                <div className="px-1">
                                                    <button
                                                        onClick={addRow}
                                                        className="w-full mt-4 py-3 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-[var(--theme-primary)]/30 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 transition-all flex items-center justify-center gap-2 group"
                                                    >
                                                        <div className="w-5 h-5 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:bg-[var(--theme-primary)]/20 group-hover:text-[var(--theme-primary)] transition-all">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                        </div>
                                                        Add Another Row
                                                    </button>
                                                </div>
                                            )}

                                            <div className="flex gap-3 pt-6 sticky bottom-0 bg-white dark:bg-gray-900 mt-2 border-t border-gray-50 dark:border-gray-800/50">
                                                <button onClick={() => setIsModalOpen(false)}
                                                    className="flex-1 py-3 border border-gray-100 dark:border-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                                                    Close
                                                </button>
                                                <motion.button
                                                    onClick={handleSave}
                                                    disabled={isSaving || rows.every(r => !r.clientName.trim())}
                                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                                    className="flex-[2] py-3 bg-[var(--theme-primary)] text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-[var(--theme-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                >
                                                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={14} />}
                                                    {editingItem ? 'Update Record' : `Save ${rows.filter(r => r.clientName.trim()).length} Complaint${rows.filter(r => r.clientName.trim()).length !== 1 ? 's' : ''}`}
                                                </motion.button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Cancel / Restore Confirmation Modal */}
                    <AnimatePresence>
                        {isCancelModalOpen && cancellingItem && (
                            <>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onClick={() => setIsCancelModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800 p-5 space-y-4">
                                        {(() => {
                                            const isRestoring = cancellingItem['Cancelled']?.toLowerCase() === 'yes';
                                            return (<>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRestoring ? 'bg-green-100 dark:bg-green-500/10' : 'bg-orange-100 dark:bg-orange-500/10'}`}>
                                                        {isRestoring ? <RotateCcw className="text-green-600" size={20} /> : <Ban className="text-orange-500" size={20} />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-gray-900 dark:text-white text-sm">{isRestoring ? 'Restore Complaint' : 'Cancel Complaint'}</h3>
                                                        <p className="text-[11px] text-gray-500">{isRestoring ? 'Move back to active view' : 'Move to cancelled view'}</p>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                                    Are you sure you want to {isRestoring ? 'restore' : 'cancel'} this complaint for <span className="font-bold text-gray-900 dark:text-white">"{cancellingItem['Client Name']}"</span>?
                                                </p>
                                                <div className="flex gap-3 pt-2">
                                                    <button onClick={() => setIsCancelModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">No, Keep</button>
                                                    <button onClick={handleCancel} disabled={isCancelling} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 ${isRestoring ? 'bg-green-600 shadow-green-600/20' : 'bg-orange-500 shadow-orange-500/20'}`}>
                                                        {isCancelling ? <Loader2 size={14} className="animate-spin" /> : (isRestoring ? <RotateCcw size={14} /> : <Ban size={14} />)}
                                                        Yes, {isRestoring ? 'Restore' : 'Cancel'}
                                                    </button>
                                                </div>
                                            </>);
                                        })()}
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Delete Confirmation Modal */}
                    <AnimatePresence>
                        {isDeleteModalOpen && deletingItem && (
                            <>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onClick={() => setIsDeleteModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800 p-5 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                                                <AlertTriangle className="text-red-500" size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-tight">Delete Complaint</h3>
                                                <p className="text-[11px] text-gray-500 uppercase tracking-widest font-bold">This action cannot be undone</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                            Are you sure you want to permanently delete the complaint for <span className="font-bold text-gray-900 dark:text-white">"{deletingItem['Client Name']}"</span>? This will remove all history and tracking data.
                                        </p>
                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">Cancel</button>
                                            <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-2">
                                                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                Delete Forever
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Bulk Update Modal */}
                    <AnimatePresence>
                        {isBulkUpdateModalOpen && (
                            <>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onClick={() => setIsBulkUpdateModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100 max-h-[90vh] flex flex-col">
                                        <div className="p-5 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 flex items-center justify-between shadow-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white/20 rounded-xl shadow-inner"><Pencil size={20} /></div>
                                                <div>
                                                    <h2 className="text-lg font-black uppercase tracking-tight leading-none">Bulk Update Status</h2>
                                                    <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1.5">Applying updates to {selectedItems.size} selected items</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setIsBulkUpdateModalOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-all hover:rotate-90"><X size={20} /></button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
                                            {COMPLAINT_STAGES.map(stage => {
                                                const stageItems = data.filter(d => selectedItems.has(d.id) && getCurrentStep(d) === stage.step);
                                                if (stageItems.length === 0) return null;

                                                return (
                                                    <div key={stage.step} className="space-y-4">
                                                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-1 h-8 rounded-full bg-[var(--theme-primary)] shadow-[0_0_12px_var(--theme-primary)]" />
                                                                <div>
                                                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Step {stage.step}: {stage.name}</h3>
                                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{stageItems.length} items in this stage</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const allChecked = stageItems.every(i => itemsToMarkDone.has(i.id));
                                                                    const next = new Set(itemsToMarkDone);
                                                                    if (allChecked) stageItems.forEach(i => next.delete(i.id));
                                                                    else stageItems.forEach(i => next.add(i.id));
                                                                    setItemsToMarkDone(next);
                                                                }}
                                                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${stageItems.every(i => itemsToMarkDone.has(i.id))
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700'
                                                                    : 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] border-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)] hover:text-gray-900'
                                                                    }`}
                                                            >
                                                                {stageItems.every(i => itemsToMarkDone.has(i.id)) ? 'Unmark All' : 'Mark All Done'}
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {stageItems.map(item => (
                                                                <div key={item.id} className={`p-4 rounded-2xl border transition-all relative overflow-hidden group ${itemsToMarkDone.has(item.id)
                                                                    ? 'bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
                                                                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm'
                                                                    }`}>
                                                                    <div className="flex flex-col gap-3">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="min-w-0">
                                                                                <h4 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight truncate">{item['Client Name']}</h4>
                                                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 truncate">{item['Complain Product']}</p>
                                                                            </div>
                                                                            <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                                                <input type="checkbox" className="sr-only peer" checked={itemsToMarkDone.has(item.id)}
                                                                                    onChange={() => {
                                                                                        const next = new Set(itemsToMarkDone);
                                                                                        if (next.has(item.id)) next.delete(item.id);
                                                                                        else next.add(item.id);
                                                                                        setItemsToMarkDone(next);
                                                                                    }}
                                                                                />
                                                                                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                                                                            </label>
                                                                        </div>


                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="p-5 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                                            <button onClick={() => setIsBulkUpdateModalOpen(false)}
                                                className="px-6 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95">
                                                Cancel
                                            </button>
                                            <button onClick={handleBulkUpdate}
                                                className="flex-1 py-3 rounded-2xl bg-[var(--theme-primary)] text-gray-900 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[var(--theme-primary)]/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <Save size={16} />
                                                Apply Updates to {selectedItems.size} Records
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                    {/* Remove Follow Up Modal */}
                    <AnimatePresence>
                        {showRemoveModal && removeTarget && (
                            <>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    onClick={() => setShowRemoveModal(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800 p-6 space-y-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                                <RotateCcw size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-tight">Remove Follow Up</h3>
                                                <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest leading-tight">{removeTarget.name}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select range to clear:</p>
                                            <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                                                <button
                                                    onClick={() => setRemoveStep('all')}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${removeStep === 'all'
                                                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                                        : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:border-indigo-200'
                                                        }`}
                                                >
                                                    <div className="font-black text-[10px] uppercase tracking-widest">Remove All</div>
                                                    <p className="text-[9px] opacity-70 font-medium mt-0.5">Clears all 8 steps for this complaint</p>
                                                </button>
                                                {COMPLAINT_STAGES.map(s => (
                                                    <button
                                                        key={s.step}
                                                        onClick={() => setRemoveStep(s.step)}
                                                        className={`p-3 rounded-xl border-2 text-left transition-all ${removeStep === s.step
                                                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                                            : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:border-indigo-200'
                                                            }`}
                                                    >
                                                        <div className="font-black text-[10px] uppercase tracking-widest">From Step {s.step} ({s.name})</div>
                                                        <p className="text-[9px] opacity-70 font-medium mt-0.5">Clears data from step {s.step} onwards</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setShowRemoveModal(false)}
                                                className="flex-1 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={handleRemoveFollowUp}
                                                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
                                                Confirm Clear
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                </div>
            </div>
        </LayoutWrapper>
    );
}
