'use client';

import { useState, useEffect, useMemo } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle, Pencil, Trash2, X, Save } from 'lucide-react';

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface FMSProduct {
    id: string;
    Product: string;
    Timestamp?: string;
    Cancelled?: string;
    _rowIndex: number;
    Planned_1?: string; Actual_1?: string; Status_1?: string; Contact_1?: string;
    Planned_2?: string; Actual_2?: string; Status_2?: string; Contact_2?: string;
    Planned_3?: string; Actual_3?: string; Status_3?: string; Contact_3?: string;
    Planned_4?: string; Actual_4?: string; Status_4?: string;
}

const PRODUCT_STAGES = [
    { step: 1, name: 'GETTING DEALER CONTACT NO' },
    { step: 2, name: 'GETTING THE SALES PERSON NO FROM DEALER' },
    { step: 3, name: 'TALK AND RETRIEVE THE LIVE PRODUCT CATALOGUE' },
    { step: 4, name: 'FILE THE PRODUCT LIST' },
];

const ITEMS_PER_PAGE = 15;
const emptyForm = { Product: '' };
type ViewMode = 'data' | 'cancelled' | 'setup';

const getNextPlannedTime = (from: Date, tatValue: number, tatUnit: 'hours' | 'days'): Date => {
    const next = new Date(from);
    if (tatUnit === 'hours') {
        next.setHours(next.getHours() + tatValue);
    } else {
        next.setDate(next.getDate() + tatValue);
    }
    return next;
};

export default function FMSProductSearchPage() {
    const [data, setData] = useState<FMSProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('data');
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all'>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FMSProduct | null>(null);
    const [deletingItem, setDeletingItem] = useState<FMSProduct | null>(null);

    const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);

    const toast = useToast();
    const loader = useLoader();

    const [rows, setRows] = useState([emptyForm]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Follow-up process states
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [itemsToMarkDone, setItemsToMarkDone] = useState<Set<string>>(new Set());
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id: string, name: string } | null>(null);
    const [removeStep, setRemoveStep] = useState<number | 'all'>('all');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/fms-product-search');
            const json = await res.json();
            if (json.data) {
                const sanitized = json.data
                    .filter((d: FMSProduct) => d.Product?.trim())
                    .map((d: FMSProduct, idx: number) => ({
                        ...d,
                        id: d.id ? String(d.id) : `temp-${idx}`
                    }));
                setData(sanitized);
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/fms-product-search-config');
            if (res.ok) {
                const data = await res.json();
                if (data.config && data.config.length > 0) {
                    setStepConfigs(data.config);
                } else {
                    const defaultConfig = PRODUCT_STAGES.map(s => ({
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

    useEffect(() => {
        fetchData();
        fetchConfig();
        fetchUsers();
    }, []);

    const getCurrentStep = (item: FMSProduct): number => {
        for (let step = 1; step <= 4; step++) {
            if (!(item as any)[`Actual_${step}`]) return step;
        }
        return 4;
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const toggleAll = () => {
        if (selectedItems.size === activeData.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(activeData.map(d => d.id)));
        }
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

                if (itemsToMarkDone.has(item.id) && currentStep <= 4) {
                    updatedData[`Actual_${currentStep}`] = now;
                    updatedData[`Status_${currentStep}`] = 'Completed';

                    if (currentStep < 4) {
                        const nextStep = currentStep + 1;
                        const nextConfig = stepConfigs.find(c => c.step === nextStep);
                        const nextPlanned = getNextPlannedTime(new Date(now), nextConfig?.tatValue || 24, nextConfig?.tatUnit || 'hours').toISOString();
                        updatedData[`Planned_${nextStep}`] = nextPlanned;
                    }
                }

                return fetch('/api/fms-product-search', {
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

    const openRemoveModal = (id: string, name?: string) => {
        setRemoveTarget({ id, name: name || 'Product ' + id });
        setRemoveStep('all');
        setShowRemoveModal(true);
    };

    const handleRemoveFollowUp = async () => {
        if (!removeTarget) return;
        try {
            loader.showLoader();
            const payload: any = { id: removeTarget.id };

            if (removeStep === 'all') {
                [1, 2, 3, 4].forEach(step => {
                    payload[`Actual_${step}`] = '';
                    payload[`Status_${step}`] = '';
                    if (step > 1) payload[`Planned_${step}`] = '';
                });
            } else {
                const stepNum = removeStep as number;
                [1, 2, 3, 4].forEach(step => {
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

            const res = await fetch('/api/fms-product-search', {
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

    const activeData = useMemo(() => {
        let filtered = data.filter(d =>
            viewMode === 'cancelled'
                ? d['Cancelled']?.trim().toLowerCase() === 'yes'
                : !d['Cancelled'] || d['Cancelled'].trim().toLowerCase() !== 'yes'
        );

        if (viewMode === 'data' && activeStepFilter !== 'all') {
            filtered = filtered.filter(item => {
                const isDone = !!(item as any)[`Actual_${activeStepFilter}`];
                const isPreviousDone = activeStepFilter === 1 || !!(item as any)[`Actual_${activeStepFilter - 1}`];
                return !isDone && isPreviousDone;
            });
        }

        if (viewMode === 'data' && activeTimeFilter) {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;

            filtered = filtered.filter(item => {
                let currentStep = 1;
                for (let s = 1; s <= 4; s++) {
                    if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                    else break;
                }
                if (currentStep > 4) return false;

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
            for (let s = 1; s <= 4; s++) {
                if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                else break;
            }
            if (currentStep > 4) return;
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
        setActiveTimeFilter(null);
    };

    const handleSave = async () => {
        const validRows = rows.filter(r => r.Product.trim());
        if (validRows.length === 0) {
            toast.error('Please enter product name');
            return;
        }

        setIsSaving(true);
        try {
            const method = editingItem ? 'PUT' : 'POST';
            const payload = editingItem
                ? { id: editingItem.id, ...validRows[0] }
                : validRows;

            const res = await fetch('/api/fms-product-search', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setIsModalOpen(false);
                fetchData();
                toast.success(editingItem ? 'Updated successfully' : 'Added successfully');
            } else {
                toast.error('Failed to save');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error saving');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        setIsDeleting(true);
        try {
            const res = await fetch('/api/fms-product-search', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: deletingItem.id })
            });
            if (res.ok) {
                setIsDeleteModalOpen(false);
                fetchData();
                toast.success('Deleted successfully');
            } else {
                toast.error('Failed to delete');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error deleting');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            loader.showLoader();
            const res = await fetch('/api/fms-product-search-config', {
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
            console.error(error);
        } finally {
            loader.hideLoader();
        }
    };

    return (
        <LayoutWrapper>
            <div className="p-3 space-y-2">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-400/15 rounded-xl">
                            <AlertTriangle size={22} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wide leading-none">
                                NEW PRODUCT SEARCH FMS
                            </h1>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                                PRODUCT CATALOGUE RETRIEVAL & TRACKING
                            </p>
                        </div>
                    </div>

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
                                    ? 'bg-amber-400 text-gray-900 shadow-lg shadow-amber-400/25 scale-[1.02]'
                                    : 'text-amber-600/60 dark:text-amber-400/60 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-400/5'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                        <div className="w-px h-8 bg-slate-100 dark:bg-slate-700 mx-1" />
                        <button
                            onClick={() => {
                                setEditingItem(null);
                                setRows([{ ...emptyForm }]);
                                setIsModalOpen(true);
                            }}
                            className="bg-amber-400/10 text-amber-600 dark:text-amber-400 p-2.5 rounded-2xl hover:bg-amber-400 hover:text-gray-900 transition-all shadow-sm"
                            title="Add New"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-white dark:border-slate-700 overflow-hidden">
                    {viewMode === 'setup' ? (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Step Configuration</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure workflow steps and turnaround times</p>
                                </div>
                                <button
                                    onClick={handleSaveConfig}
                                    className="bg-amber-400 text-gray-900 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.05] transition-all"
                                >
                                    Save Configuration
                                </button>
                            </div>

                            <div className="overflow-hidden border border-slate-100 dark:border-slate-700 rounded-[2rem]">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Step</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Responsible</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">TAT</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                        {stepConfigs.map((config, index) => (
                                            <tr key={config.step}>
                                                <td className="px-6 py-4 font-black">#{config.step}</td>
                                                <td className="px-6 py-4 text-xs font-bold">{config.stepName}</td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={config.doerName}
                                                        onChange={(e) => {
                                                            const n = [...stepConfigs];
                                                            n[index].doerName = e.target.value;
                                                            setStepConfigs(n);
                                                        }}
                                                        className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl text-xs font-bold"
                                                    >
                                                        <option value="">Select User</option>
                                                        {systemUsers.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={config.tatValue}
                                                        onChange={(e) => {
                                                            const n = [...stepConfigs];
                                                            n[index].tatValue = parseInt(e.target.value) || 0;
                                                            setStepConfigs(n);
                                                        }}
                                                        className="w-20 h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl text-xs font-bold"
                                                    />
                                                    <select
                                                        value={config.tatUnit}
                                                        onChange={(e) => {
                                                            const n = [...stepConfigs];
                                                            n[index].tatUnit = e.target.value as any;
                                                            setStepConfigs(n);
                                                        }}
                                                        className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl text-xs font-bold uppercase"
                                                    >
                                                        <option value="hours">H</option>
                                                        <option value="days">D</option>
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
                            {/* Step Filter Tiles */}
                            <div className="overflow-x-auto pb-0 scroll-smooth -mx-0 px-4 pt-4 border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/10">
                                <div className="flex gap-2 min-w-max pr-2 pb-4">
                                    {[
                                        { step: 'all' as const, label: 'All Items', value: statusStats.Total, gradient: 'from-slate-50 to-slate-100', border: 'border-slate-200', iconBg: 'from-slate-500 to-slate-600', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                                        { step: 1 as const, label: '1. Getting Dealer Contact No', value: statusStats.Step1, gradient: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', iconBg: 'from-yellow-500 to-yellow-600', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 00.948.684l1.498 4.493a1 1 0 00.502.756l2.048 1.029a2 2 0 002.992-1.159l1.5-3.5A1 1 0 0021 9V9a9 9 0 00-9-9H6a2 2 0 00-2 2z' },
                                        { step: 2 as const, label: '2. Getting Sales Person No', value: statusStats.Step2, gradient: 'from-orange-50 to-orange-100', border: 'border-orange-200', iconBg: 'from-orange-500 to-orange-600', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                                        { step: 3 as const, label: '3. Talk & Retrieve Catalogue', value: statusStats.Step3, gradient: 'from-pink-50 to-pink-100', border: 'border-pink-200', iconBg: 'from-pink-500 to-pink-600', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
                                        { step: 4 as const, label: '4. File the Product List', value: statusStats.Step4, gradient: 'from-purple-50 to-purple-100', border: 'border-purple-200', iconBg: 'from-purple-500 to-purple-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
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
                                                setCurrentPage(1);
                                            }}
                                            className={`cursor-pointer min-w-fit px-4 py-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${activeStepFilter === stat.step
                                                ? `bg-gradient-to-br ${stat.gradient} ${stat.border} border-opacity-100 shadow-lg shadow-amber-100/50`
                                                : `${stat.border} border-opacity-30 hover:border-opacity-100 text-white`
                                                }`}
                                        >
                                            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.iconBg} text-white`}>
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={stat.icon} /></svg>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                                <p className="text-lg font-black text-slate-900 dark:text-white">{stat.value}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Pagination & Date Filters Bar */}
                            <div className="flex bg-slate-50/50 dark:bg-slate-900/50 p-2 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md sticky top-0 z-20 flex-wrap gap-3 lg:flex-nowrap">
                                <div className="flex-1 flex items-center justify-between px-3 gap-4 min-w-full lg:min-w-0">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                            Showing{' '}
                                            <span className="text-slate-900 dark:text-white">{activeData.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</span>
                                            {' – '}
                                            <span className="text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, activeData.length)}</span>
                                            {' of '}
                                            <span className="text-slate-900 dark:text-white">{activeData.length}</span>
                                        </p>

                                        {selectedItems.size > 0 && (
                                            <button
                                                onClick={() => setIsBulkUpdateModalOpen(true)}
                                                className="h-8 px-4 rounded-xl bg-amber-400 text-gray-900 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all ml-2"
                                            >
                                                Update Status ({selectedItems.size})
                                            </button>
                                        )}

                                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                                        {/* Time filter pills with counts */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                            {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                                                <button
                                                    key={filter}
                                                    onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                                                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative ${activeTimeFilter === filter
                                                        ? 'bg-amber-400 text-gray-900 shadow-md scale-[1.05]'
                                                        : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:border-amber-400 hover:text-amber-600'
                                                        }`}
                                                >
                                                    {filter}
                                                    {((timeStats[filter as keyof typeof timeStats] ?? 0) > 0) && (
                                                        <sup className={`ml-1 text-[8px] ${activeTimeFilter === filter ? 'text-gray-900' : (filter === 'Delayed' ? 'text-red-500' : 'text-emerald-500')}`}>
                                                            {timeStats[filter as keyof typeof timeStats]}
                                                        </sup>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* FIRST / PREV / page numbers / NEXT / LAST */}
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                                            className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest">
                                            First
                                        </button>
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                            className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest">
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
                                                        <button key={i} onClick={() => setCurrentPage(i)}
                                                            className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${currentPage === i ? 'bg-amber-400 text-gray-900 shadow-md' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800'
                                                                }`}>{i}</button>
                                                    );
                                                }
                                                return pages;
                                            })()}
                                        </div>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                            className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest">
                                            Next
                                        </button>
                                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                                            className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest">
                                            Last
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Data Table */}
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="animate-spin" size={32} />
                                </div>
                            ) : paginatedData.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                    No records found
                                </div>
                            ) : (
                                <>
                                    {/* Bulk Update Bar */}
                                    {selectedItems.size > 0 && (
                                        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/30 flex items-center justify-between">
                                            <div className="text-sm font-bold text-amber-900 dark:text-amber-300">
                                                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                                            </div>
                                            <button
                                                onClick={() => setIsBulkUpdateModalOpen(true)}
                                                className="px-6 py-2 bg-amber-400 text-gray-900 rounded-lg font-black text-sm uppercase tracking-widest hover:bg-amber-500 transition-all shadow-lg"
                                            >
                                                Update Status ({selectedItems.size})
                                            </button>
                                        </div>
                                    )}

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-amber-400/80 dark:bg-amber-900/40 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-4 text-center w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.size === activeData.length && activeData.length > 0}
                                                            onChange={toggleAll}
                                                            className="w-4 h-4 rounded border-2"
                                                        />
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">ACTIONS</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">ID</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">PRODUCT</th>
                                                    {PRODUCT_STAGES.map(stage => (
                                                        <th key={stage.step} className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white whitespace-nowrap">
                                                            STEP {stage.step}<br />{stage.name}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {paginatedData.map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                        <td className="px-4 py-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(item.id)}
                                                                onChange={() => toggleSelection(item.id)}
                                                                className="w-4 h-4 rounded border-2"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <motion.button
                                                                    whileHover={{ scale: 1.1 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    onClick={() => {
                                                                        setEditingItem(item);
                                                                        setRows([{ Product: item.Product || '' }]);
                                                                        setIsModalOpen(true);
                                                                    }}
                                                                    className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil size={16} />
                                                                </motion.button>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.1 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    onClick={() => openRemoveModal(item.id, item.Product)}
                                                                    className="p-2 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg"
                                                                    title="Remove Follow Up"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                                </motion.button>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.1 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    onClick={() => {
                                                                        setDeletingItem(item);
                                                                        setIsDeleteModalOpen(true);
                                                                    }}
                                                                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </motion.button>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-black text-slate-900 dark:text-white">{item.id}</td>
                                                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 max-w-xs truncate">{item.Product || '-'}</td>
                                                        {PRODUCT_STAGES.map(stage => {
                                                            const actualKey = `Actual_${stage.step}`;
                                                            const statusKey = `Status_${stage.step}`;
                                                            const planned = (item as any)[`Planned_${stage.step}`];
                                                            const actual = (item as any)[actualKey];
                                                            const status = (item as any)[statusKey];
                                                            const contact = (item as any)[`Contact_${stage.step}`];

                                                            return (
                                                                <td key={stage.step} className="px-6 py-4">
                                                                    <div className="space-y-1">
                                                                        {planned && <p className="text-[9px] text-blue-600 dark:text-blue-400">📅 {new Date(planned).toLocaleDateString()}</p>}
                                                                        {actual && <p className="text-[9px] text-green-600 dark:text-green-400 font-bold">✓ {new Date(actual).toLocaleDateString()}</p>}
                                                                        {contact && <p className="text-[9px] text-purple-600 dark:text-purple-400">👤 {contact}</p>}
                                                                        {!actual && planned && <p className="text-[9px] text-orange-600 dark:text-orange-400">⏳ Pending</p>}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Modal */}
                <AnimatePresence>
                    {isModalOpen && (
                        <motion.div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <motion.div className="bg-white dark:bg-gray-800 p-8 rounded-3xl max-w-md w-full">
                                <h2 className="text-2xl font-black mb-6 uppercase tracking-wide">{editingItem ? 'Edit Product' : 'Add New Product'}</h2>

                                <div className="space-y-4 mb-6">
                                    {rows.map((row, idx) => (
                                        <div key={idx}>
                                            <label className="block text-sm font-bold mb-2 uppercase tracking-wider">Product Name *</label>
                                            <input
                                                type="text"
                                                value={row.Product}
                                                onChange={(e) => {
                                                    const newRows = [...rows];
                                                    newRows[idx].Product = e.target.value;
                                                    setRows(newRows);
                                                }}
                                                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white font-bold focus:outline-none focus:border-amber-400"
                                                placeholder="Enter product name"
                                                autoFocus
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex-1 bg-amber-400 text-gray-900 py-3 rounded-xl hover:bg-amber-500 disabled:opacity-50 flex items-center justify-center gap-2 font-black uppercase text-sm"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 bg-slate-300 dark:bg-slate-600 py-3 rounded-xl hover:bg-slate-400 flex items-center justify-center gap-2 font-black uppercase text-sm"
                                    >
                                        <X size={18} /> Cancel
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {isDeleteModalOpen && (
                        <motion.div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <motion.div className="bg-white dark:bg-gray-800 p-8 rounded-3xl max-w-md w-full">
                                <h2 className="text-2xl font-black mb-4 uppercase tracking-wide">Delete Product?</h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="flex-1 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 disabled:opacity-50 font-black uppercase"
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                    </button>
                                    <button
                                        onClick={() => setIsDeleteModalOpen(false)}
                                        className="flex-1 bg-slate-300 dark:bg-slate-600 py-3 rounded-xl hover:bg-slate-400"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* Bulk Update Modal */}
                    {isBulkUpdateModalOpen && (
                        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <motion.div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                                <div className="p-6 bg-amber-400 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-900/30">
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-wide">Update Step Status</h2>
                                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mt-1">Mark selected products as done</p>
                                </div>

                                <form onSubmit={handleBulkUpdate} className="p-6 space-y-6">
                                    <div className="space-y-3">
                                        <label className="block text-sm font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">Select Products to Complete Current Step:</label>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {Array.from(selectedItems).map(id => {
                                                const item = data.find(d => d.id === id);
                                                if (!item) return null;
                                                const currentStep = getCurrentStep(item);
                                                return (
                                                    <label key={id} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={itemsToMarkDone.has(id)}
                                                            onChange={() => {
                                                                const newSet = new Set(itemsToMarkDone);
                                                                if (newSet.has(id)) newSet.delete(id);
                                                                else newSet.add(id);
                                                                setItemsToMarkDone(newSet);
                                                            }}
                                                            className="w-4 h-4 rounded border-2"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="font-bold text-sm">{item.Product}</p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">Step {currentStep}: {PRODUCT_STAGES.find(s => s.step === currentStep)?.name}</p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                        <button
                                            type="button"
                                            onClick={() => setIsBulkUpdateModalOpen(false)}
                                            className="flex-1 px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={itemsToMarkDone.size === 0}
                                            className="flex-1 px-6 py-3 bg-amber-400 text-gray-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Mark As Done ({itemsToMarkDone.size})
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* Remove Follow-Up Modal */}
                    {showRemoveModal && (
                        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <motion.div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4">
                                <div className="p-6 bg-indigo-50 dark:bg-indigo-900/40 border-b border-indigo-200 dark:border-indigo-900/30">
                                    <h2 className="text-2xl font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-wide">Remove Follow-Up</h2>
                                    <p className="text-[11px] font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-widest mt-1">Reset step completion status</p>
                                </div>

                                <form onSubmit={(e) => { e.preventDefault(); handleRemoveFollowUp(); }} className="p-6 space-y-4">
                                    <div>
                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Product: <span className="text-amber-600 dark:text-amber-400 uppercase">{removeTarget?.name}</span></p>
                                        <label className="block text-sm font-black uppercase tracking-widest text-gray-700 dark:text-gray-300 mb-2">Which step to reset?</label>
                                        <select
                                            value={removeStep === 'all' ? 'all' : removeStep}
                                            onChange={(e) => setRemoveStep(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="all">Reset All Steps</option>
                                            <option value="1">Step 1: {PRODUCT_STAGES[0].name}</option>
                                            <option value="2">Step 2: {PRODUCT_STAGES[1].name}</option>
                                            <option value="3">Step 3: {PRODUCT_STAGES[2].name}</option>
                                            <option value="4">Step 4: {PRODUCT_STAGES[3].name}</option>
                                        </select>
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                        <button
                                            type="button"
                                            onClick={() => setShowRemoveModal(false)}
                                            className="flex-1 px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                                        >
                                            Remove Follow-Up
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </LayoutWrapper>
    );
}
