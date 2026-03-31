'use client';

import { useState, useEffect, useMemo } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, RefreshCcw, X, Calendar, User, Tag, Hash, ArrowUpDown, Pencil, History, Save, Loader2, Clock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon, Calendar as CalendarIcon } from 'lucide-react';
import CustomDateTimePicker from '@/components/CustomDateTimePicker';
import SearchableDropdown from '@/components/SearchableDropdown';
import { parseDateString } from '@/lib/dateUtils';

interface PayableData {
    Name: string;
    Id: string;
    VchType: string;
    'Bill Date': string;
    '1 Day Before Due Date': string;
    TotalAmount: string;
    Adjustment: string;
    PendingAmount: string;
    DueDays: string;
    PurchaseBillNo: string;
    'Follow Up': string;
}

const ITEMS_PER_PAGE = 10;

export default function PayablePage() {
    const [data, setData] = useState<PayableData[]>([]);
    const [filteredData, setFilteredData] = useState<PayableData[]>([]);
    const [paginatedData, setPaginatedData] = useState<PayableData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);

    // Filter States
    const [filters, setFilters] = useState({
        name: '',
        vchType: '',
        minAmount: '',
        maxAmount: '',
        dueDays: '',
        openTasksOnly: false,
        partyId: ''
    });

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: keyof PayableData | 'status'; direction: 'asc' | 'desc' } | null>(null);

    // Sidebar State
    const [selectedItem, setSelectedItem] = useState<PayableData | null>(null);
    const [selectedItemHistory, setSelectedItemHistory] = useState<any[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [followUpRemark, setFollowUpRemark] = useState('');
    const [nextFollowUpDate, setNextFollowUpDate] = useState('');
    const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

    const [doer, setDoer] = useState('');
    const [isDoerModalOpen, setIsDoerModalOpen] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [isUpdatingDoer, setIsUpdatingDoer] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/payable');
            const result = await response.json();
            if (result.data) {
                setData(result.data);
            }
        } catch (error) {
            console.error('Error loading payable data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDoerData = async () => {
        try {
            const [doerRes, usersRes] = await Promise.all([
                fetch('/api/payable/doer'),
                fetch('/api/users')
            ]);
            const [doerData, usersData] = await Promise.all([
                doerRes.json(),
                usersRes.json()
            ]);
            setDoer(doerData.doer || '');
            setUsers(usersData.users || []);
        } catch (error) {
            console.error('Error fetching doer/users:', error);
        }
    };

    useEffect(() => {
        fetchData();
        fetchDoerData();
    }, []);

    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr || dateStr === '-') return '-';
        if (dateStr.includes('-') && !dateStr.includes('/')) {
            const parts = dateStr.split('-');
            if (parts.length >= 3) {
                const year = parts[0];
                const month = parts[1];
                const day = parts[2].split('T')[0].split(' ')[0];
                return `${day}/${month}/${year}`;
            }
        }
        return dateStr;
    };

    const getDueDateStatus = (dateStr: string) => {
        if (!dateStr) return { status: 'Unknown', color: 'gray' };

        let dueDate: Date | null = null;

        // Handle DD/MM/YYYY
        if (dateStr.includes('/')) {
            const parts = dateStr.trim().split(' ')[0].split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2]);
                dueDate = new Date(year, month, day);
            }
        }
        // Handle YYYY-MM-DD (ISO)
        else if (dateStr.includes('-')) {
            const parts = dateStr.trim().split(' ')[0].split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const day = parseInt(parts[2]);
                dueDate = new Date(year, month, day);
            }
        }

        if (!dueDate || isNaN(dueDate.getTime())) return { status: 'Unknown', color: 'gray' };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate.getTime() < today.getTime()) {
            return { status: 'Overdue', color: 'red' };
        } else if (dueDate.getTime() === today.getTime()) {
            return { status: 'Pending', color: 'yellow' };
        } else {
            return { status: 'Upcoming', color: 'blue' };
        }
    };

    const timeStats = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 7': 0, 'Next 15': 0 };

        data.forEach(item => {
            const pendingAmount = parseFloat(item.PendingAmount || '0');
            if (pendingAmount <= 0) return;

            const history = Array.isArray(item['Follow Up']) ? item['Follow Up'] : [];
            const sortedHistory = [...history].sort((a: any, b: any) => {
                const tA = a.timestamp === 'Legacy' ? 0 : new Date(a.timestamp).getTime();
                const tB = b.timestamp === 'Legacy' ? 0 : new Date(b.timestamp).getTime();
                return tB - tA;
            });
            const latestWithDate = sortedHistory.find((h: any) => h.next_followup);
            const effectiveDateStr = latestWithDate?.next_followup || item['1 Day Before Due Date'];

            if (!effectiveDateStr) return;

            const pDate = parseDateString(effectiveDateStr);
            if (!pDate) return;
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

    useEffect(() => {
        let result = [...data];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(item =>
                item.Name?.toLowerCase().includes(query) ||
                item.Id?.toLowerCase().includes(query) ||
                item.PurchaseBillNo?.toLowerCase().includes(query)
            );
        }

        if (filters.name) {
            result = result.filter(item => item.Name?.toLowerCase().includes(filters.name.toLowerCase()));
        }
        if (filters.vchType) {
            result = result.filter(item => item.VchType?.toLowerCase() === filters.vchType.toLowerCase());
        }
        if (filters.partyId) {
            result = result.filter(item => item.Id === filters.partyId);
        }
        if (filters.minAmount) {
            result = result.filter(item => parseFloat(item.PendingAmount || '0') >= parseFloat(filters.minAmount));
        }
        if (filters.maxAmount) {
            result = result.filter(item => parseFloat(item.PendingAmount || '0') <= parseFloat(filters.maxAmount));
        }
        if (filters.dueDays) {
            result = result.filter(item => parseInt(item.DueDays || '0') >= parseInt(filters.dueDays));
        }
        if (statusFilter !== 'all') {
            result = result.filter(item => getDueDateStatus(item['1 Day Before Due Date']).status === statusFilter);
        }
        if (filters.openTasksOnly) {
            result = result.filter(item => {
                const status = getDueDateStatus(item['1 Day Before Due Date']).status;
                return status === 'Overdue' || status === 'Pending';
            });
        }

        // Time-Based Filter (Quick Filters)
        if (activeTimeFilter) {
            result = result.filter(item => {
                const pendingAmount = parseFloat(item.PendingAmount || '0');
                if (pendingAmount <= 0) return false;

                const history = Array.isArray(item['Follow Up']) ? item['Follow Up'] : [];
                const sortedHistory = [...history].sort((a: any, b: any) => {
                    const tA = a.timestamp === 'Legacy' ? 0 : new Date(a.timestamp).getTime();
                    const tB = b.timestamp === 'Legacy' ? 0 : new Date(b.timestamp).getTime();
                    return tB - tA;
                });
                const latestWithDate = sortedHistory.find((h: any) => h.next_followup);
                const effectiveDateStr = latestWithDate?.next_followup || item['1 Day Before Due Date'];

                if (!effectiveDateStr) return false;

                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const oneDayMs = 24 * 60 * 60 * 1000;

                const pDate = parseDateString(effectiveDateStr);
                if (!pDate) return false;
                const pTime = pDate.getTime();
                const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
                const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);

                switch (activeTimeFilter) {
                    case 'Delayed': if (pTime >= now.getTime()) return false; break;
                    case 'Today': if (diffDays !== 0) return false; break;
                    case 'Tomorrow': if (diffDays !== 1) return false; break;
                    case 'Next 3': if (!(diffDays >= 0 && diffDays <= 3)) return false; break;
                    case 'Next 7': if (!(diffDays >= 0 && diffDays <= 7)) return false; break;
                    case 'Next 15': if (!(diffDays >= 0 && diffDays <= 15)) return false; break;
                }
                return true;
            });
        }

        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof PayableData];
                let bVal: any = b[sortConfig.key as keyof PayableData];

                if (sortConfig.key === 'status') {
                    aVal = getDueDateStatus(a['1 Day Before Due Date']).status;
                    bVal = getDueDateStatus(b['1 Day Before Due Date']).status;
                } else if (['PendingAmount', 'TotalAmount', 'DueDays'].includes(sortConfig.key)) {
                    aVal = parseFloat(aVal || '0');
                    bVal = parseFloat(bVal || '0');
                } else if (['Bill Date', '1 Day Before Due Date'].includes(sortConfig.key)) {
                    const parseDate = (d: string) => {
                        if (!d) return 0;
                        const clean = d.trim().split(' ')[0];
                        if (clean.includes('/')) {
                            const parts = clean.split('/');
                            return parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime() : 0;
                        } else if (clean.includes('-')) {
                            const parts = clean.split('-');
                            return parts.length === 3 ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime() : 0;
                        }
                        return 0;
                    };
                    aVal = parseDate(aVal);
                    bVal = parseDate(bVal);
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        setFilteredData(result);
        setTotalPages(Math.ceil(result.length / ITEMS_PER_PAGE));
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        setPaginatedData(result.slice(start, start + ITEMS_PER_PAGE));
    }, [data, searchQuery, filters, statusFilter, currentPage, sortConfig, activeTimeFilter]);

    const handleSort = (key: keyof PayableData | 'status') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const resetFilters = () => {
        setFilters({
            name: '',
            vchType: '',
            minAmount: '',
            maxAmount: '',
            dueDays: '',
            openTasksOnly: false,
            partyId: ''
        });
        setStatusFilter('all');
        setActiveTimeFilter(null);
        setSortConfig(null);
    };

    const handleOpenSidebar = async (item: PayableData) => {
        setSelectedItem(item);
        setIsSidebarOpen(true);
        setFollowUpRemark('');
        setNextFollowUpDate('');
        setSelectedItemHistory([]);

        setIsFetchingHistory(true);
        try {
            const res = await fetch(`/api/payable?id=${item.Id}`);
            if (res.ok) {
                const json = await res.json();
                setSelectedItemHistory(json.data || []);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const handleSubmitFollowUp = async () => {
        if (!selectedItem || !followUpRemark) return;

        // Calculate target_due_date for scoring
        const history = [...selectedItemHistory].sort((a: any, b: any) => {
            const tA = a.timestamp === 'Legacy' ? 0 : new Date(a.timestamp).getTime();
            const tB = b.timestamp === 'Legacy' ? 0 : new Date(b.timestamp).getTime();
            return tB - tA;
        });
        const latestWithDate = history.find((h: any) => h.next_followup);
        const target_due_date = latestWithDate?.next_followup || selectedItem['1 Day Before Due Date'];

        // Adjust nextFollowUpDate to end of day if only date is selected
        let finalNextFollowUp = nextFollowUpDate;
        if (finalNextFollowUp && !finalNextFollowUp.includes(' ')) {
            finalNextFollowUp = `${finalNextFollowUp} 23:59:59`;
        }

        // Optimistic update
        const newEntry = {
            remark: followUpRemark,
            next_followup: finalNextFollowUp,
            target_due_date: target_due_date,
            timestamp: new Date().toISOString(),
            isOptimistic: true
        };

        setSelectedItemHistory(prev => [newEntry, ...prev]);
        setFollowUpRemark('');
        setNextFollowUpDate('');

        setIsSubmittingFollowUp(true);
        try {
            const response = await fetch('/api/payable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedItem.Id,
                    followUp: {
                        remark: newEntry.remark,
                        next_followup: newEntry.next_followup,
                        target_due_date: newEntry.target_due_date
                    }
                })
            });

            if (response.ok) {
                const json = await response.json();
                setSelectedItemHistory(prev =>
                    prev.map(entry => entry.isOptimistic ? json.data : entry)
                );
                fetchData(); // Refresh main table
            } else {
                setSelectedItemHistory(prev => prev.filter(entry => !entry.isOptimistic));
                const error = await response.json();
                alert(error.error || 'Failed to add follow-up');
            }
        } catch (error) {
            console.error('Error submitting follow-up:', error);
            setSelectedItemHistory(prev => prev.filter(entry => !entry.isOptimistic));
        } finally {
            setIsSubmittingFollowUp(false);
        }
    };

    const parseFollowUpHistory = (followUpStr: string) => {
        try {
            if (!followUpStr) return [];
            if (typeof followUpStr === 'object') return followUpStr;
            const parsed = JSON.parse(followUpStr);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return followUpStr ? [{ remark: followUpStr, timestamp: 'Legacy' }] : [];
        }
    };

    const handleUpdateDoer = async (selectedDoer: string | number) => {
        const doerName = String(selectedDoer);
        setIsUpdatingDoer(true);
        try {
            const res = await fetch('/api/payable/doer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doer: doerName })
            });
            if (res.ok) {
                setDoer(doerName);
                setIsDoerModalOpen(false);
            }
        } catch (error) {
            console.error('Error updating doer:', error);
        } finally {
            setIsUpdatingDoer(false);
        }
    };

    return (
        <LayoutWrapper>
            <div className="p-4 max-w-[1600px] mx-auto space-y-4">
                {/* Title & Actions Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <span className="p-2 bg-[var(--theme-primary)]/10 rounded-lg text-[var(--theme-primary)]">
                                <Tag size={24} />
                            </span>
                            Amount Payable
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-xs">Manage and track your payable amounts and follow-ups</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <motion.button
                            onClick={() => setFilters(prev => ({ ...prev, openTasksOnly: !prev.openTasksOnly }))}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`px-3 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-sm ${filters.openTasksOnly
                                ? 'bg-orange-500 text-white'
                                : 'bg-[var(--theme-primary)] text-gray-900 hover:opacity-90'
                                }`}
                        >
                            <CalendarIcon size={16} />
                            Open Followup
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${filters.openTasksOnly ? 'bg-white text-orange-600' : 'bg-gray-900/20 text-gray-900'}`}>
                                {data.filter(item => {
                                    if (parseFloat(item.PendingAmount || '0') <= 0) return false;
                                    const status = getDueDateStatus(item['1 Day Before Due Date']).status;
                                    return status === 'Overdue' || status === 'Pending';
                                }).length}
                            </span>
                        </motion.button>

                        <div className="relative flex-1 md:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search party or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-xs shadow-sm"
                            />
                        </div>

                        <motion.button
                            onClick={() => setIsDoerModalOpen(true)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-3 py-2 bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-sm"
                        >
                            <User size={16} />
                            {doer ? `Doer: ${doer}` : 'Select Responsible'}
                        </motion.button>

                        <button
                            onClick={() => setIsFilterModalOpen(true)}
                            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm group"
                        >
                            <Filter className="text-gray-500 group-hover:text-[var(--theme-primary)]" size={18} />
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm group"
                        >
                            <RefreshCcw className={`text-gray-500 group-hover:text-green-500 ${loading ? 'animate-spin' : ''}`} size={18} />
                        </button>
                    </div>
                </div>

                {/* Status Tiles */}
                <div className="flex flex-wrap gap-2">
                    {(() => {
                        const statusConfigs = [
                            { label: 'Overdue', color: 'red', icon: <CalendarIcon size={16} /> },
                            { label: 'Pending', color: 'yellow', icon: <RefreshCcw size={16} /> },
                            { label: 'Upcoming', color: 'blue', icon: <Calendar size={16} /> },
                            { label: 'Total', color: 'indigo', icon: <ListIcon size={16} /> },
                        ];

                        const getColorConfig = (color: string) => {
                            const configs: Record<string, any> = {
                                red: { bgGradient: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20', borderColor: 'border-red-200 dark:border-red-700', textColor: 'text-red-700 dark:text-red-400', iconBg: 'from-red-500 to-red-600' },
                                yellow: { bgGradient: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20', borderColor: 'border-yellow-200 dark:border-yellow-700', textColor: 'text-yellow-700 dark:text-yellow-400', iconBg: 'from-yellow-500 to-yellow-600' },
                                blue: { bgGradient: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20', borderColor: 'border-blue-200 dark:border-blue-700', textColor: 'text-blue-700 dark:text-blue-400', iconBg: 'from-blue-500 to-blue-600' },
                                indigo: { bgGradient: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20', borderColor: 'border-indigo-200 dark:border-indigo-700', textColor: 'text-indigo-700 dark:text-indigo-400', iconBg: 'from-indigo-500 to-indigo-600' },
                            };
                            return configs[color] || configs.indigo;
                        };

                        return statusConfigs.map((status) => {
                            const count = status.label === 'Total'
                                ? data.filter(item => parseFloat(item.PendingAmount || '0') > 0).length
                                : data.filter(item => {
                                    if (parseFloat(item.PendingAmount || '0') <= 0) return false;
                                    return getDueDateStatus(item['1 Day Before Due Date']).status === status.label;
                                }).length;
                            const config = getColorConfig(status.color);
                            const filterVal = status.label === 'Total' ? 'all' : status.label;
                            const isActive = statusFilter === filterVal;

                            return (
                                <motion.button
                                    key={status.label}
                                    onClick={() => setStatusFilter(filterVal)}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`flex-1 min-w-[130px] bg-gradient-to-br ${config.bgGradient} rounded-xl px-4 py-2.5 border ${isActive ? 'border-[var(--theme-primary)] shadow-lg' : config.borderColor} transition-all relative overflow-hidden group`}
                                >
                                    {isActive && (
                                        <div className="absolute top-0 right-0 w-8 h-8 bg-[var(--theme-primary)] opacity-10 rotate-45 translate-x-4 -translate-y-4" />
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.iconBg} flex items-center justify-center flex-shrink-0 shadow-md transform group-hover:rotate-12 transition-transform`}>
                                            <span className="text-white">{status.icon}</span>
                                        </div>
                                        <div className="text-left">
                                            <p className={`text-[9px] font-black ${config.textColor} uppercase tracking-widest leading-none mb-1`}>{status.label}</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white leading-none">{count}</p>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        });
                    })()}
                </div>

                {/* Table Content */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-gray-800/80 gap-4 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-4">
                            <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">
                                {filteredData.length} Records Found
                            </span>
                            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative border ${activeTimeFilter === filter
                                            ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)] shadow-sm'
                                            : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'
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

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex bg-gray-200/50 dark:bg-gray-700 p-0.5 rounded-lg">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className={`p-1 rounded-md transition ${currentPage === 1 ? 'text-gray-400' : 'text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-600 shadow-sm'}`}
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="px-2 self-center text-[10px] font-black text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    PAGE {currentPage} / {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className={`p-1 rounded-md transition ${currentPage === totalPages || totalPages === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-600 shadow-sm'}`}
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--theme-primary)] text-[11px] font-bold text-gray-900 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('Name')}>
                                        <div className="flex items-center gap-1.5">
                                            Name
                                            {sortConfig?.key === 'Name' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="text-gray-500" />}
                                        </div>
                                    </th>
                                    <th className="px-3 py-3">Details</th>
                                    <th className="px-3 py-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('Bill Date')}>
                                        <div className="flex items-center gap-1.5">
                                            Bill Date
                                            {sortConfig?.key === 'Bill Date' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="text-gray-500" />}
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('status')}>
                                        <div className="flex items-center gap-1.5">
                                            Status
                                            {sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="text-gray-500" />}
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-right cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('PendingAmount')}>
                                        <div className="flex items-center justify-end gap-1.5">
                                            Pending
                                            {sortConfig?.key === 'PendingAmount' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="text-gray-500" />}
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('DueDays')}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            Days
                                            {sortConfig?.key === 'DueDays' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="text-gray-500" />}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
                                {loading ? (
                                    Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={7} className="px-4 py-6 h-12 bg-gray-50/30 dark:bg-gray-800/30"></td>
                                        </tr>
                                    ))
                                ) : paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-gray-500 italic">No records found</td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, index) => {
                                        const { status, color } = getDueDateStatus(item['1 Day Before Due Date']);
                                        
                                        return (
                                            <tr key={index} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors group">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-bold text-gray-900 dark:text-white line-clamp-1">{item.Name}</span>
                                                        <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                                                            <Hash size={10} className="text-[var(--theme-primary)]" />
                                                            ID: {item.Id}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col gap-1 text-xs">
                                                        <span className="px-1.5 py-0.5 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded font-bold w-fit border border-[var(--theme-primary)]/20">
                                                            {item.VchType}
                                                        </span>
                                                        <span className="text-gray-400 font-medium">Ref: {item.PurchaseBillNo || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap text-gray-500 italic tabular-nums">
                                                    {item['Bill Date']?.split(' ')[0]}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {(() => {
                                                        const history = Array.isArray(item['Follow Up']) ? [...item['Follow Up']].sort((a, b) => {
                                                            const tA = a.timestamp === 'Legacy' ? 0 : new Date(a.timestamp).getTime();
                                                            const tB = b.timestamp === 'Legacy' ? 0 : new Date(b.timestamp).getTime();
                                                            return tB - tA;
                                                        }) : [];
                                                        const latestWithDate = history.find(h => h.next_followup);

                                                        const effectiveDate = latestWithDate?.next_followup || item['1 Day Before Due Date'];
                                                        const isFollowupDate = !!latestWithDate?.next_followup;
                                                        const { status, color } = getDueDateStatus(effectiveDate);
                                                        const displayDate = isFollowupDate ? formatDisplayDate(effectiveDate) : effectiveDate?.split(' ')[0];

                                                        return (
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className={`font-bold ${isFollowupDate ? 'text-orange-500' : (color === 'red' ? 'text-red-500' : 'text-gray-600 dark:text-gray-400')}`}>
                                                                    {displayDate}
                                                                </span>
                                                                <span className={`inline-flex items-center px-1 py-0.5 rounded-[4px] text-[8px] font-black w-fit uppercase tracking-tighter ${status === 'Overdue' ? 'bg-red-500 text-white' :
                                                                    status === 'Pending' ? 'bg-yellow-500 text-gray-900' :
                                                                        status === 'Upcoming' ? 'bg-blue-500 text-white' :
                                                                            'bg-gray-500 text-white'
                                                                    }`}>
                                                                    {status}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-gray-900 dark:text-white">
                                                            ₹{parseFloat(item.PendingAmount || '0').toLocaleString()}
                                                        </span>
                                                        <span className="text-[9px] text-gray-400">Total: ₹{parseFloat(item.TotalAmount || '0').toLocaleString()}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${parseInt(item.DueDays || '0') > 30 ? 'text-red-500 bg-red-100' : 'text-green-600 bg-green-100'
                                                        }`}>
                                                        {item.DueDays}d
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <motion.button
                                                        onClick={() => handleOpenSidebar(item)}
                                                        whileHover={{ scale: 1.2, rotate: 15 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                        title="Open Followup Sidebar"
                                                    >
                                                        <Pencil size={16} />
                                                    </motion.button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Sidebar / Drawer */}
            <AnimatePresence>
                {isSidebarOpen && selectedItem && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-full md:w-[450px] bg-white dark:bg-gray-900 shadow-2xl z-[9999] flex flex-col border-l border-gray-100 dark:border-gray-800"
                        >
                            {/* Header */}
                            <div className="p-6 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <Tag size={20} />
                                        </div>
                                        <h2 className="text-xl font-black truncate max-w-[250px]">{selectedItem.Name}</h2>
                                    </div>
                                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="flex gap-4 text-[11px] font-bold opacity-80 uppercase tracking-widest">
                                    <span>ID: {selectedItem.Id}</span>
                                    <span>Type: {selectedItem.VchType}</span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Pending Amount</p>
                                        <p className="text-lg font-black text-gray-900 dark:text-white">₹{parseFloat(selectedItem.PendingAmount || '0').toLocaleString()}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Due Date (-1d)</p>
                                        <p className="text-lg font-black text-red-500">{selectedItem['1 Day Before Due Date']?.split(' ')[0]}</p>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] border-b border-gray-100 dark:border-gray-800 pb-2">New Follow-up</h3>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2">
                                            <CalendarIcon size={12} className="text-[var(--theme-primary)]" /> Next Follow-up Date
                                        </label>
                                        <CustomDateTimePicker
                                            value={nextFollowUpDate}
                                            onChange={setNextFollowUpDate}
                                            placeholder="Select date..."
                                            dateOnly={true}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2">
                                            <Pencil size={12} className="text-[var(--theme-primary)]" /> Follow-up Remark
                                        </label>
                                        <textarea
                                            value={followUpRemark}
                                            onChange={(e) => setFollowUpRemark(e.target.value)}
                                            placeholder="Enter latest remark..."
                                            rows={4}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-sm transition-all resize-none"
                                        />
                                    </div>

                                    <motion.button
                                        onClick={handleSubmitFollowUp}
                                        disabled={isSubmittingFollowUp || !followUpRemark}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full py-4 bg-[var(--theme-primary)] text-gray-900 font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[var(--theme-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        {isSubmittingFollowUp ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} className="group-hover:scale-110 transition-transform" />}
                                        Submit Follow-up
                                    </motion.button>
                                </div>

                                <div className="space-y-6">
                                    {isFetchingHistory ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                                            <div className="relative">
                                                <div className="w-12 h-12 border-4 border-gray-100 dark:border-gray-800 rounded-full" />
                                                <Loader2 size={48} className="animate-spin text-[var(--theme-primary)] absolute inset-0" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Synchronizing Roadmap...</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between mb-8 border-b border-gray-100 dark:border-gray-700 pb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-[var(--theme-primary)]/15 rounded-2xl shadow-inner">
                                                        <History size={24} className="text-[var(--theme-primary)]" />
                                                    </div>
                                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none uppercase"> Roadmap </h2>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.25em] leading-none mb-1">Total</span>
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest leading-none">Followups</span>
                                                    </div>
                                                    <span className="text-6xl font-black text-[var(--theme-primary)] leading-none tabular-nums animate-pulse drop-shadow-sm">
                                                        {selectedItemHistory.length}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="relative">
                                                <div className="absolute left-[28px] top-8 bottom-0 w-1 bg-gradient-to-b from-gray-200 via-gray-100 to-transparent dark:from-gray-700 dark:via-gray-800 dark:to-transparent rounded-full opacity-50" />
                                                <div className="space-y-10">
                                                    {selectedItemHistory.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-gray-50/50 dark:bg-gray-800/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                                            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                                                <Calendar size={32} className="opacity-20" />
                                                            </div>
                                                            <p className="text-sm font-black uppercase tracking-widest opacity-40">No records found</p>
                                                        </div>
                                                    ) : (
                                                        [...selectedItemHistory].sort((a, b) => {
                                                            const tA = a.timestamp === 'Legacy' ? 0 : new Date(a.timestamp).getTime();
                                                            const tB = b.timestamp === 'Legacy' ? 0 : new Date(b.timestamp).getTime();
                                                            return tB - tA;
                                                        }).map((entry, idx) => {
                                                            const interactionNumber = selectedItemHistory.length - idx;
                                                            return (
                                                                <motion.div
                                                                    key={idx}
                                                                    initial={{ opacity: 0, x: -30, y: 10 }}
                                                                    animate={{ opacity: 1, x: 0, y: 0 }}
                                                                    transition={{ type: "spring", damping: 20, stiffness: 100, delay: idx * 0.05 }}
                                                                    className="relative pl-20"
                                                                >
                                                                    <div className={`absolute left-0 top-1 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center z-10 
                                                                    ${idx === 0
                                                                            ? 'bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 border-4 border-white dark:border-gray-800 rotate-6 scale-110 shadow-[var(--theme-primary)]/20'
                                                                            : 'bg-white dark:bg-gray-700 text-gray-400 border-2 border-gray-100 dark:border-gray-600'
                                                                        }`}
                                                                    >
                                                                        <span className={`text-xl font-black tabular-nums tracking-tighter ${idx === 0 ? 'text-gray-900' : ''}`}>
                                                                            {interactionNumber.toString().padStart(2, '0')}
                                                                        </span>
                                                                    </div>

                                                                    <div className={`bg-white dark:bg-gray-800/60 rounded-[28px] p-6 border shadow-sm transition-all duration-300 relative overflow-hidden
                                                                    ${entry.isOptimistic ? 'opacity-60 border-dashed animate-pulse' : 'border-gray-100 dark:border-gray-700 hover:border-[var(--theme-primary)]/40'}
                                                                `}>
                                                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="px-4 py-2 bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] shadow-md shadow-blue-500/20"> Follow-up </span>
                                                                                <p className="text-[11px] font-black text-gray-900 dark:text-white flex items-center gap-1.5 opacity-80 italic">
                                                                                    <Clock size={14} className="text-[var(--theme-primary)]" />
                                                                                    {entry.timestamp === 'Legacy' ? 'Legacy Record' : new Date(entry.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <p className="text-gray-800 dark:text-gray-200 text-lg leading-relaxed font-black italic tracking-tight"> "{entry.remark}" </p>

                                                                        {entry.next_followup && (
                                                                            <div className="flex items-center gap-4 pt-5 border-t border-gray-100 dark:border-gray-700 mt-2">
                                                                                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-800/50 shadow-inner">
                                                                                    <Calendar size={20} className="text-orange-500" />
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-[0.2em] leading-none mb-1.5">Next Appointment</span>
                                                                                    <p className="text-gray-900 dark:text-white text-xl font-black tabular-nums tracking-tighter">
                                                                                        {formatDisplayDate(entry.next_followup)}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        })
                                                    )}
                                                    <div className="relative pl-20 pb-10">
                                                        <div className="absolute left-[16px] top-1 w-[28px] h-[28px] rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center z-10">
                                                            <div className="w-2 h-2 rounded-full bg-[var(--theme-primary)] animate-pulse shadow-[0_0_10px_var(--theme-primary)]" />
                                                        </div>
                                                        <div className="pt-2 flex flex-col">
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-2">Origin Point</span>
                                                            <p className="text-xs font-black text-gray-500 dark:text-gray-400 italic"> Entry initialized in the system. </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isFilterModalOpen && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]">
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"> <Filter size={18} /> Filter Data </h2>
                                <button onClick={() => setIsFilterModalOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-gray-900"> <X size={18} /> </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <SearchableDropdown
                                    label="Specific Party"
                                    options={Array.from(new Set(data.map(item => item.Id))).map(id => ({
                                        id,
                                        name: data.find(item => item.Id === id)?.Name || 'Unknown'
                                    })).sort((a, b) => a.name.localeCompare(b.name))}
                                    value={filters.partyId}
                                    onChange={(val) => setFilters(prev => ({ ...prev, partyId: val.toString() }))}
                                    placeholder="Select a party..."
                                />
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Voucher Type</label>
                                    <select
                                        value={filters.vchType}
                                        onChange={(e) => setFilters(prev => ({ ...prev, vchType: e.target.value }))}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-xs transition-all"
                                    >
                                        <option value="">All Types</option>
                                        <option value="Sale">Sale</option>
                                        <option value="DrNt">Debit Note</option>
                                        <option value="CrNt">Credit Note</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Min Days Due</label>
                                    <input
                                        type="number"
                                        value={filters.dueDays}
                                        onChange={(e) => setFilters(prev => ({ ...prev, dueDays: e.target.value }))}
                                        placeholder="0"
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-xs"
                                    />
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-900/30">
                                    <input
                                        type="checkbox"
                                        id="openTasksFilter"
                                        checked={filters.openTasksOnly}
                                        onChange={(e) => setFilters(prev => ({ ...prev, openTasksOnly: e.target.checked }))}
                                        className="w-4 h-4 text-[var(--theme-primary)] bg-gray-100 border-gray-300 rounded focus:ring-[var(--theme-primary)]"
                                    />
                                    <label htmlFor="openTasksFilter" className="text-[10px] font-black text-orange-800 dark:text-orange-400 cursor-pointer uppercase tracking-wider"> Open Tasks Only </label>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                                <button onClick={resetFilters} className="flex-1 px-4 py-2.5 text-gray-500 font-bold text-[11px] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all uppercase tracking-widest">Reset</button>
                                <button onClick={() => setIsFilterModalOpen(false)} className="flex-1 px-4 py-2.5 bg-gray-900 text-white dark:bg-[var(--theme-primary)] dark:text-gray-900 font-bold text-[11px] rounded-xl hover:opacity-90 transition-all uppercase tracking-widest shadow-lg">Apply</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isDoerModalOpen && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDoerModalOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-md relative z-[10001] shadow-2xl border border-gray-100 dark:border-gray-800"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <User className="text-indigo-500" /> Assign Responsible
                                </h3>
                                <button onClick={() => setIsDoerModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"> <X size={20} /> </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Select Person</label>
                                    <SearchableDropdown
                                        options={users.map(u => ({ id: u.username, name: u.username }))}
                                        value={doer}
                                        onChange={handleUpdateDoer}
                                        placeholder="Search user..."
                                    />
                                </div>
                                {isUpdatingDoer && (
                                    <div className="flex items-center justify-center gap-2 text-indigo-500 font-bold text-xs animate-pulse text-center">
                                        <Loader2 className="animate-spin" size={14} /> Updating...
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </LayoutWrapper>
    );
}
