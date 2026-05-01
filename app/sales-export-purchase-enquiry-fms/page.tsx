'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle, Pencil, Trash2, X, Save, Ban, RotateCcw, ShoppingBag } from 'lucide-react';

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface SalesExportPurchaseEnquiryFMS {
    id: string;
    Party: string;
    Phone: string;
    Email: string;
    Country_Of_Destinations: string;
    Product_Name: string;
    Product_Quantity: string;
    Timestamp?: string;
    Cancelled?: string;
    _rowIndex: number;
    Planned_1?: string; Actual_1?: string; Status_1?: string;
    Planned_2?: string; Actual_2?: string; Status_2?: string;
    Planned_3?: string; Actual_3?: string; Status_3?: string;
    Planned_4?: string; Actual_4?: string; Status_4?: string;
    Planned_5?: string; Actual_5?: string; Status_5?: string;
}

const PRODUCT_STAGES = [
    { step: 1, name: 'Take All Releveant Details From Vendor (Price, Avaiiliability, Shelf Life, Unit Per Case Etc )', shortName: 'VENDOR DETAILS' },
    { step: 2, name: 'Inform Siddharth Export Sales Team', shortName: 'INFORM SALES' },
    { step: 3, name: 'Inform Export Purchase Team About Client Feedback', shortName: 'CLIENT FEEDBACK' },
    { step: 4, name: 'Talk To Vendor About The Price Feedback And Try To Match Feedback Prices', shortName: 'PRICE MATCH' },
    { step: 5, name: 'Inform Sales Team About The Final Price', shortName: 'FINAL PRICE' },
];

const ITEMS_PER_PAGE = 15;
const emptyForm = { 
    Party: '', 
    Phone: '', 
    Email: '', 
    Country_Of_Destinations: '', 
    Product_Name: '', 
    Product_Quantity: '' 
};
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

const getNextPlannedTime = (from: Date, tatValue: number, tatUnit: 'hours' | 'days'): Date => {
    const next = new Date(from);
    if (tatUnit === 'hours') {
        next.setHours(next.getHours() + tatValue);
    } else {
        next.setDate(next.getDate() + tatValue);
    }
    return next;
};

export default function SalesExportPurchaseEnquiryFMSPage() {
    const [data, setData] = useState<SalesExportPurchaseEnquiryFMS[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('data');
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all'>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SalesExportPurchaseEnquiryFMS | null>(null);
    const [deletingItem, setDeletingItem] = useState<SalesExportPurchaseEnquiryFMS | null>(null);

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
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancellingItem, setCancellingItem] = useState<SalesExportPurchaseEnquiryFMS | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sales-export-purchase-enquiry-fms');
            const json = await res.json();
            if (json.data) {
                const sanitized = json.data
                    .filter((d: SalesExportPurchaseEnquiryFMS) => d.Party?.trim() || d.Product_Name?.trim())
                    .map((d: SalesExportPurchaseEnquiryFMS, idx: number) => ({
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
            const res = await fetch('/api/sales-export-purchase-enquiry-fms-config');
            if (res.ok) {
                const data = await res.json();
                const fetchedConfig = data.config || [];
                
                // Merge fetched config with default PRODUCT_STAGES to ensure all 5 steps exist with correct names
                const mergedConfig = PRODUCT_STAGES.map(stage => {
                    const existing = fetchedConfig.find((c: any) => c.step === stage.step);
                    return {
                        step: stage.step,
                        stepName: stage.name, // Force names from PRODUCT_STAGES as requested
                        doerName: existing?.doerName || '',
                        tatValue: existing?.tatValue || 24,
                        tatUnit: existing?.tatUnit || 'hours'
                    };
                });
                setStepConfigs(mergedConfig);
            }
        } catch (error) {
            console.error('Error fetching config:', error);
            toast.error('Failed to load step configuration');
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

    const getCurrentStep = (item: SalesExportPurchaseEnquiryFMS): number => {
        for (let step = 1; step <= 5; step++) {
            if (!(item as any)[`Actual_${step}`]) return step;
        }
        return 5;
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

                if (itemsToMarkDone.has(item.id) && currentStep <= 5) {
                    updatedData[`Actual_${currentStep}`] = now;
                    updatedData[`Status_${currentStep}`] = 'Completed';

                    if (currentStep < 5) {
                        const nextStep = currentStep + 1;
                        const nextConfig = stepConfigs.find(c => c.step === nextStep);
                        const nextPlanned = getNextPlannedTime(new Date(now), nextConfig?.tatValue || 24, nextConfig?.tatUnit || 'hours').toISOString();
                        updatedData[`Planned_${nextStep}`] = nextPlanned;
                    }
                }

                return fetch('/api/sales-export-purchase-enquiry-fms', {
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
        setRemoveTarget({ id, name: name || 'Enquiry ' + id });
        setRemoveStep('all');
        setShowRemoveModal(true);
    };

    const handleRemoveFollowUp = async () => {
        if (!removeTarget) return;
        try {
            loader.showLoader();
            const payload: any = { id: removeTarget.id };

            if (removeStep === 'all') {
                [1, 2, 3, 4, 5].forEach(step => {
                    payload[`Actual_${step}`] = '';
                    payload[`Status_${step}`] = '';
                    if (step > 1) payload[`Planned_${step}`] = '';
                });
            } else {
                const stepNum = removeStep as number;
                [1, 2, 3, 4, 5].forEach(step => {
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

            const res = await fetch('/api/sales-export-purchase-enquiry-fms', {
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

    const handleToggleCancel = async () => {
        if (!cancellingItem) return;
        try {
            loader.showLoader();
            const isCancelling = cancellingItem.Cancelled?.trim().toLowerCase() !== 'yes';
            const res = await fetch('/api/sales-export-purchase-enquiry-fms', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cancellingItem.id, Cancelled: isCancelling ? 'Yes' : '' })
            });
            if (res.ok) {
                toast.success(isCancelling ? 'Enquiry cancelled' : 'Enquiry restored');
                setIsCancelModalOpen(false);
                setCancellingItem(null);
                fetchData();
            } else {
                toast.error('Operation failed');
            }
        } catch (e) {
            toast.error('Error updating cancel status');
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
                for (let s = 1; s <= 5; s++) {
                    if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                    else break;
                }
                if (currentStep > 5) return false;

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
                    case 'Next 3': return diffDays > 1 && diffDays <= 3;
                    case 'Next 7': return diffDays > 3 && diffDays <= 7;
                    case 'Next 15': return diffDays > 7 && diffDays <= 15;
                    default: return true;
                }
            });
        }

        return filtered.sort((a, b) => {
            const idA = parseInt(String(a.id).replace(/\D/g, '')) || 0;
            const idB = parseInt(String(b.id).replace(/\D/g, '')) || 0;
            return idB - idA;
        });
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
            for (let s = 1; s <= 5; s++) {
                if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                else break;
            }
            if (currentStep > 5) return;
            const plannedStr = (item as any)[`Planned_${currentStep}`];
            if (!plannedStr) return;
            const pDate = new Date(plannedStr);
            const pTime = pDate.getTime();
            const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
            const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);
            if (pTime < now.getTime()) stats['Delayed']++;
            if (diffDays === 0) stats['Today']++;
            else if (diffDays === 1) stats['Tomorrow']++;
            else if (diffDays > 1 && diffDays <= 3) stats['Next 3']++;
            else if (diffDays > 3 && diffDays <= 7) stats['Next 7']++;
            else if (diffDays > 7 && diffDays <= 15) stats['Next 15']++;
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
        const validRows = rows.filter(r => r.Party.trim() || r.Product_Name.trim());
        if (validRows.length === 0) {
            toast.error('Please enter party or product name');
            return;
        }

        setIsSaving(true);
        try {
            const method = editingItem ? 'PUT' : 'POST';
            const payload = editingItem
                ? { id: editingItem.id, ...validRows[0] }
                : validRows;

            const res = await fetch('/api/sales-export-purchase-enquiry-fms', {
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
            const res = await fetch('/api/sales-export-purchase-enquiry-fms', {
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
            const res = await fetch('/api/sales-export-purchase-enquiry-fms-config', {
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
                                SALES EXPORT PURCHASE ENQUIRY FMS
                            </h1>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                                EXPORT ENQUIRY & ORDER TRACKING
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
                            className="bg-amber-400 text-gray-900 p-2.5 rounded-2xl hover:bg-amber-500 transition-all shadow-lg flex items-center gap-2 px-4"
                            title="Add New Enquiry"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">BILL</span>
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
                                        { step: 1 as const, label: PRODUCT_STAGES[0].shortName, value: statusStats.Step1, gradient: 'from-amber-50 to-amber-100', border: 'border-amber-200', iconBg: 'from-amber-500 to-amber-600', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                                        { step: 2 as const, label: PRODUCT_STAGES[1].shortName, value: statusStats.Step2, gradient: 'from-orange-50 to-orange-100', border: 'border-orange-200', iconBg: 'from-orange-500 to-orange-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                                        { step: 3 as const, label: PRODUCT_STAGES[2].shortName, value: statusStats.Step3, gradient: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', iconBg: 'from-yellow-500 to-yellow-600', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                        { step: 4 as const, label: PRODUCT_STAGES[3].shortName, value: statusStats.Step4, gradient: 'from-blue-50 to-blue-100', border: 'border-blue-200', iconBg: 'from-blue-500 to-blue-600', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
                                        { step: 5 as const, label: PRODUCT_STAGES[4].shortName, value: statusStats.Step5, gradient: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200', iconBg: 'from-emerald-500 to-emerald-600', icon: 'M5 13l4 4L19 7' },
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
                                            className={`cursor-pointer min-w-fit px-3 py-1.5 rounded-xl border-2 transition-all flex items-center gap-3 ${activeStepFilter === stat.step
                                                ? `bg-gradient-to-br ${stat.gradient} ${stat.border} border-opacity-100 shadow-md shadow-amber-100/50`
                                                : `${stat.border} border-opacity-30 hover:border-opacity-100`
                                                }`}
                                        >
                                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${stat.iconBg} text-white`}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={stat.icon} /></svg>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">{stat.label}</p>
                                                <p className="text-base font-black text-slate-900 dark:text-white leading-tight">{stat.value}</p>
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
                                    {/* Pagination Controls */}
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
                                    <Loader2 className="animate-spin text-amber-600" size={32} />
                                </div>
                            ) : paginatedData.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                    No records found
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-amber-400 dark:bg-amber-500 sticky top-0 z-10 shadow-sm">
                                            <tr className="divide-x-2 divide-black/5">
                                                <th className="px-4 py-4 text-center w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.size === activeData.length && activeData.length > 0}
                                                        onChange={toggleAll}
                                                        className="w-4 h-4 rounded border-2 border-white/50 accent-amber-600"
                                                    />
                                                </th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">ACTIONS</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">ID</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">PARTY / CONTACT</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">COUNTRY</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">PRODUCT DETAILS</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">TIMESTAMP</th>
                                                {PRODUCT_STAGES.map(stage => (
                                                    <th key={stage.step} className="px-6 py-4 text-left min-w-[160px]">
                                                        <div className="flex flex-col leading-tight">
                                                            <span className="text-[9px] opacity-70 font-black text-slate-800 dark:text-slate-100">STEP {stage.step}</span>
                                                            <span className="text-[10px] font-black uppercase whitespace-nowrap text-slate-900 dark:text-white" title={stepConfigs[stage.step - 1]?.stepName || stage.name}>
                                                                {PRODUCT_STAGES[stage.step - 1].shortName}
                                                            </span>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y-2 divide-slate-100 dark:divide-slate-800">
                                            {paginatedData.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b-2 border-slate-100 dark:border-slate-800">
                                                    <td className="px-4 py-4 text-center border-r-2 border-slate-100 dark:border-slate-800">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(item.id)}
                                                            onChange={() => toggleSelection(item.id)}
                                                            className="w-4 h-4 rounded border-2"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 border-r-2 border-slate-100 dark:border-slate-800">
                                                        <div className="grid grid-cols-2 gap-2 w-fit">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingItem(item);
                                                                    setRows([{
                                                                        Party: item.Party || '',
                                                                        Phone: item.Phone || '',
                                                                        Email: item.Email || '',
                                                                        Country_Of_Destinations: item.Country_Of_Destinations || '',
                                                                        Product_Name: item.Product_Name || '',
                                                                        Product_Quantity: item.Product_Quantity || ''
                                                                    }]);
                                                                    setIsModalOpen(true);
                                                                }}
                                                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setDeletingItem(item);
                                                                    setIsDeleteModalOpen(true);
                                                                }}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => openRemoveModal(item.id, item.Party)}
                                                                className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="Reset Progress"
                                                            >
                                                                <RotateCcw size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setCancellingItem(item);
                                                                    setIsCancelModalOpen(true);
                                                                }}
                                                                className={`p-1.5 ${item.Cancelled?.toLowerCase() === 'yes' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-50'} rounded-lg transition-colors`}
                                                                title={item.Cancelled?.toLowerCase() === 'yes' ? 'Restore' : 'Cancel'}
                                                            >
                                                                <Ban size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-black text-slate-400">#{item.id}</td>
                                                    <td className="px-6 py-4 border-r-2 border-slate-100 dark:border-slate-800">
                                                        <div className="flex flex-col gap-1 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                                                                    <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                </div>
                                                                <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{item.Party || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                                                                    <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                </div>
                                                                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">{item.Phone || '-'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                                                                    <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                </div>
                                                                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold lowercase">{item.Email || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 border-r-2 border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2 whitespace-nowrap">
                                                            <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                                                <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                            </div>
                                                            <span className="text-xs font-black text-indigo-500 uppercase tracking-tight">{item.Country_Of_Destinations || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 border-r-2 border-slate-100 dark:border-slate-800">
                                                        <div className="flex flex-col gap-1.5 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
                                                                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14v14m0-14L4 7m8 4L4 7m0 0v10l8 4" /></svg>
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{item.Product_Name || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1 bg-orange-100 dark:bg-orange-900/30 rounded-md">
                                                                    <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                                                </div>
                                                                <span className="text-[10px] text-slate-500 font-black uppercase">Qty: {item.Product_Quantity || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 border-r-2 border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase">{formatDateTime(item.Timestamp)}</span>
                                                        </div>
                                                    </td>
                                                    {PRODUCT_STAGES.map(stage => {
                                                        const step = stage.step;
                                                        const planned = (item as any)[`Planned_${step}`];
                                                        const actual = (item as any)[`Actual_${step}`];
                                                        const status = (item as any)[`Status_${step}`];
                                                        const delay = getDelayInfo(planned, actual);

                                                        return (
                                                            <td key={step} className="px-6 py-4 border-l-2 border-slate-100 dark:border-slate-800">
                                                                {actual ? (
                                                                    <div className="flex flex-col gap-1 whitespace-nowrap">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Completed</span>
                                                                        </div>
                                                                        {planned && <div className="text-[8px] text-slate-400 uppercase font-bold">Planned: {formatDateTime(planned)}</div>}
                                                                        <div className="text-[8px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Actual: {formatDateTime(actual)}</div>
                                                                    </div>
                                                                ) : planned ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Planned</span>
                                                                            {delay && <span className={`text-[8px] ${delay.color}`}>{delay.text}</span>}
                                                                        </div>
                                                                        <span className="text-[9px] font-bold text-slate-400">{formatDateTime(planned)}</span>
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    loader.showLoader();
                                                                                    const now = new Date().toISOString();
                                                                                    const updates: any = { id: item.id };
                                                                                    updates[`Actual_${step}`] = now;
                                                                                    updates[`Status_${step}`] = 'Completed';

                                                                                    if (step < 5) {
                                                                                        const nextStep = step + 1;
                                                                                        const nextConfig = stepConfigs.find(c => c.step === nextStep);
                                                                                        const nextPlanned = getNextPlannedTime(new Date(now), nextConfig?.tatValue || 24, nextConfig?.tatUnit || 'hours').toISOString();
                                                                                        updates[`Planned_${nextStep}`] = nextPlanned;
                                                                                    }

                                                                                    const res = await fetch('/api/sales-export-purchase-enquiry-fms', {
                                                                                        method: 'PUT',
                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                        body: JSON.stringify(updates),
                                                                                    });
                                                                                    if (res.ok) {
                                                                                        toast.success('Status updated');
                                                                                        fetchData();
                                                                                    } else {
                                                                                        toast.error('Failed to update status');
                                                                                    }
                                                                                } finally {
                                                                                    loader.hideLoader();
                                                                                }
                                                                            }}
                                                                            className="w-full h-7 mt-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest hover:bg-amber-400 hover:text-gray-900 transition-all border border-amber-100 dark:border-amber-800"
                                                                        >
                                                                            Mark Done
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase italic">Waiting...</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Modals */}
                <AnimatePresence>
                    {isModalOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white dark:border-slate-800 w-full max-w-2xl overflow-hidden">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase">{editingItem ? 'Edit Enquiry' : 'Add New Enquiry'}</h3>
                                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
                                </div>
                                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                                    {rows.map((row, idx) => (
                                        <div key={idx} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 relative group shadow-inner">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Party Name</label>
                                                    <div className="relative group/input">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg group-focus-within/input:bg-amber-400 transition-colors">
                                                            <svg className="w-3.5 h-3.5 text-amber-600 group-focus-within/input:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                        </div>
                                                        <input type="text" value={row.Party} onChange={e => { const n = [...rows]; n[idx].Party = e.target.value; setRows(n); }}
                                                            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-4 ring-amber-400/20 focus:border-amber-400 outline-none transition-all" placeholder="Enter Party Name" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                                                    <div className="relative group/input">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg group-focus-within/input:bg-blue-400 transition-colors">
                                                            <svg className="w-3.5 h-3.5 text-blue-600 group-focus-within/input:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                        </div>
                                                        <input type="text" value={row.Phone} onChange={e => { const n = [...rows]; n[idx].Phone = e.target.value; setRows(n); }}
                                                            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-4 ring-blue-400/20 focus:border-blue-400 outline-none transition-all" placeholder="Enter Phone" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                                    <div className="relative group/input">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg group-focus-within/input:bg-purple-400 transition-colors">
                                                            <svg className="w-3.5 h-3.5 text-purple-600 group-focus-within/input:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                        </div>
                                                        <input type="email" value={row.Email} onChange={e => { const n = [...rows]; n[idx].Email = e.target.value; setRows(n); }}
                                                            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-4 ring-purple-400/20 focus:border-purple-400 outline-none transition-all" placeholder="Enter Email" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Country of Destinations</label>
                                                    <div className="relative group/input">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-rose-50 dark:bg-rose-900/30 rounded-lg group-focus-within/input:bg-rose-400 transition-colors">
                                                            <svg className="w-3.5 h-3.5 text-rose-600 group-focus-within/input:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                        </div>
                                                        <input type="text" value={row.Country_Of_Destinations} onChange={e => { const n = [...rows]; n[idx].Country_Of_Destinations = e.target.value; setRows(n); }}
                                                            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-4 ring-rose-400/20 focus:border-rose-400 outline-none transition-all" placeholder="Enter Destination" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name</label>
                                                    <div className="relative group/input">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg group-focus-within/input:bg-emerald-400 transition-colors">
                                                            <svg className="w-3.5 h-3.5 text-emerald-600 group-focus-within/input:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14v14m0-14L4 7m8 4L4 7m0 0v10l8 4" /></svg>
                                                        </div>
                                                        <input type="text" value={row.Product_Name} onChange={e => { const n = [...rows]; n[idx].Product_Name = e.target.value; setRows(n); }}
                                                            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-4 ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all" placeholder="Enter Product Name" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Quantity</label>
                                                    <div className="relative group/input">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-lg group-focus-within/input:bg-orange-400 transition-colors">
                                                            <svg className="w-3.5 h-3.5 text-orange-600 group-focus-within/input:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                                        </div>
                                                        <input type="text" value={row.Product_Quantity} onChange={e => { const n = [...rows]; n[idx].Product_Quantity = e.target.value; setRows(n); }}
                                                            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-4 ring-orange-400/20 focus:border-orange-400 outline-none transition-all" placeholder="Enter Quantity" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                                    <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
                                    <button onClick={handleSave} disabled={isSaving} className="px-10 py-3 rounded-2xl bg-amber-400 text-gray-900 font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                                        {isSaving ? 'Saving...' : editingItem ? 'Update Enquiry' : 'Add Enquiry'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Delete Modal */}
                    {isDeleteModalOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white dark:border-slate-800 w-full max-w-md overflow-hidden p-6">
                                <div className="flex items-center gap-4 text-red-500 mb-4">
                                    <div className="p-3 bg-red-50 rounded-2xl"><Trash2 size={24} /></div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Delete Record?</h3>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">Are you sure you want to delete this enquiry for <span className="font-black text-slate-800 dark:text-white uppercase">{deletingItem?.Party}</span>? This action cannot be undone.</p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
                                    <button onClick={handleDelete} disabled={isDeleting} className="px-8 py-3 rounded-2xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.05] transition-all">
                                        {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Cancel/Restore Modal */}
                    {isCancelModalOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white dark:border-slate-800 w-full max-w-md overflow-hidden p-6">
                                <div className="flex items-center gap-4 text-amber-500 mb-4">
                                    <div className="p-3 bg-amber-50 rounded-2xl"><Ban size={24} /></div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">{cancellingItem?.Cancelled?.toLowerCase() === 'yes' ? 'Restore Enquiry?' : 'Cancel Enquiry?'}</h3>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">
                                    {cancellingItem?.Cancelled?.toLowerCase() === 'yes'
                                        ? `Do you want to restore the enquiry for ${cancellingItem?.Party}?`
                                        : `Do you want to cancel the enquiry for ${cancellingItem?.Party}? It will be moved to the Cancelled View.`}
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setIsCancelModalOpen(false)} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">No, Back</button>
                                    <button onClick={handleToggleCancel} className="px-8 py-3 rounded-2xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.05] transition-all">
                                        Yes, Proceed
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Remove Follow-up Modal */}
                    {showRemoveModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white dark:border-slate-800 w-full max-w-md overflow-hidden p-6">
                                <div className="flex items-center gap-4 text-amber-500 mb-4">
                                    <div className="p-3 bg-amber-50 rounded-2xl"><RotateCcw size={24} /></div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Reset Progress</h3>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Reset progress for <span className="font-black text-slate-800 dark:text-white uppercase">{removeTarget?.name}</span>?</p>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Scope</label>
                                        <select value={removeStep} onChange={e => setRemoveStep(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                            className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold">
                                            <option value="all">Entire Process (All Steps)</option>
                                            {[1, 2, 3, 4, 5].map(s => <option key={s} value={s}>Step {s}: {stepConfigs[s - 1]?.stepName || `Stage ${s}`}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-8">
                                    <button onClick={() => setShowRemoveModal(false)} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
                                    <button onClick={handleRemoveFollowUp} className="px-8 py-3 rounded-2xl bg-amber-400 text-gray-900 font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.05] transition-all">Reset Now</button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Bulk Update Modal */}
                    {isBulkUpdateModalOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-white dark:border-slate-800 w-full max-w-lg overflow-hidden p-6">
                                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-6">Bulk Update Status ({selectedItems.size} items)</h3>
                                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                                    {Array.from(selectedItems).map(id => {
                                        const item = data.find(d => d.id === id);
                                        const currentStep = item ? getCurrentStep(item) : 1;
                                        return (
                                            <div key={id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{item?.Party}</span>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Current: Step {currentStep}</span>
                                                </div>
                                                <div className="flex items-center gap-3 cursor-pointer group"
                                                     onClick={() => {
                                                         const n = new Set(itemsToMarkDone);
                                                         if (n.has(id)) n.delete(id); else n.add(id);
                                                         setItemsToMarkDone(n);
                                                     }}>
                                                    <span className="text-[10px] font-black text-slate-400 group-hover:text-amber-600 uppercase transition-colors">Mark Step {currentStep} Done</span>
                                                    <div className={`w-11 h-6 rounded-full p-1 transition-all duration-300 ${itemsToMarkDone.has(id) ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 transform ${itemsToMarkDone.has(id) ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-end gap-3 mt-8">
                                    <button onClick={() => setIsBulkUpdateModalOpen(false)} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
                                    <button onClick={handleBulkUpdate} className="px-10 py-3 rounded-2xl bg-amber-400 text-gray-900 font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-amber-500 transition-all">
                                        Update All Selected
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </LayoutWrapper>
    );
}
