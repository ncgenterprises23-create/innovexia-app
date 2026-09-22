'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { formatDateToString, parseDateString } from '@/lib/dateUtils';

type TabType = 'Finish Goods' | 'Live Stock' | 'Ready To Order' | 'Confirmed Order';

const ITEMS_PER_PAGE = 10;

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

export default function IMSFGPage() {
    const TABS = [
        { name: 'Finish Goods' as const, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
        { name: 'Live Stock' as const, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { name: 'Ready To Order' as const, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
        { name: 'Confirmed Order' as const, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
    ];

    const [activeTab, setActiveTab] = useState<TabType>('Finish Goods');
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [editFormState, setEditFormState] = useState<any>({});
    const [itemToConfirm, setItemToConfirm] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (editingItem) {
            const gv = (key: string) =>
                editingItem[key] ??
                editingItem[key.toLowerCase().replace(/ /g, '_')] ??
                editingItem[key.replace(/ /g, '')] ??
                '';

            setEditFormState({
                party_name: gv('party_name'),
                party_address: gv('party_address'),
                gstin_uin: gv('gstin_uin'),
                hsn_code_sac_code: gv('hsn_code_sac_code'),
                average_daily_consumption: gv('average_daily_consumption'),
                lead_time_from_indent_to_receipt: gv('lead_time_from_indent_to_receipt'),
                safety_factor: gv('safety_factor'),
                moq: gv('moq'),
                max_level: gv('max_level')
            });
        }
    }, [editingItem]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditFormState((prev: any) => {
            const newState = { ...prev, [name]: value };

            // Auto-calculate Max Level: avgConsumption * leadTime * safetyFactor
            if (['average_daily_consumption', 'lead_time_from_indent_to_receipt', 'safety_factor'].includes(name)) {
                const consumption = parseFloat(newState.average_daily_consumption) || 0;
                const leadTime = parseFloat(newState.lead_time_from_indent_to_receipt) || 0;
                const safety = parseFloat(newState.safety_factor) || 0;

                newState.max_level = (consumption * leadTime * safety).toFixed(2);
            }

            return newState;
        });
    };

    const toast = useToast();
    const loader = useLoader();

    useEffect(() => {
        fetchData();
        setCurrentPage(1);
        setSortConfig(null);
    }, [activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/ims-fg?sheetName=${encodeURIComponent(activeTab)}`);
            if (res.ok) {
                const result = await res.json();
                setData(result);
            } else {
                toast.error(`Failed to fetch ${activeTab} data`);
            }
        } catch (error) {
            toast.error('Error loading data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleConfirmOrder = (item: any) => {
        setItemToConfirm(item);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmedAction = async () => {
        if (!itemToConfirm) return;

        try {
            setIsConfirmModalOpen(false);
            loader.showLoader();
            // Map item_code to sku_code if needed
            const submitData = {
                ...itemToConfirm,
                sku_code: itemToConfirm.item_code || itemToConfirm.sku_code || '-'
            };

            const res = await fetch('/api/ims-fg/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            });

            if (res.ok) {
                toast.success('Order confirmed successfully');
                fetchData();
            } else {
                toast.error('Failed to confirm order');
            }
        } catch (error) {
            toast.error('Error confirming order');
        } finally {
            loader.hideLoader();
            setItemToConfirm(null);
        }
    };

    const handleExportCSV = () => {
        // Define headers for the CSV
        const headers = [
            'Item Name', 'Item Code', 'Party Name', 'Party Address',
            'GSTIN', 'HSN Code', 'Avg Daily Consumption', 'Lead Time',
            'Safety Factor', 'MOQ', 'Max Level', 'Live Stock',
            'Material In Transit'
        ];
        if (activeTab === 'Confirmed Order') headers.unshift('Timestamp');

        const csvRows = [headers.join(',')];

        filteredData.forEach(item => {
            const gv = (key: string) => {
                const val = item[key] || item[key.toLowerCase().replace(/ /g, '_')] || item[key.replace(/ /g, '')] || '-';
                // Escape commas and quotes for CSV
                const escaped = String(val).replace(/"/g, '""');
                return `"${escaped}"`;
            };

            const row = [
                gv('item_name'),
                gv('item_code') !== '"-"' ? gv('item_code') : gv('sku_code'),
                gv('party_name'),
                gv('party_address'),
                gv('gstin_uin'),
                gv('hsn_code_sac_code'),
                gv('average_daily_consumption'),
                gv('lead_time_from_indent_to_receipt'),
                gv('safety_factor'),
                gv('moq'),
                gv('max_level'),
                gv('live_stock'),
                gv('material_in_transit')
            ];

            if (activeTab === 'Confirmed Order') {
                const date = parseDateString(item.timestamp);
                const formattedDate = date ? formatDateToString(date) : (item.timestamp || '-');
                row.unshift(`"${formattedDate}"`);
            }

            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `IMS_FG_${activeTab.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sortedData = useMemo(() => {
        let sortableData = [...data];
        if (sortConfig !== null) {
            sortableData.sort((a, b) => {
                const getVal = (obj: any, key: string) => {
                    return obj[key] || obj[key.toLowerCase().replace(/ /g, '_')] || obj[key.replace(/ /g, '')] || '';
                };

                const aValue = getVal(a, sortConfig.key);
                const bValue = getVal(b, sortConfig.key);

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                const aStr = String(aValue).toLowerCase();
                const bStr = String(bValue).toLowerCase();

                if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const filteredData = useMemo(() => {
        if (!searchQuery) return sortedData;
        const lowercaseQuery = searchQuery.toLowerCase();
        return sortedData.filter(item =>
            Object.values(item).some(val =>
                String(val).toLowerCase().includes(lowercaseQuery)
            )
        );
    }, [sortedData, searchQuery]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const columns = useMemo(() => {
        const cols: { label: string, key: string }[] = [];

        if (activeTab === 'Finish Goods' || activeTab === 'Ready To Order') {
            cols.push({ label: 'Action', key: 'action' });
        }

        if (activeTab === 'Confirmed Order') {
            cols.push({ label: 'Timestamp', key: 'timestamp' });
        }

        cols.push({ label: 'Item Details', key: 'item_name' });

        if (activeTab === 'Finish Goods') {
            cols.push({ label: 'Party Name', key: 'party_name' });
            cols.push({ label: 'Address', key: 'party_address' });
        } else {
            cols.push({ label: 'Party Details', key: 'party_name' });
        }

        cols.push({ label: 'Consumption & Lead', key: 'average_daily_consumption' });

        cols.push({ label: 'Stock Policy', key: 'moq' });

        if (activeTab === 'Live Stock') {
            cols.push({ label: 'Stock Status', key: 'live_stock' });
        } else if (activeTab === 'Ready To Order' || activeTab === 'Confirmed Order') {
            cols.push({ label: 'Inventory', key: 'live_stock' });
        }

        return cols;
    }, [activeTab]);

    const IconWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 mr-2 ${className}`}>
            {children}
        </span>
    );

    const renderCellContent = (item: any, colKey: string) => {
        const getVal = (key: string) => item[key] || item[key.toLowerCase().replace(/ /g, '_')] || item[key.replace(/ /g, '')] || '-';

        if (colKey === 'action') {
            if (activeTab === 'Finish Goods') {
                return (
                    <button
                        onClick={() => {
                            setEditingItem(item);
                            setIsEditModalOpen(true);
                        }}
                        className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        title="Edit Party Details"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                );
            }

            if (activeTab === 'Ready To Order') {
                return (
                    <button
                        onClick={() => handleConfirmOrder(item)}
                        className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                        title="Confirm Order"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                );
            }
        }

        switch (colKey) {
            case 'timestamp':
                const date = parseDateString(getVal('timestamp'));
                const renderBadge = () => {
                    if (!date) return null;
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                        return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                                TODAY
                            </span>
                        );
                    } else if (diffDays === 1) {
                        return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                YESTERDAY
                            </span>
                        );
                    } else if (diffDays === 2) {
                        return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
                                DAY BEFORE YESTERDAY
                            </span>
                        );
                    }
                    return null;
                };

                return (
                    <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                            {date ? formatDateToString(date) : getVal('timestamp')}
                        </span>
                        {renderBadge()}
                    </div>
                );
            case 'item_name':
                return (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center text-gray-900 dark:text-white font-black leading-tight">
                            <IconWrapper><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg></IconWrapper>
                            {getVal('item_name')}
                        </div>
                        <div className="flex items-center text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider ml-7">
                            <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded uppercase font-black">
                                CODE: {getVal('item_code') !== '-' ? getVal('item_code') : getVal('sku_code')}
                            </span>
                        </div>
                    </div>
                );
            case 'party_name':
                return (
                    <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <div className="flex items-start text-gray-900 dark:text-white font-black leading-tight">
                            <IconWrapper className="bg-blue-50 dark:bg-blue-900/20 text-blue-500 mt-0.5 flex-shrink-0"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg></IconWrapper>
                            <span>{getVal('party_name')}</span>
                        </div>
                        {activeTab === 'Finish Goods' && (
                            <>
                                <div className="flex flex-wrap gap-2 mt-1 ml-7">
                                    <span className="flex items-center text-[9px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                                        GST: {getVal('gstin_uin')}
                                    </span>
                                    <span className="flex items-center text-[9px] font-black bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-100 dark:border-purple-900/30">
                                        HSN: {getVal('hsn_code_sac_code')}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                );
            case 'party_address':
                return (
                    <div className="flex flex-col gap-1 min-w-[200px]">
                        <div className="flex items-start text-[10px] text-gray-500 dark:text-gray-400 font-medium italic">
                            <svg className="w-2.5 h-2.5 mr-1 mt-0.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <span>{getVal('party_address')}</span>
                        </div>
                    </div>
                );
            case 'average_daily_consumption':
                return (
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Consumption</span>
                            <span className="text-xs font-black text-[var(--theme-primary)] leading-none">{getVal('average_daily_consumption')}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Lead Time</span>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 leading-none">{getVal('lead_time_from_indent_to_receipt')} Days</span>
                        </div>
                    </div>
                );
            case 'moq':
                return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Safety</span>
                            <span className="text-[11px] font-black text-emerald-500">{getVal('safety_factor')}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">MOQ</span>
                            <span className="text-[11px] font-black text-blue-500">{getVal('moq')}</span>
                        </div>
                        <div className="flex flex-col col-span-2 mt-1 pt-1 border-t border-gray-50 dark:border-gray-700">
                            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Max Level</span>
                            <span className="text-[11px] font-black text-rose-500">{getVal('max_level')}</span>
                        </div>
                    </div>
                );
            case 'live_stock':
                if (activeTab === 'Ready To Order') {
                    return (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Live</span>
                                <span className="text-xs font-black text-gray-700 dark:text-gray-200">{getVal('live_stock')}</span>
                            </div>
                            <div className="flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10 p-1.5 rounded-lg border border-blue-100/50 dark:border-blue-900/20">
                                <span className="text-[9px] font-black text-blue-400 dark:text-blue-500 uppercase">Transit</span>
                                <span className="text-xs font-black text-blue-600 dark:text-blue-400">{getVal('material_in_transit')}</span>
                            </div>
                        </div>
                    );
                }
                const liveStock = Number(getVal('live_stock')) || 0;
                const transit = Number(getVal('material_in_transit')) || 0;
                const total = liveStock + transit;
                return (
                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
                            <span>L: {liveStock}</span>
                            <span>T: {transit}</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[var(--theme-primary)] transition-all duration-500"
                                style={{ width: `${Math.min(100, (Number(getVal('live_stock')) / (total || 1)) * 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center bg-[var(--theme-primary)]/10 p-2 rounded-xl mt-1">
                            <span className="text-[10px] font-black text-[var(--theme-primary)] uppercase">Total</span>
                            <span className="text-sm font-black text-[var(--theme-primary)]">{total}</span>
                        </div>
                    </div>
                );
            default:
                return (
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                        {getVal(colKey)}
                    </span>
                );
        }
    };

    return (
        <LayoutWrapper>
            <div className="p-3 space-y-3">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-black text-[var(--theme-primary)] tracking-tight">
                            Inventory Management System
                        </h1>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                            Finished Goods Management & Tracking
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search inventory..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-[var(--theme-primary)] outline-none w-64 transition-all"
                            />
                            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            title="Export CSV"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            title="Refresh Data"
                        >
                            <svg className={`w-5 h-5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Tabs Section */}
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-[14px] w-fit overflow-x-auto">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.name;
                        return (
                            <button
                                key={tab.name}
                                onClick={() => setActiveTab(tab.name)}
                                className={`px-4 py-2 rounded-[10px] text-[11px] font-black whitespace-nowrap transition-all duration-300 relative flex items-center gap-2 z-10 ${isActive
                                    ? 'text-[var(--theme-primary)]'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                <span className={`${isActive ? 'text-[var(--theme-primary)]' : 'text-gray-400'} transition-colors duration-300`}>
                                    {tab.icon}
                                </span>
                                <span>{tab.name}</span>
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabIMSFG"
                                        className="absolute inset-0 bg-white dark:bg-gray-700 rounded-[10px] -z-10 shadow-sm"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Data Table */}
                <div className="bg-white dark:bg-gray-800/60 rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden relative min-h-[300px]">
                    <AnimatePresence mode="wait">
                        {isLoading ? (
                            <motion.div
                                key="loader"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-50"
                            >
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-[var(--theme-primary)]/20 border-t-[var(--theme-primary)] rounded-full animate-spin" />
                                    <p className="text-sm font-bold text-gray-500 animate-pulse uppercase tracking-widest">Loading {activeTab}...</p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="flex flex-col h-full"
                            >
                                {/* Pagination Controls (Top) */}
                                {totalPages > 1 && (
                                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/30 dark:bg-gray-900/30">
                                        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">
                                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} of {filteredData.length}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                            >
                                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                                                </svg>
                                            </button>

                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    let pageNum = currentPage;
                                                    if (currentPage <= 3) pageNum = i + 1;
                                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                                    else pageNum = currentPage - 2 + i;

                                                    if (pageNum < 1 || pageNum > totalPages) return null;

                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => setCurrentPage(pageNum)}
                                                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === pageNum
                                                                ? 'bg-[var(--theme-primary)] text-white shadow-md scale-105'
                                                                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
                                                                }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                            >
                                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="overflow-x-auto flex-1">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[var(--theme-primary)]">
                                                {columns.map((col) => {
                                                    const isSorted = sortConfig?.key === col.key;
                                                    return (
                                                        <th
                                                            key={col.key}
                                                            onClick={() => handleSort(col.key)}
                                                            className="px-4 py-3 text-[10px] font-black text-white uppercase tracking-wider whitespace-nowrap border-b border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {col.label}
                                                                <div className="flex flex-col opacity-50">
                                                                    <svg className={`w-2 h-2 ${isSorted && sortConfig.direction === 'asc' ? 'text-white opacity-100' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                                                                    <svg className={`w-2 h-2 ${isSorted && sortConfig.direction === 'desc' ? 'text-white opacity-100' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                                </div>
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                            {paginatedData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={columns.length} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-4 opacity-30">
                                                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                            </svg>
                                                            <p className="text-xl font-black italic tracking-tight">No data found in {activeTab}</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginatedData.map((item, idx) => (
                                                    <motion.tr
                                                        key={idx}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.01 }}
                                                        className="hover:bg-gray-50 dark:hover:bg-[var(--theme-primary)]/5 transition-colors group"
                                                    >
                                                        {columns.map((col) => (
                                                            <td key={col.key} className="px-4 py-2 transition-colors">
                                                                {renderCellContent(item, col.key)}
                                                            </td>
                                                        ))}
                                                    </motion.tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {isEditModalOpen && editingItem && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsEditModalOpen(false)}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-800 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl relative z-10 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] p-6 sticky top-0 z-10">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">Edit Party Details</h2>
                                        <p className="text-xs font-bold text-gray-900/60 uppercase tracking-widest mt-0.5">
                                            ID: {editingItem.id} | {editingItem.item_name}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="p-2 hover:bg-white/20 rounded-lg transition"
                                    >
                                        <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>

                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    const data = Object.fromEntries(formData.entries());

                                    try {
                                        setIsSubmitting(true);
                                        loader.showLoader();
                                        const res = await fetch('/api/ims-fg/submit', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                ...editingItem,
                                                ...editFormState,
                                                submitted_at: new Date().toISOString()
                                            })
                                        });

                                        if (res.ok) {
                                            toast.success('Party details submitted successfully');
                                            setIsEditModalOpen(false);
                                        } else {
                                            toast.error('Failed to submit details');
                                        }
                                    } catch (error) {
                                        toast.error('Error submitting data');
                                    } finally {
                                        setIsSubmitting(false);
                                        loader.hideLoader();
                                    }
                                }}
                                className="p-6 space-y-5 max-h-[68vh] overflow-y-auto custom-scrollbar"
                            >
                                {/* Robust key getter */}
                                {(() => {
                                    const gv = (key: string) =>
                                        editingItem[key] ??
                                        editingItem[key.toLowerCase().replace(/ /g, '_')] ??
                                        editingItem[key.replace(/ /g, '')] ??
                                        '';

                                    const SectionLabel = ({ color, icon, title }: { color: string; icon: string; title: string }) => (
                                        <p className={`text-[10px] font-black ${color} uppercase tracking-widest mb-3 flex items-center gap-2`}>
                                            <span className="w-4 h-4 rounded flex items-center justify-center text-[10px]">{icon}</span>
                                            {title}
                                        </p>
                                    );

                                    const Field = ({ label, name, value, required = false, readOnly = false }: {
                                        label: string; name: string; value: any; required?: boolean; readOnly?: boolean;
                                    }) => (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                {label}{required && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            <input
                                                name={name}
                                                value={value ?? ''}
                                                onChange={handleInputChange}
                                                required={required}
                                                readOnly={readOnly}
                                                className={`w-full px-4 py-2.5 border-0 rounded-xl text-sm font-semibold outline-none transition ${readOnly
                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                    : 'bg-[var(--theme-lighter)] dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)]'
                                                    }`}
                                            />
                                        </div>
                                    );

                                    return (
                                        <>
                                            {/* Item Details */}
                                            <div>
                                                <SectionLabel color="text-[var(--theme-primary)]" icon="📦" title="Item Details" />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Item Name</label>
                                                        <input name="item_name" defaultValue={gv('item_name')} readOnly className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-gray-500 dark:text-gray-400 outline-none text-sm font-semibold cursor-not-allowed" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Item Code / SKU</label>
                                                        <input name="item_code" defaultValue={gv('item_code') || gv('sku_code')} readOnly className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-gray-500 dark:text-gray-400 outline-none text-sm font-semibold cursor-not-allowed" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Party Details */}
                                            <div>
                                                <SectionLabel color="text-blue-500" icon="🏢" title="Party Details" />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Field label="Party Name" name="party_name" value={editFormState.party_name} required />
                                                    <Field label="Party Address" name="party_address" value={editFormState.party_address} />
                                                    <Field label="GSTIN / UIN" name="gstin_uin" value={editFormState.gstin_uin} />
                                                    <Field label="HSN Code / SAC Code" name="hsn_code_sac_code" value={editFormState.hsn_code_sac_code} />
                                                </div>
                                            </div>

                                            {/* Consumption & Lead Time */}
                                            <div>
                                                <SectionLabel color="text-emerald-500" icon="📈" title="Consumption & Lead Time" />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Field label="Avg Daily Consumption" name="average_daily_consumption" value={editFormState.average_daily_consumption} />
                                                    <Field label="Lead Time (Days)" name="lead_time_from_indent_to_receipt" value={editFormState.lead_time_from_indent_to_receipt} />
                                                </div>
                                            </div>

                                            {/* Stock Policy */}
                                            <div>
                                                <SectionLabel color="text-violet-500" icon="📊" title="Stock Policy" />
                                                <div className="grid grid-cols-3 gap-4">
                                                    <Field label="Safety Factor" name="safety_factor" value={editFormState.safety_factor} />
                                                    <Field label="MOQ" name="moq" value={editFormState.moq} />
                                                    <Field label="Max Level" name="max_level" value={editFormState.max_level} readOnly />
                                                </div>
                                            </div>


                                        </>
                                    );
                                })()}

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-6 py-2.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-gray-900/20 border-t-gray-900 rounded-full animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            'Submit Changes'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Confirmation Modal */}
            <AnimatePresence>
                {isConfirmModalOpen && itemToConfirm && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsConfirmModalOpen(false)}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative z-10 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="p-6">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--theme-primary)]/10 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Confirm Order</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                            Are you sure you want to confirm the order for <span className="text-gray-900 dark:text-white font-black">{itemToConfirm.item_name}</span>?
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsConfirmModalOpen(false)}
                                        className="flex-1 px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmedAction}
                                        className="flex-1 px-6 py-2.5 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] hover:opacity-90 text-white rounded-xl font-semibold transition-all shadow-md shadow-[var(--theme-primary)]/20"
                                    >
                                        Confirm
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
