'use client';

import { useState, useEffect, useMemo } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { useSetupViewFromQuery } from '@/hooks/useSetupViewFromQuery';

interface CRMData {
    id: string | number;
    party_name: string;
    type: string;
    contact_person: string;
    email: string;
    contact_no_1: string;
    contact_no_2: string;
    location: string;
    state: string;
    field_person_name: string;
    Cancelled: string | boolean;
    item: string;
    quantity: string | number;
    created_at: string;
    // FMS Steps
    Planned_1?: string | null; Actual_1?: string | null; Status_1?: string | null;
    Planned_2?: string | null; Actual_2?: string | null; Status_2?: string | null;
    Planned_3?: string | null; Actual_3?: string | null; Status_3?: string | null;
    Planned_4?: string | null; Actual_4?: string | null; Status_4?: string | null;
    Planned_5?: string | null; Actual_5?: string | null; Status_5?: string | null; lead_time_5?: string | null;
    Planned_6?: string | null; Actual_6?: string | null; Status_6?: string | null;
    Planned_7?: string | null; Actual_7?: string | null; Status_7?: string | null; remark_7?: string | null;
}

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

const STAGES = [
    { step: 1, name: 'Confirm Order By Whatsapp', shortName: 'ORDER', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'indigo' },
    { step: 2, name: 'Whatsapp Estimated Delivery Date', shortName: 'DELIVERY', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'amber' },
    { step: 3, name: 'Send Invoice and Eway Copy', shortName: 'INVOICE', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'blue' },
    { step: 4, name: 'Send Billty to Outstation', shortName: 'BILLTY', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'rose' },
    { step: 5, name: 'Inform Client About ETA', shortName: 'ETA', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'violet' },
    { step: 6, name: 'Feedback Call', shortName: 'FEEDBACK', icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z', color: 'teal' },
    { step: 7, name: 'Inform Regarding Bad Feedback', shortName: 'SIR', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: 'red' },
];

const STAGE_COLORS: Record<string, { gradient: string; border: string; text: string; iconBg: string }> = {
    all: { gradient: 'from-slate-50 to-slate-100', border: 'border-slate-200', text: 'text-slate-700', iconBg: 'from-slate-500 to-slate-600' },
    indigo: { gradient: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', text: 'text-indigo-700', iconBg: 'from-indigo-500 to-indigo-600' },
    amber: { gradient: 'from-amber-50 to-amber-100', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'from-amber-500 to-amber-600' },
    blue: { gradient: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'from-blue-500 to-blue-600' },
    orange: { gradient: 'from-orange-50 to-orange-100', border: 'border-orange-200', text: 'text-orange-700', iconBg: 'from-orange-500 to-orange-600' },
    rose: { gradient: 'from-rose-50 to-rose-100', border: 'border-rose-200', text: 'text-rose-700', iconBg: 'from-rose-500 to-rose-600' },
    violet: { gradient: 'from-violet-50 to-violet-100', border: 'border-violet-200', text: 'text-violet-700', iconBg: 'from-violet-500 to-violet-600' },
    teal: { gradient: 'from-teal-50 to-teal-100', border: 'border-teal-200', text: 'text-teal-700', iconBg: 'from-teal-500 to-teal-600' },
    red: { gradient: 'from-red-50 to-red-100', border: 'border-red-200', text: 'text-red-700', iconBg: 'from-red-500 to-red-600' },
};

const ITEMS_PER_PAGE = 10;

export default function CRMPage() {
    const toast = useToast();
    const loader = useLoader();
    const [data, setData] = useState<CRMData[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'data' | 'setup'>('data');
    useSetupViewFromQuery(setViewMode);
    const [isCancelledView, setIsCancelledView] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all'>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    // Bulk Update States
    const [selectedItems, setSelectedItems] = useState<Set<number | string>>(new Set());
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [itemsToMarkDone, setItemsToMarkDone] = useState<Set<number | string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Record<string | number, any>>({});

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'info'
    });

    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id: number | string; party_name?: string } | null>(null);
    const [removeStep, setRemoveStep] = useState<number | 'all'>(1);

    // Advanced Filter States
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<Record<string, string>>({
        party_name: '',
        type: '',
        contact_person: '',
        email: '',
        contact_no_1: '',
        contact_no_2: '',
        location: '',
        state: '',
        item: ''
    });

    const activeFilterCount = useMemo(() => {
        return Object.values(advancedFilters).filter(v => v !== '').length;
    }, [advancedFilters]);

    useEffect(() => {
        fetchCRMData();
        fetchConfig();
        fetchUsers();
    }, []);

    const fetchCRMData = async () => {
        try {
            loader.showLoader();
            setLoading(true);
            const response = await fetch('/api/crm');
            if (!response.ok) throw new Error('Failed to fetch data');
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to load CRM data');
        } finally {
            setLoading(false);
            loader.hideLoader();
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/crm-config');
            if (res.ok) {
                const data = await res.json();
                if (data.config && data.config.length > 0) {
                    const syncedConfig = data.config.map((c: any) => {
                        const stage = STAGES.find(s => s.step === Number(c.step));
                        return {
                            ...c,
                            stepName: stage ? stage.name : c.stepName
                        };
                    });
                    setStepConfigs(syncedConfig);
                } else {
                    const defaultConfig = STAGES.map(s => ({
                        step: s.step,
                        stepName: s.name,
                        doerName: '',
                        tatValue: 1,
                        tatUnit: 'hours' as 'hours' | 'days'
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
            const configToSave = stepConfigs
                .filter(c => STAGES.some(s => s.step === c.step))
                .map(c => ({
                    ...c,
                    stepName: STAGES.find(s => s.step === c.step)?.name || c.stepName
                }));

            const res = await fetch('/api/crm-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: configToSave }),
            });
            if (res.ok) {
                toast.success('Configuration saved');
                setViewMode('data');
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to save configuration');
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

    const getCurrentStep = (item: CRMData): number => {
        for (let i = 1; i <= 7; i++) {
            if (!(item as any)[`Actual_${i}`]) {
                return i;
            }
        }
        return 8;
    };

    const handleToggleStepDone = async (item: CRMData, step: number) => {
        try {
            loader.showLoader();
            const currentTime = new Date();
            const updates: any = {
                id: item.id,
                [`Actual_${step}`]: currentTime.toISOString(),
                [`Status_${step}`]: 'Done'
            };

            if (step < 7) {
                const nextStep = step + 1;
                let nextPlanned: Date;

                const leadTime = (item as any).lead_time_5;
                if (step === 5 && leadTime) {
                    const leadTimeDays = parseInt(String(leadTime)) || 0;
                    nextPlanned = getNextPlannedTime(currentTime, leadTimeDays, "days");
                } else {
                    const nextConfig = stepConfigs.find(c => c.step === nextStep);
                    nextPlanned = getNextPlannedTime(currentTime, nextConfig?.tatValue || 1, nextConfig?.tatUnit || "hours");
                }
                updates[`Planned_${nextStep}`] = nextPlanned.toISOString();
            }

            const response = await fetch('/api/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) throw new Error('Update failed');

            toast.success(`Step ${step} completed`);
            fetchCRMData();
        } catch (error) {
            console.error('Error updating step:', error);
            toast.error('Failed to update step');
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
                [1, 2, 3, 4, 5, 6, 7].forEach(step => {
                    payload[`Actual_${step}`] = '';
                    payload[`Status_${step}`] = '';
                    if (step > 1) payload[`Planned_${step}`] = '';
                });
                payload['lead_time_5'] = '';
                payload['remark_7'] = '';
            } else {
                const stepNum = removeStep as number;
                [1, 2, 3, 4, 5, 6, 7].forEach(step => {
                    if (step === stepNum) {
                        payload[`Actual_${step}`] = '';
                        payload[`Status_${step}`] = '';
                        if (step === 5) payload['lead_time_5'] = '';
                        if (step === 7) payload['remark_7'] = '';
                    } else if (step > stepNum) {
                        payload[`Planned_${step}`] = '';
                        payload[`Actual_${step}`] = '';
                        payload[`Status_${step}`] = '';
                        if (step === 5) payload['lead_time_5'] = '';
                        if (step === 7) payload['remark_7'] = '';
                    }
                });
            }

            const res = await fetch('/api/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success('Follow-up details removed');
                setShowRemoveModal(false);
                setRemoveTarget(null);
                fetchCRMData();
            } else {
                toast.error('Operation failed');
            }
        } catch (error) {
            toast.error('Error removing follow-up');
        } finally {
            loader.hideLoader();
        }
    };

    const openRemoveModal = (id: number | string, party_name?: string) => {
        setRemoveTarget({ id, party_name });
        setRemoveStep(1);
        setShowRemoveModal(true);
    };

    const toggleSelection = (id: string | number) => {
        const next = new Set(selectedItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedItems(next);
    };

    const toggleAll = () => {
        if (selectedItems.size === paginatedData.length && paginatedData.length > 0) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(paginatedData.map(r => r.id)));
        }
    };

    const handleBulkUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.size === 0) return;

        try {
            loader.showLoader();
            const currentTime = new Date();
            const updatePromises = Array.from(selectedItems).map(id => {
                const item = data.find(r => r.id === id);
                if (!item) return Promise.resolve();

                const currentStep = getCurrentStep(item);
                const rowUpdate = bulkUpdates[item.id] || {};
                const updatedData: any = { id: item.id };

                // Surgical updates based on step
                if (rowUpdate.remark_7) {
                    const existing = item.remark_7 || '';
                    updatedData.remark_7 = existing ? `${existing} | ${rowUpdate.remark_7}` : rowUpdate.remark_7;
                }
                if (rowUpdate.lead_time_5) updatedData.lead_time_5 = rowUpdate.lead_time_5;

                // Handle step progression
                if (itemsToMarkDone.has(item.id) && currentStep <= 7) {
                    updatedData[`Actual_${currentStep}`] = currentTime.toISOString();

                    // Use custom status if provided (for steps 6 and 7), otherwise default to 'Done'
                    const customStatus = (currentStep === 6 || currentStep === 7)
                        ? rowUpdate[`status_${currentStep}`]
                        : null;
                    updatedData[`Status_${currentStep}`] = customStatus || 'Done';


                    // Automation for next step planning
                    if (currentStep < 7) {
                        const nextStep = currentStep + 1;
                        let nextPlanned: Date;

                        const leadTime = rowUpdate.lead_time_5 || item.lead_time_5;
                        if (currentStep === 5 && leadTime) {
                            const leadTimeDays = parseInt(String(leadTime)) || 0;
                            nextPlanned = getNextPlannedTime(currentTime, leadTimeDays, "days");
                        } else {
                            const nextConfig = stepConfigs.find(c => c.step === nextStep);
                            nextPlanned = getNextPlannedTime(currentTime, nextConfig?.tatValue || 1, nextConfig?.tatUnit || "hours");
                        }
                        updatedData[`Planned_${nextStep}`] = nextPlanned.toISOString();
                    }
                }

                // If this is a standalone remark or lead time update without marking step as done
                // It will still be sent as a PUT request due to the surgical updates block

                return fetch('/api/crm', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData),
                });
            });

            await Promise.all(updatePromises);
            toast.success('Bulk updates applied successfully');
            setItemsToMarkDone(new Set());
            setBulkUpdates({});
            setSelectedItems(new Set());
            setIsBulkUpdateModalOpen(false);
            fetchCRMData();
        } catch (error) {
            console.error('Error applying bulk updates:', error);
            toast.error('Failed to apply bulk updates');
        } finally {
            loader.hideLoader();
        }
    };

    const handleToggleCancel = async (id: string | number, currentStatus: string | boolean) => {
        const isCurrentlyCancelled = currentStatus === 'Cancelled' || currentStatus === true;

        if (!isCurrentlyCancelled) {
            setConfirmModal({
                isOpen: true,
                title: 'Cancel Record',
                message: 'Are you sure you want to cancel this record? This will move it to the archive.',
                type: 'danger',
                onConfirm: () => performToggleCancel(id, currentStatus)
            });
        } else {
            setConfirmModal({
                isOpen: true,
                title: 'Restore Record',
                message: 'Are you sure you want to restore this record back to active data?',
                type: 'info',
                onConfirm: () => performToggleCancel(id, currentStatus)
            });
        }
    };

    const performToggleCancel = async (id: string | number, currentStatus: string | boolean) => {
        try {
            const newStatus = (currentStatus === 'Cancelled' || currentStatus === true) ? '' : 'Cancelled';
            const response = await fetch('/api/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, Cancelled: newStatus })
            });

            if (!response.ok) throw new Error('Update failed');

            toast.success(newStatus === 'Cancelled' ? 'Record cancelled' : 'Record restored');
            fetchCRMData();
        } catch (error) {
            console.error('Error toggling cancel status:', error);
            toast.error('Failed to update status');
        }
    };

    const getDelayInfo = (planned: string | null | undefined, actual: string | null | undefined) => {
        if (!planned) return null;
        const pDate = new Date(planned);
        const refDate = actual ? new Date(actual) : new Date();
        const diffMs = refDate.getTime() - pDate.getTime();
        const diffMin = Math.floor(diffMs / (1000 * 60));

        if (diffMin > 0) {
            return { text: `${Math.floor(diffMin / 60)}h ${diffMin % 60}m Delay`, color: 'text-red-500 font-bold' };
        } else {
            const absMin = Math.abs(diffMin);
            return { text: `${Math.floor(absMin / 60)}h ${absMin % 60}m ${actual ? 'Ahead' : 'Left'}`, color: 'text-emerald-500 font-bold' };
        }
    };

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const uniqueValues = useMemo(() => {
        const fields = ['party_name', 'type', 'contact_person', 'email', 'contact_no_1', 'contact_no_2', 'location', 'state', 'item'];
        const values: Record<string, string[]> = {};
        fields.forEach(f => {
            const set = new Set(data.map(item => String((item as any)[f] || '')).filter(Boolean));
            values[f] = Array.from(set).sort() as string[];
        });
        return values;
    }, [data]);

    const filteredData = useMemo(() => {
        let result = data.filter(item => {
            const isCancelled = item.Cancelled === 'Cancelled' || item.Cancelled === true;
            if (isCancelledView ? !isCancelled : isCancelled) return false;

            // Apply Advanced Filters
            for (const [field, value] of Object.entries(advancedFilters)) {
                if (value && (item as any)[field] !== value) return false;
            }

            return true;
        });

        if (viewMode === 'setup') return [];

        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = (a as any)[sortConfig.key];
                const bVal = (b as any)[sortConfig.key];
                if (aVal === bVal) return 0;
                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                return sortConfig.direction === 'asc' ? 1 : -1;
            });
        }

        if (!isCancelledView && activeStepFilter !== 'all') {
            result = result.filter(r => {
                const step = activeStepFilter as number;
                const isDone = !!(r as any)[`Actual_${step}`];
                const isPreviousDone = step === 1 || !!(r as any)[`Actual_${step - 1}`];
                return !isDone && isPreviousDone;
            });
        }

        if (!isCancelledView && activeTimeFilter) {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;

            result = result.filter(r => {
                const currentStep = getCurrentStep(r);
                if (currentStep > 7) return false;

                const plannedStr = (r as any)[`Planned_${currentStep}`];
                if (!plannedStr) return false;

                const pDate = new Date(plannedStr as string);
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

        return result;
    }, [data, isCancelledView, viewMode, sortConfig, activeStepFilter, activeTimeFilter, advancedFilters]);

    const statusStats = useMemo(() => {
        const active = data.filter(r => r.Cancelled !== 'Cancelled' && r.Cancelled !== true);
        return {
            Total: active.length,
            Step1: active.filter(r => !r.Actual_1).length,
            Step2: active.filter(r => r.Actual_1 && !r.Actual_2).length,
            Step3: active.filter(r => r.Actual_1 && r.Actual_2 && !r.Actual_3).length,
            Step4: active.filter(r => r.Actual_1 && r.Actual_2 && r.Actual_3 && !r.Actual_4).length,
            Step5: active.filter(r => r.Actual_1 && r.Actual_2 && r.Actual_3 && r.Actual_4 && !r.Actual_5).length,
            Step6: active.filter(r => r.Actual_1 && r.Actual_2 && r.Actual_3 && r.Actual_4 && r.Actual_5 && !r.Actual_6).length,
            Step7: active.filter(r => r.Actual_1 && r.Actual_2 && r.Actual_3 && r.Actual_4 && r.Actual_5 && r.Actual_6 && !r.Actual_7).length,
        };
    }, [data]);

    const timeStats = useMemo(() => {
        const active = data.filter(r => r.Cancelled !== 'Cancelled' && r.Cancelled !== true);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 7': 0, 'Next 15': 0 };

        active.forEach(r => {
            const currentStep = getCurrentStep(r);
            if (currentStep > 7) return;

            const plannedStr = (r as any)[`Planned_${currentStep}`];
            if (!plannedStr) return;

            const pDate = new Date(plannedStr as string);
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

    const paginatedData = useMemo(() => {
        return filteredData.slice(
            (currentPage - 1) * ITEMS_PER_PAGE,
            currentPage * ITEMS_PER_PAGE
        );
    }, [filteredData, currentPage]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return (
            <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
        );
        return sortConfig.direction === 'asc' ? (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
        ) : (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        );
    };

    return (
        <LayoutWrapper>
            <div className="flex-1 flex flex-col bg-[var(--theme-lighter)] overflow-hidden">
                <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-2">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-[var(--theme-primary)]/10 rounded-[2rem] border border-[var(--theme-primary)]/20 shadow-inner">
                                <svg className="w-10 h-10 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-[1000] text-[var(--theme-primary)] tracking-tighter leading-none mb-1 italic uppercase">
                                    CRM
                                    <span className="text-[var(--theme-primary)]/30 not-italic ml-2 text-xl tracking-widest">WORKFLOW</span>
                                </h1>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Client Relationship Management FMS</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowFilterModal(true)}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden group ${activeFilterCount > 0
                                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                                        : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700 shadow-xl'
                                        }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                    Filter
                                    {activeFilterCount > 0 && (
                                        <span className="flex items-center justify-center w-5 h-5 bg-white text-indigo-500 font-bold rounded-full text-[9px] shadow-sm ml-1 group-hover:scale-110 transition-transform">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>
                            </div>

                            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700">
                                {[
                                    { id: 'data', label: 'Data View', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
                                    { id: 'setup', label: 'Setup View', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
                                    { id: 'cancelled', label: 'Cancelled', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            if (tab.id === 'cancelled') {
                                                setIsCancelledView(true);
                                                setViewMode('data');
                                            } else {
                                                setIsCancelledView(false);
                                                setViewMode(tab.id as any);
                                            }
                                            setCurrentPage(1);
                                        }}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${(tab.id === 'cancelled' && isCancelledView) || (tab.id === viewMode && !isCancelledView)
                                            ? 'bg-[var(--theme-primary)] text-white shadow-lg shadow-[var(--theme-primary)]/25 scale-[1.02]'
                                            : 'text-slate-400 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5'
                                            }`}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {viewMode === 'data' && (
                        <div className="flex-1 flex flex-col gap-4">

                            {/* Main Table Container */}
                            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-white dark:border-slate-700 overflow-hidden">

                                {/* Step Filter Tiles */}
                                {!isCancelledView && (
                                    <div className="overflow-x-auto pb-0 scroll-smooth -mx-0 px-4 pt-4 no-scrollbar bg-[var(--theme-lighter)]/30 dark:bg-slate-900/30">
                                        <div className="flex gap-2 min-w-max pr-2 pb-2">
                                            {[
                                                { step: 'all' as const, label: 'All Items', value: statusStats.Total, ...STAGE_COLORS.all, icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                                                ...STAGES.map(s => ({
                                                    step: s.step,
                                                    label: `${s.step}. ${s.name.split(' ').slice(0, 2).join(' ')}`,
                                                    value: (statusStats as any)[`Step${s.step}`],
                                                    ...STAGE_COLORS[s.color],
                                                    icon: s.icon
                                                }))
                                            ].map((stat, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    whileHover={activeStepFilter === stat.step ? { scale: 1 } : { y: -1 }}
                                                    onClick={() => {
                                                        setActiveStepFilter(stat.step);
                                                        if (stat.step === 'all') {
                                                            setActiveTimeFilter(null);
                                                            setAdvancedFilters({
                                                                party_name: '',
                                                                type: '',
                                                                contact_person: '',
                                                                email: '',
                                                                contact_no_1: '',
                                                                contact_no_2: '',
                                                                location: '',
                                                                state: '',
                                                                item: ''
                                                            });
                                                        }
                                                        setCurrentPage(1);
                                                    }}
                                                    className={`bg-gradient-to-br ${stat.gradient} p-2 rounded-lg border ${stat.border} shadow-sm flex items-center gap-2 transition-all min-w-[130px] cursor-pointer ${activeStepFilter === stat.step
                                                        ? 'ring-2 ring-[var(--theme-primary)] shadow-md opacity-100'
                                                        : 'opacity-75 hover:opacity-100 hover:-translate-y-px'
                                                        }`}
                                                >
                                                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stat.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm transition-transform text-white`}>
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} /></svg>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-[8px] font-bold ${stat.text} uppercase tracking-wider truncate`}>{stat.label}</p>
                                                        <p className="text-base font-bold text-gray-900 dark:text-white leading-none mt-0.5">{stat.value}</p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pagination & Summary Row */}
                                <div className="flex items-center justify-between bg-[var(--theme-lighter)]/50 dark:bg-slate-900/50 p-3 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md sticky top-0 z-[20] px-6">
                                    <div className="flex items-center gap-6">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                            Showing <span className="text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>- <span className="text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</span> of <span className="text-slate-900 dark:text-white">{filteredData.length}</span>
                                        </p>
                                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                                        {!isCancelledView && selectedItems.size > 0 && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                onClick={() => setIsBulkUpdateModalOpen(true)}
                                                className="px-4 py-2 bg-[var(--theme-primary)] hover:opacity-90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[var(--theme-primary)]/20 transition-all flex items-center gap-1.5 whitespace-nowrap"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                                                Update Details ({selectedItems.size})
                                            </motion.button>
                                        )}

                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                            {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                                                <button
                                                    key={filter}
                                                    onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                                                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative border ${activeTimeFilter === filter
                                                        ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)] shadow-md shadow-[var(--theme-primary)]/20'
                                                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:border-[var(--theme-primary)]/30 hover:text-[var(--theme-primary)]'
                                                        }`}
                                                >
                                                    {filter}
                                                    {timeStats[filter as keyof typeof timeStats] > 0 && (
                                                        <span className={`absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full text-[8px] font-black shadow-sm ring-2 ${activeTimeFilter === filter ? 'bg-white text-[var(--theme-primary)] ring-[var(--theme-primary)]' : 'bg-[var(--theme-primary)] text-white ring-white dark:ring-slate-800'}`}>
                                                            {timeStats[filter as keyof typeof timeStats]}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                                        >
                                            Prev
                                        </button>
                                        <div className="flex items-center gap-1.5 mx-2">
                                            {(() => {
                                                const pages = [];
                                                const windowSize = 3;
                                                let start = Math.max(1, currentPage - 1);
                                                let end = Math.min(totalPages, start + windowSize - 1);
                                                if (end === totalPages) start = Math.max(1, end - windowSize + 1);

                                                for (let i = start; i <= end; i++) {
                                                    pages.push(
                                                        <button
                                                            key={i}
                                                            onClick={() => setCurrentPage(i)}
                                                            className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === i ? 'bg-[var(--theme-primary)] text-white shadow-lg shadow-[var(--theme-primary)]/25 scale-110' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-600'}`}
                                                        >
                                                            {i}
                                                        </button>
                                                    );
                                                }
                                                return pages;
                                            })()}
                                        </div>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            className="p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                                        >
                                            Last
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 flex flex-col gap-4">

                                    {/* Table Content */}
                                    <div className="overflow-x-auto no-scrollbar relative">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-[var(--theme-primary)] sticky top-0 z-[20] shadow-sm h-14 border-none">
                                                    <th className="px-4 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] text-center w-16">
                                                        {!isCancelledView && (
                                                            <div className="flex items-center justify-center">
                                                                <label className="relative flex items-center justify-center p-2 rounded-xl cursor-pointer hover:bg-black/5 transition-colors group">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="peer sr-only"
                                                                        checked={selectedItems.size === paginatedData.length && paginatedData.length > 0}
                                                                        onChange={toggleAll}
                                                                    />
                                                                    <div className="w-5 h-5 rounded border-2 border-white/40 peer-checked:bg-white peer-checked:border-white transition-all flex items-center justify-center shadow-sm">
                                                                        <svg className="w-3.5 h-3.5 text-[var(--theme-primary)] opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                                    </div>
                                                                </label>
                                                            </div>
                                                        )}
                                                    </th>
                                                    <th className="px-4 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] text-center w-24">Actions</th>
                                                    <th onClick={() => requestSort('id')} className="px-6 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] whitespace-nowrap text-center cursor-pointer hover:bg-black/5 transition-colors group">
                                                        <div className="flex items-center justify-center gap-2">ID {getSortIcon('id')}</div>
                                                    </th>
                                                    <th onClick={() => requestSort('party_name')} className="px-6 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] whitespace-nowrap cursor-pointer hover:bg-black/5 transition-colors group text-left min-w-[200px]">
                                                        <div className="flex items-center gap-2">Party / Type {getSortIcon('party_name')}</div>
                                                    </th>
                                                    <th className="px-6 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] whitespace-nowrap text-center min-w-[180px]">Contact Info</th>
                                                    <th className="px-6 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] whitespace-nowrap text-center">Location / State</th>
                                                    <th className="px-6 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] whitespace-nowrap text-center">Field Person</th>
                                                    <th className="px-6 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] whitespace-nowrap text-center">Item / Qty</th>
                                                    <th onClick={() => requestSort('created_at')} className="px-6 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] whitespace-nowrap text-center cursor-pointer hover:bg-black/5 transition-colors group">
                                                        <div className="flex items-center justify-center gap-2">Created {getSortIcon('created_at')}</div>
                                                    </th>
                                                    {STAGES.map((s) => (
                                                        <th key={s.step} onClick={() => requestSort(`Actual_${s.step}`)} className="px-4 py-4 text-[11px] font-[900] text-white uppercase tracking-[0.2em] text-center whitespace-nowrap cursor-pointer hover:bg-black/5 transition-colors group min-w-[150px]">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="opacity-50 text-[9px] tracking-widest">STEP {s.step} :</span>
                                                                <span>{s.shortName}</span>
                                                                {getSortIcon(`Actual_${s.step}`)}
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-slate-100 dark:divide-slate-700">
                                                <AnimatePresence mode="popLayout">
                                                    {loading ? (
                                                        [...Array(10)].map((_, i) => (
                                                            <tr key={`skeleton-${i}`} className="animate-pulse">
                                                                {[...Array(6)].map((_, j) => (
                                                                    <td key={j} className="px-6 py-6"><div className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg w-full"></div></td>
                                                                ))}
                                                            </tr>
                                                        ))
                                                    ) : paginatedData.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={10} className="px-6 py-24 text-center">
                                                                <div className="flex flex-col items-center gap-4 opacity-30">
                                                                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-[2rem] flex items-center justify-center">
                                                                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                        </svg>
                                                                    </div>
                                                                    <p className="text-xl font-black uppercase tracking-widest text-slate-500">No Records Found</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        paginatedData.map((item, idx) => {
                                                            const currentStep = getCurrentStep(item);
                                                            const stage = STAGES.find(s => s.step === currentStep);
                                                            const planned = (item as any)[`Planned_${currentStep}`];
                                                            const delay = getDelayInfo(planned, null);

                                                            return (
                                                                <motion.tr
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: idx * 0.02 }}
                                                                    key={item.id || idx}
                                                                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-all group ${item.Cancelled === 'Cancelled' || item.Cancelled === true ? 'opacity-40 grayscale select-none' : ''}`}
                                                                >
                                                                    <td className="px-4 py-5 border-r border-slate-100 dark:border-slate-700/50">
                                                                        {!isCancelledView && (
                                                                            <div className="flex items-center justify-center">
                                                                                <label className="relative flex items-center justify-center p-2 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        className="peer sr-only"
                                                                                        checked={selectedItems.has(item.id as number)}
                                                                                        onChange={() => toggleSelection(item.id as number)}
                                                                                    />
                                                                                    <div className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-[var(--theme-primary)] peer-checked:border-[var(--theme-primary)] transition-all flex items-center justify-center shadow-sm">
                                                                                        <svg className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                                                    </div>
                                                                                </label>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-5 border-r border-slate-100 dark:border-slate-700/50">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <button
                                                                                onClick={() => handleToggleCancel(item.id, item.Cancelled)}
                                                                                className={`p-2 rounded-xl transition-all shadow-sm ${item.Cancelled === 'Cancelled' || item.Cancelled === true
                                                                                    ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100'
                                                                                    : 'bg-red-50 text-red-500 hover:bg-red-100'
                                                                                    }`}
                                                                                title={item.Cancelled === 'Cancelled' || item.Cancelled === true ? 'Restore Record' : 'Cancel Record'}
                                                                            >
                                                                                {item.Cancelled === 'Cancelled' || item.Cancelled === true ? (
                                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                                                                                ) : (
                                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                                )}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => openRemoveModal(item.id, item.party_name)}
                                                                                className="p-2 bg-indigo-50 text-indigo-500 hover:bg-indigo-100 rounded-xl transition-all shadow-sm"
                                                                                title="Remove Follow Up"
                                                                            >
                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 border-r border-slate-100 dark:border-slate-700/50 text-center">
                                                                        <span className="text-[12px] font-[1000] text-slate-400 group-hover:text-[var(--theme-primary)] transition-colors italic tracking-widest">#{item.id || '-'}</span>
                                                                    </td>
                                                                    <td className="px-6 py-5 border-r border-slate-100 dark:border-slate-700/50">
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--theme-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                                                <p className="text-[13px] font-[900] text-slate-800 dark:text-slate-100 uppercase tracking-tight truncate group-hover:text-[var(--theme-primary)] transition-colors italic">{item.party_name}</p>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 pl-5">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50"></span>
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.type || 'Standard'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 border-r border-slate-100 dark:border-slate-700/50">
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <svg className="w-3 h-3 text-emerald-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{item.contact_person || '-'}</p>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <svg className="w-3 h-3 text-amber-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                                <p className="text-[10px] font-bold text-slate-400 lowercase">{item.email || '-'}</p>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <svg className="w-3 h-3 text-blue-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                                <p className="text-[10px] font-black text-slate-700">{item.contact_no_1 || '-'} {item.contact_no_2 ? `/ ${item.contact_no_2}` : ''}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 border-r border-slate-100 dark:border-slate-700/50 text-center whitespace-nowrap">
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <div className="flex items-center gap-1 justify-center">
                                                                                <svg className="w-3.5 h-3.5 text-rose-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{item.location || '-'}</p>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 justify-center bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.state || '-'}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 border-r border-slate-100 dark:border-slate-700/50 text-center whitespace-nowrap">
                                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50/50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
                                                                            <svg className="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                            <span className="text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-tight">{item.field_person_name || '-'}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 border-r border-slate-100 dark:border-slate-700/50 text-center whitespace-nowrap">
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <div className="flex items-center gap-1 justify-center">
                                                                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                                                <p className="text-[11px] font-black text-slate-700 uppercase italic tracking-tighter">{item.item || '-'}</p>
                                                                            </div>
                                                                            <div className="inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm">
                                                                                <span className="text-[8px] font-[1000] opacity-50 mr-1">QTY</span>
                                                                                <p className="text-[10px] font-[1000]">{item.quantity || '-'}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 border-r border-slate-100 dark:border-slate-700/50 text-center whitespace-nowrap">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] font-black text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}</span>
                                                                            <span className="text-[8px] font-bold text-slate-300 uppercase">{item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                                        </div>
                                                                    </td>
                                                                    {!isCancelledView ? (
                                                                        STAGES.map((s) => {
                                                                            const actual = (item as any)[`Actual_${s.step}`];
                                                                            const planned = (item as any)[`Planned_${s.step}`];
                                                                            const isCurrent = currentStep === s.step;
                                                                            const delay = getDelayInfo(planned, actual);

                                                                            return (
                                                                                <td key={s.step} className="px-4 py-3 border-r border-slate-100 dark:border-slate-700/50 min-w-[150px]">
                                                                                    <div className="flex flex-col gap-1 text-[10px]">
                                                                                        <div className="flex justify-between gap-2">
                                                                                            <span className="text-slate-400 font-bold">P:</span>
                                                                                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                                                                                                {planned ? new Date(planned).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between gap-2">
                                                                                            <span className="text-slate-400 font-bold">A:</span>
                                                                                            <span className="text-[var(--theme-primary)] dark:text-indigo-400 font-bold">
                                                                                                {actual ? new Date(actual).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                                                            </span>
                                                                                        </div>

                                                                                        {delay && (
                                                                                            <div className={`text-[8px] text-right ${delay.color}`}>
                                                                                                {delay.text}
                                                                                            </div>
                                                                                        )}

                                                                                        {s.step === 5 && (item as any).lead_time_5 && (
                                                                                            <div className="mt-1 flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-700 pt-1">
                                                                                                <span className="text-slate-400 font-bold uppercase tracking-tighter text-[8px] whitespace-nowrap">Lead Time:</span>
                                                                                                <span className="text-slate-700 dark:text-slate-200 font-black text-[9px]">{(item as any).lead_time_5} Days</span>
                                                                                            </div>
                                                                                        )}

                                                                                        {s.step === 7 && (item as any).remark_7 && (
                                                                                            <div className="mt-1 space-y-1 border-t border-slate-100 dark:border-slate-700 pt-1">
                                                                                                <div className="flex items-start gap-1.5">
                                                                                                    <span className="text-slate-400 font-bold uppercase tracking-tighter text-[8px] whitespace-nowrap pt-0.5">Remark:</span>
                                                                                                    <span className="text-slate-600 dark:text-slate-300 italic text-[8px] leading-tight line-clamp-2" title={(item as any).remark_7}>@{(item as any).remark_7}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <td className="px-6 py-5 border-r border-slate-50 dark:border-slate-700/50">
                                                                            <p className="text-[11px] font-black text-slate-500 uppercase">{item.item} ({item.quantity})</p>
                                                                        </td>
                                                                    )}
                                                                </motion.tr>
                                                            );
                                                        })
                                                    )}
                                                </AnimatePresence>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {viewMode === 'setup' && (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-8 border border-white dark:border-slate-700 max-w-5xl mx-auto">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-[var(--theme-primary)]/10 rounded-2xl border border-[var(--theme-primary)]/20">
                                        <svg className="w-6 h-6 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-2xl font-[1000] text-slate-800 dark:text-white uppercase tracking-tighter italic">Step Configuration</h2>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setViewMode('data')} className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all italic">Discard</button>
                                    <button onClick={handleSaveConfig} className="px-8 py-3 rounded-xl bg-[var(--theme-primary)] text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-105 active:scale-95 transition-all italic">Save Configuration</button>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                {stepConfigs.map((config, index) => (
                                    <div key={config.step} className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 items-center">
                                        <div className="md:col-span-1 flex items-center justify-center">
                                            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center font-[1000] italic text-[var(--theme-primary)] shadow-sm border border-slate-100 dark:border-slate-700 text-lg">
                                                {config.step}
                                            </div>
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Step Objective</label>
                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase italic truncate">{config.stepName}</p>
                                            </div>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Responsible Doer</label>
                                            <select
                                                value={config.doerName}
                                                onChange={(e) => {
                                                    const newConfigs = [...stepConfigs];
                                                    newConfigs[index].doerName = e.target.value;
                                                    setStepConfigs(newConfigs);
                                                }}
                                                className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-[11px] font-black uppercase tracking-widest italic outline-none focus:border-[var(--theme-primary)] transition-colors"
                                            >
                                                <option value="">Select User</option>
                                                {systemUsers.map(user => (
                                                    <option key={user.id} value={user.username}>{user.username}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-4 flex items-center gap-3">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">TAT Value</label>
                                                <input
                                                    type="number"
                                                    value={config.tatValue}
                                                    onChange={(e) => {
                                                        const newConfigs = [...stepConfigs];
                                                        newConfigs[index].tatValue = parseInt(e.target.value) || 1;
                                                        setStepConfigs(newConfigs);
                                                    }}
                                                    className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-[11px] font-[1000] uppercase italic outline-none focus:border-[var(--theme-primary)] transition-colors"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">TAT Unit</label>
                                                <select
                                                    value={config.tatUnit}
                                                    onChange={(e) => {
                                                        const newConfigs = [...stepConfigs];
                                                        newConfigs[index].tatUnit = e.target.value as 'hours' | 'days';
                                                        setStepConfigs(newConfigs);
                                                    }}
                                                    className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-[11px] font-black uppercase tracking-widest italic outline-none focus:border-[var(--theme-primary)] transition-colors"
                                                >
                                                    <option value="hours">Hours</option>
                                                    <option value="days">Days</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Confirmation Modal */}
                    <AnimatePresence>
                        {
                            confirmModal.isOpen && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                                        onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                        className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full border border-white dark:border-slate-700 overflow-hidden"
                                    >
                                        <div className="relative">
                                            <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center mb-6 shadow-lg ${confirmModal.type === 'danger' ? 'bg-red-50 text-red-500' :
                                                confirmModal.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                                                    'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]'
                                                }`}>
                                                {confirmModal.type === 'danger' ? (
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                ) : (
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                )}
                                            </div>

                                            <h3 className="text-2xl font-[1000] text-slate-800 dark:text-white uppercase tracking-tighter leading-tight mb-3 italic">
                                                {confirmModal.title}
                                            </h3>
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                                                {confirmModal.message}
                                            </p>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button
                                                    onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                                    className="flex-1 px-8 py-4 rounded-2xl bg-slate-50 dark:bg-slate-700/50 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-all border border-slate-100 dark:border-slate-700"
                                                >
                                                    Dismiss
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        confirmModal.onConfirm();
                                                        setConfirmModal({ ...confirmModal, isOpen: false });
                                                    }}
                                                    className={`flex-1 px-8 py-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg transition-all hover:scale-[1.05] active:scale-[0.95] ${confirmModal.type === 'danger' ? 'bg-red-500 shadow-red-500/20' : 'bg-[var(--theme-primary)] shadow-[var(--theme-primary)]/20'
                                                        }`}
                                                >
                                                    Confirm
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            )
                        }
                    </AnimatePresence >

                    {/* Bulk Update Modal */}
                    <AnimatePresence>
                        {
                            isBulkUpdateModalOpen && selectedItems.size > 0 && (
                                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                        className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
                                    >
                                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                                            <div>
                                                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Bulk Status Update</h2>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Update multiple records in one go</p>
                                            </div>
                                            <button
                                                onClick={() => setIsBulkUpdateModalOpen(false)}
                                                className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white dark:bg-slate-900">
                                            <div className="p-2.5 px-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-[var(--theme-primary)] flex items-center justify-center text-white shadow-lg shadow-[var(--theme-primary)]/20">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-[var(--theme-primary)] dark:text-indigo-100">{selectedItems.size} records ready to be processed.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {Array.from(new Set(Array.from(selectedItems).map(id => {
                                                    const r = data.find(req => req.id === id);
                                                    return r ? getCurrentStep(r) : null;
                                                }).filter(Boolean))).sort((a, b) => (a || 0) - (b || 0)).map(stepNum => {
                                                    if (stepNum === null || stepNum > 7) return null;
                                                    const stage = STAGES.find(s => s.step === stepNum);
                                                    const config = stepConfigs.find(c => c.step === stepNum);
                                                    const stepItems = data.filter(r => selectedItems.has(r.id as number) && getCurrentStep(r) === stepNum);

                                                    return (
                                                        <div key={stepNum} className="space-y-2">
                                                            <div className="flex items-center justify-between px-1">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-0.5 h-6 rounded-full bg-[var(--theme-primary)]"></div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[8px] font-black text-[var(--theme-primary)] uppercase tracking-widest">Stage {stepNum}</span>
                                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{config?.doerName || 'UNASSIGNED'}</span>
                                                                        </div>
                                                                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{stage?.name}</h3>
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    onClick={() => {
                                                                        const allMarked = stepItems.every(i => itemsToMarkDone.has(i.id as number));
                                                                        const next = new Set(itemsToMarkDone);
                                                                        if (allMarked) {
                                                                            stepItems.forEach(i => next.delete(i.id as number));
                                                                        } else {
                                                                            stepItems.forEach(i => next.add(i.id as number));
                                                                        }
                                                                        setItemsToMarkDone(next);
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${stepItems.every(i => itemsToMarkDone.has(i.id as number))
                                                                        ? 'border-slate-200 text-slate-400 dark:border-slate-700'
                                                                        : 'border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-white'
                                                                        }`}
                                                                >
                                                                    {stepItems.every(i => itemsToMarkDone.has(i.id as number)) ? 'Unmark All' : 'Mark Stage Done'}
                                                                </button>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                                                {stepItems.map((item, idx) => (
                                                                    <div key={item.id} className={`p-2 px-3 rounded-xl border transition-all group ${itemsToMarkDone.has(item.id as number)
                                                                        ? 'bg-green-50/20 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'
                                                                        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'
                                                                        }`}>
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                                    <span className="text-[10px] font-black w-5 h-5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-[var(--theme-primary)] transition-colors shadow-sm text-[8px]">
                                                                                        {idx + 1}
                                                                                    </span>
                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID #{item.id}</span>
                                                                                </div>
                                                                                <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{item.party_name}</h4>
                                                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                                    {item.item}
                                                                                    <span className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                                                    Qty: {item.quantity}
                                                                                </p>
                                                                            </div>

                                                                            <div className="flex items-center gap-3 shrink-0 bg-white dark:bg-slate-900 p-1 px-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                                <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        className="sr-only peer"
                                                                                        checked={itemsToMarkDone.has(item.id as number)}
                                                                                        onChange={() => {
                                                                                            const next = new Set(itemsToMarkDone);
                                                                                            if (next.has(item.id as number)) next.delete(item.id as number);
                                                                                            else next.add(item.id as number);
                                                                                            setItemsToMarkDone(next);
                                                                                        }}
                                                                                    />
                                                                                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[16px] after:w-[16px] after:transition-all peer-checked:bg-[var(--theme-primary)] rounded-full"></div>
                                                                                </label>
                                                                                <span className={`text-[7px] font-black uppercase tracking-widest ${itemsToMarkDone.has(item.id as number) ? 'text-[var(--theme-primary)]' : 'text-slate-400'}`}>
                                                                                    {itemsToMarkDone.has(item.id as number) ? 'DONE' : 'NEXT'}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {stepNum === 5 && (
                                                                            <div className="col-span-full">
                                                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">ETA Delay Amount (Days)</label>
                                                                                <input
                                                                                    type="number"
                                                                                    value={bulkUpdates[item.id]?.lead_time_5 ?? (item.lead_time_5 || '')}
                                                                                    onChange={(e) => setBulkUpdates(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: { ...prev[item.id as number], lead_time_5: e.target.value }
                                                                                    }))}
                                                                                    className="w-full h-8 px-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-900 dark:text-white outline-none focus:border-[var(--theme-primary)] transition-all shadow-sm"
                                                                                    placeholder="Days delay..."
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        {stepNum === 6 && (
                                                                            <div className="col-span-full">
                                                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Feedback Quality</label>
                                                                                <div className="flex gap-2">
                                                                                    {['Good', 'Bad'].map((status) => (
                                                                                        <button
                                                                                            key={status}
                                                                                            onClick={() => setBulkUpdates(prev => ({
                                                                                                ...prev,
                                                                                                [item.id]: { ...prev[item.id as number], status_6: status }
                                                                                            }))}
                                                                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${bulkUpdates[item.id]?.status_6 === status
                                                                                                ? (status === 'Good' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20')
                                                                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200'
                                                                                                }`}
                                                                                        >
                                                                                            {status}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {stepNum === 7 && (
                                                                            <div className="col-span-full space-y-3">
                                                                                <div>
                                                                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Final Status</label>
                                                                                    <div className="flex gap-2">
                                                                                        {['Good', 'Bad'].map((status) => (
                                                                                            <button
                                                                                                key={status}
                                                                                                onClick={() => setBulkUpdates(prev => ({
                                                                                                    ...prev,
                                                                                                    [item.id]: { ...prev[item.id as number], status_7: status }
                                                                                                }))}
                                                                                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${bulkUpdates[item.id]?.status_7 === status
                                                                                                    ? (status === 'Good' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20')
                                                                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200'
                                                                                                    }`}
                                                                                            >
                                                                                                {status}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                                <div>
                                                                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Add New Remark</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={bulkUpdates[item.id]?.remark_7 ?? ''}
                                                                                        onChange={(e) => setBulkUpdates(prev => ({
                                                                                            ...prev,
                                                                                            [item.id]: { ...prev[item.id as number], remark_7: e.target.value }
                                                                                        }))}
                                                                                        className="w-full h-8 px-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-900 dark:text-white outline-none focus:border-[var(--theme-primary)] transition-all shadow-sm"
                                                                                        placeholder="Type here..."
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

                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setIsBulkUpdateModalOpen(false)}
                                                className="px-6 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleBulkUpdate}
                                                className="flex-1 h-10 rounded-xl bg-[var(--theme-primary)] text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[var(--theme-primary)]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                Apply Updates to {selectedItems.size} Records
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )
                        }
                    </AnimatePresence>

                    {/* Remove Follow Up Modal */}
                    <AnimatePresence>
                        {showRemoveModal && removeTarget && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-white dark:border-slate-700"
                                >
                                    <div className="p-8">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-500 shadow-sm border border-indigo-100/50 dark:border-indigo-800/50">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">Remove Progress</h3>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{removeTarget.party_name}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Reset progress from step:</label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <button
                                                        onClick={() => setRemoveStep('all')}
                                                        className={`px-4 py-3 rounded-2xl text-[11px] font-[1000] uppercase tracking-widest transition-all border-2 text-left flex items-center justify-between ${removeStep === 'all'
                                                            ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                                                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-slate-200'
                                                            }`}
                                                    >
                                                        Remove All Progress
                                                        {removeStep === 'all' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </button>
                                                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                                                    {STAGES.map((s) => (
                                                        <button
                                                            key={s.step}
                                                            onClick={() => setRemoveStep(s.step)}
                                                            className={`px-4 py-3 rounded-2xl text-[11px] font-[1000] uppercase tracking-widest transition-all border-2 text-left flex items-center justify-between ${removeStep === s.step
                                                                ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-slate-200'
                                                                }`}
                                                        >
                                                            <span>Step {s.step}: {s.shortName}</span>
                                                            {removeStep === s.step && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-800/30">
                                                <div className="flex gap-3">
                                                    <svg className="w-5 h-5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 leading-relaxed uppercase tracking-tight">
                                                        Caution: This will permanently clear completion data for the selected step and all subsequent steps.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 mt-8">
                                            <button
                                                onClick={() => { setShowRemoveModal(false); setRemoveTarget(null); }}
                                                className="flex-1 h-12 rounded-2xl border-2 border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                            >
                                                Keep Progress
                                            </button>
                                            <button
                                                onClick={handleRemoveFollowUp}
                                                className="flex-1 h-12 rounded-2xl bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            >
                                                Remove Details
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Filter Modal */}
                    <AnimatePresence>
                        {showFilterModal && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-white dark:border-slate-800 flex flex-col"
                                >
                                    <div className="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] p-6 sticky top-0 z-10 flex items-center justify-between shadow-lg shadow-[var(--theme-primary)]/10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white/20 dark:bg-slate-900/40 rounded-xl text-slate-900 shadow-sm backdrop-blur-md">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Advanced Filters</h3>
                                                <p className="text-[10px] font-black text-slate-900/60 uppercase tracking-widest">Refine your view with specific criteria</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {activeFilterCount > 0 && (
                                                <button
                                                    onClick={() => {
                                                        setAdvancedFilters({
                                                            party_name: '',
                                                            type: '',
                                                            contact_person: '',
                                                            email: '',
                                                            contact_no_1: '',
                                                            contact_no_2: '',
                                                            location: '',
                                                            state: '',
                                                            item: ''
                                                        });
                                                        setCurrentPage(1);
                                                    }}
                                                    className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all border border-rose-100 dark:border-rose-900/30"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setShowFilterModal(false)}
                                                className="p-2 hover:bg-white/20 rounded-xl transition-all text-slate-900"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {[
                                                { id: 'party_name', label: 'Party Name' },
                                                { id: 'type', label: 'Type' },
                                                { id: 'contact_person', label: 'Contact Person' },
                                                { id: 'email', label: 'Email Address' },
                                                { id: 'contact_no_1', label: 'Contact Number 1' },
                                                { id: 'contact_no_2', label: 'Contact Number 2' },
                                                { id: 'location', label: 'Location' },
                                                { id: 'state', label: 'State' },
                                                { id: 'item', label: 'Item Name' }
                                            ].map((filter) => (
                                                <SearchableSelect
                                                    key={filter.id}
                                                    label={filter.label}
                                                    value={advancedFilters[filter.id]}
                                                    options={uniqueValues[filter.id] || []}
                                                    placeholder={`All ${filter.label}s`}
                                                    onChange={(val) => {
                                                        setAdvancedFilters(prev => ({ ...prev, [filter.id]: val }));
                                                        setCurrentPage(1);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                        <button
                                            onClick={() => setShowFilterModal(false)}
                                            className="h-12 px-12 rounded-2xl bg-[var(--theme-primary)] text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                    <style dangerouslySetInnerHTML={{
                                        __html: `
                                            .searchable-select-dropdown {
                                                scrollbar-width: thin;
                                                scrollbar-color: var(--theme-primary) transparent;
                                            }
                                            .searchable-select-dropdown::-webkit-scrollbar {
                                                width: 4px;
                                            }
                                            .searchable-select-dropdown::-webkit-scrollbar-track {
                                                background: transparent;
                                            }
                                            .searchable-select-dropdown::-webkit-scrollbar-thumb {
                                                background-color: var(--theme-primary);
                                                border-radius: 20px;
                                            }
                                        `
                                    }} />
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </LayoutWrapper>
    );
}

function SearchableSelect({
    label,
    value,
    options,
    onChange,
    placeholder
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (val: string) => void;
    placeholder: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredOptions = useMemo(() => {
        return options.filter(opt =>
            String(opt).toLowerCase().includes(search.toLowerCase())
        );
    }, [options, search]);

    return (
        <div className="space-y-2 relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">{label}</label>
            <div className="relative">
                <div className="relative group">
                    <input
                        type="text"
                        value={isOpen ? search : (value || '')}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            if (!isOpen) setIsOpen(true);
                        }}
                        onFocus={() => {
                            setIsOpen(true);
                        }}
                        placeholder={placeholder}
                        className="w-full p-4 bg-[var(--theme-lighter)] dark:bg-slate-800/50 rounded-2xl border-0 text-[11px] font-[1000] uppercase tracking-widest italic outline-none focus:ring-2 focus:ring-[var(--theme-primary)] transition-all shadow-sm text-left pr-10 text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    <div
                        className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} text-slate-400 group-hover:text-[var(--theme-primary)]`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <>
                            <div className="fixed inset-0 z-[130]" onClick={() => {
                                setIsOpen(false);
                                setSearch('');
                            }} />
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[140] overflow-hidden flex flex-col"
                                style={{ maxHeight: '300px' }}
                            >
                                <div className="flex-1 overflow-y-auto searchable-select-dropdown py-2">
                                    <button
                                        onClick={() => {
                                            onChange('');
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors border-b border-slate-50 dark:border-slate-700"
                                    >
                                        Clear Selection
                                    </button>
                                    {filteredOptions.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No options found</p>
                                        </div>
                                    ) : (
                                        filteredOptions.map((opt) => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    onChange(opt);
                                                    setIsOpen(false);
                                                    setSearch('');
                                                }}
                                                className={`w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${value === opt ? 'bg-[var(--theme-primary)] text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-[var(--theme-lighter)]'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
