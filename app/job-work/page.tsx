'use client';

import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, Save, X, Plus, Trash2, Pencil, Search, History, AlertTriangle, ClipboardCheck, ArrowRight,
    Filter, LayoutGrid, List, CheckCircle2, Download, Trash, ChevronLeft, ChevronRight, Ban, RotateCcw,
    Users, Package, MessageSquareWarning, Calendar
} from 'lucide-react';

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface JobWork {
    id: string;
    'group-id'?: string;
    'Job Work Name': string;
    'Vendor Name': string;
    'Item Name': string;
    'Qty Of Material To Be Sent In Kg'?: number | string;
    'Qty Material To Be Sent In Pcs'?: number | string;
    'Timestamp'?: string;
    'Cancelled'?: string;
    _rowIndex: number;
    Planned_1?: string; Actual_1?: string; Status_1?: string; lead_time_1?: string; remark_1?: string;
    Planned_2?: string; Actual_2?: string; Status_2?: string;
    Planned_3?: string; Actual_3?: string; Status_3?: string;
    Planned_4?: string; Actual_4?: string; Status_4?: string;
    Planned_5?: string; Actual_5?: string; Status_5?: string;
    Planned_6?: string; Actual_6?: string; Status_6?: string;
    Planned_7?: string; Actual_7?: string; Status_7?: string;
    Planned_8?: string; Actual_8?: string; Status_8?: string;
    Planned_9?: string; Actual_9?: string; Status_9?: string;
    Planned_10?: string; Actual_10?: string; Status_10?: string;
    Planned_11?: string; Actual_11?: string; Status_11?: string;
}

const JOB_STAGES = [
    { step: 1, name: 'Talk Vendor', icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z', color: 'from-orange-50 to-orange-100', border: 'border-orange-200', iconBg: 'from-orange-500 to-orange-600' },
    { step: 2, name: 'Inform Govind', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: 'from-blue-50 to-blue-100', border: 'border-blue-200', iconBg: 'from-blue-500 to-blue-600' },
    { step: 3, name: 'Accounts', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', color: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200', iconBg: 'from-emerald-500 to-emerald-600' },
    { step: 4, name: 'Follow Up 1', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-pink-50 to-pink-100', border: 'border-pink-200', iconBg: 'from-pink-500 to-pink-600' },
    { step: 5, name: 'Follow Up 2', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-purple-50 to-purple-100', border: 'border-purple-200', iconBg: 'from-purple-500 to-purple-600' },
    { step: 6, name: 'Receive Stock', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'from-amber-50 to-amber-100', border: 'border-amber-200', iconBg: 'from-amber-500 to-amber-600' },
    { step: 7, name: 'Account Process', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', color: 'from-cyan-50 to-cyan-100', border: 'border-cyan-200', iconBg: 'from-cyan-500 to-cyan-600' },
    { step: 8, name: 'Receive Stock 2', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', iconBg: 'from-yellow-500 to-yellow-600' },
    { step: 9, name: 'Account Process 2', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', color: 'from-teal-50 to-teal-100', border: 'border-teal-200', iconBg: 'from-teal-500 to-teal-600' },
    { step: 10, name: 'Receive Stock 3', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'from-rose-50 to-rose-100', border: 'border-rose-200', iconBg: 'from-rose-500 to-rose-600' },
    { step: 11, name: 'Account Process 3', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', color: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', iconBg: 'from-indigo-500 to-indigo-600' },
];

const ITEMS_PER_PAGE = 15;
const STANDARD_JOB_WORKS = [
    "POWDER COATING", "ANODISING", "CARTON CHANGE", "ZINC PLATING",
    "LEG RIBIT TOOL", "CUBE HOLE DIE", "NORML HOLE DIE", "NORMAL STANDEE SIDE PLATE TOOL"
];
const emptyCommonFields = { jobWorkName: '', vendorName: '', customJobWorkName: '' };
const emptyItemRow = { itemName: '', qtyKg: '', qtyPcs: '' };
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

export default function JobWorkPage() {
    const [data, setData] = useState<JobWork[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('data');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all'>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [isRemoveStepModalOpen, setIsRemoveStepModalOpen] = useState(false);

    const [editingItem, setEditingItem] = useState<JobWork | null>(null);
    const [deletingItem, setDeletingItem] = useState<JobWork | null>(null);
    const [cancellingItem, setCancellingItem] = useState<JobWork | null>(null);
    const [removeStepTarget, setRemoveStepTarget] = useState<JobWork | null>(null);
    const [removeStep, setRemoveStep] = useState<'all' | number>('all');

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [itemsToMarkDone, setItemsToMarkDone] = useState<Set<string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Record<string, { lead_time_1?: string; remark_1?: string }>>({});
    const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);

    const toast = useToast();
    const loader = useLoader();

    const [rows, setRows] = useState([emptyItemRow]);
    const [commonFields, setCommonFields] = useState(emptyCommonFields);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const calendarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/job-work');
            const json = await res.json();
            if (json.data) {
                setData(json.data.map((d: any, idx: number) => ({
                    ...d,
                    id: d.id ? String(d.id) : `temp-${idx}`
                })));
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
            const res = await fetch('/api/job-work-config');
            if (res.ok) {
                const data = await res.json();
                if (data.config && data.config.length > 0) {
                    setStepConfigs(data.config);
                } else {
                    const defaultConfig = JOB_STAGES.map(s => ({
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

    const calendarCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(item => {
            if (item['Cancelled']?.trim().toLowerCase() === 'yes') return;

            let currentStep = 1;
            for (let s = 1; s <= 11; s++) {
                if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                else break;
            }
            if (currentStep > 11) return;

            const plannedStr = (item as any)[`Planned_${currentStep}`];
            if (plannedStr) {
                const pDate = new Date(plannedStr);
                if (!isNaN(pDate.getTime())) {
                    const dateKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
                    counts[dateKey] = (counts[dateKey] || 0) + 1;
                }
            }
        });
        return counts;
    }, [data]);

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
                for (let s = 1; s <= 11; s++) {
                    if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                    else break;
                }
                if (currentStep > 11) return false;

                const plannedStr = (item as any)[`Planned_${currentStep}`];
                if (!plannedStr) return false;

                const pDate = new Date(plannedStr);
                const pTime = pDate.getTime();
                const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
                const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);

                if (activeTimeFilter.startsWith('Date:')) {
                    const targetDateStr = activeTimeFilter.split(':')[1];
                    const targetDate = new Date(targetDateStr);
                    const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
                    return pDayStart === targetDayStart;
                }

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

        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(d =>
                d['Job Work Name']?.toLowerCase().includes(lowSearch) ||
                d['Vendor Name']?.toLowerCase().includes(lowSearch) ||
                d['Item Name']?.toLowerCase().includes(lowSearch)
            );
        }

        return filtered;
    }, [data, viewMode, activeStepFilter, activeTimeFilter, searchTerm]);

    const statusStats = useMemo(() => {
        const active = data.filter(d => !d['Cancelled'] || d['Cancelled'].trim().toLowerCase() !== 'yes');
        const stats: any = { Total: active.length };
        for (let i = 1; i <= 11; i++) {
            stats[`Step${i}`] = active.filter(r => {
                const isDone = !!(r as any)[`Actual_${i}`];
                const isPrevDone = i === 1 || !!(r as any)[`Actual_${i - 1}`];
                return !isDone && isPrevDone;
            }).length;
        }
        return stats;
    }, [data]);

    const timeStats = useMemo(() => {
        const active = data.filter(d => !d['Cancelled'] || d['Cancelled'].trim().toLowerCase() !== 'yes');
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 7': 0, 'Next 15': 0 };
        active.forEach(item => {
            let currentStep = 1;
            for (let s = 1; s <= 11; s++) {
                if ((item as any)[`Actual_${s}`]) currentStep = s + 1;
                else break;
            }
            if (currentStep > 11) return;
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

    const getCurrentStep = (item: JobWork) => {
        let step = 1;
        for (let s = 1; s <= 11; s++) {
            if ((item as any)[`Actual_${s}`]) step = s + 1;
            else break;
        }
        return step;
    };

    const getNextPlannedTime = (current: Date, value: number | string, unit: string) => {
        const next = new Date(current);
        const numericValue = Number(value);
        if (unit === 'days') {
            next.setDate(next.getDate() + numericValue);
        } else {
            next.setHours(next.getHours() + numericValue);
        }

        // Skip Sunday
        if (next.getDay() === 0) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    };

    const totalPages = Math.max(1, Math.ceil(activeData.length / ITEMS_PER_PAGE));
    const paginatedData = activeData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const validRows = rows.filter(r => r.itemName.trim() || r.qtyKg || r.qtyPcs);
        
        const finalJobWorkName = commonFields.jobWorkName === 'Other' 
            ? commonFields.customJobWorkName?.trim() 
            : commonFields.jobWorkName?.trim();

        if (!finalJobWorkName) return toast.error('Job Work Name is required');
        if (validRows.length === 0) return toast.error('At least one item is required');

        setIsSaving(true);
        try {
            const method = editingItem ? 'PUT' : 'POST';
            const { customJobWorkName, ...restCommonFields } = commonFields;
            const payloadCommonFields = {
                ...restCommonFields,
                jobWorkName: finalJobWorkName
            };

            const payload = editingItem
                ? {
                    id: editingItem.id,
                    ...payloadCommonFields,
                    'Item Name': validRows[0].itemName,
                    'Qty Of Material To Be Sent In Kg': validRows[0].qtyKg,
                    'Qty Material To Be Sent In Pcs': validRows[0].qtyPcs
                }
                : validRows.map(row => ({
                    ...payloadCommonFields,
                    'Item Name': row.itemName,
                    'Qty Of Material To Be Sent In Kg': row.qtyKg,
                    'Qty Material To Be Sent In Pcs': row.qtyPcs
                }));

            const res = await fetch('/api/job-work', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setIsModalOpen(false);
                fetchData();
                toast.success(editingItem ? 'Updated successfully' : `Added ${validRows.length} items`);
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
            const res = await fetch('/api/job-work', {
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

    const handleBulkUpdate = async () => {
        if (selectedItems.size === 0) return;
        setIsSaving(true);
        try {
            const currentTime = new Date();
            const updatePromises = Array.from(selectedItems).map(id => {
                const item = data.find(d => d.id === id);
                if (!item) return Promise.resolve();
                const currentStep = getCurrentStep(item);
                if (currentStep > 11) return Promise.resolve();

                const updatedData: any = { id };

                // Only mark done if this item was toggled
                if (itemsToMarkDone.has(id) && currentStep <= 11) {
                    updatedData[`Actual_${currentStep}`] = currentTime.toISOString();
                    updatedData[`Status_${currentStep}`] = 'Done';

                    // Add lead_time_1 and remark_1 if it's step 1
                    if (currentStep === 1) {
                        if (bulkUpdates[id]?.lead_time_1) {
                            updatedData.lead_time_1 = bulkUpdates[id].lead_time_1;
                        }
                        if (bulkUpdates[id]?.remark_1) {
                            updatedData.remark_1 = bulkUpdates[id].remark_1;
                        }
                    }

                    // Auto-plan next step using TAT config
                    if (currentStep < 11) {
                        const nextStep = currentStep + 1;
                        let duration = 0;
                        let unit: 'hours' | 'days' = 'hours';

                        if (currentStep === 1) {
                            // Specifically for Step 1 -> Step 2, use lead_time_1 in days (minus 2 as per requirement)
                            const lt1 = bulkUpdates[id]?.lead_time_1 || (item as any).lead_time_1 || 0;
                            duration = Math.max(0, Number(lt1) - 2);
                            unit = 'days';
                        } else {
                            const nextConfig = stepConfigs.find(c => c.step === nextStep);
                            duration = nextConfig?.tatValue || 24;
                            unit = nextConfig?.tatUnit || 'hours';
                        }

                        const nextPlanned = getNextPlannedTime(currentTime, duration, unit);
                        updatedData[`Planned_${nextStep}`] = nextPlanned.toISOString();
                    }
                }

                return fetch('/api/job-work', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
            });

            await Promise.all(updatePromises);
            toast.success(`Bulk update applied to ${itemsToMarkDone.size} items`);
            setItemsToMarkDone(new Set());
            setSelectedItems(new Set());
            setBulkUpdates({});
            setIsBulkUpdateModalOpen(false);
            fetchData();
        } catch (e) {
            console.error(e);
            toast.error('Bulk update failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveStep = async () => {
        if (!removeStepTarget) return;
        setIsSaving(true);
        try {
            const updates: any = {};
            if (removeStep === 'all') {
                for (let s = 1; s <= 11; s++) {
                    updates[`Actual_${s}`] = '';
                    updates[`Status_${s}`] = '';
                    if (s > 1) updates[`Planned_${s}`] = '';
                }
                updates.lead_time_1 = '';
                updates.remark_1 = '';
            } else {
                const stepNum = removeStep as number;
                for (let s = 1; s <= 11; s++) {
                    if (s === stepNum) {
                        updates[`Actual_${s}`] = '';
                        updates[`Status_${s}`] = '';
                        if (s === 1) {
                            updates.lead_time_1 = '';
                            updates.remark_1 = '';
                        }
                    } else if (s > stepNum) {
                        updates[`Actual_${s}`] = '';
                        updates[`Status_${s}`] = '';
                        updates[`Planned_${s}`] = '';
                    }
                }
            }

            const res = await fetch('/api/job-work', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: removeStepTarget.id, ...updates })
            });
            if (res.ok) {
                toast.success('Step data removed successfully');
                setIsRemoveStepModalOpen(false);
                setRemoveStepTarget(null);
                setRemoveStep('all');
                fetchData();
            } else {
                toast.error('Failed to remove step data');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error removing step data');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/job-work-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: stepConfigs })
            });
            if (res.ok) {
                toast.success('Configuration saved');
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to save configuration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = async () => {
        if (!cancellingItem) return;
        setIsCancelling(true);
        const isCancelled = cancellingItem['Cancelled']?.toLowerCase() === 'yes';
        try {
            const res = await fetch('/api/job-work', {
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
            setIsCancelling(false);
        }
    };

    const handleExportCSV = () => {
        if (data.length === 0) {
            toast.error("No data available to export");
            return;
        }

        const formatCSVValue = (val: any) => {
            if (!val) return '';
            if (typeof val === 'string') {
                if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(val)) {
                    return new Date(val).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                    });
                }
            }
            return String(val);
        };

        const headers = Object.keys(data[0]).filter(key => key !== 'id' && key !== '_rowIndex');

        const csvRows = [];
        csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

        for (const row of data) {
            const values = headers.map(header => {
                const val = (row as any)[header];
                const formattedVal = formatCSVValue(val);
                const escaped = String(formattedVal).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `job_work_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <LayoutWrapper>
            <div className="p-4 space-y-4">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[var(--theme-primary)]/15 rounded-xl">
                            <ClipboardCheck size={22} className="text-[var(--theme-primary)]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wide leading-none">
                                Job Work
                            </h1>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                                Management and Tracking
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700">
                        <button
                            onClick={() => { setViewMode('data'); setCurrentPage(1); }}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'data' ? 'bg-[var(--theme-primary)] text-gray-900 shadow-md' : 'text-gray-500 hover:text-[var(--theme-primary)]'}`}
                        >
                            <List size={14} /> Data View
                        </button>
                        <button
                            onClick={() => { setViewMode('cancelled'); setCurrentPage(1); }}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'cancelled' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:text-red-500'}`}
                        >
                            <Ban size={14} /> Cancelled View
                        </button>
                        <button
                            onClick={() => { setViewMode('setup'); setCurrentPage(1); }}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'setup' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-500 hover:text-indigo-500'}`}
                        >
                            <LayoutGrid size={14} /> Setup
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all text-gray-500 hover:text-green-600 hover:bg-green-50"
                        >
                            <Download size={14} /> Export
                        </button>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                        <button
                            onClick={() => {
                                setEditingItem(null);
                                setCommonFields(emptyCommonFields);
                                setRows([{ ...emptyItemRow }]);
                                setIsModalOpen(true);
                            }}
                            className="bg-[var(--theme-primary)] text-gray-900 p-2.5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--theme-primary)]/20"
                            title="Add New"
                        >
                            <Plus size={22} />
                        </button>
                    </div>
                </div>






                {/* Search and Table Section — Search Removed */}
                {viewMode !== 'setup' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-700/50">
                        {/* Summary Tiles Inside Container */}
                        <div className="overflow-x-auto pb-0 scroll-smooth -mx-0 px-4 pt-4 border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/10">
                            <div className="flex gap-2 min-w-max pr-2 pb-4">
                                <motion.div
                                    whileHover={{ y: -1 }}
                                    onClick={() => setActiveStepFilter('all')}
                                    className={`bg-gradient-to-br from-slate-50 to-slate-100 p-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 transition-all min-w-[140px] cursor-pointer ${activeStepFilter === 'all'
                                        ? 'ring-2 ring-[var(--theme-primary)] shadow-md opacity-100'
                                        : 'opacity-75 hover:opacity-100'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center flex-shrink-0 shadow-sm text-white`}>
                                        <List size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-wider truncate opacity-80">Total Active</p>
                                        <p className="text-base font-black text-gray-900 leading-none mt-0.5">{statusStats.Total}</p>
                                    </div>
                                </motion.div>

                                {JOB_STAGES.map((stat, i) => (
                                    <motion.div
                                        key={i}
                                        whileHover={activeStepFilter === stat.step ? { scale: 1 } : { y: -1 }}
                                        onClick={() => {
                                            const nextStep = activeStepFilter === stat.step ? 'all' : stat.step;
                                            setActiveStepFilter(nextStep);
                                            setCurrentPage(1);
                                        }}
                                        className={`bg-gradient-to-br ${stat.color} p-2 rounded-xl border ${stat.border} shadow-sm flex items-center gap-2 transition-all min-w-[140px] cursor-pointer ${activeStepFilter === stat.step
                                            ? 'ring-2 ring-[var(--theme-primary)] shadow-md opacity-100'
                                            : 'opacity-75 hover:opacity-100 hover:-translate-y-px'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm text-white`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={stat.icon} /></svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[8px] font-black text-gray-500 uppercase tracking-wider truncate opacity-80">{stat.name}</p>
                                            <p className="text-base font-black text-gray-900 leading-none mt-0.5">{statusStats[`Step${stat.step}`] || 0}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Pagination Row — above header, combined with filters */}
                        <div className="flex bg-slate-50/50 dark:bg-slate-900/50 p-2 border-b border-slate-50 dark:border-slate-800 backdrop-blur-md sticky top-0 z-[30]">
                            <div className="flex-1 flex items-center justify-between px-3">
                                <div className="flex items-center gap-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        Showing{' '}
                                        <span className="text-slate-900 dark:text-white">{activeData.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</span>
                                        {' – '}
                                        <span className="text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, activeData.length)}</span>
                                        {' of '}
                                        <span className="text-slate-900 dark:text-white">{activeData.length}</span>
                                    </p>

                                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                            {['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'].map((filter) => (
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
                                                        <sup className={`ml-1 text-[8px] ${activeTimeFilter === filter ? 'text-gray-900' : (filter === 'Delayed' ? 'text-red-500' : 'text-emerald-500')}`}>
                                                            {timeStats[filter as keyof typeof timeStats]}
                                                        </sup>
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="h-3 w-px bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
                                        <div className="relative flex items-center shrink-0" ref={calendarRef}>
                                            <button
                                                type="button"
                                                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer outline-none ${activeTimeFilter?.startsWith('Date:') ? 'bg-[var(--theme-primary)] text-gray-900 border-[var(--theme-primary)] shadow-md scale-[1.05]' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'}`}
                                            >
                                                <Calendar size={12} />
                                                {activeTimeFilter?.startsWith('Date:') 
                                                    ? new Date(activeTimeFilter.split(':')[1]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) 
                                                    : 'Select Date'}
                                            </button>

                                            <AnimatePresence>
                                                {isCalendarOpen && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: -10, scale: 0.95 }}
                                                        animate={{ opacity: 1, x: 0, scale: 1 }}
                                                        exit={{ opacity: 0, x: -10, scale: 0.95 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="absolute left-[100%] ml-3 top-0 z-[99] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-5 w-80"
                                                    >
                                                        <div className="flex items-center justify-between mb-4">
                                                            <button
                                                                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                                                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                            >
                                                                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                            </button>
                                                            <span className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                                                                {calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                                            </span>
                                                            <button
                                                                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                                                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                            >
                                                                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                                                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                                                <div key={day} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{day}</div>
                                                            ))}
                                                        </div>

                                                        <div className="grid grid-cols-7 gap-1">
                                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
                                                                <div key={`empty-${i}`} />
                                                            ))}
                                                            {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                                                const day = i + 1;
                                                                const dateKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                                const count = calendarCounts[dateKey] || 0;
                                                                const isSelected = activeTimeFilter === `Date:${dateKey}`;
                                                                const isToday = new Date().toDateString() === new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day).toDateString();

                                                                return (
                                                                    <button
                                                                        key={day}
                                                                        onClick={() => {
                                                                            setActiveTimeFilter(`Date:${dateKey}`);
                                                                            setCurrentPage(1);
                                                                            setIsCalendarOpen(false);
                                                                        }}
                                                                        className={`relative h-10 w-10 rounded-lg text-sm flex items-center justify-center transition-all ${isSelected ? 'bg-[var(--theme-primary)] text-gray-900 font-bold shadow-md' : isToday ? 'bg-gray-100 dark:bg-gray-700 text-[var(--theme-primary)] font-bold' : count > 0 ? 'bg-[var(--theme-primary)]/15 text-[var(--theme-primary)] font-bold border border-[var(--theme-primary)]/30 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium'}`}
                                                                    >
                                                                        {day}
                                                                        {count > 0 && (
                                                                            <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black shadow-sm ${isSelected ? 'bg-white text-[var(--theme-primary)]' : 'bg-[var(--theme-primary)] text-gray-900'}`}>
                                                                                {count}
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        {activeTimeFilter?.startsWith('Date:') && (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                                <button
                                                                    onClick={() => { setActiveTimeFilter(null); setIsCalendarOpen(false); }}
                                                                    className="w-full py-1.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                                >
                                                                    Clear Selection
                                                                </button>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {selectedItems.size > 0 && (
                                        <>
                                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
                                                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{selectedItems.size} Selected</span>
                                                    <button
                                                        onClick={() => setSelectedItems(new Set())}
                                                        className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 rounded-md text-emerald-500 transition-colors"
                                                        title="Clear Selection"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => setIsBulkUpdateModalOpen(true)}
                                                    className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                                                >
                                                    <CheckCircle2 size={13} />
                                                    Update Details
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-[9px] font-black uppercase tracking-tighter rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-all border border-slate-100 dark:border-slate-700"
                                    >
                                        First
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-[9px] font-black uppercase tracking-tighter rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-all border border-slate-100 dark:border-slate-700"
                                    >
                                        Prev
                                    </button>
                                    <div className="px-3 py-1.5 text-[10px] font-black bg-[var(--theme-primary)] text-gray-900 rounded-lg shadow-sm border border-[var(--theme-primary)]">
                                        {currentPage}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-[9px] font-black uppercase tracking-tighter rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-all border border-slate-100 dark:border-slate-700"
                                    >
                                        Next
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-[9px] font-black uppercase tracking-tighter rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-all border border-slate-100 dark:border-slate-700"
                                    >
                                        Last
                                    </button>
                                </div>
                            </div>
                        </div>


                        <div className="overflow-x-auto overflow-hidden rounded-b-[2.5rem]">
                            <table className="w-full text-left">
                                <thead className={`text-[10px] font-black uppercase tracking-widest text-gray-900 ${viewMode === 'cancelled' ? 'bg-red-400' : 'bg-[var(--theme-primary)]'}`}>
                                    <tr>
                                        <th className="px-6 py-3 w-10 border-r-2 border-white/20">
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.size > 0 && selectedItems.size === activeData.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedItems(new Set(activeData.map(d => d.id)));
                                                    else setSelectedItems(new Set());
                                                }}
                                                className="w-5 h-5 rounded border-2 border-slate-400 checked:bg-[var(--theme-primary)] checked:border-[var(--theme-primary)] appearance-none cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-black checked:after:font-black checked:after:text-sm transition-all"
                                            />
                                        </th>
                                        <th className="px-6 py-3 w-28 text-center border-r-2 border-white/20">Actions</th>
                                        <th className="px-6 py-3 w-20 text-center border-r-2 border-white/20">ID</th>
                                        <th className="px-6 py-3 w-24 text-center border-r-2 border-white/20">Group</th>
                                        <th className="px-6 py-3 min-w-[200px] border-r-2 border-white/20">Job Details</th>
                                        <th className="px-6 py-3 text-center border-r-2 border-white/20">Qty (Kg)</th>
                                        <th className="px-6 py-3 text-center border-r-2 border-white/20">Qty (Pcs)</th>
                                        <th className="px-6 py-3 border-r-2 border-white/20">Date</th>
                                        {JOB_STAGES.map(s => (
                                            <th key={s.step} className="px-3 py-2 text-left border-r-2 border-white/20 min-w-[160px]">
                                                <div className="flex flex-col leading-tight">
                                                    <span className="text-[9px] opacity-70 font-black">STEP {s.step}</span>
                                                    <span className="text-[10px] font-black uppercase whitespace-nowrap">{s.name}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-slate-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={20} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="animate-spin text-[var(--theme-primary)]" size={32} />
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Records...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginatedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={20} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No Records Found</td>
                                        </tr>
                                    ) : (
                                        paginatedData.map((item) => (
                                            <motion.tr
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                key={item.id}
                                                className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors ${selectedItems.has(item.id) ? 'bg-[var(--theme-primary)]/5' : ''}`}
                                            >
                                                <td className="px-6 py-4 border-r-2 border-slate-200 dark:border-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.has(item.id)}
                                                        onChange={(e) => {
                                                            const next = new Set(selectedItems);
                                                            if (e.target.checked) next.add(item.id);
                                                            else next.delete(item.id);
                                                            setSelectedItems(next);
                                                        }}
                                                        className="w-5 h-5 rounded border-2 border-slate-400 checked:bg-[var(--theme-primary)] checked:border-[var(--theme-primary)] appearance-none cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-black checked:after:font-black checked:after:text-sm transition-all"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 border-r-2 border-slate-200 dark:border-slate-700">
                                                    <div className={`grid ${viewMode === 'data' ? 'grid-cols-2' : 'grid-cols-1'} gap-1 items-center justify-items-center`}>
                                                        {viewMode === 'data' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingItem(item);
                                                                        const isStandard = STANDARD_JOB_WORKS.includes(item['Job Work Name']);
                                                                        setCommonFields({
                                                                            jobWorkName: isStandard ? item['Job Work Name'] : 'Other',
                                                                            vendorName: item['Vendor Name'],
                                                                            customJobWorkName: isStandard ? '' : item['Job Work Name']
                                                                        });
                                                                        setRows([{
                                                                            itemName: item['Item Name'],
                                                                            qtyKg: String(item['Qty Of Material To Be Sent In Kg'] || ''),
                                                                            qtyPcs: String(item['Qty Material To Be Sent In Pcs'] || '')
                                                                        }]);
                                                                        setIsModalOpen(true);
                                                                    }}
                                                                    className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>
                                                                <button
                                                                    onClick={() => { setCancellingItem(item); setIsCancelModalOpen(true); }}
                                                                    className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl transition-all"
                                                                    title="Cancel Item"
                                                                >
                                                                    <Ban size={15} />
                                                                </button>
                                                                {getCurrentStep(item) > 1 && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setRemoveStepTarget(item);
                                                                            setRemoveStep('all');
                                                                            setIsRemoveStepModalOpen(true);
                                                                        }}
                                                                        className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                                                                        title="Remove Follow Up"
                                                                    >
                                                                        <RotateCcw size={15} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => { setDeletingItem(item); setIsDeleteModalOpen(true); }}
                                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setCancellingItem(item); setIsCancelModalOpen(true); }}
                                                                className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                                            >
                                                                <RotateCcw size={15} /> Restore
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-slate-500 text-[10px] border-r-2 border-slate-200 dark:border-slate-700">#{item.id}</td>
                                                <td className="px-6 py-4 text-center border-r-2 border-slate-200 dark:border-slate-700">
                                                    <div className="bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 font-mono inline-block">
                                                        {item['group-id'] || 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 border-r-2 border-slate-200 dark:border-slate-700">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2 group">
                                                            <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500">
                                                                <ClipboardCheck size={12} />
                                                            </div>
                                                            <span className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-tight">{item['Job Work Name']}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 group">
                                                            <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500">
                                                                <Users size={12} />
                                                            </div>
                                                            <span className="font-bold text-slate-600 dark:text-slate-400 text-[10px]">{item['Vendor Name']}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 group">
                                                            <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                                                                <Package size={12} />
                                                            </div>
                                                            <span className="font-bold text-slate-600 dark:text-slate-400 text-[10px]">{item['Item Name']}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-black text-slate-900 dark:text-white text-xs border-r-2 border-slate-200 dark:border-slate-700">{item['Qty Of Material To Be Sent In Kg'] || '0'}</td>
                                                <td className="px-6 py-4 text-center font-black text-slate-900 dark:text-white text-xs border-r-2 border-slate-200 dark:border-slate-700">{item['Qty Material To Be Sent In Pcs'] || '0'}</td>
                                                <td className="px-6 py-4 text-[10px] font-bold text-slate-400 border-r-2 border-slate-200 dark:border-slate-700">{formatDateTime(item.Timestamp)}</td>
                                                {JOB_STAGES.map(s => {
                                                    const planned = (item as any)[`Planned_${s.step}`];
                                                    const actual = (item as any)[`Actual_${s.step}`];
                                                    const delay = getDelayInfo(planned, actual);
                                                    const currentPendingStep = getCurrentStep(item);
                                                    const isCurrent = currentPendingStep === s.step;
                                                    const isLastCompleted = currentPendingStep - 1 === s.step;

                                                    return (
                                                        <td key={s.step} className="px-3 py-3 border-r-2 border-slate-200 dark:border-slate-700 transition-colors">
                                                            <div className="flex flex-col gap-0.5 text-[10px]">
                                                                <div className="flex justify-between gap-2">
                                                                    <span className="text-gray-400">P:</span>
                                                                    <span className="text-gray-600 dark:text-gray-300">
                                                                        {planned ? new Date(planned).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between gap-2">
                                                                    <span className="text-gray-400">A:</span>
                                                                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                                                        {actual ? new Date(actual).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                                    </span>
                                                                </div>
                                                                {s.step === 1 && (
                                                                    <>
                                                                        {item.lead_time_1 && (
                                                                            <div className="flex justify-between gap-2">
                                                                                <span className="text-gray-400">LT:</span>
                                                                                <span className="font-bold text-amber-600">{item.lead_time_1} Days</span>
                                                                            </div>
                                                                        )}
                                                                        {item.remark_1 && (
                                                                            <div className="flex flex-col gap-0.5 mt-0.5 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                                                                                <span className="text-gray-400 text-[8px] uppercase font-black">Remark:</span>
                                                                                <span className="font-medium text-slate-600 dark:text-slate-400 italic break-words">{item.remark_1}</span>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {(() => {
                                                                    return delay ? (
                                                                        <div className={`text-[8px] text-right font-black uppercase tracking-tighter ${delay.color}`}>
                                                                            {delay.text}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                                {!planned && !actual && (
                                                                    <span className="text-[9px] font-bold text-slate-300 uppercase italic">Waiting</span>
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
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-700/50 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight">Step Configuration</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage Lead Times and Responsibility</p>
                            </div>
                            <button
                                onClick={handleSaveConfig}
                                disabled={isSaving}
                                className="bg-[var(--theme-primary)] text-gray-900 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[var(--theme-primary)]/20"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                Save Config
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {stepConfigs.map((config, idx) => {
                                const stage = JOB_STAGES.find(s => s.step === config.step);
                                return (
                                    <div
                                        key={config.step}
                                        className={`bg-gradient-to-br ${stage?.color || 'from-slate-50 to-slate-100'} dark:from-slate-800/50 dark:to-slate-900/50 p-3 rounded-xl border-2 ${stage?.border || 'border-slate-100'} dark:border-slate-700 shadow-sm space-y-2 transition-all hover:shadow-md hover:scale-[1.02]`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 bg-gradient-to-br ${stage?.iconBg || 'from-indigo-500 to-indigo-600'} text-white rounded-lg flex items-center justify-center font-black text-[10px] shadow-sm`}>
                                                    {config.step}
                                                </div>
                                                <h3 className="font-black uppercase tracking-tight text-[10px] text-slate-800 dark:text-slate-200 truncate max-w-[120px]">{config.stepName}</h3>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Responsible</label>
                                                <select
                                                    value={config.doerName}
                                                    onChange={(e) => {
                                                        const next = [...stepConfigs];
                                                        next[idx].doerName = e.target.value;
                                                        setStepConfigs(next);
                                                    }}
                                                    className="w-full px-3 py-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg border-none font-bold text-[10px] shadow-sm focus:ring-1 focus:ring-indigo-500 transition-all"
                                                >
                                                    <option value="">Select User</option>
                                                    {systemUsers.map(u => (
                                                        <option key={u.id} value={u.username}>{u.username} ({u.role})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">TAT / Lead Time</label>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        value={config.tatValue}
                                                        onChange={(e) => {
                                                            const next = [...stepConfigs];
                                                            next[idx].tatValue = parseInt(e.target.value) || 0;
                                                            setStepConfigs(next);
                                                        }}
                                                        className="w-full px-3 py-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg border-none font-bold text-[10px] shadow-sm focus:ring-1 focus:ring-indigo-500 transition-all"
                                                    />
                                                    <select
                                                        value={config.tatUnit}
                                                        onChange={(e) => {
                                                            const next = [...stepConfigs];
                                                            next[idx].tatUnit = e.target.value as 'hours' | 'days';
                                                            setStepConfigs(next);
                                                        }}
                                                        className="w-20 px-2 py-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg border-none font-bold text-[10px] shadow-sm focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                                                    >
                                                        <option value="hours">Hrs</option>
                                                        <option value="days">Days</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>


            {/* Create/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden overflow-y-auto max-h-[90vh]"
                        >
                            <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-[var(--theme-primary)] text-gray-900 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight">{editingItem ? 'Edit' : 'Create New'} Job Work</h2>
                                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Enter record details below</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Job Work Name</label>
                                        {commonFields.jobWorkName === 'Other' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    autoFocus
                                                    required
                                                    value={commonFields.customJobWorkName || ''}
                                                    onChange={(e) => setCommonFields({ ...commonFields, customJobWorkName: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 rounded-2xl border-none font-bold focus:ring-2 focus:ring-[var(--theme-primary)] transition-all"
                                                    placeholder="Enter custom job work name"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setCommonFields({ ...commonFields, jobWorkName: '', customJobWorkName: '' })}
                                                    className="p-3 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-2xl transition-all shadow-sm"
                                                    title="Cancel custom input"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        ) : (
                                            <select
                                                required
                                                value={commonFields.jobWorkName}
                                                onChange={(e) => setCommonFields({ ...commonFields, jobWorkName: e.target.value })}
                                                className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 rounded-2xl border-none font-bold focus:ring-2 focus:ring-[var(--theme-primary)] transition-all appearance-none"
                                            >
                                                <option value="">Select Job Work Type</option>
                                                {STANDARD_JOB_WORKS.map(work => (
                                                    <option key={work} value={work}>{work}</option>
                                                ))}
                                                <option value="Other">Other (Custom)</option>
                                            </select>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor Name</label>
                                        <input
                                            value={commonFields.vendorName}
                                            onChange={(e) => setCommonFields({ ...commonFields, vendorName: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 rounded-2xl border-none font-bold focus:ring-2 focus:ring-[var(--theme-primary)] transition-all"
                                            placeholder="Vendor Company Name"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Details</label>
                                        {!editingItem && (
                                            <button
                                                type="button"
                                                onClick={() => setRows([...rows, { ...emptyItemRow }])}
                                                className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--theme-primary)] hover:text-gray-900 transition-all"
                                            >
                                                <Plus size={14} /> Add Row
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {rows.map((row, idx) => (
                                            <div key={idx} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_50px] gap-4 items-end bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Name</label>
                                                    <input
                                                        value={row.itemName}
                                                        onChange={(e) => {
                                                            const n = [...rows];
                                                            n[idx].itemName = e.target.value;
                                                            setRows(n);
                                                        }}
                                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm"
                                                        placeholder="Item description..."
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qty (Kg)</label>
                                                    <input
                                                        type="number"
                                                        value={row.qtyKg}
                                                        onChange={(e) => {
                                                            const n = [...rows];
                                                            n[idx].qtyKg = e.target.value;
                                                            setRows(n);
                                                        }}
                                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm"
                                                        placeholder="Kg"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qty (Pcs)</label>
                                                    <input
                                                        type="number"
                                                        value={row.qtyPcs}
                                                        onChange={(e) => {
                                                            const n = [...rows];
                                                            n[idx].qtyPcs = e.target.value;
                                                            setRows(n);
                                                        }}
                                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm"
                                                        placeholder="Pcs"
                                                    />
                                                </div>
                                                <div>
                                                    {!editingItem && rows.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                                                            className="p-2.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-[2] px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-[var(--theme-primary)] text-gray-900 shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                        {editingItem ? 'Update Record' : 'Create Records'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Cancel/Restore Confirm Modal */}
            <AnimatePresence>
                {isCancelModalOpen && cancellingItem && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCancelModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center">
                            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <RotateCcw className="text-orange-600" size={32} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">
                                {cancellingItem['Cancelled']?.toLowerCase() === 'yes' ? 'Restore Item?' : 'Cancel Item?'}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">
                                {cancellingItem['Cancelled']?.toLowerCase() === 'yes' ? 'This record will be moved back to the active list.' : 'This will hide the record from active view.'}
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => setIsCancelModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-500">No</button>
                                <button
                                    onClick={handleCancel}
                                    disabled={isCancelling}
                                    className="flex-1 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-orange-500 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                                >
                                    {isCancelling ? <Loader2 className="animate-spin" size={16} /> : 'Yes, Sure'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Modal */}
            <AnimatePresence>
                {isDeleteModalOpen && deletingItem && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Delete Record?</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">This action is irreversible. All data for this item will be removed.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-500">Cancel</button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex-1 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-600 text-white shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {isBulkUpdateModalOpen && selectedItems.size > 0 && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Bulk Status Update</h2>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Toggle each item to mark as done for its current step</p>
                                </div>
                                <button
                                    onClick={() => { setIsBulkUpdateModalOpen(false); setItemsToMarkDone(new Set()); }}
                                    className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-all text-slate-400 hover:text-slate-600"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900">
                                <div className="p-2.5 px-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                        <ClipboardCheck size={15} />
                                    </div>
                                    <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-100">{selectedItems.size} records ready to be processed. Toggle items to mark done.</p>
                                </div>

                                <div className="space-y-4">
                                    {Array.from(new Set(
                                        Array.from(selectedItems)
                                            .map(id => { const item = data.find(d => d.id === id); return item ? getCurrentStep(item) : null; })
                                            .filter((s): s is number => s !== null && s <= 11)
                                    )).sort((a, b) => a - b).map(stepNum => {
                                        const stage = JOB_STAGES.find(s => s.step === stepNum);
                                        const config = stepConfigs.find(c => c.step === stepNum);
                                        const stepItems = data.filter(d => selectedItems.has(d.id) && getCurrentStep(d) === stepNum);
                                        const allMarked = stepItems.every(i => itemsToMarkDone.has(i.id));

                                        return (
                                            <div key={stepNum} className="space-y-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-0.5 h-6 rounded-full bg-[var(--theme-primary)]" />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[8px] font-black text-[var(--theme-primary)] uppercase tracking-widest">Step {stepNum}</span>
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{config?.doerName || 'Unassigned'}</span>
                                                            </div>
                                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{stage?.name || `Step ${stepNum}`}</h3>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const next = new Set(itemsToMarkDone);
                                                            if (allMarked) { stepItems.forEach(i => next.delete(i.id)); }
                                                            else { stepItems.forEach(i => next.add(i.id)); }
                                                            setItemsToMarkDone(next);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${allMarked
                                                            ? 'border-slate-200 text-slate-400 dark:border-slate-700'
                                                            : 'border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-white'
                                                            }`}
                                                    >
                                                        {allMarked ? 'Unmark All' : 'Mark Stage Done'}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                                    {stepItems.map((item, idx) => (
                                                        <div key={item.id} className={`p-2 px-3 rounded-xl border transition-all group ${itemsToMarkDone.has(item.id)
                                                            ? 'bg-green-50/20 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'
                                                            : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'
                                                            }`}>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <span className="text-[8px] font-black w-5 h-5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shadow-sm">{idx + 1}</span>
                                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID #{item.id}</span>
                                                                    </div>
                                                                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{item['Job Work Name']}</h4>
                                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 truncate">
                                                                        {item['Item Name']}
                                                                        {item['Vendor Name'] && <><span className="w-0.5 h-0.5 rounded-full bg-slate-300 inline-block" />{item['Vendor Name']}</>}
                                                                    </p>
                                                                </div>

                                                                <div className="flex items-center gap-2 shrink-0 bg-white dark:bg-slate-900 p-1 px-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                    <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={itemsToMarkDone.has(item.id)}
                                                                            onChange={() => {
                                                                                const next = new Set(itemsToMarkDone);
                                                                                if (next.has(item.id)) next.delete(item.id);
                                                                                else next.add(item.id);
                                                                                setItemsToMarkDone(next);
                                                                            }}
                                                                        />
                                                                        <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 peer-checked:bg-green-500 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-[16px] after:w-[16px] after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
                                                                    </label>
                                                                    <span className={`text-[7px] font-black uppercase tracking-widest ${itemsToMarkDone.has(item.id) ? 'text-green-500' : 'text-slate-400'}`}>
                                                                        {itemsToMarkDone.has(item.id) ? 'DONE' : 'NEXT'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {stepNum === 1 && (
                                                                <div className="grid grid-cols-2 gap-2 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/50">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Lead Time</label>
                                                                        <input
                                                                            type="number"
                                                                            value={bulkUpdates[item.id]?.lead_time_1 || ''}
                                                                            onChange={(e) => setBulkUpdates(prev => ({
                                                                                ...prev,
                                                                                [item.id]: { ...prev[item.id], lead_time_1: e.target.value }
                                                                            }))}
                                                                            className="w-full h-7 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-bold focus:border-[var(--theme-primary)] outline-none"
                                                                            placeholder="Lead Time..."
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Remark</label>
                                                                        <input
                                                                            type="text"
                                                                            value={bulkUpdates[item.id]?.remark_1 || ''}
                                                                            onChange={(e) => setBulkUpdates(prev => ({
                                                                                ...prev,
                                                                                [item.id]: { ...prev[item.id], remark_1: e.target.value }
                                                                            }))}
                                                                            className="w-full h-7 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-bold focus:border-[var(--theme-primary)] outline-none"
                                                                            placeholder="Remark..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsBulkUpdateModalOpen(false); setItemsToMarkDone(new Set()); }}
                                    className="px-6 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkUpdate}
                                    disabled={isSaving || itemsToMarkDone.size === 0}
                                    className="flex-1 h-10 rounded-xl bg-[var(--theme-primary)] text-gray-900 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[var(--theme-primary)]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : (
                                        <>
                                            <CheckCircle2 size={15} />
                                            Apply Updates to {itemsToMarkDone.size} Records
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Remove Step Modal */}
            <AnimatePresence>
                {isRemoveStepModalOpen && removeStepTarget && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRemoveStepModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
                                    <RotateCcw size={28} />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Remove Follow Up</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{removeStepTarget['Job Work Name']}</p>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left px-1">Select range to clear:</p>
                                <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                                    <button
                                        onClick={() => setRemoveStep('all')}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${removeStep === 'all'
                                            ? 'border-red-500 bg-red-50/50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                            : 'border-slate-100 dark:border-slate-800 text-slate-500 hover:border-red-200'
                                            }`}
                                    >
                                        <div className="font-black text-[10px] uppercase tracking-widest">Remove All</div>
                                        <p className="text-[9px] opacity-70 font-medium mt-1">Clears all 11 steps for this job</p>
                                    </button>
                                    {JOB_STAGES.map(s => {
                                        const isDone = !!(removeStepTarget as any)[`Actual_${s.step}`];
                                        if (!isDone) return null;
                                        return (
                                            <button
                                                key={s.step}
                                                onClick={() => setRemoveStep(s.step)}
                                                className={`p-4 rounded-xl border-2 text-left transition-all ${removeStep === s.step
                                                    ? 'border-red-500 bg-red-50/50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                                    : 'border-slate-100 dark:border-slate-800 text-slate-500 hover:border-red-200'
                                                    }`}
                                            >
                                                <div className="font-black text-[10px] uppercase tracking-widest">From Step {s.step} ({s.name})</div>
                                                <p className="text-[9px] opacity-70 font-medium mt-1">Clears data from step {s.step} onwards</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setIsRemoveStepModalOpen(false)} className="flex-1 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                                <button
                                    onClick={handleRemoveStep}
                                    disabled={isSaving}
                                    className="flex-[1.5] px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-red-600 text-white shadow-xl shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : 'Confirm Clear'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </LayoutWrapper>
    );
}
