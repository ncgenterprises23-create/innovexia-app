'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import SearchableDropdown from '@/components/SearchableDropdown';
import DateRangePicker from '@/components/DateRangePicker';
import { useSetupViewFromQuery } from '@/hooks/useSetupViewFromQuery';

interface OrderItem {
    id: number;
    item: string;
    qty: string;
    // Follow-up Steps (Flat Columns) - optional here as they might not be present in all contexts
    Planned_1?: string | null; Actual_1?: string | null; Destination?: string | null;
    Planned_2?: string | null; Actual_2?: string | null; 'Stock Availability'?: string | null;
    Planned_3?: string | null; Actual_3?: string | null; 'Production Status'?: string | null;
    Planned_4?: string | null; Actual_4?: string | null; 'Information Status'?: string | null;
    Planned_5?: string | null; Actual_5?: string | null; Status_5?: string | null;
    Planned_6?: string | null; Actual_6?: string | null; 'Dispatch Status'?: string | null;
    Planned_7?: string | null; Actual_7?: string | null; 'Bill No.'?: string | null; 'Revenue'?: string | null; 'Item Cost'?: string | null; 'Total Cost'?: string | null;
    Planned_8?: string | null; Actual_8?: string | null; Status_8?: string | null;
    Cancelled?: string | null;
}

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface O2DOrder {
    id: number;
    party_id: number;
    party_name: string;
    type: string;
    contact_person: string;
    email: string;
    contact_no_1: string;
    contact_no_2: string;
    location: string;
    state: string;
    field_person_name: string;
    items: OrderItem[];
    created_at: string;
    status: string;
    // Follow-up Steps (Flat Columns)
    Planned_1: string | null; Actual_1: string | null; Destination: string | null;
    Planned_2: string | null; Actual_2: string | null; 'Stock Availability': string | null;
    Planned_3: string | null; Actual_3: string | null; 'Production Status': string | null;
    Planned_4: string | null; Actual_4: string | null; 'Information Status': string | null;
    Planned_5: string | null; Actual_5: string | null; Status_5: string | null;
    Planned_6: string | null; Actual_6: string | null; 'Dispatch Status': string | null;
    Planned_7: string | null; Actual_7: string | null; 'Bill No.': string | null; 'Revenue': string | null; 'Item Cost': string | null; 'Total Cost': string | null;
    Planned_8: string | null; Actual_8: string | null; Status_8: string | null;
    Cancelled: string | null;
    quantity: string | number; // Added to interface for cost calculation convenience
}

const TYPES = ['DEALER', 'PRINTER', 'AGENCY', 'CORPORATE'];
const STATUSES = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];

const FOLLOWUP_STEPS_CONFIG = [
    { step: 1, name: 'Destination', question: 'Local or Out Station?', plannedField: 'Planned_1', actualField: 'Actual_1', responseField: 'Destination', responseType: 'select', options: ['Local', 'Out Station'], icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { step: 2, name: 'Check Stock Availability', question: 'Stock Available or Not Available?', plannedField: 'Planned_2', actualField: 'Actual_2', responseField: 'Stock Availability', responseType: 'select', options: ['Stock Available', 'Not Available'], icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
    { step: 3, name: 'Do Production & Communicate', question: 'Production Completed?', plannedField: 'Planned_3', actualField: 'Actual_3', responseField: 'Production Status', responseType: 'select', options: ['Yes', 'No'], icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
    { step: 4, name: 'Inform Warehouse Keeper for dispatch', question: 'Information Shared?', plannedField: 'Planned_4', actualField: 'Actual_4', responseField: 'Information Status', responseType: 'select', options: ['Yes', 'No'], icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
    { step: 5, name: 'Talk to Transporter', question: 'Done?', plannedField: 'Planned_5', actualField: 'Actual_5', responseField: 'Status_5', responseType: 'select', options: ['Yes', 'No'], icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
    { step: 6, name: 'Account Process', question: 'Dispatch Status?', plannedField: 'Planned_6', actualField: 'Actual_6', responseField: 'Dispatch Status', responseType: 'select', options: ['Dispatched'], icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> },
    { step: 7, name: 'Fill the cost Form', question: 'Bill, Revenue & Cost Details', plannedField: 'Planned_7', actualField: 'Actual_7', responseField: 'Bill No.', secondResponseField: 'Revenue', thirdResponseField: 'Item Cost', fourthResponseField: 'Total Cost', responseType: 'custom', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-2 4h2m-2 4h2M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg> },
    { step: 8, name: 'File the Bill in Sales Bill File', question: 'Done?', plannedField: 'Planned_8', actualField: 'Actual_8', responseField: 'Status_8', responseType: 'select', options: ['Yes', 'No'], icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9l-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
];

const STATUS_CONFIGS = {
    'Pending': { color: 'yellow', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-700' },
    'Dispatched': { color: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700' },
    'Delivered': { color: 'green', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-700' },
    'Cancelled': { color: 'red', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-700' },
};

const getStatusConfig = (status: string) => STATUS_CONFIGS[status as keyof typeof STATUS_CONFIGS] || STATUS_CONFIGS['Pending'];

const formatToSheetDate = (date: Date) => {
    return date.toISOString();
};

const getNextPlannedTime = (currentActualTime: Date, value: number = 1, unit: 'hours' | 'days' = 'hours') => {
    const nextTime = new Date(currentActualTime);
    if (unit === 'hours') {
        nextTime.setTime(nextTime.getTime() + value * 60 * 60 * 1000);
    } else {
        nextTime.setDate(nextTime.getDate() + value);
    }

    // If it falls on Sunday (0), move to Monday
    if (nextTime.getDay() === 0) {
        nextTime.setDate(nextTime.getDate() + 1);
    }
    return nextTime;
};

const calculateTimeDelay = (plannedTime: string | null, actualTime: string | null) => {
    if (!plannedTime) return null;

    const planned = new Date(plannedTime);
    const compareTime = actualTime ? new Date(actualTime) : new Date();

    const diffMs = compareTime.getTime() - planned.getTime();
    const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));

    const isDelayed = diffMs > 0;
    const status = actualTime ? 'completed' : 'running';

    return {
        hours: diffHours,
        minutes: diffMinutes,
        isDelayed,
        status,
        display: `${isDelayed ? '+' : '-'}${diffHours}h ${diffMinutes}m`
    };
};

export default function O2DPage() {
    const [orders, setOrders] = useState<O2DOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<O2DOrder | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFollowUpOrder, setSelectedFollowUpOrder] = useState<O2DOrder | null>(null);
    const [selectedFollowUpItems, setSelectedFollowUpItems] = useState<O2DOrder[]>([]);
    const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
    const [activeFollowUpStep, setActiveFollowUpStep] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [costingItems, setCostingItems] = useState<string[]>([]);
    const [dropdownParties, setDropdownParties] = useState<string[]>([]);
    const [isAddingParty, setIsAddingParty] = useState(false);
    const [isSubmittingParty, setIsSubmittingParty] = useState(false);
    const [newPartyName, setNewPartyName] = useState('');

    const [formData, setFormData] = useState<Partial<O2DOrder>>({
        party_name: '',
        type: 'DEALER',
        contact_person: '',
        email: '',
        contact_no_1: '',
        contact_no_2: '',
        location: '',
        state: '',
        field_person_name: '',
        status: 'Pending',
    });
    const [orderItems, setOrderItems] = useState<OrderItem[]>([{ id: Date.now(), item: '', qty: '' } as OrderItem]);
    const [viewMode, setViewMode] = useState<'group' | 'details' | 'cancelled' | 'setup'>('group');
    useSetupViewFromQuery(setViewMode);
    const [stepConfig, setStepConfig] = useState<StepConfig[]>([]);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [showDelayedOnly, setShowDelayedOnly] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const itemsPerPage = 20;
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id?: number; party_id?: number; party_name?: string; item?: string } | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<{ id?: number; party_id?: number; party_name?: string; item?: string; isCancelled: boolean } | null>(null);
    const [sortField, setSortField] = useState<'party_name' | 'type' | 'location' | 'created_at'>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ id?: number; party_id?: number; party_name?: string; item?: string } | null>(null);
    const [removeStep, setRemoveStep] = useState<number | 'all'>(1);
    const [filters, setFilters] = useState({
        partyName: '',
        type: '',
        status: '',
        location: '',
        state: '',
        representative: '',
        contactPerson: '',
        email: '',
        phone: '',
        dateFrom: '',
        dateTo: '',
    });
    const [activeStepFilter, setActiveStepFilter] = useState<number | null>(null);
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const toast = useToast();
    const loader = useLoader();

    useEffect(() => {
        fetchOrders();
        fetchUsers();
        fetchCostingItems();
        fetchDropdownParties();
        fetchStepConfig();

        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000 * 60); // Update every minute

        const syncTimer = setInterval(() => {
            fetchOrders();
        }, 1000 * 5); // Sync every 5 seconds for real-time updates

        return () => {
            clearInterval(timer);
            clearInterval(syncTimer);
        };
    }, []);

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

    const fetchCostingItems = async () => {
        try {
            const res = await fetch('/api/costing-items');
            if (res.ok) {
                const data = await res.json();
                setCostingItems(data.items || []);
            }
        } catch (error) {
            console.error('Error fetching costing items:', error);
        }
    };

    const fetchDropdownParties = async () => {
        try {
            const res = await fetch('/api/o2d-dropdown');
            if (res.ok) {
                const data = await res.json();
                setDropdownParties(data.parties || []);
            }
        } catch (error) {
            console.error('Error fetching dropdown parties:', error);
        }
    };

    const handleAddParty = async () => {
        if (!newPartyName.trim() || isSubmittingParty) return;
        setIsSubmittingParty(true);
        try {
            const res = await fetch('/api/o2d-dropdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newPartyName.trim() })
            });

            if (res.ok) {
                toast.success('Party added successfully');
                await fetchDropdownParties();
                setFormData({ ...formData, party_name: newPartyName.trim(), party_id: undefined });
                setNewPartyName('');
                setIsAddingParty(false);
            } else {
                toast.error('Failed to add party');
            }
        } catch (error) {
            console.error('Error adding party:', error);
            toast.error('Error adding party');
        } finally {
            setIsSubmittingParty(false);
        }
    };

    const fetchStepConfig = async () => {
        try {
            const res = await fetch('/api/o2d-config');
            if (res.ok) {
                const data = await res.json();
                if (data.config && data.config.length > 0) {
                    setStepConfig(data.config);
                } else {
                    const defaultConfig = FOLLOWUP_STEPS_CONFIG.map(step => ({
                        step: step.step,
                        stepName: step.name,
                        doerName: '',
                        tatValue: 1,
                        tatUnit: 'hours' as 'hours' | 'days'
                    }));
                    setStepConfig(defaultConfig);
                }
            }
        } catch (error) {
            console.error('Error fetching step config:', error);
            const defaultConfig = FOLLOWUP_STEPS_CONFIG.map(step => ({
                step: step.step,
                stepName: step.name,
                doerName: '',
                tatValue: 1,
                tatUnit: 'hours' as 'hours' | 'days'
            }));
            setStepConfig(defaultConfig);
        }
    };

    const partyOptions = useMemo(() => {
        const unique = Array.from(new Set([
            ...orders.map(o => o.party_name),
            ...dropdownParties
        ])).filter(Boolean);
        return unique.map(name => ({ id: name, name }));
    }, [orders, dropdownParties]);

    const locationOptions = useMemo(() => {
        const unique = Array.from(new Set(orders.map(o => o.location))).filter(Boolean);
        return unique.map(name => ({ id: name, name }));
    }, [orders]);

    const stateOptions = useMemo(() => {
        const unique = Array.from(new Set(orders.map(o => o.state))).filter(Boolean);
        return unique.map(name => ({ id: name, name }));
    }, [orders]);

    const representativeOptions = useMemo(() => {
        return systemUsers.map(u => ({ id: u.username, name: u.username }));
    }, [systemUsers]);

    const getCurrentStep = (item: OrderItem) => {
        if (!item.Actual_1) return 1;
        if (!item.Actual_2) return 2;
        if (!item.Actual_3 && item['Stock Availability'] !== 'Stock Available') return 3;
        if (!item.Actual_4) return 4;
        if (!item.Actual_5 && item.Destination !== 'Local') return 5;
        if (!item.Actual_6) return 6;
        if (!item.Actual_7) return 7;
        if (!item.Actual_8) return 8;
        return null;
    };

    const matchesTimeFilter = (item: OrderItem, filter: string | null) => {
        if (!filter) return true;

        const step = getCurrentStep(item);
        if (!step) return false;

        const plannedTime = (item as any)[`Planned_${step}`];
        if (!plannedTime) return false;

        const plannedDate = new Date(plannedTime);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const plannedDay = new Date(plannedTime);
        plannedDay.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((plannedDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (filter === 'Delayed') return plannedDate < new Date();
        if (filter === 'Today') return diffDays === 0;
        if (filter === 'Tomorrow') return diffDays === 1;
        if (filter === 'Next 3') return diffDays >= 0 && diffDays <= 3;
        if (filter === 'Next 5') return diffDays >= 0 && diffDays <= 5;
        if (filter === 'Next 7') return diffDays >= 0 && diffDays <= 7;
        if (filter === 'Next 15') return diffDays >= 0 && diffDays <= 15;

        return true;
    };

    const statusStats = useMemo(() => {
        const allItems = orders.flatMap(o => o.items || []);

        return {
            Total: allItems.length,
            Step1: allItems.filter(item => !item.Actual_1).length,
            Step2: allItems.filter(item => !!item.Actual_1 && !item.Actual_2).length,
            Step3: allItems.filter(item => !!item.Actual_2 && !item.Actual_3 && item['Stock Availability'] !== 'Stock Available').length,
            Step4: allItems.filter(item => (!!item.Actual_3 || item['Stock Availability'] === 'Stock Available') && !item.Actual_4).length,
            Step5: allItems.filter(item => !!item.Actual_4 && !item.Actual_5 && item.Destination !== 'Local').length,
            Step6: allItems.filter(item => (!!item.Actual_5 || (!!item.Actual_4 && item.Destination === 'Local')) && !item.Actual_6).length,
            Step7: allItems.filter(item => !!item.Actual_6 && !item.Actual_7).length,
            Step8: allItems.filter(item => !!item.Actual_7 && !item.Actual_8).length,
        };
    }, [orders]);

    const timeStats = useMemo(() => {
        const allItems = orders.flatMap(o => o.items || []).filter(item => {
            const isItemCancelled = item.Cancelled === 'Cancelled';
            return viewMode === 'cancelled' ? isItemCancelled : !isItemCancelled;
        });

        const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 5': 0, 'Next 7': 0, 'Next 15': 0 };

        allItems.forEach(item => {
            if (matchesTimeFilter(item as any, 'Delayed')) stats['Delayed']++;
            if (matchesTimeFilter(item as any, 'Today')) stats['Today']++;
            if (matchesTimeFilter(item as any, 'Tomorrow')) stats['Tomorrow']++;
            if (matchesTimeFilter(item as any, 'Next 3')) stats['Next 3']++;
            if (matchesTimeFilter(item as any, 'Next 5')) stats['Next 5']++;
            if (matchesTimeFilter(item as any, 'Next 7')) stats['Next 7']++;
            if (matchesTimeFilter(item as any, 'Next 15')) stats['Next 15']++;
        });

        return stats;
    }, [orders, viewMode]);

    const matchesStepFilter = (item: OrderItem, step: number) => {
        switch (step) {
            case 1: return !item.Actual_1;
            case 2: return !!item.Actual_1 && !item.Actual_2;
            case 3: return !!item.Actual_2 && !item.Actual_3 && item['Stock Availability'] !== 'Stock Available';
            case 4: return (!!item.Actual_3 || item['Stock Availability'] === 'Stock Available') && !item.Actual_4;
            case 5: return !!item.Actual_4 && !item.Actual_5 && item.Destination !== 'Local';
            case 6: return (!!item.Actual_5 || (!!item.Actual_4 && item.Destination === 'Local')) && !item.Actual_6;
            case 7: return !!item.Actual_6 && !item.Actual_7;
            case 8: return !!item.Actual_7 && !item.Actual_8;
            default: return true;
        }
    };

    const getDelayInfo = (planned: string | null | undefined, actual: string | null | undefined) => {
        if (!planned) return null;
        try {
            const pDate = new Date(planned);
            if (isNaN(pDate.getTime())) return null;

            const isPending = !actual;
            const refDate = actual ? new Date(actual) : new Date();
            if (isNaN(refDate.getTime())) return null;

            const diff = refDate.getTime() - pDate.getTime();
            const absDiff = Math.abs(diff);
            const hours = Math.floor(absDiff / (1000 * 60 * 60));
            const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

            const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            if (diff > 60000) { // More than 1 minute delay
                return { text: `${timeStr} Delay`, color: 'text-red-500 font-bold' };
            } else if (diff < -60000) { // More than 1 minute ahead/left
                return { text: `${timeStr} ${isPending ? 'Left' : 'Ahead'}`, color: 'text-emerald-500 font-bold' };
            } else {
                return { text: 'On Time', color: 'text-emerald-600 font-bold' };
            }
        } catch (e) {
            return null;
        }
    };

    const fetchOrders = async () => {
        try {
            const res = await fetch('/api/o2d');
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            } else {
                toast.error('Failed to fetch orders');
            }
        } catch (error) {
            toast.error('Error loading orders');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (order?: O2DOrder) => {
        if (order) {
            setEditingOrder(order);
            setFormData({
                party_name: order.party_name,
                type: order.type,
                contact_person: order.contact_person,
                email: order.email,
                contact_no_1: order.contact_no_1,
                contact_no_2: order.contact_no_2,
                location: order.location,
                state: order.state,
                field_person_name: order.field_person_name,
                status: order.status || 'Pending',
            });
            setOrderItems(order.items && order.items.length > 0 ? order.items : [{ id: Date.now(), item: '', qty: '' } as OrderItem]);
        } else {
            setEditingOrder(null);
            setFormData({
                party_name: '',
                type: 'DEALER',
                contact_person: '',
                email: '',
                contact_no_1: '',
                contact_no_2: '',
                location: '',
                state: '',
                field_person_name: '',
                status: 'Pending',
            });
            setOrderItems([{ id: Date.now(), item: '', qty: '' } as OrderItem]);
        }
        setIsModalOpen(true);
    };

    const handleAddItemRow = () => {
        setOrderItems([...orderItems, { id: Date.now(), item: '', qty: '' } as OrderItem]);
    };

    const handleRemoveItemRow = (id: number) => {
        if (orderItems.length > 1) {
            setOrderItems(orderItems.filter(item => item.id !== id));
        }
    };

    const handleItemChange = (id: number, field: 'item' | 'qty', value: string) => {
        setOrderItems(orderItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Format items for API
        const formattedItems = orderItems.filter(i => i.item && i.qty);
        if (formattedItems.length === 0) {
            toast.error('At least one item with quantity is required');
            return;
        }

        // Determine if this is a single-item update (Details view) or full order update (Group view)
        const isItemUpdate = editingOrder && viewMode === 'details' && editingOrder.items?.length === 1;

        const payload: any = {
            ...formData,
            items: formattedItems,
        };

        if (editingOrder) {
            if (isItemUpdate) {
                // Details view: update single item
                payload.operation_type = 'item';
                payload.item_id = editingOrder.items[0].id;
                payload.item = formattedItems[0].item;
                payload.qty = formattedItems[0].qty;
            } else {
                // Group view: update entire party
                payload.operation_type = 'party';
                payload.party_id = editingOrder.party_id;
            }
        } else {
            // New order: Initialize follow-up steps (Flat Columns)
            // New order: Initialize follow-up steps (Flat Columns)
            const now = new Date();
            const step1Config = stepConfig.find(c => c.step === 1);
            const nextTime = getNextPlannedTime(now, step1Config?.tatValue || 1, step1Config?.tatUnit || 'hours');

            payload.Planned_1 = nextTime.toISOString();
        }

        try {
            loader.showLoader();
            const res = await fetch('/api/o2d', {
                method: editingOrder ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success(editingOrder ? 'Order updated' : 'Order created');
                setIsModalOpen(false);
                fetchOrders();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Operation failed');
            }
        } catch (error) {
            toast.error('Error saving order');
        } finally {
            loader.hideLoader();
        }
    };

    const openDeleteModal = (target: { id?: number; party_id?: number; party_name?: string; item?: string }) => {
        setDeleteTarget(target);
        setShowDeleteModal(true);
    };

    const openCancelModal = (target: { id?: number; party_id?: number; party_name?: string; item?: string; isCancelled: boolean }) => {
        setCancelTarget(target);
        setShowCancelModal(true);
    };

    const openRemoveModal = (target: { id?: number; party_id?: number; party_name?: string; item?: string }) => {
        setRemoveTarget(target);
        setRemoveStep(1);
        setShowRemoveModal(true);
    };

    const handleRemoveFollowUp = async () => {
        if (!removeTarget) return;

        try {
            loader.showLoader();
            const payload: any = {
                operation_type: 'followup'
            };

            if (viewMode === 'group') {
                payload.party_id = removeTarget.party_id;
            } else {
                payload.id = removeTarget.id;
            }

            if (removeStep === 'all') {
                // Clear active fields for all steps, and Planned 2-8 (KEEP Planned 1)
                FOLLOWUP_STEPS_CONFIG.forEach(config => {
                    payload[config.actualField] = '';
                    payload[config.responseField] = '';
                    if (config.secondResponseField) payload[config.secondResponseField] = '';
                    if (config.thirdResponseField) payload[config.thirdResponseField] = '';
                    if (config.fourthResponseField) payload[config.fourthResponseField] = '';

                    // Clear planned times too, except for Predicted_1
                    if (config.step > 1) {
                        payload[config.plannedField] = '';
                    }
                });
            } else {
                // Clear from chosen step onwards
                const startStepNum = Number(removeStep);
                FOLLOWUP_STEPS_CONFIG.forEach(config => {
                    if (config.step === startStepNum) {
                        // For the current step: Clear actual and responses, keep planned
                        payload[config.actualField] = '';
                        payload[config.responseField] = '';
                        if (config.secondResponseField) payload[config.secondResponseField] = '';
                        if (config.thirdResponseField) payload[config.thirdResponseField] = '';
                        if (config.fourthResponseField) payload[config.fourthResponseField] = '';
                    } else if (config.step > startStepNum) {
                        // For future steps: Clear everything (planned, actual, responses)
                        payload[config.plannedField] = '';
                        payload[config.actualField] = '';
                        payload[config.responseField] = '';
                        if (config.secondResponseField) payload[config.secondResponseField] = '';
                        if (config.thirdResponseField) payload[config.thirdResponseField] = '';
                        if (config.fourthResponseField) payload[config.fourthResponseField] = '';
                    }
                });
            }

            const res = await fetch('/api/o2d', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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

    const handleCancel = async () => {
        if (!cancelTarget) return;

        try {
            loader.showLoader();
            const payload: any = {
                operation_type: 'followup',
                Cancelled: cancelTarget.isCancelled ? '' : 'Cancelled'
            };

            if (viewMode === 'group') {
                payload.party_id = cancelTarget.party_id;
            } else {
                payload.id = cancelTarget.id;
            }

            const res = await fetch('/api/o2d', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(cancelTarget.isCancelled ? 'Cancellation removed' : 'Order cancelled');
                fetchOrders();
            } else {
                toast.error('Operation failed');
            }
        } catch (error) {
            toast.error('Error during operation');
        } finally {
            loader.hideLoader();
            setShowCancelModal(false);
            setCancelTarget(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        try {
            loader.showLoader();
            const deleteId = viewMode === 'group' ? deleteTarget.party_id : deleteTarget.id;
            const deleteType = viewMode === 'group' ? 'party' : 'item';

            const res = await fetch(`/api/o2d?id=${deleteId}&type=${deleteType}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(viewMode === 'group' ? 'Order deleted' : 'Item deleted');
                fetchOrders();
            } else {
                toast.error('Delete failed');
            }
        } catch (error) {
            toast.error('Error deleting');
        } finally {
            loader.hideLoader();
            setShowDeleteModal(false);
            setDeleteTarget(null);
        }
    };

    const handleSort = (field: 'party_name' | 'type' | 'location' | 'created_at') => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleOpenFollowUpModal = (order: O2DOrder) => {
        setSelectedFollowUpItems([order]);
        setIsFollowUpModalOpen(true);
    };


    const handleFollowUpSubmit = async (order: O2DOrder, stepNumber: number, responses: Record<string, string>) => {
        if (!order) return;

        const config = FOLLOWUP_STEPS_CONFIG.find(c => c.step === stepNumber);
        if (!config) return;

        const now = new Date();
        const payload: any = {
            operation_type: 'followup',
            [config.actualField]: formatToSheetDate(now),
            [config.responseField]: responses[config.responseField]
        };

        // Determine if updating party (group view) or single item (details view)
        if (viewMode === 'details') {
            // In details view, use the item id
            const itemId = (order as any).current_item?.id || order.id;
            if (!itemId) {
                toast.error('Item ID not found');
                return;
            }
            payload.id = itemId;
            console.log('Details view - sending id:', itemId);
        } else {
            // In group view, use party_id
            if (!order.party_id) {
                toast.error('Party ID not found');
                return;
            }
            payload.party_id = order.party_id;
            console.log('Group view - sending party_id:', order.party_id);
        }

        if (config.secondResponseField && (responses[config.secondResponseField] !== undefined)) {
            payload[config.secondResponseField] = responses[config.secondResponseField];
        }
        if (config.thirdResponseField && (responses[config.thirdResponseField] !== undefined)) {
            payload[config.thirdResponseField] = responses[config.thirdResponseField];
        }
        if (config.fourthResponseField && (responses[config.fourthResponseField] !== undefined)) {
            payload[config.fourthResponseField] = responses[config.fourthResponseField];
        }

        // Calculate next step's planned time (1 hour later, skip Sunday)
        if (stepNumber < 8) {
            let nextStepIdx = stepNumber; // FOLLOWUP_STEPS_CONFIG is 0-indexed, so stepNumber (e.g. 2) is index 2 which is Step 3

            // If Step 2 (Check Stock Availability) is 'Stock Available', skip Step 3 (Production) scheduling
            if (stepNumber === 2 && responses['Stock Availability'] === 'Stock Available') {
                nextStepIdx = 3; // Set context to Step 4 for planned time
            }

            // If Step 4 is completed and Destination (Step 1) is 'Local', skip Step 5 (Transporter)
            if (stepNumber === 4 && order.Destination === 'Local') {
                nextStepIdx = 5; // Set context to Step 6 for planned time
            }

            if (nextStepIdx < 8) {
                const nextStepConfig = FOLLOWUP_STEPS_CONFIG[nextStepIdx];
                const configNext = stepConfig.find(c => c.step === nextStepConfig.step);
                const nextPlannedTime = getNextPlannedTime(now, configNext?.tatValue || 1, configNext?.tatUnit || 'hours');
                payload[nextStepConfig.plannedField] = formatToSheetDate(nextPlannedTime);
            }
        }

        console.log('Submitting payload:', payload);

        try {
            loader.showLoader();
            const res = await fetch('/api/o2d', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success(`Item Updated`);
                await fetchOrders();
                // If it was a bulk update, we might want to keep the modal open but update the state
                // However, the user usually wants to see the update reflected.
                // For simplicity, let's just refresh. The modal will stay open with fresh data from 'orders'
                // if we derive 'selectedFollowUpItems' from 'orders' IDs.
                // But since it's a separate state, let's update it manually for immediate feedback.
                setSelectedFollowUpItems(prev => prev.map(item => {
                    const isMatch = viewMode === 'details'
                        ? (item.id === payload.id || (item as any).current_item?.id === payload.id)
                        : item.party_id === payload.party_id;

                    if (isMatch) {
                        const updated = { ...item } as any;
                        updated[config.actualField] = payload[config.actualField];
                        updated[config.responseField] = payload[config.responseField];
                        if (config.secondResponseField) updated[config.secondResponseField] = payload[config.secondResponseField];
                        return updated;
                    }
                    return item;
                }));

            } else {
                const errorData = await res.json();
                console.error('API Error:', errorData);
                toast.error(errorData.error || 'Failed to update step');
            }
        } catch (error) {
            console.error('Error updating step:', error);
            toast.error('Error updating step');
        } finally {
            loader.hideLoader();
        }
    };

    const filteredOrders = useMemo(() => {
        const filtered = orders.filter(order => {
            const matchesSearch = (order.party_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (order.contact_person?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (order.location?.toLowerCase() || '').includes(searchQuery.toLowerCase());

            const matchesParty = !filters.partyName || order.party_name === filters.partyName;
            const matchesType = !filters.type || order.type === filters.type;
            const matchesStatus = !filters.status || order.status === filters.status;
            const matchesLocation = !filters.location || order.location === filters.location;
            const matchesState = !filters.state || order.state === filters.state;
            const matchesRep = !filters.representative || order.field_person_name === filters.representative;
            const matchesContactPerson = !filters.contactPerson || (order.contact_person?.toLowerCase() || '').includes(filters.contactPerson.toLowerCase());
            const matchesEmail = !filters.email || (order.email?.toLowerCase() || '').includes(filters.email.toLowerCase());
            const matchesPhone = !filters.phone || (order.contact_no_1?.includes(filters.phone) || order.contact_no_2?.includes(filters.phone));

            let matchesDate = true;
            if (filters.dateFrom || filters.dateTo) {
                const orderDate = new Date(order.created_at);
                if (filters.dateFrom) {
                    matchesDate = matchesDate && orderDate >= new Date(filters.dateFrom);
                }
                if (filters.dateTo) {
                    const toDate = new Date(filters.dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    matchesDate = matchesDate && orderDate <= toDate;
                }
            }

            const hasCancelledItems = (order.items || []).some(item => item.Cancelled === 'Cancelled');
            const hasActiveItems = (order.items || []).some(item => item.Cancelled !== 'Cancelled');
            const matchesCancellation = viewMode === 'cancelled' ? hasCancelledItems : hasActiveItems;

            const matchesStep = !activeStepFilter || (order.items || []).some(item => matchesStepFilter(item as any, activeStepFilter));
            const matchesTime = !activeTimeFilter || (order.items || []).some(item => matchesTimeFilter(item as any, activeTimeFilter));

            let matchesDelayed = true;
            if (showDelayedOnly) {
                matchesDelayed = (order.items || []).some(item => {
                    const steps = [1, 2, 3, 4, 5, 6, 7, 8];
                    return steps.some(stepNum => {
                        const planned = (item as any)[`Planned_${stepNum}`];
                        const actual = (item as any)[`Actual_${stepNum}`];
                        const delayInfo = getDelayInfo(planned, actual);
                        return delayInfo?.text.includes('Delay');
                    });
                });
            }

            return matchesSearch && matchesParty && matchesType && matchesStatus && matchesLocation && matchesState && matchesDate && matchesRep && matchesContactPerson && matchesEmail && matchesPhone && matchesStep && matchesTime && matchesCancellation && matchesDelayed;
        });

        // Apply sorting
        return filtered.sort((a, b) => {
            let aVal: any = a[sortField];
            let bVal: any = b[sortField];

            if (sortField === 'created_at') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            } else {
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
            }

            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }, [orders, searchQuery, filters, sortField, sortDirection, activeStepFilter, activeTimeFilter]);

    const paginatedOrders = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredOrders, currentPage, itemsPerPage]);

    const detailsRows = useMemo(() => {
        const rows: any[] = [];
        filteredOrders.forEach(order => {
            order.items?.forEach(item => {
                const isItemCancelled = item.Cancelled === 'Cancelled';
                const matchesCancellation = viewMode === 'cancelled' ? isItemCancelled : !isItemCancelled;

                let matchesDelayed = true;
                if (showDelayedOnly) {
                    const steps = [1, 2, 3, 4, 5, 6, 7, 8];
                    matchesDelayed = steps.some(stepNum => {
                        const planned = (item as any)[`Planned_${stepNum}`];
                        const actual = (item as any)[`Actual_${stepNum}`];
                        const delayInfo = getDelayInfo(planned, actual);
                        return delayInfo?.text.includes('Delay');
                    });
                }

                if (matchesCancellation && matchesDelayed && (!activeStepFilter || matchesStepFilter(item as any, activeStepFilter)) && (!activeTimeFilter || matchesTimeFilter(item as any, activeTimeFilter))) {
                    rows.push({
                        ...order,
                        ...item, // Bring item-specific follow-up fields (Actual_1, etc.) to top level
                        current_item: item
                    });
                }
            });
        });
        return rows;
    }, [filteredOrders, activeStepFilter, viewMode, showDelayedOnly, activeTimeFilter]);

    const paginatedDetailsRows = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return detailsRows.slice(startIndex, startIndex + itemsPerPage);
    }, [detailsRows, currentPage, itemsPerPage]);

    const totalPages = Math.ceil((viewMode === 'group' ? filteredOrders.length : detailsRows.length) / itemsPerPage);


    const toggleSelection = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        const currentPageIds = paginatedDetailsRows
            .filter(r => r.current_item?.Cancelled !== 'Cancelled' || viewMode === 'cancelled')
            .map(r => String(r.id));
        const allSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedItems.has(id));

        setSelectedItems(prev => {
            const next = new Set(prev);
            if (allSelected) {
                currentPageIds.forEach(id => next.delete(id));
            } else {
                currentPageIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleBulkFollowUp = () => {
        if (selectedItems.size === 0) return;

        // Get the actual data for the selected items by ID
        const selectedData = detailsRows.filter(r => selectedItems.has(String(r.id)));

        setSelectedFollowUpItems(selectedData);
        setIsFollowUpModalOpen(true);
    };

    const handleSaveStepConfig = async () => {
        const isValid = stepConfig.every(config =>
            config.doerName.trim() !== '' && config.tatValue > 0
        );

        if (!isValid) {
            toast.error('Please fill in all doer names and TAT values');
            return;
        }

        try {
            setIsSavingConfig(true);
            loader.showLoader();
            const res = await fetch('/api/o2d-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: stepConfig }),
            });

            if (res.ok) {
                toast.success('Step configuration saved successfully');
                await fetchStepConfig();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to save configuration');
            }
        } catch (error) {
            toast.error('Error saving configuration');
        } finally {
            setIsSavingConfig(false);
            loader.hideLoader();
        }
    };

    const handleConfigChange = (step: number, field: 'doerName' | 'tatValue' | 'tatUnit', value: string | number) => {
        setStepConfig(prev => prev.map(config =>
            config.step === step
                ? { ...config, [field]: value }
                : config
        ));
    };

    return (
        <LayoutWrapper>
            <div className="w-full min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
                <div className="max-w-[1920px] mx-auto px-4 py-2 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Order to Delivery (O2D)</h1>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-0.5">Manage and track your delivery orders</p>
                        </div>



                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowDelayedOnly(!showDelayedOnly)}
                                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-2 font-medium text-xs ${showDelayedOnly ? 'bg-red-500 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Open Task
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowFilterModal(true)}
                                className="px-3 py-2 bg-[var(--theme-primary)] text-gray-900 hover:bg-[var(--theme-secondary)] hover:shadow-lg rounded-xl transition-all flex items-center gap-2 font-medium text-xs"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                Filter
                            </motion.button>
                            <div className="flex items-center bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
                                <button
                                    onClick={() => { setViewMode('group'); setCurrentPage(1); }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewMode === 'group' ? 'bg-white dark:bg-gray-600 text-[var(--theme-primary)] shadow-sm' : 'text-gray-500'}`}
                                    title="Group View"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                    Group
                                </button>
                                <button
                                    onClick={() => { setViewMode('details'); setCurrentPage(1); }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewMode === 'details' ? 'bg-white dark:bg-gray-600 text-[var(--theme-primary)] shadow-sm' : 'text-gray-500'}`}
                                    title="Details View"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                    Details
                                </button>
                                <button
                                    onClick={() => { setViewMode('cancelled'); setCurrentPage(1); }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewMode === 'cancelled' ? 'bg-white dark:bg-gray-600 text-red-500 shadow-sm' : 'text-gray-500'}`}
                                    title="Cancelled View"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                    Cancelled
                                </button>
                                <button
                                    onClick={() => { setViewMode('setup'); setCurrentPage(1); }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewMode === 'setup' ? 'bg-white dark:bg-gray-600 text-purple-500 shadow-sm' : 'text-gray-500'}`}
                                    title="Setup Configuration"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    Setup
                                </button>
                            </div>

                            {viewMode === 'details' && selectedItems.size > 0 && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    onClick={handleBulkFollowUp}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 font-bold text-xs"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    Update Selected ({selectedItems.size})
                                </motion.button>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleOpenModal()}
                                className="px-3 py-2 bg-[var(--theme-primary)] text-gray-900 hover:bg-[var(--theme-secondary)] hover:shadow-lg rounded-xl transition-all flex items-center gap-2 font-medium text-xs"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                CREATE ORDER
                            </motion.button>
                        </div>
                    </div>
                </div>

                <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
                    {/* Stats Highlights */}
                    <div className="overflow-x-auto pb-2 custom-scrollbar-horizontal scroll-smooth -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                        <div className="flex gap-2 min-w-max pr-8">
                            {[
                                { step: null, label: 'All Items', value: statusStats.Total, gradient: 'from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-700 dark:text-gray-400', iconBg: 'from-gray-500 to-gray-600', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
                                { step: 1, label: '1. Destination', value: statusStats.Step1, gradient: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20', border: 'border-indigo-200 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-400', iconBg: 'from-indigo-500 to-indigo-600', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
                                { step: 2, label: '2. Stock Check', value: statusStats.Step2, gradient: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20', border: 'border-yellow-200 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-400', iconBg: 'from-yellow-500 to-yellow-600', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
                                { step: 3, label: '3. Production', value: statusStats.Step3, gradient: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20', border: 'border-orange-200 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-400', iconBg: 'from-orange-500 to-orange-600', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                                { step: 4, label: '4. Warehouse', value: statusStats.Step4, gradient: 'from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20', border: 'border-pink-200 dark:border-pink-700', text: 'text-pink-700 dark:text-pink-400', iconBg: 'from-pink-500 to-pink-600', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
                                { step: 5, label: '5. Transporter', value: statusStats.Step5, gradient: 'from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20', border: 'border-teal-200 dark:border-teal-700', text: 'text-teal-700 dark:text-teal-400', iconBg: 'from-teal-500 to-teal-600', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                                { step: 6, label: '6. Account', value: statusStats.Step6, gradient: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20', border: 'border-blue-200 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-400', iconBg: 'from-blue-500 to-blue-600', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
                                { step: 7, label: '7. Cost Form', value: statusStats.Step7, gradient: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20', border: 'border-purple-200 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-400', iconBg: 'from-purple-500 to-purple-600', icon: 'M9 8h6m-2 4h2m-2 4h2M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z' },
                                { step: 8, label: '8. Bill Filing', value: statusStats.Step8, gradient: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20', border: 'border-green-200 dark:border-green-700', text: 'text-green-700 dark:text-green-400', iconBg: 'from-green-500 to-green-600', icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9l-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                            ].map((stat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    whileHover={activeStepFilter === stat.step ? {} : { y: -1 }}
                                    onClick={() => {
                                        setActiveStepFilter(stat.step);
                                        if (stat.step === null) {
                                            setActiveTimeFilter(null);
                                            setShowDelayedOnly(false);
                                            setSearchQuery('');
                                        }
                                    }}
                                    className={`bg-gradient-to-br ${stat.gradient} p-2 rounded-lg border ${stat.border} shadow-sm flex items-center gap-2 group transition-all min-w-[140px] cursor-pointer ${activeStepFilter === stat.step ? 'bg-white dark:bg-gray-800 border-[var(--theme-primary)] shadow-md' : 'opacity-80 hover:opacity-100'}`}
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


                    {/* Table View (Follow-up is now handled via Modal) */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
                        {viewMode === 'setup' ? (
                            <>
                                {/* Setup Mode Form */}
                                <div className="p-6">
                                    <div className="mb-6">
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Step Configuration</h2>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Configure doer assignments and TAT (Turn Around Time) for each follow-up step.</p>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">Step</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">Doer Name</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">TAT</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stepConfig.map((config, index) => (
                                                    <tr key={config.step} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                                    {config.step}
                                                                </div>
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{config.stepName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <select
                                                                value={config.doerName}
                                                                onChange={(e) => handleConfigChange(config.step, 'doerName', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                            >
                                                                <option value="">Select Doer</option>
                                                                {systemUsers.map(user => (
                                                                    <option key={user.username} value={user.username}>{user.username}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={config.tatValue}
                                                                    onChange={(e) => handleConfigChange(config.step, 'tatValue', parseInt(e.target.value) || 1)}
                                                                    className="w-20 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                                />
                                                                <select
                                                                    value={config.tatUnit}
                                                                    onChange={(e) => handleConfigChange(config.step, 'tatUnit', e.target.value)}
                                                                    className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                                >
                                                                    <option value="hours">Hours</option>
                                                                    <option value="days">Days</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mt-6 flex items-center justify-end gap-3">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => fetchStepConfig()}
                                            disabled={isSavingConfig}
                                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                                        >
                                            Reset
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleSaveStepConfig}
                                            disabled={isSavingConfig}
                                            className="px-6 py-2 bg-purple-600 text-white rounded-xl font-medium text-sm hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isSavingConfig ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Save Configuration
                                                </>
                                            )}
                                        </motion.button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Filter & Pagination Row */}
                                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-1.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30 gap-2">
                                    <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            Showing <span className="text-gray-900 dark:text-white">{Math.max(0, (currentPage - 1) * itemsPerPage + (viewMode === 'group' ? (filteredOrders.length > 0 ? 1 : 0) : (detailsRows.length > 0 ? 1 : 0)))}</span>- <span className="text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, viewMode === 'group' ? filteredOrders.length : detailsRows.length)}</span> of <span className="text-gray-900 dark:text-white">{viewMode === 'group' ? filteredOrders.length : detailsRows.length}</span>
                                        </p>

                                        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block mx-1" />

                                        <div className="flex items-center gap-1">
                                            {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 5', 'Next 7', 'Next 15'] as const).map((filter) => (
                                                <button
                                                    key={filter}
                                                    onClick={() => setActiveTimeFilter(activeTimeFilter === filter ? null : filter)}
                                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border relative ${activeTimeFilter === filter
                                                        ? 'bg-[var(--theme-primary)] text-gray-900 border-[var(--theme-primary)] shadow-sm'
                                                        : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'
                                                        }`}
                                                >
                                                    {filter}
                                                    {timeStats[filter] > 0 && (
                                                        <sup className={`ml-1 text-[8px] ${activeTimeFilter === filter ? 'text-gray-900/80' : (filter === 'Delayed' ? 'text-red-500' : 'text-[var(--theme-primary)]')}`}>
                                                            {timeStats[filter]}
                                                        </sup>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="p-1 px-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-white dark:hover:bg-gray-700 transition-all text-[10px] font-medium"
                                            >
                                                PREV
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {(() => {
                                                    const pages = [];
                                                    const maxVisible = 5;
                                                    let start = Math.max(1, currentPage - 2);
                                                    let end = Math.min(totalPages, start + maxVisible - 1);
                                                    if (end === totalPages) start = Math.max(1, end - maxVisible + 1);

                                                    for (let i = start; i <= end; i++) {
                                                        pages.push(
                                                            <button
                                                                key={i}
                                                                onClick={() => setCurrentPage(i)}
                                                                className={`w-6 h-6 rounded-lg text-[10px] font-medium transition-all ${currentPage === i ? 'bg-[var(--theme-primary)] text-gray-900' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`}
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
                                                className="p-1 px-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-white dark:hover:bg-gray-700 transition-all text-[10px] font-medium"
                                            >
                                                NEXT
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[var(--theme-primary)] dark:bg-[var(--theme-primary)] sticky top-0 border-b border-gray-200 dark:border-gray-700">
                                                {viewMode !== 'group' && (
                                                    <th className="px-4 py-3 text-left w-10 sticky left-0 z-[21] bg-[var(--theme-primary)]">
                                                        <input
                                                            type="checkbox"
                                                            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            checked={
                                                                paginatedDetailsRows.some(r => r.current_item?.Cancelled !== 'Cancelled' || viewMode === 'cancelled') &&
                                                                paginatedDetailsRows
                                                                    .filter(r => r.current_item?.Cancelled !== 'Cancelled' || viewMode === 'cancelled')
                                                                    .every(r => selectedItems.has(String(r.id)))
                                                            }
                                                            onChange={toggleAll}
                                                        />
                                                    </th>
                                                )}
                                                <th className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider sticky left-0 bg-[var(--theme-primary)] z-10">Actions</th>
                                                {viewMode !== 'group' && (
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">ID</th>
                                                )}
                                                <th className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">Party ID</th>
                                                <th onClick={() => handleSort('party_name')} className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        Party Details
                                                        {sortField === 'party_name' && (
                                                            <svg className={`w-4 h-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                        )}
                                                    </div>
                                                </th>
                                                <th onClick={() => handleSort('type')} className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        Type
                                                        {sortField === 'type' && (
                                                            <svg className={`w-4 h-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">Contact Info</th>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">Representative</th>
                                                {viewMode !== 'details' && (
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">Cancelled</th>
                                                )}
                                                <th onClick={() => handleSort('location')} className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        Location
                                                        {sortField === 'location' && (
                                                            <svg className={`w-4 h-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                        )}
                                                    </div>
                                                </th>
                                                {viewMode !== 'group' && (
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider min-w-[280px]">Item Details</th>
                                                )}
                                                {viewMode === 'group' && (
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-white uppercase tracking-wider">Summary</th>
                                                )}
                                                {viewMode !== 'group' && (
                                                    <>
                                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider min-w-[150px]">Step 1: Destination</th>
                                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider min-w-[150px]">Step 2: Stock Check</th>
                                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider min-w-[150px]">Step 3: Production</th>
                                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider min-w-[150px]">Step 4: Warehouse</th>
                                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider min-w-[150px]">Step 5: Transporter</th>
                                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider min-w-[150px]">Step 6: Account</th>
                                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider min-w-[180px]">Step 7: Costing</th>
                                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider min-w-[150px]">Step 8: Billing</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                            {(viewMode === 'group' ? paginatedOrders : paginatedDetailsRows).map((row, index) => (
                                                <tr
                                                    key={viewMode === 'group' ? row.party_id : row.id}
                                                    className={`group transition-all border-b border-gray-50 dark:border-gray-700/50 ${(viewMode === 'group' ? row.items?.some((i: OrderItem) => i.Cancelled === 'Cancelled') : row.current_item?.Cancelled === 'Cancelled')
                                                        ? 'bg-red-50/80 dark:bg-red-900/10 hover:bg-red-100/80 dark:hover:bg-red-900/20'
                                                        : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30'
                                                        }`}
                                                >
                                                    {viewMode !== 'group' && (
                                                        <td className="px-4 py-3 text-left w-10">
                                                            {(row.current_item?.Cancelled !== 'Cancelled' || viewMode === 'cancelled') && (
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                    checked={selectedItems.has(String(row.id))}
                                                                    onChange={() => toggleSelection(String(row.id))}
                                                                />
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3 text-left sticky left-0 bg-white dark:bg-gray-800 group-hover:bg-gray-50/50 dark:group-hover:bg-gray-700/30 z-10">
                                                        <div className="flex justify-center items-center">
                                                            <div className="grid grid-cols-2 gap-1.5 w-fit">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenModal(viewMode === 'group' ? row : { ...row, items: [row.current_item] });
                                                                    }}
                                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                                    title="Edit"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openDeleteModal({
                                                                            party_id: row.party_id,
                                                                            id: viewMode !== 'group' ? row.current_item?.id : undefined,
                                                                            party_name: row.party_name,
                                                                            item: viewMode !== 'group' ? row.current_item?.item : undefined
                                                                        });
                                                                    }}
                                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                                    title="Delete"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => openCancelModal({
                                                                        party_id: row.party_id,
                                                                        id: viewMode !== 'group' ? row.current_item?.id : undefined,
                                                                        party_name: row.party_name,
                                                                        item: viewMode !== 'group' ? row.current_item?.item : undefined,
                                                                        isCancelled: viewMode === 'group' ? row.items?.some((i: OrderItem) => i.Cancelled === 'Cancelled') : row.current_item?.Cancelled === 'Cancelled'
                                                                    })}
                                                                    className={`p-1.5 rounded-lg transition-all ${(viewMode === 'group' ? row.items?.some((i: OrderItem) => i.Cancelled === 'Cancelled') : row.current_item?.Cancelled === 'Cancelled')
                                                                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                                        : 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                                                                        }`}
                                                                    title={(viewMode === 'group' ? row.items?.some((i: OrderItem) => i.Cancelled === 'Cancelled') : row.current_item?.Cancelled === 'Cancelled') ? 'Remove Cancellation' : 'Cancel'}
                                                                >
                                                                    {(viewMode === 'group' ? row.items?.some((i: OrderItem) => i.Cancelled === 'Cancelled') : row.current_item?.Cancelled === 'Cancelled') ? (
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                    ) : (
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => openRemoveModal({
                                                                        party_id: row.party_id,
                                                                        id: viewMode !== 'group' ? row.current_item?.id : undefined,
                                                                        party_name: row.party_name,
                                                                        item: viewMode !== 'group' ? row.current_item?.item : undefined
                                                                    })}
                                                                    className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                                                    title="Remove Follow Up"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {viewMode !== 'group' && (
                                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                                                            {row.current_item?.id}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                                                        {row.party_id}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-medium text-gray-900 dark:text-white text-sm tracking-tight">{row.party_name}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">{row.contact_person}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-lg uppercase tracking-wider border border-gray-200 dark:border-gray-600">
                                                            {row.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-lg bg-[var(--theme-lighter)] dark:bg-gray-700/50 flex items-center justify-center text-[var(--theme-primary)]">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                </div>
                                                                <span className="font-medium text-gray-700 dark:text-gray-300">{row.email || '-'}</span>
                                                            </div>
                                                            <div className="flex gap-4 ml-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{row.contact_no_1}</span>
                                                                </div>
                                                                {row.contact_no_2 && (
                                                                    <div className="flex items-center gap-1.5 border-l border-gray-100 dark:border-gray-700 pl-4">
                                                                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{row.contact_no_2}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                            </div>
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{row.field_person_name || '-'}</span>
                                                        </div>
                                                    </td>
                                                    {viewMode !== 'details' && (
                                                        <td className="px-4 py-3">
                                                            {(viewMode === 'group' ? row.items?.some((i: OrderItem) => i.Cancelled === 'Cancelled') : row.current_item?.Cancelled === 'Cancelled') ? (
                                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-bold rounded uppercase tracking-wider">
                                                                    Cancelled
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs italic">Active</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{row.location}</span>
                                                            </div>
                                                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest ml-5">{row.state}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {viewMode !== 'group' ? (
                                                            <div className="flex flex-col gap-1 text-sm">
                                                                <span className="font-medium text-gray-900 dark:text-white">{row.current_item.item}</span>
                                                                <span className="text-xs font-medium text-[var(--theme-primary)] uppercase tracking-wider">Qty: {row.current_item.qty}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1 max-w-[250px]">
                                                                {row.items?.filter((i: any) => i.Cancelled !== 'Cancelled').slice(0, 3).map((item: any, idx: number) => (
                                                                    <span key={idx} className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 text-[10px] font-semibold uppercase tracking-tight rounded-lg border border-gray-200 dark:border-gray-600">
                                                                        {item.item} ({item.qty})
                                                                    </span>
                                                                ))}
                                                                {row.items?.filter((i: any) => i.Cancelled !== 'Cancelled').length > 3 && (
                                                                    <span className="px-2 py-0.5 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] text-[10px] font-semibold uppercase tracking-tight rounded-lg border border-[var(--theme-primary)]/20">
                                                                        +{row.items?.filter((i: any) => i.Cancelled !== 'Cancelled').length - 3} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    {viewMode !== 'group' && (
                                                        <>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">P:</span><span className="text-gray-600 dark:text-gray-300">{row.current_item?.Planned_1 ? new Date(row.current_item.Planned_1).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">A:</span><span className="font-medium text-indigo-600 dark:text-indigo-400">{row.current_item?.Actual_1 ? new Date(row.current_item.Actual_1).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    {(() => {
                                                                        const delay = getDelayInfo(row.current_item?.Planned_1, row.current_item?.Actual_1);
                                                                        return delay ? <div className={`text-[8px] text-right ${viewMode === 'cancelled' ? 'text-gray-400' : delay.color}`}>{delay.text}</div> : null;
                                                                    })()}
                                                                    <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700 font-bold uppercase text-[9px] text-[var(--theme-primary)]">{row.current_item?.Destination || '-'}</div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">P:</span><span className="text-gray-600 dark:text-gray-300">{row.current_item?.Planned_2 ? new Date(row.current_item.Planned_2).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">A:</span><span className="font-medium text-indigo-600 dark:text-indigo-400">{row.current_item?.Actual_2 ? new Date(row.current_item.Actual_2).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    {(() => {
                                                                        const delay = getDelayInfo(row.current_item?.Planned_2, row.current_item?.Actual_2);
                                                                        return delay ? <div className={`text-[8px] text-right ${delay.color}`}>{delay.text}</div> : null;
                                                                    })()}
                                                                    <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700 font-bold uppercase text-[9px] text-[var(--theme-primary)]">{row.current_item?.['Stock Availability'] || '-'}</div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">P:</span><span className="text-gray-600 dark:text-gray-300">{row.current_item?.Planned_3 ? new Date(row.current_item.Planned_3).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">A:</span><span className="font-medium text-indigo-600 dark:text-indigo-400">{row.current_item?.Actual_3 ? new Date(row.current_item.Actual_3).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    {(() => {
                                                                        const delay = getDelayInfo(row.current_item?.Planned_3, row.current_item?.Actual_3);
                                                                        return delay ? <div className={`text-[8px] text-right ${delay.color}`}>{delay.text}</div> : null;
                                                                    })()}
                                                                    <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700 font-bold uppercase text-[9px] text-[var(--theme-primary)]">{row.current_item?.['Production Status'] || '-'}</div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">P:</span><span className="text-gray-600 dark:text-gray-300">{row.current_item?.Planned_4 ? new Date(row.current_item.Planned_4).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">A:</span><span className="font-medium text-indigo-600 dark:text-indigo-400">{row.current_item?.Actual_4 ? new Date(row.current_item.Actual_4).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    {(() => {
                                                                        const delay = getDelayInfo(row.current_item?.Planned_4, row.current_item?.Actual_4);
                                                                        return delay ? <div className={`text-[8px] text-right ${delay.color}`}>{delay.text}</div> : null;
                                                                    })()}
                                                                    <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700 font-bold uppercase text-[9px] text-[var(--theme-primary)]">{row.current_item?.['Information Status'] || '-'}</div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">P:</span><span className="text-gray-600 dark:text-gray-300">{row.current_item?.Planned_5 ? new Date(row.current_item.Planned_5).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">A:</span><span className="font-medium text-indigo-600 dark:text-indigo-400">{row.current_item?.Actual_5 ? new Date(row.current_item.Actual_5).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    {(() => {
                                                                        const delay = getDelayInfo(row.current_item?.Planned_5, row.current_item?.Actual_5);
                                                                        return delay ? <div className={`text-[8px] text-right ${delay.color}`}>{delay.text}</div> : null;
                                                                    })()}
                                                                    <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700 font-bold uppercase text-[9px] text-[var(--theme-primary)]">{row.current_item?.Status_5 || '-'}</div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">P:</span><span className="text-gray-600 dark:text-gray-300">{row.current_item?.Planned_6 ? new Date(row.current_item.Planned_6).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">A:</span><span className="font-medium text-indigo-600 dark:text-indigo-400">{row.current_item?.Actual_6 ? new Date(row.current_item.Actual_6).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    {(() => {
                                                                        const delay = getDelayInfo(row.current_item?.Planned_6, row.current_item?.Actual_6);
                                                                        return delay ? <div className={`text-[8px] text-right ${delay.color}`}>{delay.text}</div> : null;
                                                                    })()}
                                                                    <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700 font-bold uppercase text-[9px] text-[var(--theme-primary)]">{row.current_item?.['Dispatch Status'] || '-'}</div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400 text-[8px]">PLAN:</span><span className="text-gray-600 dark:text-gray-300">{row.current_item?.Planned_7 ? new Date(row.current_item.Planned_7).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400 text-[8px]">ACT:</span><span className="font-medium text-indigo-600 dark:text-indigo-400">{row.current_item?.Actual_7 ? new Date(row.current_item.Actual_7).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    {(() => {
                                                                        const delay = getDelayInfo(row.current_item?.Planned_7, row.current_item?.Actual_7);
                                                                        return delay ? <div className={`text-[8px] text-right ${delay.color}`}>{delay.text}</div> : null;
                                                                    })()}
                                                                    <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-0.5">
                                                                        <div className="flex justify-between gap-2 text-blue-600 font-bold uppercase text-[8px]"><span>REV:</span><span>{row.current_item?.Revenue || '-'}</span></div>
                                                                        <div className="flex justify-between gap-2 text-green-600 font-bold uppercase text-[8px]"><span>COST:</span><span>{row.current_item?.['Total Cost'] || '-'}</span></div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col gap-0.5 text-[10px]">
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">P:</span><span className="text-gray-600 dark:text-gray-300">{row.current_item?.Planned_8 ? new Date(row.current_item.Planned_8).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    <div className="flex justify-between gap-2"><span className="text-gray-400">A:</span><span className="font-medium text-indigo-600 dark:text-indigo-400">{row.current_item?.Actual_8 ? new Date(row.current_item.Actual_8).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span></div>
                                                                    {(() => {
                                                                        const delay = getDelayInfo(row.current_item?.Planned_8, row.current_item?.Actual_8);
                                                                        return delay ? <div className={`text-[8px] text-right ${delay.color}`}>{delay.text}</div> : null;
                                                                    })()}
                                                                    <div className="mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700 font-bold uppercase text-[9px] text-[var(--theme-primary)]">{row.current_item?.Status_8 || '-'}</div>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                            {filteredOrders.length === 0 && !isLoading && (
                                                <tr>
                                                    <td colSpan={viewMode !== 'group' ? 34 : 9} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center">
                                                                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                            </div>
                                                            <span className="text-gray-500 font-medium">No orders found matching your search.</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    <AnimatePresence>
                        {isFollowUpModalOpen && selectedFollowUpItems.length > 0 && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => {
                                        setIsFollowUpModalOpen(false);
                                        setSelectedFollowUpItems([]);
                                        setSelectedItems(new Set());
                                    }}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
                                >
                                    {/* Modal Header */}
                                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-indigo-800 text-white">
                                        <div>
                                            <h2 className="text-xl font-bold italic tracking-tight uppercase">Update Selected Items</h2>
                                            <p className="text-[10px] font-medium text-white/60 uppercase tracking-widest mt-0.5">BULK FOLLOW-UP WORKFLOW</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsFollowUpModalOpen(false);
                                                setSelectedFollowUpItems([]);
                                                setSelectedItems(new Set());
                                            }}
                                            className="p-2 hover:bg-white/20 rounded-xl transition-all group"
                                        >
                                            <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-gray-900/50 custom-scrollbar">
                                        {selectedFollowUpItems.map((order, itemIdx) => {
                                            // Dynamically find current pending step for THIS specific item
                                            let currentStepIdx = FOLLOWUP_STEPS_CONFIG.findIndex(cfg => {
                                                if (order[cfg.actualField as keyof O2DOrder]) return false;
                                                // Skip-aware checks
                                                if (cfg.step === 5 && order.Destination === 'Local') return false;
                                                if (cfg.step === 3 && order['Stock Availability'] === 'Stock Available') return false;
                                                return true;
                                            });

                                            const activeStep = currentStepIdx === -1 ? 7 : currentStepIdx;
                                            const stepConfig = FOLLOWUP_STEPS_CONFIG[activeStep];

                                            const delay = calculateTimeDelay(
                                                order[stepConfig.plannedField as keyof O2DOrder] as string,
                                                order[stepConfig.actualField as keyof O2DOrder] as string
                                            );

                                            return (
                                                <motion.div
                                                    key={`${order.party_id}-${itemIdx}`}
                                                    layout
                                                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                                                >
                                                    {/* Item Header */}
                                                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                                                                {itemIdx + 1}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                                                    {order.party_name}
                                                                </h4>
                                                                <p className="text-[10px] text-gray-500 font-medium">{viewMode === 'details' ? (order as any).current_item?.item : 'Order Group'} - Qty: {viewMode === 'details' ? (order as any).current_item?.qty : order.items?.length}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${delay?.isDelayed
                                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                                : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                                                                {delay?.display || 'NO TARGET'}
                                                            </span>
                                                            <span className="text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-full uppercase tracking-wider">
                                                                STEP {stepConfig.step}: {stepConfig.name}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                        <div>
                                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{stepConfig.question}</p>
                                                            {stepConfig.responseType === 'select' ? (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {stepConfig.options?.map(opt => (
                                                                        <button
                                                                            key={opt}
                                                                            onClick={() => handleFollowUpSubmit(order, stepConfig.step, { [stepConfig.responseField]: opt })}
                                                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all active:scale-95 border border-transparent hover:border-indigo-400"
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <div className="flex flex-col gap-2">
                                                                        <input
                                                                            type="text"
                                                                            placeholder={stepConfig.responseField}
                                                                            id={`bulk-input-1-${itemIdx}`}
                                                                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-[10px] font-medium border-0 focus:ring-1 focus:ring-indigo-500"
                                                                        />
                                                                        {stepConfig.secondResponseField && (
                                                                            <input
                                                                                type="text"
                                                                                placeholder={stepConfig.secondResponseField}
                                                                                id={`bulk-input-2-${itemIdx}`}
                                                                                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-[10px] font-medium border-0 focus:ring-1 focus:ring-indigo-500"
                                                                            />
                                                                        )}
                                                                        {stepConfig.thirdResponseField && (
                                                                            <input
                                                                                type="text"
                                                                                placeholder={stepConfig.thirdResponseField}
                                                                                id={`bulk-input-3-${itemIdx}`}
                                                                                onInput={(e) => {
                                                                                    if (stepConfig.step === 7) {
                                                                                        const cost = parseFloat((e.target as HTMLInputElement).value);
                                                                                        const qtyStr = (order as any).current_item?.qty || (order as any).quantity || 0;
                                                                                        const qty = parseFloat(String(qtyStr));
                                                                                        const totalInput = document.getElementById(`bulk-input-4-${itemIdx}`) as HTMLInputElement;
                                                                                        if (totalInput && !isNaN(cost) && !isNaN(qty)) {
                                                                                            totalInput.value = (cost * qty).toFixed(2);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-[10px] font-medium border-0 focus:ring-1 focus:ring-indigo-500"
                                                                            />
                                                                        )}
                                                                        {stepConfig.fourthResponseField && (
                                                                            <input
                                                                                type="text"
                                                                                placeholder={stepConfig.fourthResponseField}
                                                                                id={`bulk-input-4-${itemIdx}`}
                                                                                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-[10px] font-medium border-0 focus:ring-1 focus:ring-indigo-500"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const val1 = (document.getElementById(`bulk-input-1-${itemIdx}`) as HTMLInputElement)?.value;
                                                                            const val2 = (document.getElementById(`bulk-input-2-${itemIdx}`) as HTMLInputElement)?.value;
                                                                            const val3 = (document.getElementById(`bulk-input-3-${itemIdx}`) as HTMLInputElement)?.value;
                                                                            const val4 = (document.getElementById(`bulk-input-4-${itemIdx}`) as HTMLInputElement)?.value;
                                                                            if (!val1) return toast.error('Required');
                                                                            const resps: any = { [stepConfig.responseField]: val1 };
                                                                            if (val2) resps[stepConfig.secondResponseField as string] = val2;
                                                                            if (val3) resps[stepConfig.thirdResponseField as string] = val3;
                                                                            if (val4) resps[stepConfig.fourthResponseField as string] = val4;
                                                                            handleFollowUpSubmit(order, stepConfig.step, resps);
                                                                        }}
                                                                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider"
                                                                    >
                                                                        Update
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Target Time</p>
                                                                    <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                                                        {order[stepConfig.plannedField as keyof O2DOrder]
                                                                            ? new Date(order[stepConfig.plannedField as keyof O2DOrder] as string).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                                                                            : 'Pending'}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Current Delay</p>
                                                                    <p className={`text-[10px] font-bold ${delay?.display?.includes('delay') ? 'text-red-500' : 'text-green-500'}`}>
                                                                        {delay?.display || '-'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Create/Edit Modal */}
                    <AnimatePresence>
                        {isModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsModalOpen(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
                                >
                                    {/* Modal Header */}
                                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]">
                                        <div>
                                            <h2 className="text-xl font-medium text-gray-900">{editingOrder ? 'Edit Delivery Order' : 'Create New Order'}</h2>
                                            <p className="text-[10px] font-medium text-gray-800/60 uppercase tracking-widest mt-0.5">#{editingOrder ? editingOrder.party_id : 'NEW'} - {editingOrder ? 'UPDATE RECORD' : 'NEW ENTRY'}</p>
                                        </div>
                                        <button
                                            onClick={() => setIsModalOpen(false)}
                                            className="p-2 hover:bg-white/20 rounded-xl transition-all group"
                                        >
                                            <svg className="w-6 h-6 text-gray-900 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 px-1">
                                                <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center text-gray-900 font-medium text-sm shadow-lg shadow-[var(--theme-primary)]/20">1</div>
                                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-widest">Party Information</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-0">
                                                    <div className="flex items-end gap-2">
                                                        <div className="flex-1">
                                                            <SearchableDropdown
                                                                label="PARTY NAME"
                                                                options={partyOptions}
                                                                value={formData.party_name || ''}
                                                                allowCustomValue={true}
                                                                onChange={(val) => {
                                                                    const partyName = val as string;
                                                                    const existingOrder = orders.find(o => o.party_name === partyName);
                                                                    if (existingOrder) {
                                                                        setFormData({
                                                                            ...formData,
                                                                            party_id: existingOrder.party_id,
                                                                            party_name: partyName,
                                                                            type: existingOrder.type || formData.type,
                                                                            contact_person: existingOrder.contact_person || formData.contact_person,
                                                                            email: existingOrder.email || formData.email,
                                                                            contact_no_1: existingOrder.contact_no_1 || formData.contact_no_1,
                                                                            contact_no_2: existingOrder.contact_no_2 || formData.contact_no_2,
                                                                            location: existingOrder.location || formData.location,
                                                                            state: existingOrder.state || formData.state,
                                                                            field_person_name: existingOrder.field_person_name || formData.field_person_name
                                                                        });
                                                                    } else {
                                                                        setFormData({ ...formData, party_name: partyName, party_id: undefined });
                                                                    }
                                                                }}
                                                                placeholder="Select or enter party name"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsAddingParty(true)}
                                                            className="mb-1 p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                                                            title="Add New Party"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                                        </button>
                                                    </div>

                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Customer Type</label>
                                                    <select
                                                        required
                                                        value={formData.type}
                                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                    >
                                                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Contact Person</label>
                                                    <input
                                                        type="text"
                                                        value={formData.contact_person}
                                                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                        placeholder="Full name"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Email Address</label>
                                                    <input
                                                        type="email"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                        placeholder="email@example.com"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Primary Phone</label>
                                                    <input
                                                        type="text"
                                                        value={formData.contact_no_1}
                                                        onChange={(e) => setFormData({ ...formData, contact_no_1: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                        placeholder="+91"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Secondary Phone</label>
                                                    <input
                                                        type="text"
                                                        value={formData.contact_no_2}
                                                        onChange={(e) => setFormData({ ...formData, contact_no_2: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                        placeholder="Optional"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 px-1">
                                                <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center text-gray-900 font-medium text-sm shadow-lg shadow-[var(--theme-primary)]/20">2</div>
                                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-widest">Delivery Details</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Location</label>
                                                    <input
                                                        type="text"
                                                        value={formData.location}
                                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                        placeholder="City/Area"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">State</label>
                                                    <input
                                                        type="text"
                                                        value={formData.state}
                                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                        placeholder="State"
                                                    />
                                                </div>
                                                <div className="space-y-0">
                                                    <SearchableDropdown
                                                        label="REPRESENTATIVE"
                                                        options={representativeOptions}
                                                        value={formData.field_person_name || ''}
                                                        onChange={(val) => setFormData({ ...formData, field_person_name: val as string })}
                                                        placeholder="Select representative"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center shadow-lg shadow-[var(--theme-primary)]/20">
                                                        <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-widest">Order Items</h3>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAddItemRow}
                                                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] hover:text-gray-900 transition-all rounded-lg text-[9px] font-medium uppercase tracking-widest flex items-center gap-1.5 shadow-sm active:scale-95"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                                    Add Row
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2">
                                                {orderItems.map((item, index) => (
                                                    <motion.div
                                                        layout
                                                        initial={{ opacity: 0, scale: 0.98 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        key={item.id}
                                                        className="flex gap-2 p-2 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl border border-transparent hover:border-[var(--theme-primary)]/40 transition-all group items-center"
                                                    >
                                                        <div className="flex-[4]">
                                                            <select
                                                                required
                                                                value={item.item}
                                                                onChange={(e) => handleItemChange(item.id, 'item', e.target.value)}
                                                                className="w-full px-3 py-1.5 bg-white/50 dark:bg-gray-800/50 rounded-lg font-semibold text-xs border-0 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all"
                                                            >
                                                                <option value="">Select Item</option>
                                                                {costingItems.map((costItem, idx) => (
                                                                    <option key={idx} value={costItem}>
                                                                        {costItem}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="flex-1">
                                                            <input
                                                                required
                                                                type="text"
                                                                value={item.qty}
                                                                onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)}
                                                                className="w-full px-3 py-1.5 bg-white/50 dark:bg-gray-800/50 rounded-lg font-semibold text-xs border-0 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-center"
                                                                placeholder="Qty"
                                                            />
                                                        </div>
                                                        {orderItems.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItemRow(item.id)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white/50 dark:hover:bg-gray-700 rounded-lg transition-all"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        )}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setIsModalOpen(false)}
                                                className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-[10px] font-medium text-gray-400 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:text-gray-600"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 text-[10px] font-medium uppercase tracking-widest shadow-lg shadow-[var(--theme-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            >
                                                {editingOrder ? 'Update Record' : 'Create Entry'}
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Filter Modal */}
                    <AnimatePresence>
                        {showFilterModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowFilterModal(false)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
                                >
                                    {/* Filter Header */}
                                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]">
                                        <div>
                                            <h2 className="text-xl font-medium text-gray-900">Search Filters</h2>
                                            <p className="text-[10px] font-medium text-gray-800/60 uppercase tracking-widest mt-0.5">REFINE YOUR ORDER LIST</p>
                                        </div>
                                        <button
                                            onClick={() => setShowFilterModal(false)}
                                            className="p-2 hover:bg-white/20 rounded-xl transition-all group"
                                        >
                                            <svg className="w-5 h-5 text-gray-900 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <SearchableDropdown
                                                label="Party Name"
                                                options={partyOptions}
                                                value={filters.partyName}
                                                onChange={(val) => setFilters({ ...filters, partyName: val as string })}
                                                placeholder="All Parties"
                                            />
                                            <SearchableDropdown
                                                label="Location"
                                                options={locationOptions}
                                                value={filters.location}
                                                onChange={(val) => setFilters({ ...filters, location: val as string })}
                                                placeholder="All Locations"
                                            />
                                            <SearchableDropdown
                                                label="STATE"
                                                options={stateOptions}
                                                value={filters.state}
                                                onChange={(val) => setFilters({ ...filters, state: val as string })}
                                                placeholder="All States"
                                            />
                                            <SearchableDropdown
                                                label="Representative"
                                                options={representativeOptions}
                                                value={filters.representative}
                                                onChange={(val) => setFilters({ ...filters, representative: val as string })}
                                                placeholder="All Representatives"
                                            />
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Contact Person</label>
                                                <input
                                                    type="text"
                                                    value={filters.contactPerson}
                                                    onChange={(e) => setFilters({ ...filters, contactPerson: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                    placeholder="Search by name"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Email</label>
                                                <input
                                                    type="text"
                                                    value={filters.email}
                                                    onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                    placeholder="Search by email"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Phone Number</label>
                                                <input
                                                    type="text"
                                                    value={filters.phone}
                                                    onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                                                    placeholder="Search by phone"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Order Type</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {TYPES.map(type => (
                                                        <button
                                                            key={type}
                                                            onClick={() => setFilters({ ...filters, type: filters.type === type ? '' : type })}
                                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-medium uppercase tracking-widest transition-all ${filters.type === type ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-md' : 'bg-[var(--theme-lighter)] dark:bg-gray-700/50 text-gray-500'}`}
                                                        >
                                                            {type}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>


                                        <div className="space-y-3">
                                            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-1">Date Range</label>
                                            <DateRangePicker
                                                fromDate={filters.dateFrom}
                                                toDate={filters.dateTo}
                                                onRangeChange={(from, to) => setFilters({ ...filters, dateFrom: from, dateTo: to })}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                                        <button
                                            onClick={() => {
                                                setFilters({
                                                    partyName: '',
                                                    type: '',
                                                    status: '',
                                                    location: '',
                                                    state: '',
                                                    representative: '',
                                                    contactPerson: '',
                                                    email: '',
                                                    phone: '',
                                                    dateFrom: '',
                                                    dateTo: '',
                                                });
                                                setShowFilterModal(false);
                                            }}
                                            className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:text-gray-600"
                                        >
                                            Reset All
                                        </button>
                                        <button
                                            onClick={() => setShowFilterModal(false)}
                                            className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[10px] font-bold uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>



                    {/* Delete Confirmation Modal */}
                    {showDeleteModal && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteTarget(null);
                                }}
                            />

                            {/* Modal */}
                            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
                                <motion.div
                                    className="w-full max-w-md pointer-events-auto"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                                Confirm Delete
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setShowDeleteModal(false);
                                                    setDeleteTarget(null);
                                                }}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                            >
                                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
                                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                                    {viewMode === 'group' ? (
                                                        <>
                                                            Are you sure you want to delete the order for <span className="font-bold text-red-600 dark:text-red-400">{deleteTarget?.party_name}</span>?
                                                            <br />
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">This will delete all items in this order.</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            Are you sure you want to delete the item <span className="font-bold text-red-600 dark:text-red-400">{deleteTarget?.item}</span> from <span className="font-bold">{deleteTarget?.party_name}</span>'s order?
                                                        </>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        setShowDeleteModal(false);
                                                        setDeleteTarget(null);
                                                    }}
                                                    className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl transition"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleDelete}
                                                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition shadow-md"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    )}

                    {/* Cancel Confirmation Modal */}
                    {showCancelModal && (
                        <>
                            <motion.div
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelTarget(null);
                                }}
                            />

                            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
                                <motion.div
                                    className="w-full max-w-md pointer-events-auto"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                                {cancelTarget?.isCancelled ? 'Remove Cancellation' : 'Confirm Cancellation'}
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setShowCancelModal(false);
                                                    setCancelTarget(null);
                                                }}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                            >
                                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className={`p-4 rounded-xl border ${cancelTarget?.isCancelled ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'}`}>
                                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                                    {viewMode === 'group' ? (
                                                        <>
                                                            Are you sure you want to {cancelTarget?.isCancelled ? 'remove the cancellation' : 'cancel'} the order for <span className="font-bold">{cancelTarget?.party_name}</span>?
                                                            {!cancelTarget?.isCancelled && <br />}
                                                            {!cancelTarget?.isCancelled && <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">This will mark all items in this order as cancelled.</span>}
                                                        </>
                                                    ) : (
                                                        <>
                                                            Are you sure you want to {cancelTarget?.isCancelled ? 'remove the cancellation for' : 'cancel'} the item <span className="font-bold">{cancelTarget?.item}</span> from <span className="font-bold">{cancelTarget?.party_name}</span>'s order?
                                                        </>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        setShowCancelModal(false);
                                                        setCancelTarget(null);
                                                    }}
                                                    className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl transition"
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    onClick={handleCancel}
                                                    className={`flex-1 px-4 py-2.5 text-white font-bold rounded-xl transition shadow-md ${cancelTarget?.isCancelled ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}`}
                                                >
                                                    {cancelTarget?.isCancelled ? 'Restore Order' : 'Cancel Order'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    )}

                    {/* Remove Follow Up Modal */}
                    {showRemoveModal && (
                        <>
                            <motion.div
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => {
                                    setShowRemoveModal(false);
                                    setRemoveTarget(null);
                                }}
                            />

                            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
                                <motion.div
                                    className="w-full max-w-md pointer-events-auto"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Remove Follow Up</h3>
                                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">RESET WORKFLOW STEPS</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setShowRemoveModal(false);
                                                    setRemoveTarget(null);
                                                }}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                            >
                                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900">
                                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                                    Select the step from which you want to clear follow-up details for <span className="font-bold text-indigo-600 dark:text-indigo-400">{removeTarget?.party_name}</span>
                                                    {removeTarget?.item && <span>'s item <span className="font-bold underline decoration-indigo-200">{removeTarget.item}</span></span>}.
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Selection Range</label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <div className="relative group">
                                                        <select
                                                            value={removeStep}
                                                            onChange={(e) => setRemoveStep(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                                            className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl border-0 ring-1 ring-gray-200 dark:ring-gray-600 focus:ring-2 focus:ring-indigo-500 transition shadow-sm appearance-none font-medium text-sm"
                                                        >
                                                            <option value="all" className="font-bold text-red-600">Remove All Steps (Keep Step 1 Planned)</option>
                                                            {[1, 2, 3, 4, 5, 6, 7, 8].map(step => (
                                                                <option key={step} value={step}>
                                                                    From Step {step} onwards
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-500 transition-colors">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-orange-500 font-medium italic mt-2 px-1">
                                                    * Note: Clearing a step also clears all subsequent data (planned and actual) to maintain workflow order.
                                                </p>
                                            </div>

                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    onClick={() => {
                                                        setShowRemoveModal(false);
                                                        setRemoveTarget(null);
                                                    }}
                                                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 font-bold rounded-xl transition-all shadow-sm active:scale-95"
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    onClick={handleRemoveFollowUp}
                                                    className="flex-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    Confirm Reset
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            {/* Add Party Modal Overlay */}
            <AnimatePresence>
                {isAddingParty && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAddingParty(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md space-y-4"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Party</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Register new party name in dropdown</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingParty(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Party Name</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newPartyName}
                                        onChange={(e) => setNewPartyName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddParty();
                                            }
                                        }}
                                        placeholder="Enter full company/party name..."
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl text-sm font-medium border-0 focus:ring-2 focus:ring-indigo-500 transition-all text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingParty(false)}
                                        className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSubmittingParty}
                                        onClick={handleAddParty}
                                        className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isSubmittingParty ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Adding...
                                            </>
                                        ) : (
                                            'Add Party'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </LayoutWrapper>
    );
}
