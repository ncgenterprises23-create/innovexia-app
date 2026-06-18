'use client';

import React, { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { Calendar } from 'lucide-react';

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface PurchaseFMSOrder {
    id: number;
    Timestamp: string;
    sku_code: string;
    Item_name: string;
    Party_Name: string;
    'Average Daily Consumption': string | number;
    Lead_Time_2: string | number;
    MOQ: string | number;
    'Po No.': string;
    Next_Follow_Up_Date: string | null;
    Remark?: string;
    Planned_1: string | null; Actual_1: string | null; Status_1: string | null;
    Planned_2: string | null; Actual_2: string | null; Status_2: string | null;
    Planned_3: string | null; Actual_3: string | null; Status_3: string | null;
    Planned_4: string | null; Actual_4: string | null; Status_4: string | null;
    Planned_5?: string | null;
    Actual_5?: string | null;
    Status_5?: string | null;
    Cancelled?: string | null;
}

const STAGES = [
    { step: 1, name: 'PO' },
    { step: 2, name: 'Sent' },
    { step: 3, name: 'Followup' },
    { step: 4, name: 'Received' },
];

const ITEMS_PER_PAGE = 10;

const getCurrentStep = (order: PurchaseFMSOrder) => {
    if (!order.Actual_1) return 1;
    if (!order.Actual_2) return 2;
    if (!order.Actual_3) return 3;
    if (!order.Actual_4) return 4;
    return 5; // All done
};

export default function PurchaseFMSPage() {
    const [orders, setOrders] = useState<PurchaseFMSOrder[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all' | null>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false); // Kept for logic but will be used as part of viewMode
    const [viewMode, setViewMode] = useState<'data' | 'setup'>('data');
    const [currentPage, setCurrentPage] = useState(1);
    const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: keyof PurchaseFMSOrder | string; direction: 'asc' | 'desc' } | null>(null);

    const [editingOrder, setEditingOrder] = useState<PurchaseFMSOrder | null>(null);
    const [isCancelledView, setIsCancelledView] = useState(false);

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<{ id: number; Item_name?: string; isCancelled: boolean } | null>(null);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id: number; Item_name?: string } | null>(null);
    const [removeStep, setRemoveStep] = useState<number | 'all'>(1);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

    // Advanced Filter States
    const [showAdvancedFilterModal, setShowAdvancedFilterModal] = useState(false);
    const [tempFilters, setTempFilters] = useState({ Item_name: '', Party_Name: '', Po_No: '' });
    const [appliedFilters, setAppliedFilters] = useState({ Item_name: '', Party_Name: '', Po_No: '' });
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [itemsToMarkDone, setItemsToMarkDone] = useState<Set<number>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Record<number, { Remark?: string, Next_Follow_Up_Date?: string, Lead_Time_2?: string }>>({});

    const toast = useToast();
    const loader = useLoader();

    useEffect(() => {
        fetchOrders();
        fetchConfig();
        fetchUsers();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeStepFilter, activeTimeFilter]);

    const fetchOrders = async () => {
        try {
            const res = await fetch('/api/purchase-fms');
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (error) {
            toast.error('Failed to fetch orders');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/purchase-fms-config');
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

    const filterOptions = useMemo(() => {
        return {
            Item_names: Array.from(new Set(orders.map(o => o.Item_name))).filter(Boolean).sort(),
            Party_Names: Array.from(new Set(orders.map(o => o.Party_Name))).filter(Boolean).sort(),
            Po_Numbers: Array.from(new Set(orders.map(o => o['Po No.']))).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
        };
    }, [orders]);

    const handleApplyFilters = () => {
        setAppliedFilters(tempFilters);
        setShowAdvancedFilterModal(false);
    };

    const handleClearFilters = () => {
        const cleared = { Item_name: '', Party_Name: '', Po_No: '' };
        setTempFilters(cleared);
        setAppliedFilters(cleared);
        setShowAdvancedFilterModal(false);
    };
    const statusStats = useMemo(() => {
        const activeOrders = orders.filter(o => o.Cancelled !== 'Cancelled');
        return {
            Total: activeOrders.length,
            Step1: activeOrders.filter(o => !o.Actual_1).length,
            Step2: activeOrders.filter(o => o.Actual_1 && !o.Actual_2).length,
            Step3: activeOrders.filter(o => o.Actual_2 && !o.Actual_3).length,
            Step4: activeOrders.filter(o => o.Actual_3 && !o.Actual_4).length,
        };
    }, [orders]);

    const timeStats = useMemo(() => {
        const active = orders.filter(o => o.Cancelled !== 'Cancelled');
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 7': 0, 'Next 15': 0 };

        active.forEach(o => {
            const currentStep = getCurrentStep(o);
            if (currentStep > 4) return;

            // Prefer Next_Follow_Up_Date for step 3 when present
            let plannedStr = o[`Planned_${currentStep}` as keyof PurchaseFMSOrder];
            if (currentStep === 3 && o.Next_Follow_Up_Date) plannedStr = o.Next_Follow_Up_Date;
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
    }, [orders]);

    const calendarCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        const activeOrders = orders.filter(o => o.Cancelled !== 'Cancelled');
        activeOrders.forEach(o => {
            const currentStep = getCurrentStep(o);
            if (currentStep > 4) return;
            // Prefer Next_Follow_Up_Date for step 3 when present
            let plannedStr = o[`Planned_${currentStep}` as keyof PurchaseFMSOrder];
            if (currentStep === 3 && o.Next_Follow_Up_Date) plannedStr = o.Next_Follow_Up_Date;
            if (!plannedStr) return;
            const pDate = new Date(plannedStr as string);
            if (isNaN(pDate.getTime())) return;
            const dateKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
            counts[dateKey] = (counts[dateKey] || 0) + 1;
        });
        return counts;
    }, [orders]);

    const distinctSteps = useMemo(() => {
        const selectedOrders = orders.filter(o => selectedItems.has(o.id));
        const steps = new Set(selectedOrders.map(o => getCurrentStep(o)));
        return Array.from(steps).filter(s => s <= 4).sort((a, b) => a - b);
    }, [selectedItems, orders]);

    const sortedOrders = useMemo(() => {
        let sortableOrders = [...orders];
        if (sortConfig !== null) {
            sortableOrders.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof PurchaseFMSOrder];
                const bValue = b[sortConfig.key as keyof PurchaseFMSOrder];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableOrders;
    }, [orders, sortConfig]);

    const filteredOrders = useMemo(() => {
        let result = orders;

        // Apply Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(o =>
                o.Item_name.toLowerCase().includes(query) ||
                o.Party_Name.toLowerCase().includes(query) ||
                o.sku_code.toLowerCase().includes(query) ||
                String(o.id).includes(query)
            );
        }

        // Apply Advanced Filters
        if (appliedFilters.Item_name) {
            result = result.filter(o => o.Item_name === appliedFilters.Item_name);
        }
        if (appliedFilters.Party_Name) {
            result = result.filter(o => o.Party_Name === appliedFilters.Party_Name);
        }
        if (appliedFilters.Po_No) {
            result = result.filter(o => o['Po No.'] === appliedFilters.Po_No);
        }

        // Apply Cancelled View Filter - ONLY SHOW CANCELLED IN CANCELLED VIEW
        if (isCancelledView) {
            result = result.filter(o => o.Cancelled === 'Cancelled');
        } else {
            result = result.filter(o => o.Cancelled !== 'Cancelled');

            // Apply Step Filter only in normal view
            if (activeStepFilter !== null && activeStepFilter !== 'all') {
                result = result.filter(o => {
                    const step = activeStepFilter as number;
                    const isDone = !!o[`Actual_${step}` as keyof PurchaseFMSOrder];
                    const isPreviousDone = step === 1 || !!o[`Actual_${step - 1}` as keyof PurchaseFMSOrder];
                    return !isDone && isPreviousDone;
                });
            }

            // Apply Time-Based Filter
            if (activeTimeFilter) {
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const oneDayMs = 24 * 60 * 60 * 1000;

                result = result.filter(o => {
                    const currentStep = getCurrentStep(o);
                    if (currentStep > 4) return false;

                    // Prefer Next_Follow_Up_Date for step 3 when present
                    let plannedStr = o[`Planned_${currentStep}` as keyof PurchaseFMSOrder];
                    if (currentStep === 3 && o.Next_Follow_Up_Date) plannedStr = o.Next_Follow_Up_Date;
                    if (!plannedStr) return false;

                    const pDate = new Date(plannedStr as string);
                    const pTime = pDate.getTime();
                    const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
                    const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);

                    if (activeTimeFilter.startsWith('Date:')) {
                        const targetDateStr = activeTimeFilter.split(':')[1];
                        const pDateStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
                        return pDateStr === targetDateStr;
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
        }

        // Apply Sorting
        if (sortConfig) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof PurchaseFMSOrder];
                const bValue = b[sortConfig.key as keyof PurchaseFMSOrder];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return result;
    }, [orders, searchQuery, activeStepFilter, isCancelledView, sortConfig, activeTimeFilter, appliedFilters]);

    const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
    const paginatedOrders = filteredOrders.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const getNextPlannedTime = (currentActualTime: Date, value: number, unit: 'hours' | 'days') => {
        const nextTime = new Date(currentActualTime);
        if (unit === 'hours') {
            nextTime.setTime(nextTime.getTime() + value * 60 * 60 * 1000);
        } else {
            nextTime.setDate(nextTime.getDate() + value);
        }
        // Skip Sunday
        if (nextTime.getDay() === 0) {
            nextTime.setDate(nextTime.getDate() + 1);
        }
        return nextTime;
    };

    const handleMarkDone = async (order: PurchaseFMSOrder, step: number) => {
        try {
            loader.showLoader();
            const currentTime = new Date();
            const updateData: any = {
                id: order.id,
                [`Actual_${step}`]: currentTime.toISOString(),
                [`Status_${step}`]: 'Done',
            };

            // Calculate next planned time if not the last step
            if (step < 4) {
                const nextStep = step + 1;
                let nextPlanned: Date;

                if (step === 2 && order.Lead_Time_2) {
                    // Step 3 planned time is based on Lead_Time_2 from Step 2 (minus 2 days as per requirement)
                    const leadTimeDays = parseInt(String(order.Lead_Time_2)) || 0;
                    if (leadTimeDays > 0) {
                        const adjustedLeadTime = Math.max(0, leadTimeDays - 2);
                        nextPlanned = getNextPlannedTime(currentTime, adjustedLeadTime, "days");
                    } else {
                        const nextConfig = stepConfigs.find(c => c.step === nextStep);
                        nextPlanned = getNextPlannedTime(currentTime, nextConfig?.tatValue || 1, nextConfig?.tatUnit || "hours");
                    }
                } else {
                    const nextConfig = stepConfigs.find(c => c.step === nextStep);
                    nextPlanned = getNextPlannedTime(currentTime, nextConfig?.tatValue || 1, nextConfig?.tatUnit || "hours");
                }
                updateData[`Planned_${nextStep}`] = nextPlanned.toISOString();
            }

            const res = await fetch('/api/purchase-fms', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });

            if (res.ok) {
                toast.success(`Step ${step} completed`);
                fetchOrders();
            }
        } catch (error) {
            toast.error('Failed to update status');
        } finally {
            loader.hideLoader();
        }
    };

    const handleUpdateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrder || selectedItems.size === 0) return;

        try {
            loader.showLoader();
            const currentTime = new Date();
            const updatePromises = Array.from(selectedItems).map(id => {
                const order = orders.find(o => o.id === id);
                if (!order) return Promise.resolve();

                const currentStep = getCurrentStep(order);
                const rowUpdate = bulkUpdates[order.id] || {};

                // Surgical payload: only include what's actually changed
                const updatedData: any = { id: order.id };

                // Handle fields only if they have new values (don't overwrite with old item data unless explicitly set in row)
                if (rowUpdate.Remark !== undefined) {
                    updatedData.Remark = rowUpdate.Remark;
                }
                if (rowUpdate.Next_Follow_Up_Date !== undefined) {
                    updatedData.Next_Follow_Up_Date = rowUpdate.Next_Follow_Up_Date;
                }
                if (rowUpdate.Lead_Time_2 !== undefined) {
                    updatedData.Lead_Time_2 = rowUpdate.Lead_Time_2;
                }

                // Dynamic Step 3 Completion Logic: 
                // If in Step 3 and a next follow-up date is provided, we NEVER mark it as done, even if toggled.
                // This allows for iterative follow-ups.
                let isMarkingDone = itemsToMarkDone.has(order.id);
                if (currentStep === 3 && rowUpdate.Next_Follow_Up_Date) {
                    isMarkingDone = false;
                }

                if (isMarkingDone && currentStep <= 4) {
                    updatedData[`Actual_${currentStep}`] = currentTime.toISOString();
                    updatedData[`Status_${currentStep}`] = 'Done';

                    // Automation for next step planning
                    if (currentStep < 4) {
                        const nextStep = currentStep + 1;
                        let nextPlanned: Date;

                        const leadTime = rowUpdate.Lead_Time_2 || editingOrder.Lead_Time_2;
                        if (currentStep === 2 && leadTime) {
                            const leadTimeDays = parseInt(String(leadTime)) || 0;
                            if (leadTimeDays > 0) {
                                const adjustedLeadTime = Math.max(0, leadTimeDays - 2);
                                nextPlanned = getNextPlannedTime(currentTime, adjustedLeadTime, "days");
                            } else {
                                const nextConfig = stepConfigs.find(c => c.step === nextStep);
                                nextPlanned = getNextPlannedTime(currentTime, nextConfig?.tatValue || 1, nextConfig?.tatUnit || "hours");
                            }
                        } else {
                            const nextConfig = stepConfigs.find(c => c.step === nextStep);
                            nextPlanned = getNextPlannedTime(currentTime, nextConfig?.tatValue || 1, nextConfig?.tatUnit || "hours");
                        }
                        updatedData[`Planned_${nextStep}`] = nextPlanned.toISOString();
                    }
                }

                return fetch('/api/purchase-fms', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData),
                });
            });

            await Promise.all(updatePromises);
            toast.success('Bulk updates applied successfully');
            // Keep modal open and selection active for real-time progression
            setItemsToMarkDone(new Set());
            setBulkUpdates({});
            fetchOrders();
        } catch (error) {
            toast.error('Failed to apply bulk updates');
        } finally {
            loader.hideLoader();
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

            const res = await fetch('/api/purchase-fms-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: configToSave }),
            });
            if (res.ok) {
                toast.success('Configuration saved');
                setIsConfigModalOpen(false);
            }
        } catch (error) {
            toast.error('Failed to save configuration');
        } finally {
            loader.hideLoader();
        }
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
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

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

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

    const handleCancel = async () => {
        if (!cancelTarget) return;
        try {
            loader.showLoader();
            const res = await fetch('/api/purchase-fms', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: cancelTarget.id,
                    Cancelled: cancelTarget.isCancelled ? '' : 'Cancelled'
                }),
            });
            if (res.ok) {
                toast.success(cancelTarget.isCancelled ? 'Cancellation removed' : 'Order cancelled');
                setShowCancelModal(false);
                setCancelTarget(null);
                fetchOrders();
            } else {
                toast.error('Operation failed');
            }
        } catch (error) {
            toast.error('Error during operation');
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
                [1, 2, 3, 4].forEach(step => {
                    payload[`Actual_${step}`] = '';
                    payload[`Status_${step}`] = '';
                    if (step > 1) payload[`Planned_${step}`] = '';
                });
                payload['Next_Follow_Up_Date'] = '';
                payload['Remark'] = '';
                payload['Lead_Time_2'] = '';
            } else {
                const stepNum = removeStep as number;
                [1, 2, 3, 4].forEach(step => {
                    if (step === stepNum) {
                        payload[`Actual_${step}`] = '';
                        payload[`Status_${step}`] = '';
                        if (step === 2) payload['Lead_Time_2'] = '';
                        if (step === 3) {
                            payload['Next_Follow_Up_Date'] = '';
                            payload['Remark'] = '';
                        }
                    } else if (step > stepNum) {
                        payload[`Planned_${step}`] = '';
                        payload[`Actual_${step}`] = '';
                        payload[`Status_${step}`] = '';
                        if (step === 2) payload['Lead_Time_2'] = '';
                        if (step === 3) {
                            payload['Next_Follow_Up_Date'] = '';
                            payload['Remark'] = '';
                        }
                    }
                });
            }

            const res = await fetch('/api/purchase-fms', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success('Follow-up details removed');
                setShowRemoveModal(false);
                setRemoveTarget(null);
                fetchOrders();
            } else {
                toast.error('Operation failed');
            }
        } catch (error) {
            toast.error('Error removing follow-up');
        } finally {
            loader.hideLoader();
        }
    };

    const openDeleteModal = (id: number, Item_name?: string) => {
        // Functionality disabled as per user request
    };

    const openCancelModal = (id: number, isCancelled: boolean, Item_name?: string) => {
        setCancelTarget({ id, Item_name, isCancelled });
        setShowCancelModal(true);
    };

    const openRemoveModal = (id: number, Item_name?: string) => {
        setRemoveTarget({ id, Item_name });
        setRemoveStep(1);
        setShowRemoveModal(true);
    };

    const toggleSelection = (id: number) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };

    const toggleAll = () => {
        if (selectedItems.size === paginatedOrders.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(paginatedOrders.map(o => o.id)));
        }
    };

    const handleExportCSV = () => {
        if (orders.length === 0) {
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

        const headers = Object.keys(orders[0]).filter(key => key !== 'id' && key !== '_rowIndex');

        const csvRows = [];
        csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

        for (const row of orders) {
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
        link.setAttribute('download', `purchase_fms_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStageSortIcon = (step: number) => {
        const key = `Actual_${step}`;
        return getSortIcon(key);
    };

    return (
        <LayoutWrapper>
            <div className="flex-1 flex flex-col bg-[var(--theme-lighter)] overflow-hidden">
                <div className="flex-1 overflow-auto custom-scrollbar p-6 space-y-6">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <h1 className="text-3xl font-black text-[var(--theme-primary)] tracking-tight">
                                Purchase FMS
                            </h1>
                            <p className="text-[12px] text-gray-400 font-bold underline decoration-[var(--theme-primary)] decoration-2 underline-offset-4 uppercase tracking-widest leading-none mt-1.5 flex items-center gap-2">
                                Purchase FMS Management & Tracking
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <button
                                    onClick={() => setIsCancelledView(!isCancelledView)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isCancelledView ? 'bg-red-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                    Cancelled View
                                </button>
                                <button
                                    onClick={() => {
                                        setViewMode('data');
                                        setIsCancelledView(false);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'data' && !isCancelledView ? 'bg-[var(--theme-primary)] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                    Data View
                                </button>
                                <button
                                    onClick={() => setViewMode('setup')}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'setup' && !isCancelledView ? 'bg-[var(--theme-primary)] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    Setup
                                </button>
                            </div>

                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-green-500 hover:text-green-600 transition-all group"
                            >
                                <svg className="w-4 h-4 text-slate-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-green-600">Export</span>
                            </button>

                            {/* Advanced Filter Button */}
                            <button
                                onClick={() => setShowAdvancedFilterModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] transition-all group"
                            >
                                <svg className={`w-4 h-4 ${Object.values(appliedFilters).some(v => v) ? 'text-[var(--theme-primary)]' : 'text-slate-400 group-hover:text-[var(--theme-primary)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Filters {Object.values(appliedFilters).filter(v => v).length > 0 && `(${Object.values(appliedFilters).filter(v => v).length})`}</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedItems.size > 0) {
                                        const firstSelected = orders.find(o => o.id === Array.from(selectedItems)[0]);
                                        if (firstSelected) {
                                            // Initialize with clean fields for bulk mode to avoid overwriting all rows with first item's details
                                            setEditingOrder({
                                                ...firstSelected,
                                                Remark: '',
                                                Next_Follow_Up_Date: '',
                                                Lead_Time_2: ''
                                            });
                                            setItemsToMarkDone(new Set());
                                            setBulkUpdates({});
                                            setIsEditModalOpen(true);
                                        }
                                    }
                                }}
                                disabled={selectedItems.size === 0}
                                className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 shadow-lg ${selectedItems.size > 0 ? 'bg-[var(--theme-primary)] text-white shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98]' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                                Update Status ({selectedItems.size})
                            </button>
                            <button
                                onClick={fetchOrders}
                                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
                            >
                                <svg className={`w-5 h-5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                            </button>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {viewMode === 'setup' ? (
                            <motion.div
                                key="setup"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700"
                            >
                                <div className="mb-8">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Step Configuration</h2>
                                    <p className="text-sm text-slate-500">Configure TAT (Turn Around Time) and assignees for each purchase step.</p>
                                </div>
                                <div className="space-y-4">
                                    {stepConfigs.filter(c => c.step <= 4).map((config, index) => (
                                        <div key={config.step} className="grid grid-cols-4 gap-6 p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 items-center">
                                            <div className="col-span-1 border-r border-slate-200 dark:border-slate-700 pr-6">
                                                <div className="text-[10px] font-bold text-[var(--theme-primary)] uppercase tracking-widest">Step {config.step}</div>
                                                <div className="text-sm font-black text-slate-900 dark:text-white truncate" title={STAGES.find(s => s.step === config.step)?.name || config.stepName}>{STAGES.find(s => s.step === config.step)?.name || config.stepName}</div>
                                            </div>
                                            <div className="col-span-1 space-y-1.5 text-center">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">TAT Value</label>
                                                <input
                                                    type="number"
                                                    value={config.tatValue}
                                                    onChange={(e) => {
                                                        const newConfigs = [...stepConfigs];
                                                        const itemIndex = newConfigs.findIndex(nc => nc.step === config.step);
                                                        if (itemIndex !== -1) newConfigs[itemIndex].tatValue = parseInt(e.target.value);
                                                        setStepConfigs(newConfigs);
                                                    }}
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-center"
                                                />
                                            </div>
                                            <div className="col-span-1 space-y-1.5 text-center">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">TAT Unit</label>
                                                <select
                                                    value={config.tatUnit}
                                                    onChange={(e) => {
                                                        const newConfigs = [...stepConfigs];
                                                        const itemIndex = newConfigs.findIndex(nc => nc.step === config.step);
                                                        if (itemIndex !== -1) newConfigs[itemIndex].tatUnit = e.target.value as "hours" | "days";
                                                        setStepConfigs(newConfigs);
                                                    }}
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="hours">Hours</option>
                                                    <option value="days">Days</option>
                                                </select>
                                            </div>
                                            <div className="col-span-1 space-y-1.5 text-center">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Assignee</label>
                                                <select
                                                    value={config.doerName}
                                                    onChange={(e) => {
                                                        const newConfigs = [...stepConfigs];
                                                        const itemIndex = newConfigs.findIndex(nc => nc.step === config.step);
                                                        if (itemIndex !== -1) newConfigs[itemIndex].doerName = e.target.value;
                                                        setStepConfigs(newConfigs);
                                                    }}
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="">Select Assignee</option>
                                                    {systemUsers.map(user => (
                                                        <option key={user.username} value={user.username}>{user.username}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button
                                        onClick={() => setViewMode('data')}
                                        className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm"
                                    >
                                        Back to Data
                                    </button>
                                    <button
                                        onClick={handleSaveConfig}
                                        className="px-6 py-2.5 bg-[var(--theme-primary)] text-white rounded-xl font-bold shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                                    >
                                        Save Configuration
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="data"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-4"
                            >
                                {/* Step Tiles Highlights */}
                                <div className="overflow-x-auto pb-0 custom-scrollbar-horizontal scroll-smooth -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                                    <div className="flex flex-wrap gap-2 min-w-max pr-8">
                                        {[
                                            { step: 'all', label: 'All Items', value: orders.filter(o => o.Cancelled !== 'Cancelled').length, gradient: 'from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-400', iconBg: 'from-slate-500 to-slate-600', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                                            { step: 1, label: '1. Create PO', value: statusStats.Step1, gradient: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20', border: 'border-indigo-200 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-400', iconBg: 'from-indigo-500 to-indigo-600', icon: 'M12 4v16m8-8H4' },
                                            { step: 2, label: '2. Sent PO', value: statusStats.Step2, gradient: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20', border: 'border-yellow-200 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-400', iconBg: 'from-yellow-500 to-yellow-600', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
                                            { step: 3, label: '3. Follow Up', value: statusStats.Step3, gradient: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20', border: 'border-orange-200 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-400', iconBg: 'from-orange-500 to-orange-600', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                            { step: 4, label: '4. Received', value: statusStats.Step4, gradient: 'from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20', border: 'border-pink-200 dark:border-pink-700', text: 'text-pink-700 dark:text-pink-400', iconBg: 'from-pink-500 to-pink-600', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                                        ].map((stat, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.03 }}
                                                whileHover={activeStepFilter === (stat.step as any) ? {} : { y: -1 }}
                                                onClick={() => {
                                                    setActiveStepFilter(stat.step as any);
                                                    if (stat.step === 'all') {
                                                        setActiveTimeFilter(null);
                                                        setSearchQuery('');
                                                        setAppliedFilters({ Item_name: '', Party_Name: '', Po_No: '' });
                                                        setTempFilters({ Item_name: '', Party_Name: '', Po_No: '' });
                                                    }
                                                }}
                                                className={`bg-gradient-to-br ${stat.gradient} p-2 rounded-lg border ${stat.border} shadow-sm flex items-center gap-2 group transition-all min-w-[140px] cursor-pointer ${activeStepFilter === (stat.step as any) ? 'bg-white dark:bg-gray-800 border-[var(--theme-primary)] shadow-md' : 'opacity-80 hover:opacity-100'}`}
                                            >
                                                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stat.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm ${activeStepFilter !== stat.step ? 'group-hover:scale-105' : ''} transition-transform text-white`}>
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

                                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-white dark:border-slate-700">
                                    <div className="flex bg-[var(--theme-lighter)]/50 dark:bg-slate-900/50 p-2 border-y border-slate-100 dark:border-slate-800 backdrop-blur-md sticky top-0 z-[30]">
                                        <div className="flex-1 flex items-center justify-between px-4">
                                            <div className="flex items-center gap-4">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                    Showing <span className="text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>- <span className="text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</span> of <span className="text-slate-900 dark:text-white">{filteredOrders.length}</span>
                                                </p>

                                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                                                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                                    {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                                                        <button
                                                            key={filter}
                                                            onClick={() => setActiveTimeFilter(activeTimeFilter === filter ? null : filter)}
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

                                                <div className="h-3 w-px bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
                                                <div className="relative flex items-center shrink-0" ref={calendarRef}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                                        className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer outline-none ${activeTimeFilter?.startsWith('Date:') ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)] shadow-md scale-[1.05]' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'}`}
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
                                                                                className={`relative h-10 w-10 rounded-lg text-sm flex items-center justify-center transition-all ${isSelected ? 'bg-[var(--theme-primary)] text-white font-bold shadow-md' : isToday ? 'bg-gray-100 dark:bg-gray-700 text-[var(--theme-primary)] font-bold' : count > 0 ? 'bg-[var(--theme-primary)]/15 text-[var(--theme-primary)] font-bold border border-[var(--theme-primary)]/30 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium'}`}
                                                                            >
                                                                                {day}
                                                                                {count > 0 && (
                                                                                    <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black shadow-sm ${isSelected ? 'bg-white text-[var(--theme-primary)]' : 'bg-[var(--theme-primary)] text-white'}`}>
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

                                    <div className="overflow-x-auto custom-scrollbar relative overflow-hidden rounded-b-3xl">
                                        <table className="w-full text-left border-collapse min-w-[2000px]">
                                            <thead>
                                                <tr className="bg-[var(--theme-primary)] sticky top-0 z-[20] border-none shadow-sm h-14">
                                                    {!isCancelledView && (
                                                        <th className="px-6 py-4 text-center w-12 sticky left-0 z-[21] bg-[var(--theme-primary)]">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] cursor-pointer"
                                                                checked={selectedItems.size > 0 && selectedItems.size === paginatedOrders.length}
                                                                onChange={toggleAll}
                                                            />
                                                        </th>
                                                    )}
                                                    <th className={`px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] sticky ${isCancelledView ? 'left-0' : 'left-12'} z-[21] bg-[var(--theme-primary)] text-center w-32 border-l border-white/10`}>Actions</th>
                                                    <th onClick={() => requestSort('Timestamp')} className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap text-center cursor-pointer hover:bg-black/5 transition-colors group">
                                                        <div className="flex items-center justify-center gap-2">Timestamp {getSortIcon('Timestamp')}</div>
                                                    </th>
                                                    <th onClick={() => requestSort('Item_name')} className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap cursor-pointer hover:bg-black/5 transition-colors group text-left">
                                                        <div className="flex items-center gap-2">Item Details {getSortIcon('Item_name')}</div>
                                                    </th>
                                                    <th onClick={() => requestSort('Party_Name')} className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap cursor-pointer hover:bg-black/5 transition-colors group text-left">
                                                        <div className="flex items-center gap-2">Party Name {getSortIcon('Party_Name')}</div>
                                                    </th>
                                                    <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap text-center">ADC</th>
                                                    <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap text-center">MOQ</th>
                                                    <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap text-center">Po No.</th>
                                                    {STAGES.map((s) => (
                                                        <Fragment key={s.step}>
                                                            <th onClick={() => requestSort(`Actual_${s.step}`)} className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] text-center whitespace-nowrap cursor-pointer hover:bg-black/5 transition-colors group min-w-[150px]">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className="opacity-50 text-[9px] tracking-widest">STAGE {s.step} :</span>
                                                                    <span>{s.name}</span>
                                                                    {getStageSortIcon(s.step)}
                                                                </div>
                                                            </th>
                                                        </Fragment>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                                <AnimatePresence mode="popLayout">
                                                    {paginatedOrders.map((order, idx) => (
                                                        <motion.tr
                                                            key={order.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95 }}
                                                            transition={{ delay: idx * 0.02 }}
                                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group"
                                                        >
                                                            {!isCancelledView && (
                                                                <td className="px-6 py-4 text-center sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-700/30 z-[10]">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 rounded border-slate-300 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] cursor-pointer"
                                                                        checked={selectedItems.has(order.id)}
                                                                        onChange={() => toggleSelection(order.id)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className={`px-4 py-3 sticky ${isCancelledView ? 'left-0' : 'left-12'} z-[11] bg-white dark:bg-slate-800 border-l border-slate-50 dark:border-slate-700/50`}>
                                                                <div className="flex justify-center items-center">
                                                                    <div className="flex gap-2 w-fit">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                openCancelModal(order.id, order.Cancelled === 'Cancelled', order.Item_name);
                                                                            }}
                                                                            className={`p-1.5 rounded-lg transition-all ${order.Cancelled === 'Cancelled'
                                                                                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                                                : 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                                                                                }`}
                                                                            title={order.Cancelled === 'Cancelled' ? 'Remove Cancellation' : 'Cancel'}
                                                                        >
                                                                            {order.Cancelled === 'Cancelled' ? (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                            ) : (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 border-r border-slate-50 dark:border-slate-700/50 min-w-[160px]">
                                                                <div className="flex flex-col text-center">
                                                                    <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300">
                                                                        {formatDateTime(order.Timestamp).split(',')[0]}
                                                                    </span>
                                                                    <span className="text-[11px] font-bold text-slate-400 italic">
                                                                        {formatDateTime(order.Timestamp).split(',')[1]}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 border-r border-slate-50 dark:border-slate-700/50 min-w-[350px]">
                                                                <div className="flex flex-col gap-1.5">
                                                                    <span className="w-fit px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-md text-[11px] font-black leading-none">
                                                                        {order.sku_code}
                                                                    </span>
                                                                    <div className="text-[13px] font-black text-slate-700 dark:text-slate-200 uppercase leading-tight line-clamp-2">
                                                                        {order.Item_name}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 border-r border-slate-50 dark:border-slate-700/50 min-w-[220px]">
                                                                <div className="text-[13px] font-bold text-slate-600 dark:text-slate-300 uppercase truncate">
                                                                    {order.Party_Name}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 border-r border-slate-50 dark:border-slate-700/50 text-center font-bold text-slate-500 text-[13px]">
                                                                {order['Average Daily Consumption']}
                                                            </td>
                                                            <td className="px-6 py-5 border-r border-slate-50 dark:border-slate-700/50 text-center font-bold text-[var(--theme-primary)] text-[13px]">
                                                                {order.MOQ}
                                                            </td>
                                                            <td className="px-6 py-5 border-r border-slate-50 dark:border-slate-700/50 text-[12px] font-bold text-slate-400 uppercase tracking-widest leading-none text-center">
                                                                {order['Po No.']}
                                                            </td>
                                                            {STAGES.map((s) => {
                                                                const planned = order[`Planned_${s.step}` as keyof PurchaseFMSOrder];
                                                                const actual = order[`Actual_${s.step}` as keyof PurchaseFMSOrder];
                                                                const status = order[`Status_${s.step}` as keyof PurchaseFMSOrder];
                                                                // If a Next_Follow_Up_Date exists for step 3, use it as the reference for delay
                                                                const plannedForDelay = (s.step === 3 && order.Next_Follow_Up_Date) ? order.Next_Follow_Up_Date : planned;
                                                                const delayInfo = getDelayInfo(plannedForDelay as string, actual as string);

                                                                const isPreviousDone = s.step === 1 || !!order[`Actual_${s.step - 1}` as keyof PurchaseFMSOrder];
                                                                const isDone = !!actual;

                                                                return (
                                                                    <Fragment key={s.step}>
                                                                        <td className="px-4 py-3 border-r border-slate-50 dark:border-slate-700/50 min-w-[150px]">
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

                                                                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700 space-y-1">
                                                                                    {s.step === 2 && (
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="text-slate-400 font-bold uppercase tracking-tighter text-[8px] whitespace-nowrap">Lead Time :</span>
                                                                                            <span className="text-slate-700 dark:text-slate-200 font-black text-[9px]">{order.Lead_Time_2 || '-'}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {s.step === 3 && (
                                                                                        <>
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <span className="text-slate-400 font-bold uppercase tracking-tighter text-[8px] whitespace-nowrap">NFU :</span>
                                                                                                <span className="text-slate-700 dark:text-slate-200 font-black text-[9px]">
                                                                                                    {order.Next_Follow_Up_Date ? formatDateTime(order.Next_Follow_Up_Date).split(',')[0] : '-'}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="flex items-start gap-1.5">
                                                                                                <span className="text-slate-400 font-bold uppercase tracking-tighter text-[8px] whitespace-nowrap pt-0.5">Remark :</span>
                                                                                                <span className="text-slate-600 dark:text-slate-300 italic text-[9px] line-clamp-2 leading-tight" title={order.Remark || ''}>
                                                                                                    {order.Remark || '-'}
                                                                                                </span>
                                                                                            </div>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </Fragment>
                                                                );
                                                            })}
                                                        </motion.tr>
                                                    ))}
                                                </AnimatePresence>
                                                {paginatedOrders.length === 0 && !isLoading && (
                                                    <tr>
                                                        <td colSpan={STAGES.length + 8} className="px-6 py-32 text-center text-slate-500 bg-white/50 dark:bg-slate-800/50">
                                                            <div className="flex flex-col items-center gap-4">
                                                                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-3xl flex items-center justify-center text-slate-300">
                                                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-lg font-bold text-slate-900 dark:text-white">No items found</p>
                                                                    <p className="text-sm text-slate-500">Try adjusting your filters</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Edit Order Modal */}
                <AnimatePresence>
                    {isEditModalOpen && editingOrder && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
                            >
                                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Bulk Status Update</h2>
                                    <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" /></svg>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                    {/* Header info */}
                                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest mb-1">Items Selected</p>
                                        <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{selectedItems.size} rows identified at {distinctSteps.length} different stages.</p>
                                    </div>

                                    {/* Step-wise Sections */}
                                    <div className="space-y-6">
                                        {distinctSteps.map(stepNum => {
                                            const stage = STAGES.find(s => s.step === stepNum);
                                            const config = stepConfigs.find(c => c.step === stepNum);
                                            const stepItems = orders.filter(o => selectedItems.has(o.id) && getCurrentStep(o) === stepNum);

                                            return (
                                                <div key={stepNum} className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-[var(--theme-primary)] uppercase tracking-[0.2em]">Stage {stepNum}</span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{config?.doerName || 'NO DOER'}</span>
                                                            </div>
                                                            <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{stage?.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{stepItems.length} items at this stage</span>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => {
                                                                    const allMarked = stepItems.every(i => itemsToMarkDone.has(i.id));
                                                                    const next = new Set(itemsToMarkDone);
                                                                    if (allMarked) {
                                                                        stepItems.forEach(i => next.delete(i.id));
                                                                    } else {
                                                                        stepItems.forEach(i => {
                                                                            next.add(i.id);
                                                                            if (stepNum === 3) {
                                                                                setBulkUpdates(prev => ({
                                                                                    ...prev,
                                                                                    [i.id]: { ...prev[i.id], Next_Follow_Up_Date: '' }
                                                                                }));
                                                                            }
                                                                        });
                                                                    }
                                                                    setItemsToMarkDone(next);
                                                                }}
                                                                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:bg-[var(--theme-primary)] hover:text-white transition-all"
                                                            >
                                                                {stepItems.every(i => itemsToMarkDone.has(i.id)) ? 'Unselect All' : 'Mark All Done'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Row-wise display of items in this stage */}
                                                    <div className="space-y-3 pt-1">
                                                        {stepItems.map((item, idx) => (
                                                            <div key={item.id} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex gap-3">
                                                                        <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                                            {idx + 1}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[11px] font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight line-clamp-1">{item.Item_name}</p>
                                                                            <div className="flex items-center gap-2 mt-1">
                                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.Party_Name}</span>
                                                                                <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                                                                                <span className="text-[9px] font-black text-[var(--theme-primary)]">{item['Po No.'] || 'NO PO'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {stepNum !== 3 && (
                                                                        <label className="relative inline-flex items-center cursor-pointer">
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
                                                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500 rounded-full"></div>
                                                                            <span className="ml-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">Done</span>
                                                                        </label>
                                                                    )}
                                                                </div>

                                                                {/* Item-specific inputs based on Step */}
                                                                {(stepNum === 2 || stepNum === 3) && (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-50 dark:border-slate-700/50 mt-1">
                                                                        {stepNum === 2 && (
                                                                            <div className="col-span-full">
                                                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Lead Time (Days)</label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={bulkUpdates[item.id]?.Lead_Time_2 ?? (item.Lead_Time_2 || '')}
                                                                                    onChange={(e) => setBulkUpdates(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: { ...prev[item.id], Lead_Time_2: e.target.value }
                                                                                    }))}
                                                                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[var(--theme-primary)]"
                                                                                    placeholder="Enter days..."
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        {stepNum === 3 && (
                                                                            <div className="col-span-full">
                                                                                <div className="flex gap-6 mb-4 mt-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                                                        <input 
                                                                                            type="radio" 
                                                                                            name={`step3_action_${item.id}`}
                                                                                            checked={itemsToMarkDone.has(item.id)}
                                                                                            onChange={() => {
                                                                                                const next = new Set(itemsToMarkDone);
                                                                                                next.add(item.id);
                                                                                                setItemsToMarkDone(next);
                                                                                                setBulkUpdates(prev => ({
                                                                                                    ...prev,
                                                                                                    [item.id]: { ...prev[item.id], Next_Follow_Up_Date: '' }
                                                                                                }));
                                                                                            }}
                                                                                            className="w-4 h-4 text-green-500 border-slate-300 focus:ring-green-500 cursor-pointer"
                                                                                        />
                                                                                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest group-hover:text-green-600 transition-colors">Mark as Done</span>
                                                                                    </label>
                                                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                                                        <input 
                                                                                            type="radio" 
                                                                                            name={`step3_action_${item.id}`}
                                                                                            checked={!itemsToMarkDone.has(item.id)}
                                                                                            onChange={() => {
                                                                                                const next = new Set(itemsToMarkDone);
                                                                                                next.delete(item.id);
                                                                                                setItemsToMarkDone(next);
                                                                                            }}
                                                                                            className="w-4 h-4 text-orange-500 border-slate-300 focus:ring-orange-500 cursor-pointer"
                                                                                        />
                                                                                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest group-hover:text-orange-600 transition-colors">Next Follow Up</span>
                                                                                    </label>
                                                                                </div>
                                                                                
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                                    <div className={`transition-opacity ${itemsToMarkDone.has(item.id) ? 'opacity-50 pointer-events-none' : ''}`}>
                                                                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Next Follow Up Date</label>
                                                                                        <input
                                                                                            type="datetime-local"
                                                                                            value={bulkUpdates[item.id]?.Next_Follow_Up_Date ?? (item.Next_Follow_Up_Date ? new Date(item.Next_Follow_Up_Date).toISOString().slice(0, 16) : '')}
                                                                                            onChange={(e) => {
                                                                                                setBulkUpdates(prev => ({
                                                                                                    ...prev,
                                                                                                    [item.id]: { ...prev[item.id], Next_Follow_Up_Date: e.target.value }
                                                                                                }));
                                                                                                if (e.target.value) {
                                                                                                    const next = new Set(itemsToMarkDone);
                                                                                                    next.delete(item.id);
                                                                                                    setItemsToMarkDone(next);
                                                                                                }
                                                                                            }}
                                                                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 shadow-sm"
                                                                                        />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Remark (Notes)</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={bulkUpdates[item.id]?.Remark ?? (item.Remark || '')}
                                                                                            onChange={(e) => setBulkUpdates(prev => ({
                                                                                                ...prev,
                                                                                                [item.id]: { ...prev[item.id], Remark: e.target.value }
                                                                                            }))}
                                                                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 shadow-sm"
                                                                                            placeholder="Type remark..."
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
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

                                <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 py-3 px-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUpdateOrder}
                                        className="flex-1 py-3 px-6 rounded-2xl bg-[var(--theme-primary)] text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        Apply Bulk Updates
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Action Confirmation Modals */}

                {/* Cancel Confirmation Modal */}
                {showCancelModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20"
                        >
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                {cancelTarget?.isCancelled ? 'Remove Cancellation' : 'Cancel Order'}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
                                {cancelTarget?.isCancelled
                                    ? `Are you sure you want to remove the cancellation for "${cancelTarget?.Item_name}"?`
                                    : `Are you sure you want to mark "${cancelTarget?.Item_name}" as cancelled? it will be moved to the Cancelled View.`}
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowCancelModal(false)}
                                    className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className={`px-6 py-2 ${cancelTarget?.isCancelled ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'} text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-200 dark:shadow-none`}
                                >
                                    {cancelTarget?.isCancelled ? 'Un-Cancel' : 'Confirm Cancel'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Remove Follow Up Modal */}
                {showRemoveModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-none">Remove Details</h3>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{removeTarget?.Item_name}</p>
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
                                        <div className="text-[10px] opacity-70 font-medium">Clears all follow-up data</div>
                                    </button>
                                    {[1, 2, 3, 4].map(step => (
                                        <button
                                            key={step}
                                            onClick={() => setRemoveStep(step)}
                                            className={`p-3 rounded-2xl border-2 text-left transition-all ${removeStep === step
                                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                                : 'border-slate-100 dark:border-slate-700 text-slate-500 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className="font-black text-xs uppercase tracking-widest">From Step {step}</div>
                                            <div className="text-[10px] opacity-70 font-medium">Clears data from step {step} onwards</div>
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
                {/* Removed Config Modal as it's now an inline view */}
            </div>

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
            {/* Advanced Filter Modal */}
            <AnimatePresence>
                {showAdvancedFilterModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800"
                        >
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary)]/80">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Advanced Filters</h3>
                                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-[0.2em] mt-1">Refine your data view</p>
                                </div>
                                <button
                                    onClick={() => setShowAdvancedFilterModal(false)}
                                    className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all backdrop-blur-md"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l18 18" /></svg>
                                </button>
                            </div>

                            <div className="p-8 space-y-8 bg-white dark:bg-slate-900">
                                {/* Item Name Filter */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Search Item Name</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--theme-primary)] transition-all">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                        <input
                                            type="text"
                                            list="item-names-list"
                                            placeholder="Type or select item name..."
                                            value={tempFilters.Item_name}
                                            onChange={(e) => setTempFilters({ ...tempFilters, Item_name: e.target.value })}
                                            className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/5 outline-none transition-all shadow-sm group-hover:border-slate-200 dark:group-hover:border-slate-600"
                                        />
                                        <datalist id="item-names-list">
                                            {filterOptions.Item_names.map(name => (
                                                <option key={name} value={name} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                {/* Party Name Filter */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Search Party Name</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--theme-primary)] transition-all">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                        </div>
                                        <input
                                            type="text"
                                            list="party-names-list"
                                            placeholder="Type or select party name..."
                                            value={tempFilters.Party_Name}
                                            onChange={(e) => setTempFilters({ ...tempFilters, Party_Name: e.target.value })}
                                            className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/5 outline-none transition-all shadow-sm group-hover:border-slate-200 dark:group-hover:border-slate-600"
                                        />
                                        <datalist id="party-names-list">
                                            {filterOptions.Party_Names.map(name => (
                                                <option key={name} value={name} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                {/* PO No. Filter */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Search PO Number</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--theme-primary)] transition-all">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </div>
                                        <input
                                            type="text"
                                            list="po-numbers-list"
                                            placeholder="Type or select PO number..."
                                            value={tempFilters.Po_No}
                                            onChange={(e) => setTempFilters({ ...tempFilters, Po_No: e.target.value })}
                                            className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/5 outline-none transition-all shadow-sm group-hover:border-slate-200 dark:group-hover:border-slate-600"
                                        />
                                        <datalist id="po-numbers-list">
                                            {filterOptions.Po_Numbers.map(no => (
                                                <option key={no} value={String(no)} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 flex gap-4 backdrop-blur-md">
                                <button
                                    onClick={handleClearFilters}
                                    className="flex-1 h-14 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm active:scale-95"
                                >
                                    Clear All
                                </button>
                                <button
                                    onClick={handleApplyFilters}
                                    className="flex-[2] h-14 rounded-2xl bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary)]/90 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-[var(--theme-primary)]/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <span>Apply Filters</span>
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </LayoutWrapper >
    );
}
