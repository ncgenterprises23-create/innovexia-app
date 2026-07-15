'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface DiyRequirement {
    id: number;
    requirement_type: string;
    requirement: string;
    new_product: string;
    created_at: string;
    updated_at: string;
    Planned_1?: string | null; Actual_1?: string | null; Status_1?: string | null;
    Planned_2?: string | null; Actual_2?: string | null; Status_2?: string | null; lead_time_2?: string | null;
    Planned_3?: string | null; Actual_3?: string | null; Status_3?: string | null;
    Planned_4?: string | null; Actual_4?: string | null; Status_4?: string | null; Next_Follow_Up_Date_4?: string | null; remark_4?: string | null;
    Planned_5?: string | null; Actual_5?: string | null; Status_5?: string | null;
    Planned_6?: string | null; Actual_6?: string | null; Status_6?: string | null;
    Planned_7?: string | null; Actual_7?: string | null; Status_7?: string | null; lead_time_7?: string | null;
    Planned_8?: string | null; Actual_8?: string | null; Status_8?: string | null; Next_Follow_Up_Date_8?: string | null; remark_8?: string | null;
    Planned_9?: string | null; Actual_9?: string | null; Status_9?: string | null;
    Next_Follow_Up_Date?: string | null;
    Remark?: string;
    Cancelled?: string | null;
}

const STAGES = [
    { step: 1, name: 'Approval' },
    { step: 2, name: 'Order' },
    { step: 3, name: 'Advance' },
    { step: 4, name: 'Followup' },
    { step: 5, name: 'Received' },
    { step: 6, name: 'Check the Sample' },
    { step: 7, name: 'Get the Correction' },
    { step: 8, name: 'Followup 2' },
    { step: 9, name: 'Check the Sample 2' }
];

const REQ_TYPE_OPTIONS = ['One Time', 'Monthly'];
const NEW_PRODUCT_OPTIONS = ['Yes', 'No'];
const ITEMS_PER_PAGE = 10;

export default function DiyRequirementFMS() {
    const [requirements, setRequirements] = useState<DiyRequirement[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
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
    const [editingRequirement, setEditingRequirement] = useState<DiyRequirement | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [viewMode, setViewMode] = useState<'data' | 'setup'>('data');
    const [isCancelledView, setIsCancelledView] = useState(false);
    const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all'>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<DiyRequirement>>({
        requirement_type: 'One Time',
        requirement: '',
        new_product: 'No',
    });

    const toast = useToast();
    const loader = useLoader();

    // Bulk Update States
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [itemsToMarkDone, setItemsToMarkDone] = useState<Set<number>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Record<number, any>>({});

    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id: number; requirement?: string } | null>(null);
    const [removeStep, setRemoveStep] = useState<number | 'all'>(1);

    // Helper functions
    const getCurrentStep = (req: DiyRequirement): number => {
        for (let i = 1; i <= 9; i++) {
            if (!req[`Actual_${i}` as keyof DiyRequirement]) {
                return i;
            }
        }
        return 6; // All steps completed
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

        // Final check: If it lands on a Sunday, shift to Monday
        if (next.getDay() === 0) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    };

    const toggleSelection = (id: number) => {
        const next = new Set(selectedItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedItems(next);
    };

    const toggleAll = () => {
        if (selectedItems.size === filteredRequirements.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredRequirements.map(r => r.id)));
        }
    };

    const handleBulkUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.size === 0) return;

        try {
            loader.showLoader();
            const currentTime = new Date();
            const updatePromises = Array.from(selectedItems).map(id => {
                const req = requirements.find(r => r.id === id);
                if (!req) return Promise.resolve();

                const currentStep = getCurrentStep(req);
                const rowUpdate = bulkUpdates[req.id] || {};
                const updatedData: any = { id: req.id };

                // Surgical updates
                if (rowUpdate.Remark) updatedData.Remark = rowUpdate.Remark;
                if (rowUpdate.remark_4) {
                    const existing = req.remark_4 || '';
                    updatedData.remark_4 = existing ? `${existing} | ${rowUpdate.remark_4}` : rowUpdate.remark_4;
                }
                if (rowUpdate.Next_Follow_Up_Date_4) {
                    updatedData.Next_Follow_Up_Date_4 = rowUpdate.Next_Follow_Up_Date_4;
                    updatedData.Planned_4 = rowUpdate.Next_Follow_Up_Date_4;
                }
                if (rowUpdate.remark_8) {
                    const existing = req.remark_8 || '';
                    updatedData.remark_8 = existing ? `${existing} | ${rowUpdate.remark_8}` : rowUpdate.remark_8;
                }
                if (rowUpdate.Next_Follow_Up_Date_8) {
                    updatedData.Next_Follow_Up_Date_8 = rowUpdate.Next_Follow_Up_Date_8;
                    updatedData.Planned_8 = rowUpdate.Next_Follow_Up_Date_8;
                }
                if (rowUpdate.lead_time_2) updatedData.lead_time_2 = rowUpdate.lead_time_2;
                if (rowUpdate.lead_time_7) updatedData.lead_time_7 = rowUpdate.lead_time_7;

                // Handle step progression
                // SPECIAL RULE FOR STEP 4 & 8: If Next_Follow_Up_Date is provided, STAY in that Step.
                const isStep4WithFollowUp = currentStep === 4 && rowUpdate.Next_Follow_Up_Date_4;
                const isStep8WithFollowUp = currentStep === 8 && rowUpdate.Next_Follow_Up_Date_8;

                if (itemsToMarkDone.has(req.id) && currentStep <= 9 && !isStep4WithFollowUp && !isStep8WithFollowUp) {
                    updatedData[`Actual_${currentStep}`] = currentTime.toISOString();

                    if (currentStep === 6 || currentStep === 9) {
                        const statusKey = `Status_${currentStep}`;
                        const status = rowUpdate[statusKey] || 'Ok';
                        updatedData[statusKey] = status;
                        if (status === 'Not Ok') {
                            const nextStep = 7;
                            const nextConfig = stepConfigs.find(c => c.step === nextStep);
                            const nextPlanned = getNextPlannedTime(currentTime, nextConfig?.tatValue || 1, nextConfig?.tatUnit || "hours");
                            updatedData[`Planned_${nextStep}`] = nextPlanned.toISOString();

                            if (currentStep === 9) {
                                updatedData['Actual_7'] = '';
                                updatedData['Status_7'] = '';
                                updatedData['lead_time_7'] = '';
                                updatedData['Planned_8'] = '';
                                updatedData['Actual_8'] = '';
                                updatedData['Status_8'] = '';
                                updatedData['Next_Follow_Up_Date_8'] = '';
                                updatedData['remark_8'] = '';
                                updatedData['Planned_9'] = '';
                                updatedData['Actual_9'] = '';
                            }
                        }
                    } else {
                        updatedData[`Status_${currentStep}`] = 'Done';

                        // Automation for next step planning
                        if (currentStep < 9) {
                            const nextStep = currentStep + 1;
                            const nextConfig = stepConfigs.find(c => c.step === nextStep);

                            if (currentStep === 3 && req.Planned_4) {
                                // Do not overwrite Planned_4 if it was already generated by Step 2's lead time
                            } else if (currentStep === 7) {
                                // Planned_8 is handled below by Step 7 Lead Time
                            } else {
                                const nextPlanned = getNextPlannedTime(currentTime, nextConfig?.tatValue || 1, nextConfig?.tatUnit || "hours");
                                updatedData[`Planned_${nextStep}`] = nextPlanned.toISOString();
                            }

                            // Special rule: Step 2 Lead Time generates Planned_4
                            if (currentStep === 2) {
                                const leadTime = rowUpdate.lead_time_2 || req.lead_time_2;
                                if (leadTime) {
                                    const leadTimeDays = parseInt(String(leadTime)) || 0;
                                    const planned4Days = Math.max(0, leadTimeDays - 2);
                                    const planned4 = getNextPlannedTime(currentTime, planned4Days, "days");
                                    updatedData[`Planned_4`] = planned4.toISOString();
                                }
                            }

                            // Special rule: Step 7 Lead Time generates Planned_8
                            if (currentStep === 7) {
                                const leadTime = rowUpdate.lead_time_7 || req.lead_time_7;
                                if (leadTime) {
                                    const leadTimeDays = parseInt(String(leadTime)) || 0;
                                    const planned8Days = Math.max(0, leadTimeDays - 2);
                                    const planned8 = getNextPlannedTime(currentTime, planned8Days, "days");
                                    updatedData[`Planned_8`] = planned8.toISOString();
                                }
                            }
                        }
                    }
                }

                return fetch('/api/diy-requirements', {
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
            fetchRequirements();
        } catch (error) {
            toast.error('Failed to apply bulk updates');
        } finally {
            loader.hideLoader();
        }
    };

    useEffect(() => {
        fetchRequirements();
        fetchConfig();
        fetchUsers();
    }, []);

    const fetchRequirements = async () => {
        try {
            loader.showLoader();
            const res = await fetch('/api/diy-requirements');
            if (res.ok) {
                const data = await res.json();
                setRequirements(data);
            } else {
                toast.error('Failed to fetch requirements');
            }
        } catch (error) {
            toast.error('Error loading factory requirements');
        } finally {
            loader.hideLoader();
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/diy-requirements-config');
            if (res.ok) {
                const data = await res.json();
                const configArray = Array.isArray(data) ? data : data.config;
                
                if (configArray && configArray.length > 0) {
                    const syncedConfig = configArray.map((c: any) => {
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

            const res = await fetch('/api/diy-requirements-config', {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.requirement_type || !formData.requirement || !formData.new_product) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            loader.showLoader();
            const method = editingRequirement ? 'PUT' : 'POST';
            const payload = editingRequirement ? { ...formData, id: editingRequirement.id } : formData;

            const res = await fetch('/api/diy-requirements', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success(editingRequirement ? 'Requirement updated' : 'Requirement created');
                setIsModalOpen(false);
                setEditingRequirement(null);
                setFormData({ requirement_type: 'One Time', requirement: '', new_product: 'No' });
                fetchRequirements();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Operation failed');
            }
        } catch (error) {
            toast.error('Error saving requirement');
        } finally {
            loader.hideLoader();
        }
    };

    const handleEdit = (req: DiyRequirement) => {
        setEditingRequirement(req);
        setFormData({
            requirement_type: req.requirement_type,
            requirement: req.requirement,
            new_product: req.new_product,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Requirement',
            message: 'Are you sure you want to permanently delete this requirement?',
            type: 'danger',
            onConfirm: async () => {
                try {
                    loader.showLoader();
                    const res = await fetch(`/api/diy-requirements?id=${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        toast.success('Requirement deleted');
                        fetchRequirements();
                    } else {
                        toast.error('Delete failed');
                    }
                } catch (error) {
                    toast.error('Error deleting requirement');
                } finally {
                    loader.hideLoader();
                    setConfirmModal({ ...confirmModal, isOpen: false });
                }
            }
        });
    };

    const handleRemoveFollowUp = async () => {
        if (!removeTarget) return;
        try {
            loader.showLoader();
            const payload: any = { id: removeTarget.id };

            if (removeStep === 'all') {
                [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(step => {
                    payload[`Actual_${step}`] = '';
                    payload[`Status_${step}`] = '';
                    if (step > 1) payload[`Planned_${step}`] = '';
                });
                payload['lead_time_2'] = '';
                payload['lead_time_7'] = '';
                payload['Next_Follow_Up_Date_4'] = '';
                payload['remark_4'] = '';
                payload['Next_Follow_Up_Date_8'] = '';
                payload['remark_8'] = '';
            } else {
                const stepNum = removeStep as number;
                [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(step => {
                    if (step === stepNum) {
                        payload[`Actual_${step}`] = '';
                        payload[`Status_${step}`] = '';
                        if (step === 2) payload['lead_time_2'] = '';
                        if (step === 7) payload['lead_time_7'] = '';
                        payload['lead_time_7'] = '';
                        if (step === 4) {
                            payload['Next_Follow_Up_Date_4'] = '';
                            payload['remark_4'] = '';
                        }
                        if (step === 8) {
                            payload['Next_Follow_Up_Date_8'] = '';
                            payload['remark_8'] = '';
                        }
                    } else if (step > stepNum) {
                        payload[`Planned_${step}`] = '';
                        payload[`Actual_${step}`] = '';
                        payload[`Status_${step}`] = '';
                        if (step === 2) payload['lead_time_2'] = '';
                        if (step === 7) payload['lead_time_7'] = '';
                        payload['lead_time_7'] = '';
                        if (step === 4) {
                            payload['Next_Follow_Up_Date_4'] = '';
                            payload['remark_4'] = '';
                        }
                        if (step === 8) {
                            payload['Next_Follow_Up_Date_8'] = '';
                            payload['remark_8'] = '';
                        }
                    }
                });
            }

            const res = await fetch('/api/diy-requirements', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success('Follow-up details removed');
                setShowRemoveModal(false);
                setRemoveTarget(null);
                fetchRequirements();
            } else {
                toast.error('Operation failed');
            }
        } catch (error) {
            toast.error('Error removing follow-up');
        } finally {
            loader.hideLoader();
        }
    };

    const openRemoveModal = (id: number, requirement?: string) => {
        setRemoveTarget({ id, requirement });
        setRemoveStep(1);
        setShowRemoveModal(true);
    };

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof DiyRequirement | string) => {
        if (!sortConfig || sortConfig.key !== key) return (
            <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
        );
        return sortConfig.direction === 'asc' ? (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
        ) : (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        );
    };

    const getStageSortIcon = (step: number) => {
        const key = `Actual_${step}`;
        return getSortIcon(key);
    };

    const getDelayInfo = (planned: string | null, actual: string | null) => {
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

    const filteredRequirements = useMemo(() => {
        let result = [...requirements];

        if (viewMode === 'setup') return [];

        if (isCancelledView) {
            result = result.filter(r => r.Cancelled === 'Cancelled');
        } else {
            result = result.filter(r => r.Cancelled !== 'Cancelled');
        }

        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = (a as any)[sortConfig.key];
                const bVal = (b as any)[sortConfig.key];
                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // Apply step filter tile
        if (!isCancelledView && activeStepFilter !== 'all') {
            result = result.filter(r => {
                const step = activeStepFilter as number;
                const isDone = !!(r as any)[`Actual_${step}`];
                const isPreviousDone = step === 1 || !!(r as any)[`Actual_${step - 1}`];
                return !isDone && isPreviousDone;
            });
        }

        // Apply Time-Based Filter
        if (!isCancelledView && activeTimeFilter) {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;

            result = result.filter(r => {
                // Determine current step for this requirement
                let currentStep = 1;
                for (let s = 1; s <= 9; s++) {
                    if ((r as any)[`Actual_${s}`]) currentStep = s + 1;
                    else break;
                }
                if (currentStep > 9) return false;

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
    }, [requirements, sortConfig, isCancelledView, viewMode, activeStepFilter, activeTimeFilter]);

    const statusStats = useMemo(() => {
        const active = requirements.filter(r => r.Cancelled !== 'Cancelled');
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
            Step9: active.filter(r => r.Actual_8 && !r.Actual_9).length,
        };
    }, [requirements]);

    const timeStats = useMemo(() => {
        const active = requirements.filter(r => r.Cancelled !== 'Cancelled');
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 7': 0, 'Next 15': 0 };

        active.forEach(r => {
            let currentStep = 1;
            for (let s = 1; s <= 9; s++) {
                if ((r as any)[`Actual_${s}`]) currentStep = s + 1;
                else break;
            }
            if (currentStep > 9) return;

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
    }, [requirements]);

    const totalPages = Math.ceil(filteredRequirements.length / ITEMS_PER_PAGE);
    const paginatedRequirements = filteredRequirements.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <LayoutWrapper>
            <div className="flex-1 flex flex-col bg-[var(--theme-lighter)] overflow-hidden">
                <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-2">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-[var(--theme-primary)]/10 rounded-[2rem] border border-[var(--theme-primary)]/20 shadow-inner">
                                <svg className="w-10 h-10 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-[1000] text-[var(--theme-primary)] tracking-tighter leading-none mb-1 italic uppercase">
                                    Diy Requirement FMS
                                </h1>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Diy Requirement Tracking</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700">
                            {[
                                { id: 'data', label: 'Data View', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
                                { id: 'cancelled', label: 'Cancelled View', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                                { id: 'setup', label: 'Setup', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
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
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${(tab.id === 'cancelled' && isCancelledView) || (tab.id === 'data' && viewMode === 'data' && !isCancelledView) || (tab.id === 'setup' && viewMode === 'setup')
                                        ? 'bg-[var(--theme-primary)] text-white shadow-lg shadow-[var(--theme-primary)]/25 scale-[1.02]'
                                        : 'text-slate-400 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5'
                                        }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                            <div className="w-px h-8 bg-slate-100 dark:bg-slate-700 mx-1" />
                            <button
                                onClick={() => { setEditingRequirement(null); setFormData({ requirement_type: 'One Time', requirement: '', new_product: 'No' }); setIsModalOpen(true); }}
                                className="bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] p-2.5 rounded-2xl hover:bg-[var(--theme-primary)] hover:text-white transition-all shadow-sm"
                                title="Add New"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-white dark:border-slate-700 overflow-hidden">
                        {viewMode === 'setup' ? (
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">FMS Step Configuration</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure workflow steps and turnaround times</p>
                                    </div>
                                    <button
                                        onClick={handleSaveConfig}
                                        className="bg-[var(--theme-primary)] text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
                                    >
                                        Save Configuration
                                    </button>
                                </div>

                                <div className="overflow-hidden border border-slate-100 dark:border-slate-700 rounded-[2rem]">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400">
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Step</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Step Name</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Responsible Person (Doer)</th>
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
                                                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-[var(--theme-primary)] outline-none"
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
                                                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-[var(--theme-primary)] outline-none"
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
                                                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-[var(--theme-primary)] outline-none uppercase"
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
                                {/* Step Filter Tiles */}
                                {!isCancelledView && (
                                    <div className="overflow-x-auto pb-0 scroll-smooth -mx-0 px-4 pt-3">
                                        <div className="flex gap-2 min-w-max pr-2 pb-1">
                                            {STAGES.reduce((tiles, s) => {
                                                const colors = [
                                                    { gradient: 'from-slate-50 to-slate-100', border: 'border-slate-200', text: 'text-slate-700', iconBg: 'from-slate-500 to-slate-600', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                                                    { gradient: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', text: 'text-indigo-700', iconBg: 'from-indigo-500 to-indigo-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                    { gradient: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', text: 'text-yellow-700', iconBg: 'from-yellow-500 to-yellow-600', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
                                                    { gradient: 'from-orange-50 to-orange-100', border: 'border-orange-200', text: 'text-orange-700', iconBg: 'from-orange-500 to-orange-600', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                    { gradient: 'from-pink-50 to-pink-100', border: 'border-pink-200', text: 'text-pink-700', iconBg: 'from-pink-500 to-pink-600', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                                                    { gradient: 'from-purple-50 to-purple-100', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'from-purple-500 to-purple-600', icon: 'M5 13l4 4L19 7' },
                                                ];
                                                return tiles;
                                            }, [] as any[])}
                                            {[
                                                { step: 'all' as const, label: 'All Items', value: statusStats.Total, gradient: 'from-slate-50 to-slate-100', border: 'border-slate-200', iconBg: 'from-slate-500 to-slate-600', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                                                { step: 1 as const, label: `1. ${STAGES[0]?.name || 'Step 1'}`, value: statusStats.Step1, gradient: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', iconBg: 'from-indigo-500 to-indigo-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                { step: 2 as const, label: `2. ${STAGES[1]?.name || 'Step 2'}`, value: statusStats.Step2, gradient: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', iconBg: 'from-yellow-500 to-yellow-600', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
                                                { step: 3 as const, label: `3. ${STAGES[2]?.name || 'Step 3'}`, value: statusStats.Step3, gradient: 'from-orange-50 to-orange-100', border: 'border-orange-200', iconBg: 'from-orange-500 to-orange-600', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                { step: 4 as const, label: `4. ${STAGES[3]?.name || 'Step 4'}`, value: statusStats.Step4, gradient: 'from-pink-50 to-pink-100', border: 'border-pink-200', iconBg: 'from-pink-500 to-pink-600', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                                                { step: 5 as const, label: `5. ${STAGES[4]?.name || 'Step 5'}`, value: statusStats.Step5, gradient: 'from-purple-50 to-purple-100', border: 'border-purple-200', iconBg: 'from-purple-500 to-purple-600', icon: 'M5 13l4 4L19 7' },
                                                { step: 6 as const, label: `6. ${STAGES[5]?.name || 'Step 6'}`, value: statusStats.Step6, gradient: 'from-teal-50 to-teal-100', border: 'border-teal-200', iconBg: 'from-teal-500 to-teal-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                { step: 7 as const, label: `7. ${STAGES[6]?.name || 'Step 7'}`, value: statusStats.Step7, gradient: 'from-cyan-50 to-cyan-100', border: 'border-cyan-200', iconBg: 'from-cyan-500 to-cyan-600', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
                                                { step: 8 as const, label: `8. ${STAGES[7]?.name || 'Step 8'}`, value: statusStats.Step8, gradient: 'from-rose-50 to-rose-100', border: 'border-rose-200', iconBg: 'from-rose-500 to-rose-600', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2' },
                                                { step: 9 as const, label: `9. ${STAGES[8]?.name || 'Step 9'}`, value: statusStats.Step9, gradient: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200', iconBg: 'from-emerald-500 to-emerald-600', icon: 'M5 13l4 4L19 7' },
                                            ].map((stat, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    whileHover={activeStepFilter === stat.step ? { scale: 1 } : { y: -1 }}
                                                    onClick={() => {
                                                        setActiveStepFilter(stat.step);
                                                        if (stat.step === 'all') setActiveTimeFilter(null);
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
                                                        <p className="text-[8px] font-bold text-black uppercase tracking-wider truncate opacity-80">{stat.label}</p>
                                                        <p className="text-base font-bold text-black leading-none mt-0.5">{stat.value}</p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pagination Controls Row */}
                                <div className="flex bg-[var(--theme-lighter)]/50 dark:bg-slate-900/50 p-2 border-y border-slate-100 dark:border-slate-800 backdrop-blur-md sticky top-0 z-[20]">
                                    <div className="flex-1 flex items-center justify-between px-4">
                                        <div className="flex items-center gap-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                Showing <span className="text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>- <span className="text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredRequirements.length)}</span> of <span className="text-slate-900 dark:text-white">{filteredRequirements.length}</span>
                                            </p>
                                            {selectedItems.size > 0 && (
                                                <button
                                                    onClick={() => setIsBulkUpdateModalOpen(true)}
                                                    className="h-8 px-4 rounded-xl bg-[var(--theme-primary)] text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all ml-2"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    Update Status ({selectedItems.size})
                                                </button>
                                            )}
                                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                                {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                                                    <button
                                                        key={filter}
                                                        onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                                                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative ${activeTimeFilter === filter
                                                            ? 'bg-[var(--theme-primary)] text-white shadow-md'
                                                            : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'
                                                            }`}
                                                    >
                                                        {filter}
                                                        {timeStats[filter] > 0 && (
                                                            <sup className={`ml-1 text-[8px] ${activeTimeFilter === filter ? 'text-white/80' : (filter === 'Delayed' ? 'text-red-500' : 'text-[var(--theme-primary)]')}`}>
                                                                {timeStats[filter]}
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
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                                                                className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${currentPage === i ? 'bg-[var(--theme-primary)] text-white shadow-md' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
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

                                {/* Table Section */}
                                <div className="overflow-x-auto custom-scrollbar relative">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[var(--theme-primary)] sticky top-0 z-[20] border-none shadow-sm h-14">
                                                {!isCancelledView && (
                                                    <th className="px-4 py-4 w-12 text-center">
                                                        <div className="flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.size === filteredRequirements.length && filteredRequirements.length > 0}
                                                                onChange={toggleAll}
                                                                className="w-4 h-4 rounded border-2 border-white/30 bg-white/10 checked:bg-white checked:border-white transition-all cursor-pointer accent-white"
                                                            />
                                                        </div>
                                                    </th>
                                                )}
                                                <th className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] text-center w-32 sticky left-0 z-[21] bg-[var(--theme-primary)]">Actions</th>
                                                <th onClick={() => requestSort('id')} className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap text-center cursor-pointer hover:bg-black/5 transition-colors group">
                                                    <div className="flex items-center justify-center gap-2">ID {getSortIcon('id')}</div>
                                                </th>
                                                <th onClick={() => requestSort('requirement')} className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap cursor-pointer hover:bg-black/5 transition-colors group text-left min-w-[300px]">
                                                    <div className="flex items-center gap-2">Requirement Details {getSortIcon('requirement')}</div>
                                                </th>
                                                <th onClick={() => requestSort('created_at')} className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap text-center cursor-pointer hover:bg-black/5 transition-colors group">
                                                    <div className="flex items-center justify-center gap-2">Created {getSortIcon('created_at')}</div>
                                                </th>
                                                {STAGES.map((s) => (
                                                    <Fragment key={s.step}>
                                                        <th onClick={() => requestSort(`Actual_${s.step}`)} className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] text-center whitespace-nowrap cursor-pointer hover:bg-black/5 transition-colors group min-w-[150px]">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="opacity-50 text-[9px] tracking-widest">STEP {s.step} :</span>
                                                                <span>{s.name}</span>
                                                                {getStageSortIcon(s.step)}
                                                            </div>
                                                        </th>
                                                    </Fragment>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                            <AnimatePresence mode='popLayout'>
                                                {paginatedRequirements.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-20 text-center">
                                                            <div className="flex flex-col items-center gap-4">
                                                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center text-slate-300">
                                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                                </div>
                                                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Requirements Found</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedRequirements.map((req, idx) => {
                                                        return (
                                                            <motion.tr
                                                                key={req.id}
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ delay: idx * 0.02 }}
                                                                className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group ${selectedItems.has(req.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                                            >
                                                                {!isCancelledView && (
                                                                    <td className="px-4 py-2 border-r border-slate-50 dark:border-slate-700/50">
                                                                        <div className="flex items-center justify-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedItems.has(req.id)}
                                                                                onChange={() => toggleSelection(req.id)}
                                                                                className="w-4 h-4 rounded border-2 border-slate-200 dark:border-slate-700 checked:bg-[var(--theme-primary)] checked:border-[var(--theme-primary)] transition-all cursor-pointer accent-[var(--theme-primary)]"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                )}
                                                                <td className="px-4 py-2 border-r border-slate-50 dark:border-slate-700/50 sticky left-0 z-[10] bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors">
                                                                    <div className="flex items-center justify-center gap-1 transition-all duration-200">
                                                                        <button
                                                                            onClick={() => handleEdit(req)}
                                                                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                                                            title="Edit"
                                                                        >
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const action = req.Cancelled === 'Cancelled' ? 'restore' : 'cancel';
                                                                                setConfirmModal({
                                                                                    isOpen: true,
                                                                                    title: `${action.charAt(0).toUpperCase() + action.slice(1)} Requirement`,
                                                                                    message: `Are you sure you want to ${action} this requirement?`,
                                                                                    type: action === 'cancel' ? 'warning' : 'info',
                                                                                    onConfirm: async () => {
                                                                                        try {
                                                                                            loader.showLoader();
                                                                                            const res = await fetch('/api/diy-requirements', {
                                                                                                method: 'PUT',
                                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                                body: JSON.stringify({ id: req.id, Cancelled: req.Cancelled === 'Cancelled' ? '' : 'Cancelled' })
                                                                                            });
                                                                                            if (res.ok) {
                                                                                                toast.success(req.Cancelled === 'Cancelled' ? 'Requirement restored' : 'Requirement cancelled');
                                                                                                fetchRequirements();
                                                                                            }
                                                                                        } catch (error) {
                                                                                            toast.error('Operation failed');
                                                                                        } finally {
                                                                                            loader.hideLoader();
                                                                                            setConfirmModal({ ...confirmModal, isOpen: false });
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }}
                                                                            className={`p-1.5 transition-colors rounded-lg ${req.Cancelled === 'Cancelled' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-orange-500 hover:bg-orange-50'}`}
                                                                            title={req.Cancelled === 'Cancelled' ? 'Restore' : 'Cancel'}
                                                                        >
                                                                            {req.Cancelled === 'Cancelled' ? (
                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                                                                            ) : (
                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => openRemoveModal(req.id, req.requirement)}
                                                                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
                                                                            title="Remove Follow Up"
                                                                        >
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDelete(req.id)}
                                                                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                                                            title="Delete"
                                                                        >
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-2 text-center text-[12px] font-black text-slate-400 border-r border-slate-50 dark:border-slate-700/50">#{req.id}</td>
                                                                <td className="px-6 py-3 border-r border-slate-50 dark:border-slate-700/50 min-w-[300px]">
                                                                    <div className="space-y-2">
                                                                        {/* Requirement with Icon */}
                                                                        <div className="flex items-start gap-2.5">
                                                                            <div className="mt-0.5 p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-500 shadow-sm">
                                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                                            </div>
                                                                            <div className="text-[13px] font-black text-slate-700 dark:text-slate-200 uppercase leading-tight line-clamp-2 pt-0.5">{req.requirement}</div>
                                                                        </div>

                                                                        <div className="flex flex-wrap items-center gap-3 pl-9">
                                                                            {/* Req. Type */}
                                                                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/40 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800">
                                                                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">{req.requirement_type}</span>
                                                                            </div>

                                                                            {/* New Product */}
                                                                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${req.new_product === 'Yes' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30 text-orange-600' : 'bg-slate-50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800/30 text-slate-500'}`}>
                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                                <span className="text-[10px] font-black uppercase tracking-tight">{req.new_product === 'Yes' ? 'New Product' : 'Repeat'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-2 text-center border-r border-slate-50 dark:border-slate-700/50">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{new Date(req.created_at).toLocaleDateString()}</span>
                                                                        <span className="text-[10px] font-bold text-slate-400 italic">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                </td>
                                                                {STAGES.map((s) => {
                                                                    const actual = req[`Actual_${s.step}` as keyof DiyRequirement];
                                                                    const planned = req[`Planned_${s.step}` as keyof DiyRequirement];
                                                                    const delayInfo = getDelayInfo(planned as string, actual as string);

                                                                    return (
                                                                        <Fragment key={s.step}>
                                                                            <td className="px-4 py-2 border-r border-slate-50 dark:border-slate-700/50 min-w-[150px]">
                                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                                    <div className="flex justify-between gap-2">
                                                                                        <span className="text-slate-400">P:</span>
                                                                                        <span className="text-slate-600 dark:text-slate-300">
                                                                                            {planned ? new Date(planned as string).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between gap-2">
                                                                                        <span className="text-slate-400">A:</span>
                                                                                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                                                                            {actual ? new Date(actual as string).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                                                        </span>
                                                                                    </div>
                                                                                    {delayInfo && (
                                                                                        <div className={`text-[8px] text-right ${delayInfo.color}`}>
                                                                                            {delayInfo.text}
                                                                                        </div>
                                                                                    )}

                                                                                    {(s.step === 2 || s.step === 7) && req[`lead_time_${s.step}` as keyof DiyRequirement] && (
                                                                                        <div className="mt-1 flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-700 pt-1">
                                                                                            <span className="text-slate-400 font-bold uppercase tracking-tighter text-[8px] whitespace-nowrap">Lead Time :</span>
                                                                                            <span className="text-slate-700 dark:text-slate-200 font-black text-[9px]">{req[`lead_time_${s.step}` as keyof DiyRequirement] as string}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {(s.step === 4 || s.step === 8) && (req[`Next_Follow_Up_Date_${s.step}` as keyof DiyRequirement] || req[`remark_${s.step}` as keyof DiyRequirement]) && (
                                                                                        <div className="mt-1 space-y-1 border-t border-slate-100 dark:border-slate-700 pt-1">
                                                                                            {req[`Next_Follow_Up_Date_${s.step}` as keyof DiyRequirement] && (
                                                                                                <div className="flex items-center gap-1.5">
                                                                                                    <span className="text-slate-400 font-bold uppercase tracking-tighter text-[8px] whitespace-nowrap">NFU :</span>
                                                                                                    <span className="text-slate-700 dark:text-slate-200 font-black text-[9px]">{new Date(req[`Next_Follow_Up_Date_${s.step}` as keyof DiyRequirement] as string).toLocaleDateString()}</span>
                                                                                                </div>
                                                                                            )}
                                                                                            {req[`remark_${s.step}` as keyof DiyRequirement] && (
                                                                                                <div className="flex items-start gap-1.5">
                                                                                                    <span className="text-slate-400 font-bold uppercase tracking-tighter text-[8px] whitespace-nowrap pt-0.5">Remark :</span>
                                                                                                    <span className="text-slate-600 dark:text-slate-300 italic text-[8px] leading-tight line-clamp-2" title={req[`remark_${s.step}` as keyof DiyRequirement] as string}>@{req[`remark_${s.step}` as keyof DiyRequirement] as string}</span>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </Fragment>
                                                                    );
                                                                })}
                                                            </motion.tr>
                                                        );
                                                    })
                                                )}


                                            </AnimatePresence>
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/* Custom Confirmation Modal */}
            <AnimatePresence mode="wait">
                {confirmModal.isOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-sm border border-slate-100 dark:border-slate-800"
                        >
                            <div className={`px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center text-center`}>
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${confirmModal.type === 'danger' ? 'bg-red-50 text-red-500' :
                                    confirmModal.type === 'warning' ? 'bg-orange-50 text-orange-500' :
                                        'bg-blue-50 text-blue-500'
                                    }`}>
                                    {confirmModal.type === 'danger' ? (
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    ) : confirmModal.type === 'warning' ? (
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    ) : (
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    )}
                                </div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{confirmModal.title}</h3>
                                <p className="text-[11px] font-bold text-slate-400 mt-2 px-4 uppercase tracking-widest">{confirmModal.message}</p>
                            </div>
                            <div className="flex p-4 gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                                <button
                                    onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                    className="flex-1 h-12 rounded-2xl border-2 border-slate-100 dark:border-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmModal.onConfirm}
                                    className={`flex-[1.5] h-12 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest shadow-lg transition-all ${confirmModal.type === 'danger' ? 'bg-red-500 shadow-red-500/20 hover:bg-red-600' :
                                        confirmModal.type === 'warning' ? 'bg-orange-500 shadow-orange-500/20 hover:bg-orange-600' :
                                            'bg-blue-500 shadow-blue-500/20 hover:bg-blue-600'
                                        }`}
                                >
                                    Confirm Action
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden w-full max-w-lg border border-slate-100 dark:border-slate-800 flex flex-col"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-[var(--theme-primary)] flex justify-between items-center text-white">
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tight">
                                        {editingRequirement ? 'Edit Entry' : 'New Entry'}
                                    </h2>
                                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">Submit Requirement Details</p>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Requirement Type</label>
                                    <select
                                        value={formData.requirement_type}
                                        onChange={(e) => setFormData({ ...formData, requirement_type: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)]/20 outline-none transition-all dark:text-white"
                                    >
                                        {REQ_TYPE_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Requirement</label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={formData.requirement}
                                        onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-bold text-sm focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)]/20 outline-none transition-all dark:text-white resize-none"
                                        placeholder="Enter details..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Product?</label>
                                    <select
                                        value={formData.new_product}
                                        onChange={(e) => setFormData({ ...formData, new_product: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)]/20 outline-none transition-all dark:text-white"
                                    >
                                        {NEW_PRODUCT_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 h-12 rounded-2xl border-2 border-slate-100 dark:border-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] h-12 rounded-2xl bg-[var(--theme-primary)] text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        {editingRequirement ? 'Update Item' : 'Create Item'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bulk Update Modal */}
            <AnimatePresence>
                {isBulkUpdateModalOpen && selectedItems.size > 0 && (
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
                                    <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-100">{selectedItems.size} records ready to be processed.</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {Array.from(new Set(Array.from(selectedItems).map(id => {
                                        const r = requirements.find(req => req.id === id);
                                        return r ? getCurrentStep(r) : null;
                                    }).filter(Boolean))).sort((a, b) => (a || 0) - (b || 0)).map(stepNum => {
                                        if (stepNum === null || stepNum > 9) return null;
                                        const stage = STAGES.find(s => s.step === stepNum);
                                        const config = stepConfigs.find(c => c.step === stepNum);
                                        const stepItems = requirements.filter(r => selectedItems.has(r.id) && getCurrentStep(r) === stepNum);

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

                                                    {(stepNum === 6 || stepNum === 9) ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    const statusKey = `Status_${stepNum}`;
                                                                    const allMarked = stepItems.every(i => itemsToMarkDone.has(i.id) && bulkUpdates[i.id]?.[statusKey] === 'Ok');
                                                                    const next = new Set(itemsToMarkDone);
                                                                    const nextBulk = { ...bulkUpdates };
                                                                    if (allMarked) {
                                                                        stepItems.forEach(i => { next.delete(i.id); delete nextBulk[i.id]?.[statusKey]; });
                                                                    } else {
                                                                        stepItems.forEach(i => { next.add(i.id); nextBulk[i.id] = { ...nextBulk[i.id], [statusKey]: 'Ok' }; });
                                                                    }
                                                                    setItemsToMarkDone(next);
                                                                    setBulkUpdates(nextBulk);
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${stepItems.every(i => itemsToMarkDone.has(i.id) && bulkUpdates[i.id]?.[`Status_${stepNum}`] === 'Ok')
                                                                    ? 'border-green-500 bg-green-500 text-white'
                                                                    : 'border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
                                                                    }`}
                                                            >
                                                                {stepItems.every(i => itemsToMarkDone.has(i.id) && bulkUpdates[i.id]?.[`Status_${stepNum}`] === 'Ok') ? 'Unmark All' : 'Mark All Ok'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const statusKey = `Status_${stepNum}`;
                                                                    const allMarked = stepItems.every(i => itemsToMarkDone.has(i.id) && bulkUpdates[i.id]?.[statusKey] === 'Not Ok');
                                                                    const next = new Set(itemsToMarkDone);
                                                                    const nextBulk = { ...bulkUpdates };
                                                                    if (allMarked) {
                                                                        stepItems.forEach(i => { next.delete(i.id); delete nextBulk[i.id]?.[statusKey]; });
                                                                    } else {
                                                                        stepItems.forEach(i => { next.add(i.id); nextBulk[i.id] = { ...nextBulk[i.id], [statusKey]: 'Not Ok' }; });
                                                                    }
                                                                    setItemsToMarkDone(next);
                                                                    setBulkUpdates(nextBulk);
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${stepItems.every(i => itemsToMarkDone.has(i.id) && bulkUpdates[i.id]?.[`Status_${stepNum}`] === 'Not Ok')
                                                                    ? 'border-red-500 bg-red-500 text-white'
                                                                    : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                                                                    }`}
                                                            >
                                                                {stepItems.every(i => itemsToMarkDone.has(i.id) && bulkUpdates[i.id]?.[`Status_${stepNum}`] === 'Not Ok') ? 'Unmark All' : 'Mark All Not Ok'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                const allMarked = stepItems.every(i => itemsToMarkDone.has(i.id));
                                                                const next = new Set(itemsToMarkDone);
                                                                if (allMarked) {
                                                                    stepItems.forEach(i => next.delete(i.id));
                                                                } else {
                                                                    stepItems.forEach(i => next.add(i.id));
                                                                }
                                                                setItemsToMarkDone(next);
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${stepItems.every(i => itemsToMarkDone.has(i.id))
                                                                ? 'border-slate-200 text-slate-400 dark:border-slate-700'
                                                                : 'border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-white'
                                                                }`}
                                                        >
                                                            {stepItems.every(i => itemsToMarkDone.has(i.id)) ? 'Unmark All' : 'Mark Stage Done'}
                                                        </button>
                                                    )}
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
                                                                        <span className="text-[10px] font-black w-5 h-5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-[var(--theme-primary)] transition-colors shadow-sm text-[8px]">
                                                                            {idx + 1}
                                                                        </span>
                                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID #{item.id}</span>
                                                                    </div>
                                                                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{item.requirement}</h4>
                                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                        {item.requirement_type}
                                                                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                                        {item.new_product}
                                                                    </p>
                                                                </div>

                                                                <div className="flex items-center gap-3 shrink-0 bg-white dark:bg-slate-900 p-1 px-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                    {(stepNum === 6 || stepNum === 9) ? (
                                                                        <div className="flex gap-1">
                                                                            <button
                                                                                onClick={() => {
                                                                                    const statusKey = `Status_${stepNum}`;
                                                                                    const next = new Set(itemsToMarkDone);
                                                                                    const nextBulk = { ...bulkUpdates };
                                                                                    if (itemsToMarkDone.has(item.id) && bulkUpdates[item.id]?.[statusKey] === 'Ok') {
                                                                                        next.delete(item.id);
                                                                                        delete nextBulk[item.id]?.[statusKey];
                                                                                    } else {
                                                                                        next.add(item.id);
                                                                                        nextBulk[item.id] = { ...nextBulk[item.id], [statusKey]: 'Ok' };
                                                                                    }
                                                                                    setItemsToMarkDone(next);
                                                                                    setBulkUpdates(nextBulk);
                                                                                }}
                                                                                className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all border ${itemsToMarkDone.has(item.id) && bulkUpdates[item.id]?.[`Status_${stepNum}`] === 'Ok'
                                                                                    ? 'border-green-500 bg-green-500 text-white'
                                                                                    : 'border-slate-200 text-slate-400 hover:border-green-500 hover:text-green-500'
                                                                                    }`}
                                                                            >Ok</button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const statusKey = `Status_${stepNum}`;
                                                                                    const next = new Set(itemsToMarkDone);
                                                                                    const nextBulk = { ...bulkUpdates };
                                                                                    if (itemsToMarkDone.has(item.id) && bulkUpdates[item.id]?.[statusKey] === 'Not Ok') {
                                                                                        next.delete(item.id);
                                                                                        delete nextBulk[item.id]?.[statusKey];
                                                                                    } else {
                                                                                        next.add(item.id);
                                                                                        nextBulk[item.id] = { ...nextBulk[item.id], [statusKey]: 'Not Ok' };
                                                                                    }
                                                                                    setItemsToMarkDone(next);
                                                                                    setBulkUpdates(nextBulk);
                                                                                }}
                                                                                className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all border ${itemsToMarkDone.has(item.id) && bulkUpdates[item.id]?.[`Status_${stepNum}`] === 'Not Ok'
                                                                                    ? 'border-red-500 bg-red-500 text-white'
                                                                                    : 'border-slate-200 text-slate-400 hover:border-red-500 hover:text-red-500'
                                                                                    }`}
                                                                            >Not Ok</button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
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
                                                                                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[16px] after:w-[16px] after:transition-all peer-checked:bg-green-500 rounded-full"></div>
                                                                            </label>
                                                                            <span className={`text-[7px] font-black uppercase tracking-widest ${itemsToMarkDone.has(item.id) ? 'text-green-500' : 'text-slate-400'}`}>
                                                                                {itemsToMarkDone.has(item.id) ? 'DONE' : 'NEXT'}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {(stepNum === 2 || stepNum === 4 || stepNum === 7 || stepNum === 8) && (
                                                                <div className="grid grid-cols-2 gap-2 pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50">
                                                                    {stepNum === 2 && (
                                                                        <div className="col-span-full">
                                                                            <input
                                                                                type="number"
                                                                                value={bulkUpdates[item.id]?.lead_time_2 ?? (item.lead_time_2 || '')}
                                                                                onChange={(e) => setBulkUpdates(prev => ({
                                                                                    ...prev,
                                                                                    [item.id]: { ...prev[item.id], lead_time_2: e.target.value }
                                                                                }))}
                                                                                className="w-full h-7 px-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-900 dark:text-white outline-none focus:border-[var(--theme-primary)]"
                                                                                placeholder="Lead Time (Days)..."
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {stepNum === 7 && (
                                                                        <div className="col-span-full">
                                                                            <input
                                                                                type="number"
                                                                                value={bulkUpdates[item.id]?.lead_time_7 ?? (item.lead_time_7 || '')}
                                                                                onChange={(e) => setBulkUpdates(prev => ({
                                                                                    ...prev,
                                                                                    [item.id]: { ...prev[item.id], lead_time_7: e.target.value }
                                                                                }))}
                                                                                className="w-full h-7 px-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-900 dark:text-white outline-none focus:border-[var(--theme-primary)]"
                                                                                placeholder="Lead Time (Days)..."
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {(stepNum === 4 || stepNum === 8) && (
                                                                        <>
                                                                            <input
                                                                                type="datetime-local"
                                                                                value={bulkUpdates[item.id]?.[`Next_Follow_Up_Date_${stepNum}`] ?? (item[`Next_Follow_Up_Date_${stepNum}` as keyof DiyRequirement] ? new Date(item[`Next_Follow_Up_Date_${stepNum}` as keyof DiyRequirement] as string).toISOString().slice(0, 16) : '')}
                                                                                onChange={(e) => setBulkUpdates(prev => ({
                                                                                    ...prev,
                                                                                    [item.id]: { ...prev[item.id], [`Next_Follow_Up_Date_${stepNum}`]: e.target.value }
                                                                                }))}
                                                                                className="w-full h-7 px-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-[8px] font-bold text-slate-900 dark:text-white outline-none focus:border-[var(--theme-primary)]"
                                                                            />
                                                                            <div>
                                                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Add New Remark (Stage {stepNum})</label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={bulkUpdates[item.id]?.[`remark_${stepNum}`] ?? ''}
                                                                                    onChange={(e) => setBulkUpdates(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: { ...prev[item.id], [`remark_${stepNum}`]: e.target.value }
                                                                                    }))}
                                                                                    className="w-full h-7 px-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-900 dark:text-white outline-none focus:border-[var(--theme-primary)]"
                                                                                    placeholder="Type here to add to existing..."
                                                                                />
                                                                            </div>
                                                                        </>
                                                                    )}
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
                )}
            </AnimatePresence>

            {/* Remove Follow Up Modal */}
            <AnimatePresence>
                {showRemoveModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-none">Remove Details</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest leading-tight">{removeTarget?.requirement}</p>
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Select range to remove:</p>
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        onClick={() => setRemoveStep('all')}
                                        className={`p-3 rounded-2xl border-2 text-left transition-all ${removeStep === 'all'
                                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                            : 'border-slate-100 dark:border-slate-700 text-slate-500 hover:border-indigo-200'
                                            }`}
                                    >
                                        <div className="font-black text-xs uppercase tracking-widest">Remove All</div>
                                        <div className="text-[10px] opacity-70 font-medium tracking-tight">Clears all follow-up data for this requirement</div>
                                    </button>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(step => (
                                        <button
                                            key={step}
                                            onClick={() => setRemoveStep(step)}
                                            className={`p-3 rounded-2xl border-2 text-left transition-all ${removeStep === step
                                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                                : 'border-slate-100 dark:border-slate-700 text-slate-500 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className="font-black text-xs uppercase tracking-widest">From Step {step}</div>
                                            <div className="text-[10px] opacity-70 font-medium tracking-tight">Clears data from step {step} onwards</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowRemoveModal(false)}
                                    className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all font-mono"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRemoveFollowUp}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                                >
                                    Confirm Clear
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
        }
        .dark ::-webkit-scrollbar-thumb {
            background: #475569;
        }
      `}</style>
        </LayoutWrapper >
    );
}
