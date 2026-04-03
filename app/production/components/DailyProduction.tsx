'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Box,
  Layers,
  CalendarCheck,
  Plus, 
  X,
  AlertTriangle,
  Loader2,
  Calendar,
  ChevronRight,
  TrendingUp,
  PackageCheck,
  Trash2,
  Monitor,
  GalleryVerticalEnd,
  Lightbulb
} from 'lucide-react';

interface ProductionData {
  id: string;
  date: string;
  department: string;
  productionName: string;
  category: string;
  qty: number;
  rowIndex: number;
}

const DEPARTMENTS = ['Devender', 'Neeraj', 'Rahul'];

const CATEGORIES = [
  { label: 'Table Top', icon: <Monitor size={14}/>, color: 'from-blue-400 to-indigo-500', textColors: 'text-blue-700 dark:text-blue-400', bgColors: 'bg-blue-100 dark:bg-blue-900/30' },
  { label: 'Standee', icon: <GalleryVerticalEnd size={14}/>, color: 'from-purple-400 to-pink-500', textColors: 'text-purple-700 dark:text-purple-400', bgColors: 'bg-purple-100 dark:bg-purple-900/30' },
  { label: 'Light', icon: <Lightbulb size={14}/>, color: 'from-amber-400 to-orange-500', textColors: 'text-amber-700 dark:text-amber-400', bgColors: 'bg-amber-100 dark:bg-amber-900/30' }
];

const getTodayDate = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

interface FormRow {
  uid: string;
  productionName: string;
  category: string;
  qty: number;
}

export default function DailyProduction() {
  const [production, setProduction] = useState<ProductionData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ProductionData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Bulk Form State
  const [logDate, setLogDate] = useState(getTodayDate());
  const [selectedDeptLog, setSelectedDeptLog] = useState(DEPARTMENTS[0]);
  const [formRows, setFormRows] = useState<FormRow[]>([]);
  
  const [selectedViewDept, setSelectedViewDept] = useState(DEPARTMENTS[0]); // For the view filter

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/daily-production');
      const data = await res.json();
      if (data.production) setProduction(data.production);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setLogDate(getTodayDate());
    setSelectedDeptLog(DEPARTMENTS[0]);
    
    // Initialize with one empty row
    setFormRows([{
      uid: crypto.randomUUID(),
      productionName: '',
      category: 'Table Top',
      qty: 1
    }]);

    setIsModalOpen(true);
  };

  const addRow = () => {
    setFormRows([...formRows, {
      uid: crypto.randomUUID(),
      productionName: '',
      category: 'Table Top',
      qty: 1
    }]);
  };

  const updateRow = (uid: string, field: keyof FormRow, value: any) => {
    setFormRows(formRows.map(row => 
      row.uid === uid ? { ...row, [field]: value } : row
    ));
  };

  const removeRow = (uid: string) => {
    setFormRows(formRows.filter(row => row.uid !== uid));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validRows = formRows.filter(r => r.productionName.trim() !== '' && r.qty > 0);
    
    if (validRows.length === 0) {
      alert("Please ensure at least one production entry is filled with a valid name and quantity greater than 0.");
      return;
    }

    setSubmitting(true);
    const recordsToInsert = validRows.map(r => ({
      date: logDate,
      department: selectedDeptLog,
      productionName: r.productionName,
      category: r.category,
      qty: r.qty
    }));

    try {
      await fetch('/api/production/daily-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordsToInsert),
      });
      fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to log production', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (record: ProductionData) => {
    setRecordToDelete(record);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    setSubmitting(true);
    try {
      await fetch(`/api/production/daily-production?rowIndex=${recordToDelete.rowIndex}`, {
        method: 'DELETE',
      });
      setProduction(production.filter(a => a.id !== recordToDelete.id));
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Failed to delete production record', error);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const groupedTableDatas = useMemo(() => {
    const rows: { 
      id: string; 
      date: string; 
      records: ProductionData[];
      stats: {
        totalQty: number;
        totalItems: number;
        catBreakdown: Record<string, number>;
      }
    }[] = [];
    
    const viewRecords = production.filter(a => a.department === selectedViewDept);
    const uniqueDates = Array.from(new Set(viewRecords.map(a => a.date))).sort((a,b) => b.localeCompare(a));

    uniqueDates.forEach(date => {
      const dateRecords = viewRecords.filter(a => a.date === date);
      
      let totalQty = 0;
      let totalItems = dateRecords.length;
      let catBreakdown: Record<string, number> = {
        'Table Top': 0, 'Standee': 0, 'Light': 0
      };

      dateRecords.forEach(r => {
        totalQty += r.qty;
        if (catBreakdown[r.category] !== undefined) {
          catBreakdown[r.category] += r.qty;
        } else {
           catBreakdown[r.category] = r.qty;
        }
      });

      rows.push({
        id: `${date}-${selectedViewDept}`,
        date,
        records: dateRecords,
        stats: {
          totalQty,
          totalItems,
          catBreakdown
        }
      });
    });
    return rows;
  }, [production, selectedViewDept]);

  return (
    <div className="space-y-4">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-2 p-1.5 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-2xl shadow-lg shadow-blue-900/5">
          {DEPARTMENTS.map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedViewDept(dept)}
              className={`relative px-6 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
                selectedViewDept === dept
                  ? 'text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
              }`}
            >
              {selectedViewDept === dept && (
                 <motion.div layoutId="prodActiveTabBadge" className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl -z-10" />
              )}
              {dept}
            </button>
          ))}
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-xl shadow-blue-500/20 transition-all border border-blue-500/50"
        >
          <Plus size={18} />
          <span>Log Daily Production</span>
        </motion.button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Syncing with Google Sheets...</p>
        </div>
      ) : groupedTableDatas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
            <Box className="text-blue-600" size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Production Logs for {selectedViewDept}</h3>
          <p className="text-sm text-gray-500 mb-4">You have not logged any outputs for this department yet.</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="mt-4 px-4 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-lg shadow hover:opacity-90 transition-all"
          >
            Start Logging
          </motion.button>
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-blue-900/10 border border-white/60 dark:border-gray-700/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50/80 to-blue-50/40 dark:from-gray-900/80 dark:to-blue-900/20 border-b border-gray-200/60 dark:border-gray-700/60">
                  <th className="px-6 py-4 text-xs font-black text-blue-800/60 dark:text-blue-400/60 uppercase tracking-widest w-16"></th>
                  <th className="px-6 py-4 text-xs font-black text-blue-800/60 dark:text-blue-400/60 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-xs font-black text-blue-800/60 dark:text-blue-400/60 uppercase tracking-widest text-right">Daily Statistics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50 border-0">
                {groupedTableDatas.map((row) => {
                  const isExpanded = expandedRows.has(row.id);
                  const dateObj = new Date(row.date);
                  const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  const { stats } = row;
                  
                  return (
                    <React.Fragment key={row.id}>
                      <tr 
                        onClick={() => toggleRow(row.id)}
                        className={`cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-gradient-to-r from-blue-50/50 to-white/10 dark:from-blue-900/20 dark:to-transparent border-l-4 border-l-blue-500' : 'hover:bg-white/80 dark:hover:bg-gray-700/40 border-l-4 border-l-transparent'}`}
                      >
                        <td className="px-6 py-5 w-16">
                          <button className={`p-1.5 rounded-lg transition-all duration-300 ${isExpanded ? 'rotate-90 text-blue-600 bg-blue-100/50 dark:bg-blue-900/50 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <ChevronRight size={18} />
                          </button>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className={`font-bold transition-all duration-300 flex items-center gap-3 ${isExpanded ? 'text-blue-700 dark:text-blue-300 text-base' : 'text-gray-800 dark:text-gray-200 text-sm'}`}>
                            <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                              <Calendar size={16} />
                            </div>
                            {dateFormatted}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right flex justify-end">
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold whitespace-nowrap">
                              <PackageCheck size={12} className="opacity-70" /> Total Qty: {stats.totalQty}
                            </span>
                            
                            {Object.entries(stats.catBreakdown).map(([catStr, qty]) => {
                              if (qty === 0) return null;
                              const catMeta = CATEGORIES.find(c => c.label === catStr);
                              if (!catMeta) return null;
                              
                              return (
                                <span key={catStr} className={`flex items-center gap-1.5 px-2.5 py-1 rounded ${catMeta.bgColors} ${catMeta.textColors} text-xs font-bold whitespace-nowrap`}>
                                  {catMeta.icon} {qty}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={3} className="p-0 border-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-gray-50/80 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700"
                              >
                                <div className="p-6 flex flex-wrap gap-4 relative">
                                  <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 opacity-50 diagram-pattern pointer-events-none"></div>
                                  
                                  {row.records.map((record) => {
                                    const catMeta = CATEGORIES.find(c => c.label === record.category) || CATEGORIES[0];

                                    return (
                                      <div
                                        key={record.id}
                                        className="min-w-[220px] max-w-[240px] flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-4 shadow-xl shadow-gray-200/50 dark:shadow-none border border-white dark:border-gray-700 relative overflow-hidden z-10 transition-transform hover:-translate-y-1"
                                      >
                                        <div className="flex items-start justify-between mb-4">
                                          <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${catMeta.color} text-white shadow-inner`}>
                                             {React.cloneElement(catMeta.icon as React.ReactElement<any>, { size: 18 })}
                                          </div>
                                          <button
                                            onClick={() => handleOpenDeleteModal(record)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>

                                        <h4 className="text-base font-extrabold text-gray-900 dark:text-white truncate mb-1" title={record.productionName}>
                                          {record.productionName}
                                        </h4>
                                        <p className={`text-xs font-bold ${catMeta.textColors} uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2`}>
                                          {record.category}
                                        </p>

                                        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800">
                                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Qty</span>
                                          <span className="text-xl font-black text-gray-900 dark:text-white leading-none">{record.qty}</span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700 flex flex-col"
            >
              <div className="shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <Box className="text-blue-500" size={28}/>
                  Log Production Entry
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-gray-800">
                {/* 1. Date & Department (Matching Worker Attendance) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800 mb-6">
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Log Date</label>
                     <input
                        type="date"
                        value={logDate}
                        onChange={e => setLogDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Department</label>
                    <div className="flex gap-2">
                      {DEPARTMENTS.map(dept => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setSelectedDeptLog(dept)}
                          className={`flex-1 px-2 py-2 text-xs font-bold rounded-lg transition-all border ${
                            selectedDeptLog === dept
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent shadow-md'
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 font-semibold'
                          }`}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 mb-2">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Box size={16} className="text-gray-400" />
                      Production Output
                    </h4>
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                      {formRows.length} Items Listed
                    </span>
                  </div>

                  <AnimatePresence initial={false}>
                    {formRows.map((row, index) => (
                      <motion.div 
                        key={row.uid}
                        initial={{ opacity: 0, height: 0, y: 20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800 relative group"
                      >
                        <div className="absolute -left-2 -top-2 w-6 h-6 bg-[var(--theme-primary)] text-white font-black text-[10px] flex items-center justify-center rounded-full shadow-sm z-10 border-2 border-white dark:border-gray-800">
                          {index + 1}
                        </div>
                        
                        {formRows.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeRow(row.uid)} 
                            className="absolute right-2 top-2 w-6 h-6 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center rounded-full z-10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={14} />
                          </button>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-5">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Production Name</label>
                            <input
                              type="text"
                              value={row.productionName}
                              onChange={(e) => updateRow(row.uid, 'productionName', e.target.value)}
                              placeholder="e.g., Slim Light Box Module A"
                              className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                            />
                          </div>
                          
                          <div className="md:col-span-5">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Category</label>
                            <div className="flex gap-1.5">
                              {CATEGORIES.map(cat => (
                                <button
                                  key={cat.label}
                                  type="button"
                                  onClick={() => updateRow(row.uid, 'category', cat.label)}
                                  className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 text-[10px] font-bold rounded-lg transition-all border ${
                                    row.category === cat.label
                                      ? `bg-gradient-to-br ${cat.color} text-white border-transparent shadow`
                                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {React.cloneElement(cat.icon as React.ReactElement<any>, { className: 'mb-1 opacity-80', size: 16 })}
                                  <span className="leading-none">{cat.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="md:col-span-2">
                             <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider text-center">Qty</label>
                             <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm flex-1 w-full h-[46px]">
                               <button 
                                 type="button" 
                                 onClick={() => updateRow(row.uid, 'qty', Math.max(1, row.qty - 1))}
                                 className="h-full px-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                               >-</button>
                               <input 
                                 type="number" 
                                 min="1" 
                                 value={row.qty} 
                                 onChange={(e) => updateRow(row.uid, 'qty', parseInt(e.target.value) || 1)}
                                 className="w-full text-center bg-transparent border-0 outline-none text-sm font-black text-gray-900 dark:text-white focus:ring-0 p-0"
                               />
                               <button 
                                 type="button" 
                                 onClick={() => updateRow(row.uid, 'qty', row.qty + 1)}
                                 className="h-full px-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                               >+</button>
                             </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <button 
                    type="button" 
                    onClick={addRow}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                  >
                    <Plus size={16} />
                    Add Another Product
                  </button>

                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-6 flex gap-4 items-center justify-between">
                  <p className="text-sm font-semibold text-gray-500 hidden sm:block">
                     Total Items: <span className="text-gray-900 dark:text-white font-black">{formRows.length}</span>
                  </p>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-sm font-bold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex-1 sm:flex-none">
                      Discard
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={submitting} className="px-8 py-3 text-sm font-black bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_8px_20px_rgba(37,99,235,0.3)] text-white rounded-xl hover:opacity-90 disabled:opacity-70 flex justify-center items-center gap-2 transition-all flex-2 sm:flex-none">
                      {submitting ? <Loader2 className="animate-spin" size={16} /> : <TrendingUp size={16} />} 
                      Submit Production
                    </button>
                  </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setIsDeleteModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-8 border border-gray-100 dark:border-gray-700 text-center"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-100 dark:border-red-900/50">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-3">Delete Entry</h3>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-8 mx-auto leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-1 rounded">{recordToDelete?.productionName}</span>? This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-3 text-sm font-bold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="button" onClick={handleDelete} disabled={submitting} className="flex-1 px-4 py-3 text-sm font-bold bg-red-500 text-white shadow-lg shadow-red-500/30 rounded-xl hover:bg-red-600 disabled:opacity-70 flex justify-center items-center gap-2 transition-all">
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : null} Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
