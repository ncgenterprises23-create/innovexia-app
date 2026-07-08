'use client';

import { useState, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardCheck, Save, CalendarDays, BarChart3, ClipboardList, PackageSearch, Search
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import AuditDashboard from './components/AuditDashboard';

interface AuditItem {
  id: string;
  rawMaterial: string;
  liveStock: string;
  actualStock: string;
}

const TABS = [
  { id: 'data-entry', label: 'Data Entry', icon: <ClipboardList size={18} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={18} /> },
];

export default function RMAuditStockPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('data-entry');
  
  // Data Entry State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imsData, setImsData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Fetch Live Stock data from IMS
    const fetchImsData = async () => {
        try {
            const res = await fetch('/api/ims-rm?sheetName=Live%20Stock');
            if (res.ok) {
                const data = await res.json();
                setImsData(data);
                
                // Initialize items from IMS data
                const initialItems = data.map((d: any) => {
                    const live = Number(d.live_stock) || 0;
                    const transit = Number(d.material_in_transit) || 0;
                    return {
                        id: Math.random().toString(),
                        rawMaterial: d.item_name || d.sku_code || '-',
                        liveStock: String(live + transit),
                        actualStock: ''
                    };
                });
                
                // Filter out empty rows
                setItems(initialItems.filter((i: any) => i.rawMaterial && i.rawMaterial !== '-'));
            }
        } catch (error) {
            console.error("Failed to fetch IMS data", error);
        }
    };
    fetchImsData();
  }, []);

  const handleItemChange = (id: string, field: keyof AuditItem, value: string) => {
    if (field === 'actualStock' && value && !/^-?\d*\.?\d*$/.test(value)) return;
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }

    const validItems = items.filter(i => i.actualStock.trim() !== '');
    if (validItems.length === 0) {
      toast.error('Please enter Actual Stock for at least one item');
      return;
    }

    // Process diffs before submitting
    const itemsWithDiff = validItems.map(item => {
        const live = parseFloat(item.liveStock) || 0;
        const actual = parseFloat(item.actualStock) || 0;
        return {
            ...item,
            liveStock: live,
            actualStock: actual,
            diff: parseFloat((actual - live).toFixed(2))
        };
    });

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/rm-audit-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          items: itemsWithDiff
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit data');
      }

      toast.success('Audit Stock data saved successfully!');
      
      // Clear actual stock fields after successful submission
      setItems(items.map(item => ({ ...item, actualStock: '' })));
      
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while saving');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(item => 
      item.rawMaterial.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <LayoutWrapper>
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="p-2 bg-blue-500/10 rounded-xl text-blue-600 shadow-sm backdrop-blur-md border border-blue-500/20">
                <ClipboardCheck size={22} />
              </span>
              RM Audit Stock
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Weekly tracking of raw materials and stock differences
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-white/50 dark:bg-gray-800/50 p-1.5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm self-start inline-flex flex-wrap gap-1 shadow-sm sm:flex-nowrap w-full sm:w-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 w-full sm:w-auto focus:outline-none ${
                    isActive
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/30'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="rmTabIndicator"
                      className="absolute inset-0 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <span className={`${isActive ? 'text-blue-500' : ''}`}>
                      {tab.icon}
                    </span>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Section */}
        <div className="mt-4 min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === 'data-entry' && (
              <motion.div
                key="data-entry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
              >
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Date</label>
                      <div className="flex items-center gap-3 w-full md:w-64 relative">
                          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-gray-900 dark:text-white"
                          />
                      </div>
                  </div>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || items.length === 0}
                    className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white shadow-md transition-all mt-4 md:mt-0 ${
                      isSubmitting || items.length === 0
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {isSubmitting ? 'Saving...' : 'Submit Records'}
                  </button>
                </div>

                <div className="p-5">
                  <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Audit Items 
                        <span className="text-sm text-gray-400 font-normal ml-2">
                            ({filteredItems.length} items)
                        </span>
                    </h2>
                    
                    <div className="relative w-full md:w-72">
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white placeholder-gray-400"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {/* Header Row for Inputs */}
                    <div className="hidden md:flex gap-3 px-3 pb-2 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="flex-1">Raw Material</div>
                        <div className="w-32">Live Stock</div>
                        <div className="w-32">Actual Stock</div>
                        <div className="w-24">Diff (Auto)</div>
                    </div>

                    {filteredItems.map((item) => {
                      const live = parseFloat(item.liveStock) || 0;
                      const actual = parseFloat(item.actualStock) || 0;
                      const rawDiff = actual - live;
                      // Fix floating point precision issues (e.g. 500 - 719.7 = -219.70000000000005)
                      const diff = parseFloat(rawDiff.toFixed(2));
                      
                      const diffColor = item.actualStock === '' ? 'text-gray-300 dark:text-gray-600' : diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-gray-500';

                      return (
                        <div 
                          key={item.id}
                          className={`flex flex-col md:flex-row gap-3 p-3 bg-white dark:bg-gray-800/80 border rounded-xl items-start md:items-center transition-colors ${
                              item.actualStock !== '' 
                                ? 'border-blue-200 dark:border-blue-500/30 shadow-sm' 
                                : 'border-gray-100 dark:border-gray-700'
                          }`}
                        >
                          <div className="w-full md:flex-1 flex items-center gap-3 overflow-hidden">
                             <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                 <PackageSearch className="text-blue-500" size={16} />
                             </div>
                             <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">
                                 {item.rawMaterial}
                             </span>
                          </div>
                          
                          <div className="flex gap-3 w-full md:w-auto items-center">
                            <div className="w-full md:w-32 px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col justify-center text-center opacity-80 cursor-not-allowed">
                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Live Stock</span>
                                <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{item.liveStock}</span>
                            </div>
                            
                            <input
                              type="text"
                              placeholder="Actual Stock"
                              value={item.actualStock}
                              onChange={(e) => handleItemChange(item.id, 'actualStock', e.target.value)}
                              className={`w-full md:w-32 px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border rounded-lg focus:ring-2 outline-none transition-all dark:text-white text-center font-bold ${
                                  item.actualStock !== '' 
                                    ? 'border-blue-400 focus:ring-blue-500 text-blue-700 dark:text-blue-400' 
                                    : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 placeholder-gray-300'
                              }`}
                            />
                            
                            <div className="w-full md:w-24 px-3 py-2 rounded-lg flex items-center justify-center">
                                <span className="text-xs text-gray-400 md:hidden mr-2">Diff:</span>
                                <span className={`text-sm font-black ${diffColor}`}>
                                  {item.actualStock === '' ? '-' : (diff > 0 ? '+' : '') + diff}
                                </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredItems.length === 0 && imsData.length > 0 && (
                        <div className="text-center py-10 text-gray-500">
                            No items found matching "{searchQuery}"
                        </div>
                    )}
                    
                    {imsData.length === 0 && (
                         <div className="text-center py-10 text-gray-500">
                            Loading inventory items...
                        </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <AuditDashboard />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </LayoutWrapper>
  );
}
