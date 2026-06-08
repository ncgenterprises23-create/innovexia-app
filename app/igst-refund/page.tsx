'use client';

import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, Save, X, Plus, Trash2, Pencil, Search, AlertTriangle, ChevronLeft, ChevronRight, Ban, RotateCcw, Calendar, CheckCircle2, Eye
} from 'lucide-react';

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface IgstRefund {
    id: string;
    Id?: string | number;
    Company_Name: string;
    Shipping_Bill_No: string;
    Shipping_Bill_Date: string;
    Invoice_No: string;
    Igst_Amt: string | number;
    Drawback_Amt: string | number;
    Rod_Tep_Amt: string | number;



    'Timestamp'?: string;
    'Cancelled'?: string;
    _rowIndex: number;
    [key: string]: any;
}

const CONTAINER_TYPES = ["20'", "40'"];
const ITEMS_PER_PAGE = 15;
const emptyForm = { id: '', Company_Name: '', Shipping_Bill_No: '', Shipping_Bill_Date: '', Invoice_No: '', Igst_Amt: '', Drawback_Amt: '', Rod_Tep_Amt: '' };

const EXPORT_STAGES = [
    { step: 1, name: 'CHECK DRAWBACK CREDIT', short: 'DRAWBACK CREDIT' },
    { step: 2, name: 'CHECK THE GST PORTAL TRANMITTED TO ICE GATE', short: 'GST PORTAL' },
    { step: 3, name: 'CHECK ICE GATE IGST VALIDATION', short: 'ICE GATE IGST' },
    { step: 4, name: 'CHECK IGST SCROLL SANCTIONED', short: 'IGST SCROLL' },
    { step: 5, name: 'CHECK IGST CREDIT', short: 'IGST CREDIT' },
    { step: 6, name: 'CHECK RODTEP CREDIT', short: 'RODTEP CREDIT' }
];

const STEP_CHECKLISTS: Record<number, string[]> = {};

type ViewMode = 'data' | 'cancelled' | 'setup';

const formatDisplayDate = (val: any) => {
    if (!val) return '-';
    // Handle Excel/Google Sheets serial numbers
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        const date = new Date((num - 25569) * 86400 * 1000);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Handle standard date strings
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return String(val);
};

const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
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

export default function IgstRefundPage() {
    const [data, setData] = useState<IgstRefund[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('data');
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all'>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<IgstRefund | null>(null);
    const [deletingItem, setDeletingItem] = useState<IgstRefund | null>(null);
    const [cancellingItem, setCancellingItem] = useState<IgstRefund | null>(null);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id: string, name: string } | null>(null);
    const [removeStep, setRemoveStep] = useState<number | 'all'>('all');

    const toast = useToast();
    const loader = useLoader();

    const [form, setForm] = useState<typeof emptyForm>(emptyForm);

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [itemsToMarkDone, setItemsToMarkDone] = useState<Set<string>>(new Set());
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [selectedChecklist, setSelectedChecklist] = useState<Set<string>>(new Set());
    const [isChecklistViewModalOpen, setIsChecklistViewModalOpen] = useState(false);
    const [checklistViewItem, setChecklistViewItem] = useState<IgstRefund | null>(null);
    const [checklistViewStep, setChecklistViewStep] = useState<number | null>(null);
    const [savedChecklistItems, setSavedChecklistItems] = useState<string[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/igst-refund');
            const json = await res.json();
            if (json.data) {
                const sanitized = json.data.filter((d: IgstRefund) => String(d['Shipping_Bill_No'] || '').trim()).map((d: IgstRefund, idx: number) => {
                    const realId = d.id || d.Id || d.ID;
                    return {
                        ...d,
                        id: realId ? String(realId) : `temp-${idx}`
                    };
                });
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
            const res = await fetch('/api/igst-refund-config');
            if (res.ok) {
                const data = await res.json();
                if (data.config && data.config.length > 0) {
                    // Ensure all step names match EXPORT_STAGES
                    const correctedConfig = data.config.map((cfg: StepConfig) => ({
                        ...cfg,
                        stepName: EXPORT_STAGES.find(s => s.step === cfg.step)?.name || cfg.stepName
                    }));
                    setStepConfigs(correctedConfig);
                } else {
                    const defaultConfig = EXPORT_STAGES.map(s => ({
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

    const activeData = useMemo(() => {
        let filtered = data.filter(d =>
            viewMode === 'cancelled'
                ? String(d['Cancelled'] || '').toLowerCase() === 'yes'
                : !d['Cancelled'] || String(d['Cancelled'] || '').toLowerCase() !== 'yes'
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
                for (let s = 1; s <= 6; s++) {
                    if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                    else break;
                }
                if (currentStep > 6) return false;

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

        return filtered;
    }, [data, viewMode, activeStepFilter, activeTimeFilter]);

    const statusStats = useMemo(() => {
        const active = data.filter(d => !d['Cancelled'] || String(d['Cancelled'] || '').toLowerCase() !== 'yes');
        const stats: any = { Total: active.length };
        for (let i = 1; i <= 6; i++) {
            // Count items currently at this step (completed all previous steps, not yet completed this one)
            stats[`Step${i}`] = active.filter(r => {
                // For step 1, check only that Actual_1 is not filled
                if (i === 1) {
                    return !r[`Actual_${i}`];
                }
                // For other steps, check that all previous steps are completed AND current step is not
                let allPreviousCompleted = true;
                for (let j = 1; j < i; j++) {
                    if (!r[`Actual_${j}`]) {
                        allPreviousCompleted = false;
                        break;
                    }
                }
                return allPreviousCompleted && !r[`Actual_${i}`];
            }).length;
        }
        return stats;
    }, [data]);

    const timeStats = useMemo(() => {
        const active = data.filter(d => !d['Cancelled'] || String(d['Cancelled'] || '').toLowerCase() !== 'yes');
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 7': 0, 'Next 15': 0 };
        active.forEach(item => {
            let currentStep = 1;
            for (let s = 1; s <= 6; s++) {
                if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                else break;
            }
            if (currentStep > 6) return;
            const plannedStr = (item as any)[`Planned_${currentStep}`];
            if (!plannedStr) return;
            const pDate = new Date(plannedStr);
            const pTime = pDate.getTime();
            const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
            const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);
            if (pTime < now.getTime()) {
                stats['Delayed']++;
            } else if (diffDays === 0) {
                stats['Today']++;
            } else if (diffDays === 1) {
                stats['Tomorrow']++;
            } else if (diffDays > 1 && diffDays <= 3) {
                stats['Next 3']++;
            } else if (diffDays > 3 && diffDays <= 7) {
                stats['Next 7']++;
            } else if (diffDays > 7 && diffDays <= 15) {
                stats['Next 15']++;
            }
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

    const getNextPlannedTime = (current: Date, value: number, unit: string) => {
        const next = new Date(current);
        if (unit === 'days') {
            let daysAdded = 0;
            while (daysAdded < value) {
                next.setDate(next.getDate() + 1);
                if (next.getDay() !== 0) daysAdded++;
            }
        } else {
            next.setHours(next.getHours() + value);
        }
        if (next.getDay() === 0) next.setDate(next.getDate() + 1);
        return next;
    };

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedItems);
        newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
        setSelectedItems(newSelected);
    };

    const toggleAll = () => {
        setSelectedItems(selectedItems.size === activeData.length ? new Set() : new Set(activeData.map(d => d.id)));
    };

    const getCurrentStep = (item: IgstRefund) => {
        let step = 1;
        for (let s = 1; s <= 6; s++) {
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

                if (itemsToMarkDone.has(item.id) && currentStep <= 6) {
                    updatedData[`Actual_${currentStep}`] = now;
                    updatedData[`Status_${currentStep}`] = 'Completed';

                    // Add checklist items if this step has checklists
                    if (STEP_CHECKLISTS[currentStep]) {
                        const checklistItems = Array.from(selectedChecklist)
                            .filter(key => key.startsWith(`step_${currentStep}_item_`))
                            .map(key => {
                                const itemIndex = parseInt(key.split('_').pop() || '0');
                                return STEP_CHECKLISTS[currentStep][itemIndex];
                            });
                        updatedData[`Checklist_${currentStep}`] = JSON.stringify(checklistItems);
                    }

                    if (currentStep < 6) {
                        const nextStep = currentStep + 1;
                        const nextConfig = stepConfigs.find(c => c.step === nextStep);
                        const nextPlanned = getNextPlannedTime(new Date(now), nextConfig?.tatValue || 24, nextConfig?.tatUnit || 'hours').toISOString();
                        updatedData[`Planned_${nextStep}`] = nextPlanned;
                    }
                }

                return fetch('/api/igst-refund', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData),
                });
            });

            await Promise.all(updatePromises);
            toast.success('Bulk updates applied');
            setItemsToMarkDone(new Set());
            setSelectedItems(new Set());
            setSelectedChecklist(new Set());
            setIsBulkUpdateModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to apply bulk updates');
        } finally {
            loader.hideLoader();
        }
    };

    const handleSave = async () => {
        if (!String(form.Shipping_Bill_No || '').trim()) {
            toast.error('Shipping_Bill_No is required');
            return;
        }

        try {
            loader.showLoader();
            const payload: any = {
                Company_Name: form.Company_Name,
                Shipping_Bill_No: form.Shipping_Bill_No,
                Shipping_Bill_Date: form.Shipping_Bill_Date,
                Invoice_No: form.Invoice_No,
                Igst_Amt: form.Igst_Amt,
                Drawback_Amt: form.Drawback_Amt,
                Rod_Tep_Amt: form.Rod_Tep_Amt,
            };

            const method = editingItem ? 'PUT' : 'POST';
            if (editingItem) payload.id = editingItem.id;

            const res = await fetch('/api/igst-refund', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (res.ok) {
                setIsModalOpen(false);
                setForm(emptyForm);

                fetchData();
                toast.success(editingItem ? 'Updated successfully' : 'Added successfully');
            } else {
                toast.error(result.details || 'Failed to save');
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || 'Error saving');
        } finally {
            loader.hideLoader();
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        try {
            loader.showLoader();
            const res = await fetch('/api/igst-refund', {
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
            loader.hideLoader();
        }
    };

    const handleCancel = async () => {
        if (!cancellingItem) return;
        try {
            loader.showLoader();
            const isCancelled = cancellingItem['Cancelled']?.toLowerCase() === 'yes';
            const res = await fetch('/api/igst-refund', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cancellingItem.id, cancelled: !isCancelled }),
            });
            if (res.ok) {
                setIsCancelModalOpen(false);
                fetchData();
                toast.success(isCancelled ? 'Restored successfully' : 'Cancelled successfully');
            } else {
                toast.error('Operation failed');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error updating status');
        } finally {
            loader.hideLoader();
        }
    };

    const handleRemoveFollowUp = async () => {
        if (!removeTarget) return;
        try {
            loader.showLoader();
            const payload: any = { id: removeTarget.id };

            if (removeStep === 'all') {
                for (let i = 1; i <= 6; i++) {
                    payload[`Actual_${i}`] = '';
                    payload[`Status_${i}`] = '';
                    payload[`Checklist_${i}`] = '';
                    if (i > 1) payload[`Planned_${i}`] = '';
                }
            } else {
                const stepNum = removeStep as number;
                for (let i = 1; i <= 6; i++) {
                    if (i === stepNum) {
                        payload[`Actual_${i}`] = '';
                        payload[`Status_${i}`] = '';
                        payload[`Checklist_${i}`] = '';
                    } else if (i > stepNum) {
                        payload[`Planned_${i}`] = '';
                        payload[`Actual_${i}`] = '';
                        payload[`Status_${i}`] = '';
                        payload[`Checklist_${i}`] = '';
                    }
                }
            }

            const res = await fetch('/api/igst-refund', {
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
        setRemoveTarget({ id, name: name || 'Record ' + id });
        setRemoveStep('all');
        setShowRemoveModal(true);
    };

    const openChecklistViewModal = (item: IgstRefund, step: number) => {
        const checklistKey = `Checklist_${step}` as keyof IgstRefund;
        const checklistData = item[checklistKey] as any;
        let submittedItems: string[] = [];

        if (checklistData) {
            try {
                // Handle both string and array formats
                if (typeof checklistData === 'string') {
                    submittedItems = JSON.parse(checklistData);
                } else if (Array.isArray(checklistData)) {
                    submittedItems = checklistData;
                }
            } catch (e) {
                console.error('Error parsing checklist data:', e);
                submittedItems = [];
            }
        }

        setChecklistViewItem(item);
        setChecklistViewStep(step);
        setSavedChecklistItems(submittedItems);
        setIsChecklistViewModalOpen(true);
    };

    const handleSaveConfig = async () => {
        try {
            loader.showLoader();
            // Ensure all step names are correct from EXPORT_STAGES before saving
            const configToSave = stepConfigs.map(config => ({
                ...config,
                stepName: EXPORT_STAGES.find(s => s.step === config.step)?.name || config.stepName
            }));
            const res = await fetch('/api/igst-refund-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: configToSave }),
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





    const parseProducts = (product: any) => {
        if (typeof product === 'string') {
            try {
                return JSON.parse(product);
            } catch {
                return [];
            }
        }
        return Array.isArray(product) ? product : [];
    };

    const stepGradients = ['from-indigo-50 to-indigo-100', 'from-yellow-50 to-yellow-100', 'from-orange-50 to-orange-100', 'from-pink-50 to-pink-100', 'from-purple-50 to-purple-100', 'from-blue-50 to-blue-100', 'from-teal-50 to-teal-100', 'from-rose-50 to-rose-100', 'from-emerald-50 to-emerald-100', 'from-cyan-50 to-cyan-100', 'from-lime-50 to-lime-100', 'from-red-50 to-red-100', 'from-violet-50 to-violet-100', 'from-amber-50 to-amber-100', 'from-green-50 to-green-100', 'from-sky-50 to-sky-100', 'from-fuchsia-50 to-fuchsia-100'];
    const stepBorders = ['border-indigo-200', 'border-yellow-200', 'border-orange-200', 'border-pink-200', 'border-purple-200', 'border-blue-200', 'border-teal-200', 'border-rose-200', 'border-emerald-200', 'border-cyan-200', 'border-lime-200', 'border-red-200', 'border-violet-200', 'border-amber-200', 'border-green-200', 'border-sky-200', 'border-fuchsia-200'];
    const stepIconBgs = ['from-indigo-500 to-indigo-600', 'from-yellow-500 to-yellow-600', 'from-orange-500 to-orange-600', 'from-pink-500 to-pink-600', 'from-purple-500 to-purple-600', 'from-blue-500 to-blue-600', 'from-teal-500 to-teal-600', 'from-rose-500 to-rose-600', 'from-emerald-500 to-emerald-600', 'from-cyan-500 to-cyan-600', 'from-lime-500 to-lime-600', 'from-red-500 to-red-600', 'from-violet-500 to-violet-600', 'from-amber-500 to-amber-600', 'from-green-500 to-green-600', 'from-sky-500 to-sky-600', 'from-fuchsia-500 to-fuchsia-600'];

    if (loading && data.length === 0) {
        return <LayoutWrapper disableNotifications={true}><div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div></LayoutWrapper>;
    }

    return (
        <LayoutWrapper disableNotifications={true}>
            <div className="p-3 space-y-2">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[var(--theme-primary)]/15 rounded-xl">
                            <Calendar size={22} className="text-[var(--theme-primary)]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wide leading-none">
                                IGST REFUND
                            </h1>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                                IGST REFUND TRACKING
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700">
                        {[
                            { id: 'data' as ViewMode, label: 'Data View', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
                            { id: 'cancelled' as ViewMode, label: 'Cancelled', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                            { id: 'setup' as ViewMode, label: 'Setup', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.36c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
                        ].map((tab) => (
                            <button key={tab.id} onClick={() => switchView(tab.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === tab.id ? 'bg-[var(--theme-primary)] text-gray-900 shadow-lg shadow-[var(--theme-primary)]/25 scale-[1.02]' : 'text-[var(--theme-primary)]/60 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5'}`}>
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                        <div className="w-px h-8 bg-slate-100 dark:bg-slate-700 mx-1" />
                        <button
                            onClick={() => {
                                setEditingItem(null);
                                setForm(emptyForm);

                                setIsModalOpen(true);
                            }}
                            className="bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] p-2.5 rounded-2xl hover:bg-[var(--theme-primary)] hover:text-white transition-all shadow-sm"
                            title="Add New"
                        >
                            <Plus className="w-5 h-5" />
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
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure export workflow steps and turnaround times</p>
                                </div>
                                <button
                                    onClick={handleSaveConfig}
                                    className="bg-[var(--theme-primary)] text-gray-900 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.05] transition-all"
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
                                        {stepConfigs.map((config, index) => {
                                            const stageName = EXPORT_STAGES.find(s => s.step === config.step)?.name || config.stepName;
                                            return (
                                                <tr key={config.step}>
                                                    <td className="px-6 py-4 font-black">#{config.step}</td>
                                                    <td className="px-6 py-4 text-xs font-bold">{stageName}</td>
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
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Step Filter Tiles */}
                            <div className="overflow-x-auto pb-0 scroll-smooth -mx-0 px-4 pt-4 border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/10">
                                <div className="flex gap-2 min-w-max pr-2 pb-4">
                                    {(() => {
                                        const statTiles: any[] = [{ step: 'all', label: 'All Items', value: statusStats.Total }];
                                        EXPORT_STAGES.forEach((s, idx) => {
                                            statTiles.push({ step: s.step, label: (s as any).short || s.name, value: statusStats[`Step${s.step}`] });
                                        });
                                        return statTiles.map((stat, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.03 }}
                                                whileHover={activeStepFilter === stat.step ? { scale: 1 } : { y: -1 }}
                                                onClick={() => {
                                                    const nextStep = activeStepFilter === stat.step ? ('all' as const) : (stat as any).step;
                                                    setActiveStepFilter(nextStep);
                                                    if (nextStep === 'all') setActiveTimeFilter(null);
                                                    setCurrentPage(1);
                                                }}
                                                className={`p-2 rounded-xl border shadow-sm flex items-center gap-2 transition-all min-w-[140px] cursor-pointer ${activeStepFilter === stat.step ? 'ring-2 ring-[var(--theme-primary)] shadow-md opacity-100' : 'opacity-75 hover:opacity-100 hover:-translate-y-px'} ${i === 0 ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200' : `bg-gradient-to-br ${stepGradients[i - 1]} ${stepBorders[i - 1]}`}`}
                                            >
                                                {i > 0 && (
                                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stepIconBgs[i - 1]} flex items-center justify-center flex-shrink-0 shadow-sm text-white`}>
                                                        <span className="text-xs font-bold">{EXPORT_STAGES[i - 1].step}</span>
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-wider truncate opacity-80">{stat.label}</p>
                                                    <p className="text-base font-black text-gray-900 leading-none mt-0.5">{stat.value}</p>
                                                </div>
                                            </motion.div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* Pagination + Filters */}
                            <div className="flex bg-[var(--theme-lighter)]/50 dark:bg-slate-900/50 p-2 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md sticky top-0 z-[20]">
                                <div className="flex-1 flex items-center justify-between px-3">
                                    <div className="flex items-center gap-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                            Showing <span className="text-slate-900 dark:text-white">{activeData.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</span> − <span className="text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, activeData.length)}</span> of <span className="text-slate-900 dark:text-white">{activeData.length}</span>
                                        </p>

                                        {selectedItems.size > 0 && (
                                            <button
                                                onClick={() => setIsBulkUpdateModalOpen(true)}
                                                className="h-8 px-4 rounded-xl bg-[var(--theme-primary)] text-gray-900 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all ml-2"
                                            >
                                                Update Status ({selectedItems.size})
                                            </button>
                                        )}

                                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                            {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                                                <button
                                                    key={filter}
                                                    onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                                                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative ${activeTimeFilter === filter ? 'bg-[var(--theme-primary)] text-gray-900 shadow-md scale-[1.05]' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'}`}
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
                                                            className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${currentPage === i ? 'bg-[var(--theme-primary)] text-gray-900 shadow-md' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}>{i}</button>
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
                                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest w-28 text-center">Actions</th>
                                            <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest w-12 text-center">ID</th>
                                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 dark:border-slate-700">Company Name</th>
                                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">SB No</th>
                                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">SB Date</th>
                                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Invoice No.</th>
                                            <th className="px-4 py-3 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">IGST ₹</th>
                                            <th className="px-4 py-3 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Drawback ₹</th>
                                            <th className="px-4 py-3 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 dark:border-slate-700">RodTEP ₹</th>
                                            {EXPORT_STAGES.map(s => (
                                                <th key={s.step} className="px-3 py-2 text-left border-l border-white/10 min-w-[160px]">
                                                    <div className="flex flex-col leading-tight">
                                                        <span className="text-[9px] opacity-70 font-black">STEP {s.step}</span>
                                                        <span className="text-[10px] font-black uppercase whitespace-nowrap">{(s as any).short || s.name}</span>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-xs">
                                        {loading ? (
                                            <tr><td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-bold">Loading records...</td></tr>
                                        ) : paginatedData.length === 0 ? (
                                            <tr><td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-bold">No records found</td></tr>
                                        ) : paginatedData.map((item, idx) => {

                                            return (
                                                <tr key={item.id || `row-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 group transition-colors">
                                                    <td className="px-3 py-2 text-center border-r border-gray-100 dark:border-gray-700/50">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(item.id)}
                                                            onChange={() => toggleSelection(item.id)}
                                                            className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 checked:bg-[var(--theme-primary)] checked:border-[var(--theme-primary)] transition-all cursor-pointer accent-[var(--theme-primary)]"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                onClick={() => {
                                                                    setEditingItem(item);
                                                                    setForm({
                                                                        id: item.id || '',
                                                                        Company_Name: item.Company_Name || '',
                                                                        Shipping_Bill_No: item.Shipping_Bill_No || '',
                                                                        Shipping_Bill_Date: item.Shipping_Bill_Date || '',
                                                                        Invoice_No: item.Invoice_No || '',
                                                                        Igst_Amt: item.Igst_Amt ? String(item.Igst_Amt) : '',
                                                                        Drawback_Amt: item.Drawback_Amt ? String(item.Drawback_Amt) : '',
                                                                        Rod_Tep_Amt: item.Rod_Tep_Amt ? String(item.Rod_Tep_Amt) : '',
                                                                    });
                                                                    setIsModalOpen(true);
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 rounded-lg transition-colors" title="Edit">
                                                                <Pencil size={13} />
                                                            </motion.button>
                                                            {viewMode !== 'cancelled' ? (
                                                                <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                    onClick={() => { setCancellingItem(item); setIsCancelModalOpen(true); }}
                                                                    className="p-1 text-orange-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors" title="Cancel">
                                                                    <Ban size={13} />
                                                                </motion.button>
                                                            ) : (
                                                                <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                    onClick={() => { setCancellingItem(item); setIsCancelModalOpen(true); }}
                                                                    className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors" title="Restore">
                                                                    <RotateCcw size={13} />
                                                                </motion.button>
                                                            )}
                                                            <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                onClick={() => openRemoveModal(item.id, item.Shipping_Bill_No)}
                                                                className="p-1 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors" title="Reset Steps">
                                                                <RotateCcw size={13} />
                                                            </motion.button>
                                                            <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                                onClick={() => { setDeletingItem(item); setIsDeleteModalOpen(true); }}
                                                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                                                                <Trash2 size={13} />
                                                            </motion.button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="text-[11px] font-black text-slate-600 dark:text-slate-300">{item.id}</div>
                                                    </td>
                                                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-700 max-w-[160px]">
                                                        <span className="font-bold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2">{item.Company_Name}</span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.Shipping_Bill_No}</span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{formatDisplayDate(item.Shipping_Bill_Date)}</span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.Invoice_No || '-'}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">{item.Igst_Amt || '-'}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className="text-[11px] font-bold text-green-700 dark:text-green-300">{item.Drawback_Amt || '-'}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right border-r border-slate-100 dark:border-slate-700">
                                                        <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">{item.Rod_Tep_Amt || '-'}</span>
                                                    </td>
                                                    {EXPORT_STAGES.map(s => {
                                                        const planned = item[`Planned_${s.step}` as keyof IgstRefund] as string;
                                                        const actual = item[`Actual_${s.step}` as keyof IgstRefund] as string;
                                                        const delay = getDelayInfo(planned, actual);
                                                        const hasChecklist = STEP_CHECKLISTS[s.step];
                                                        const checklistData = hasChecklist ? item[`Checklist_${s.step}` as keyof IgstRefund] as string : null;

                                                        return (
                                                            <td key={s.step} className="px-3 py-2 border-l border-slate-50 dark:border-slate-700">
                                                                <div className="flex flex-col gap-1 text-[9px]">
                                                                    {planned && (
                                                                        <div className="text-slate-400">
                                                                            <span className="font-black">P:</span> {formatDateTime(planned)}
                                                                        </div>
                                                                    )}
                                                                    {actual ? (
                                                                        <>
                                                                            <div className="text-emerald-600 dark:text-emerald-400 font-black">
                                                                                ✓ {formatDateTime(actual)}
                                                                            </div>
                                                                            {delay && <div className={delay.color}>{delay.text}</div>}
                                                                            {hasChecklist && checklistData && (
                                                                                <motion.button
                                                                                    whileHover={{ scale: 1.2 }}
                                                                                    whileTap={{ scale: 0.9 }}
                                                                                    onClick={() => openChecklistViewModal(item, s.step)}
                                                                                    className="p-1 w-fit text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 rounded-lg transition-colors"
                                                                                    title="View Checklist Items"
                                                                                >
                                                                                    <Eye size={12} />
                                                                                </motion.button>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {delay && <div className={delay.color}>{delay.text}</div>}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Modals */}
                <AnimatePresence>
                    {isModalOpen && (
                        <Fragment key="modal-export-fms">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100">
                                    <div className="p-5 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary)]/80 text-gray-900 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-white/20 rounded-lg">
                                                <Calendar size={18} />
                                            </div>
                                            <h2 className="text-base font-black uppercase tracking-tight">{editingItem ? 'Edit Export Order' : 'Add New Export Order'}</h2>
                                        </div>
                                        <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={16} /></button>
                                    </div>

                                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className="block text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">Company Name <span className="text-red-500">*</span></label>
                                            <input type="text" value={form.Company_Name} onChange={(e) => setForm({ ...form, Company_Name: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm transition-all" placeholder="Enter Company Name" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">Shipping Bill No <span className="text-red-500">*</span></label>
                                            <input type="text" value={form.Shipping_Bill_No} onChange={(e) => setForm({ ...form, Shipping_Bill_No: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm transition-all" placeholder="Enter Shipping Bill No" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">Shipping Bill Date</label>
                                            <input type="date" value={form.Shipping_Bill_Date} onChange={(e) => setForm({ ...form, Shipping_Bill_Date: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm transition-all" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">Invoice No.</label>
                                            <input type="text" value={form.Invoice_No} onChange={(e) => setForm({ ...form, Invoice_No: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm transition-all" placeholder="Enter Invoice No" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">IGST Amount</label>
                                            <input type="number" value={form.Igst_Amt} onChange={(e) => setForm({ ...form, Igst_Amt: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm transition-all" placeholder="Enter IGST Amount" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">Drawback Amount</label>
                                            <input type="number" value={form.Drawback_Amt} onChange={(e) => setForm({ ...form, Drawback_Amt: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm transition-all" placeholder="Enter Drawback Amount" />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className="block text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-1">ROD TEP Amount</label>
                                            <input type="number" value={form.Rod_Tep_Amt} onChange={(e) => setForm({ ...form, Rod_Tep_Amt: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm transition-all" placeholder="Enter ROD TEP Amount" />
                                        </div>

                                        <div className="pt-4 flex gap-2 justify-end border-t border-gray-200 dark:border-gray-700">
                                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 font-black text-[10px] uppercase tracking-widest text-gray-700 dark:text-gray-300 transition-all">
                                                Cancel
                                            </button>
                                            <button type="submit" className="px-6 py-2.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/90 text-gray-900 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all">
                                                <Save className="w-4 h-4" /> Save
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        </Fragment>
                    )}

                    {isDeleteModalOpen && (
                        <Fragment key="modal-delete">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setIsDeleteModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100">
                                    <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-white/20 rounded-lg">
                                                <Trash2 size={18} />
                                            </div>
                                            <h2 className="text-base font-black uppercase tracking-tight">Delete Record</h2>
                                        </div>
                                        <button onClick={() => setIsDeleteModalOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={16} /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                                            Are you sure you want to delete PI Number <strong>{deletingItem?.Shipping_Bill_No}</strong>? This action cannot be undone.
                                        </p>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 font-black text-[10px] uppercase tracking-widest text-gray-700 dark:text-gray-300 transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={handleDelete} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </Fragment>
                    )}

                    {isCancelModalOpen && (
                        <Fragment key="modal-cancel">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setIsCancelModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100">
                                    <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-white/20 rounded-lg">
                                                <AlertTriangle size={18} />
                                            </div>
                                            <h2 className="text-base font-black uppercase tracking-tight">{cancellingItem?.['Cancelled']?.toLowerCase() === 'yes' ? 'Restore Record' : 'Cancel Record'}</h2>
                                        </div>
                                        <button onClick={() => setIsCancelModalOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={16} /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                                            Are you sure you want to {cancellingItem?.['Cancelled']?.toLowerCase() === 'yes' ? 'restore' : 'cancel'} PI Number <strong>{cancellingItem?.Shipping_Bill_No}</strong>?
                                        </p>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setIsCancelModalOpen(false)} className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 font-black text-[10px] uppercase tracking-widest text-gray-700 dark:text-gray-300 transition-all">
                                                No, Keep It
                                            </button>
                                            <button onClick={handleCancel} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                                Yes, {cancellingItem?.['Cancelled']?.toLowerCase() === 'yes' ? 'Restore' : 'Cancel'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </Fragment>
                    )}

                    {showRemoveModal && (
                        <Fragment key="modal-remove">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowRemoveModal(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100">
                                    <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-white/20 rounded-lg">
                                                <RotateCcw size={18} />
                                            </div>
                                            <h2 className="text-base font-black uppercase tracking-tight">Reset Steps</h2>
                                        </div>
                                        <button onClick={() => setShowRemoveModal(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={16} /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                                            Remove follow-up details for <strong>{removeTarget?.name}</strong>
                                        </p>
                                        <select value={removeStep} onChange={(e) => setRemoveStep(e.target.value === 'all' ? 'all' : parseInt(e.target.value))} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm">
                                            <option value="all">All Steps</option>
                                            {EXPORT_STAGES.map(s => (
                                                <option key={s.step} value={s.step}>Step {s.step}: {(s as any).short || s.name}</option>
                                            ))}
                                        </select>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setShowRemoveModal(false)} className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 font-black text-[10px] uppercase tracking-widest text-gray-700 dark:text-gray-300 transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={handleRemoveFollowUp} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                                Reset Steps
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </Fragment>
                    )}

                    {isBulkUpdateModalOpen && (
                        <Fragment key="modal-bulk-update">
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
                                        <button onClick={() => {
                                            setIsBulkUpdateModalOpen(false);
                                            setSelectedChecklist(new Set());
                                        }} className="p-2 hover:bg-white/20 rounded-xl transition-all hover:rotate-90"><X size={20} /></button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
                                        {EXPORT_STAGES.map(stage => {
                                            const stageItems = data.filter(d => selectedItems.has(d.id) && getCurrentStep(d) === stage.step);
                                            if (stageItems.length === 0) return null;

                                            return (
                                                <div key={stage.step} className="space-y-4">
                                                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1 h-8 rounded-full bg-[var(--theme-primary)] shadow-[0_0_12px_var(--theme-primary)]" />
                                                            <div>
                                                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Step {stage.step}: {(stage as any).short || stage.name}</h3>
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
                                                                            <h4 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight truncate">{item.Shipping_Bill_No}</h4>
                                                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 truncate">{item['Party Name']}</p>
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

                                                    {STEP_CHECKLISTS[stage.step] && stageItems.some(i => itemsToMarkDone.has(i.id)) && (
                                                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                                            <h4 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight mb-3">Checklist Items for Step {stage.step}</h4>
                                                            <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                                                {STEP_CHECKLISTS[stage.step].map((checkItem, idx) => {
                                                                    const checklistKey = `step_${stage.step}_item_${idx}`;
                                                                    return (
                                                                        <label key={checklistKey} className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedChecklist.has(checklistKey)}
                                                                                onChange={(e) => {
                                                                                    const newSet = new Set(selectedChecklist);
                                                                                    if (e.target.checked) newSet.add(checklistKey);
                                                                                    else newSet.delete(checklistKey);
                                                                                    setSelectedChecklist(newSet);
                                                                                }}
                                                                                className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 checked:bg-[var(--theme-primary)] checked:border-[var(--theme-primary)] transition-all cursor-pointer accent-[var(--theme-primary)]"
                                                                            />
                                                                            <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">{checkItem}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="p-5 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                                        <button onClick={() => {
                                            setIsBulkUpdateModalOpen(false);
                                            setSelectedChecklist(new Set());
                                        }}
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
                        </Fragment>
                    )}

                    {/* Checklist View Modal */}
                    {isChecklistViewModalOpen && (
                        <Fragment key="modal-checklist-view">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setIsChecklistViewModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]" />
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100">
                                    <div className="p-5 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary)]/80 text-gray-900 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-white/20 rounded-lg">
                                                <Eye size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <h2 className="text-base font-black uppercase tracking-tight">Checklist Items</h2>
                                                <p className="text-xs text-gray-800 font-semibold">Step {checklistViewStep}: {EXPORT_STAGES.find(s => s.step === checklistViewStep)?.name}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsChecklistViewModalOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={16} /></button>
                                    </div>

                                    <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                                        {(() => {
                                            const allItems = checklistViewStep && STEP_CHECKLISTS[checklistViewStep] ? STEP_CHECKLISTS[checklistViewStep] : [];

                                            if (allItems.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                                        <AlertTriangle size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">No checklist items configured for this step</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-2">
                                                    {allItems.map((item, idx) => {
                                                        const isSubmitted = savedChecklistItems.includes(item);
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isSubmitted
                                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                                                        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'
                                                                    }`}
                                                            >
                                                                <div className={`p-1 rounded-lg mt-0.5 flex-shrink-0 ${isSubmitted
                                                                        ? 'bg-emerald-100 dark:bg-emerald-900'
                                                                        : 'bg-slate-200 dark:bg-slate-700'
                                                                    }`}>
                                                                    <CheckCircle2
                                                                        size={14}
                                                                        className={isSubmitted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}
                                                                    />
                                                                </div>
                                                                <span className={`text-sm font-medium leading-snug ${isSubmitted
                                                                        ? 'text-emerald-900 dark:text-emerald-100'
                                                                        : 'text-slate-600 dark:text-slate-400'
                                                                    }`}>
                                                                    {item}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex gap-3">
                                        <button onClick={() => setIsChecklistViewModalOpen(false)}
                                            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </Fragment>
                    )}
                </AnimatePresence>
            </div>
        </LayoutWrapper>
    );
}
