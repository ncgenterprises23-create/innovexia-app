'use client';

import { useState, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Recycle, Save, Plus, Trash2, CalendarDays, FileText,
  BarChart3, ClipboardList
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import ScrapDashboard from './components/ScrapDashboard';

interface ScrapItem {
  id: string;
  description: string;
  qty: string;
  weight: string;
}

const TABS = [
  { id: 'data-entry', label: 'Data Entry', icon: <ClipboardList size={18} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={18} /> },
];

export default function ScrapSalesPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('data-entry');
  
  // Data Entry State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ScrapItem[]>([
    { id: '1', description: '', qty: '', weight: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dashboard State
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  // Load Dashboard Data
  const fetchDashboardData = async () => {
    setIsLoadingDashboard(true);
    try {
      const response = await fetch('/api/scrap-sales');
      if (response.ok) {
        const json = await response.json();
        setDashboardData(json.data || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData();
    }
  }, [activeTab]);

  // Data Entry Handlers
  const handleAddItem = () => {
    setItems([...items, { id: Math.random().toString(), description: '', qty: '', weight: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return; // keep at least one
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof ScrapItem, value: string) => {
    if ((field === 'qty' || field === 'weight') && value && !/^\d*\.?\d*$/.test(value)) return;
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }

    const validItems = items.filter(i => i.description.trim() && (i.qty || i.weight));
    if (validItems.length === 0) {
      toast.error('Please enter at least one item with a description and quantity/weight');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/scrap-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          items: validItems
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit data');
      }

      toast.success('Scrap sales data saved successfully!');
      
      // Reset form
      setItems([{ id: Math.random().toString(), description: '', qty: '', weight: '' }]);
      
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while saving');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LayoutWrapper>
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 shadow-sm backdrop-blur-md border border-emerald-500/20">
                <Recycle size={22} />
              </span>
              Scrap Sales Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Track and analyze scrap sales over time
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
                    layoutId="scrapTabIndicator"
                    className="absolute inset-0 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <span className={`${isActive ? 'text-emerald-500' : ''}`}>
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
                              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all text-gray-900 dark:text-white"
                          />
                      </div>
                  </div>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white shadow-md transition-all mt-4 md:mt-0 ${
                      isSubmitting 
                        ? 'bg-emerald-400 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg active:scale-95'
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
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scrap Items</h2>
                    <button
                      onClick={handleAddItem}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                    >
                      <Plus size={16} />
                      Add Row
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {items.map((item) => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex flex-col md:flex-row gap-3 p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl items-start md:items-center"
                      >
                        <div className="w-full md:flex-1 relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            placeholder="Item Description (e.g. Aluminium Powder)"
                            value={item.description}
                            onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all dark:text-white placeholder-gray-400"
                          />
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                           <input
                              type="text"
                              placeholder="Qty"
                              value={item.qty}
                              onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)}
                              className="w-full md:w-28 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all dark:text-white placeholder-gray-400"
                            />
                            <div className="relative w-full md:w-32">
                                <input
                                  type="text"
                                  placeholder="Weight"
                                  value={item.weight}
                                  onChange={(e) => handleItemChange(item.id, 'weight', e.target.value)}
                                  className="w-full pr-8 pl-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all dark:text-white placeholder-gray-400"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">kg</span>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={items.length === 1}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={18} />
                            </button>
                        </div>
                      </motion.div>
                    ))}
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
                className="space-y-6"
              >
                {isLoadingDashboard ? (
                  <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-sm text-gray-500">Loading Dashboard Data...</p>
                  </div>
                ) : dashboardData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-gray-300 dark:text-gray-600 mb-3 flex items-center justify-center">
                        <BarChart3 size={48} />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">No data found in Google Sheets.</p>
                  </div>
                ) : (
                  <ScrapDashboard data={dashboardData} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </LayoutWrapper>
  );
}
