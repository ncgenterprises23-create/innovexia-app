'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarCheck,
  User, 
  Users,
  Calendar,
  Briefcase, 
  Trash2, 
  Plus, 
  X,
  AlertTriangle,
  Loader2,
  Clock,
  ArrowRightLeft,
  ChevronRight,
  Sun,
  Sunset,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface WorkerData {
  id: string;
  workerName: string;
  department: string;
}

interface AttendanceData {
  id: string;
  date: string;
  workerName: string;
  assignedDepartment: string;
  borrowedDepartment: string;
  timeIn: string;
  timeOut: string;
  otHours?: string;
  rowIndex: number;
}

type WorkerStatus = 'Present' | 'Absent' | 'Borrowed';

const DEPARTMENTS = ['Devender', 'Neeraj', 'Rahul'];

const SHIFTS = [
  { label: 'Morning', icon: <Sun size={14}/>, in: '09:00', out: '18:00', color: 'from-amber-400 to-orange-500' },
  { label: 'Evening', icon: <Sunset size={14}/>, in: '10:00', out: '19:00', color: 'from-blue-400 to-indigo-500' }
];

const getTodayDate = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

export default function WorkerAttendance() {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Bulk Form State
  const [logDate, setLogDate] = useState(getTodayDate());
  const [selectedDeptLog, setSelectedDeptLog] = useState(DEPARTMENTS[0]);
  const [shiftType, setShiftType] = useState('Morning'); // 'Morning', 'Evening', 'Custom'
  const [customTimeIn, setCustomTimeIn] = useState('');
  const [customTimeOut, setCustomTimeOut] = useState('');
  const [otHours, setOtHours] = useState('0'); // Acts as "Set All"
  const [workerOTs, setWorkerOTs] = useState<Record<string, string>>({});

  const [selectedViewDept, setSelectedViewDept] = useState(DEPARTMENTS[0]); // For the view filter
  
  // Mapping of workerName -> 'Present' | 'Absent'
  const [workerStatuses, setWorkerStatuses] = useState<Record<string, WorkerStatus>>({});
  // List of extra workers manually borrowed for this department today
  const [borrowedWorkers, setBorrowedWorkers] = useState<WorkerData[]>([]);
  const [showBorrowList, setShowBorrowList] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [workersRes, attRes] = await Promise.all([
        fetch('/api/production/workers'),
        fetch('/api/production/attendance')
      ]);
      const workersData = await workersRes.json();
      const attData = await attRes.json();
      
      if (workersData.workers) setWorkers(workersData.workers);
      if (attData.attendance) setAttendance(attData.attendance);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const currentDeptWorkers = useMemo(() => {
    return workers.filter(w => w.department === selectedDeptLog);
  }, [workers, selectedDeptLog]);

  const otherDeptWorkers = useMemo(() => {
    return workers.filter(w => w.department !== selectedDeptLog && !borrowedWorkers.find(bw => bw.id === w.id));
  }, [workers, selectedDeptLog, borrowedWorkers]);

  const handleOpenModal = () => {
    setLogDate(getTodayDate());
    setSelectedDeptLog(DEPARTMENTS[0]);
    setShiftType('Morning');
    setOtHours('0');
    setBorrowedWorkers([]);
    setShowBorrowList(false);
    
    // Default all workers in first dept to Present and OT 0
    const initialStatus: Record<string, WorkerStatus> = {};
    const initialOTs: Record<string, string> = {};
    workers.filter(w => w.department === DEPARTMENTS[0]).forEach(w => {
      initialStatus[w.workerName] = 'Present';
      initialOTs[w.workerName] = '0';
    });
    setWorkerStatuses(initialStatus);
    setWorkerOTs(initialOTs);

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDeptSelect = (dept: string) => {
    setSelectedDeptLog(dept);
    setBorrowedWorkers([]);
    const newStatus: Record<string, WorkerStatus> = {};
    const newOTs: Record<string, string> = {};
    workers.filter(w => w.department === dept).forEach(w => {
       newStatus[w.workerName] = 'Present';
       newOTs[w.workerName] = '0';
    });
    setWorkerStatuses(newStatus);
    setWorkerOTs(newOTs);
  };

  const toggleWorkerStatus = (workerName: string) => {
    setWorkerStatuses(prev => ({
      ...prev,
      [workerName]: prev[workerName] === 'Present' ? 'Absent' : 'Present'
    }));
  };

  const addBorrowedWorker = (worker: WorkerData) => {
    setBorrowedWorkers([...borrowedWorkers, worker]);
    setWorkerStatuses(prev => ({
      ...prev,
      [worker.workerName]: 'Present'
    }));
    setWorkerOTs(prev => ({
      ...prev,
      [worker.workerName]: '0'
    }));
    setShowBorrowList(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    let timeIn = '';
    let timeOut = '';
    
    if (shiftType === 'Custom') {
      timeIn = customTimeIn;
      timeOut = customTimeOut;
    } else {
      const shift = SHIFTS.find(s => s.label === shiftType);
      if (shift) {
        timeIn = shift.in;
        timeOut = shift.out;
      }
    }

    const recordsToInsert = [];

    // 1. Core workers marked Present
    for (const w of currentDeptWorkers) {
      if (workerStatuses[w.workerName] === 'Present') {
        const workerOT = workerOTs[w.workerName] || '0';
        recordsToInsert.push({
          date: logDate,
          workerName: w.workerName,
          assignedDepartment: w.department,
          borrowedDepartment: '',
          timeIn,
          timeOut,
          otHours: workerOT === '0' ? '' : workerOT
        });
      }
    }

    // 2. Borrowed workers marked Present
    for (const w of borrowedWorkers) {
      if (workerStatuses[w.workerName] === 'Present') {
        const workerOT = workerOTs[w.workerName] || '0';
        recordsToInsert.push({
          date: logDate,
          workerName: w.workerName,
          assignedDepartment: w.department, // Their real dept
          borrowedDepartment: selectedDeptLog, // Where they are today
          timeIn,
          timeOut,
          otHours: workerOT === '0' ? '' : workerOT
        });
      }
    }

    if (recordsToInsert.length === 0) {
      alert("No workers marked present to log!");
      setSubmitting(false);
      return;
    }

    try {
      await fetch('/api/production/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordsToInsert),
      });
      fetchData();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to log bulk attendance', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (record: AttendanceData) => {
    setRecordToDelete(record);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    setSubmitting(true);
    try {
      await fetch(`/api/production/attendance?rowIndex=${recordToDelete.rowIndex}`, {
        method: 'DELETE',
      });
      setAttendance(attendance.filter(a => a.id !== recordToDelete.id));
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Failed to delete attendance', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Removed auto-expand effect as requested

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
      records: AttendanceData[];
      stats: {
        totalCore: number;
        presentCore: number;
        absentCore: number;
        borrowedIn: AttendanceData[];
        borrowedOut: AttendanceData[];
      }
    }[] = [];
    
    const uniqueDates = Array.from(new Set(attendance.map(a => a.date))).sort((a,b) => b.localeCompare(a));
    const coreWorkersCount = workers.filter(w => w.department === selectedViewDept).length;

    uniqueDates.forEach(date => {
      const dateRecords = attendance.filter(a => a.date === date);
      
      // Workers physically present in this department today
      const workingHere = dateRecords.filter(a => (a.borrowedDepartment || a.assignedDepartment) === selectedViewDept);
      
      const presentCoreCount = workingHere.filter(a => a.assignedDepartment === selectedViewDept && !a.borrowedDepartment).length;
      const borrowedIn = workingHere.filter(a => a.borrowedDepartment === selectedViewDept);
      const borrowedOut = dateRecords.filter(a => a.assignedDepartment === selectedViewDept && a.borrowedDepartment && a.borrowedDepartment !== selectedViewDept);
      
      const absentCoreCount = Math.max(0, coreWorkersCount - presentCoreCount - borrowedOut.length);

      if (workingHere.length > 0 || borrowedOut.length > 0) {
        rows.push({
          id: `${date}-${selectedViewDept}`,
          date,
          records: workingHere,
          stats: {
            totalCore: coreWorkersCount,
            presentCore: presentCoreCount,
            absentCore: absentCoreCount,
            borrowedIn,
            borrowedOut
          }
        });
      }
    });
    return rows;
  }, [attendance, selectedViewDept, workers]);

  return (
    <div className="space-y-4">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-2 p-1.5 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-2xl shadow-lg shadow-teal-900/5">
          {DEPARTMENTS.map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedViewDept(dept)}
              className={`relative px-6 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
                selectedViewDept === dept
                  ? 'text-white shadow-md shadow-teal-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
              }`}
            >
              {selectedViewDept === dept && (
                 <motion.div layoutId="activeTabBadge" className="absolute inset-0 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl -z-10" />
              )}
              {dept}
            </button>
          ))}
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-bold rounded-xl shadow-xl shadow-teal-500/20 transition-all border border-teal-500/50"
        >
          <Users size={18} />
          <span>Log Department Bulk</span>
        </motion.button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <Loader2 className="animate-spin text-teal-600 mb-3" size={32} />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Syncing with Google Sheets...</p>
        </div>
      ) : groupedTableDatas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
          <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mb-4">
            <CalendarCheck className="text-teal-600" size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Logs for {selectedViewDept}</h3>
          <p className="text-sm text-gray-500 mb-4">You have not logged any shifts for this department yet.</p>
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
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-teal-900/10 border border-white/60 dark:border-gray-700/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50/80 to-teal-50/40 dark:from-gray-900/80 dark:to-teal-900/20 border-b border-gray-200/60 dark:border-gray-700/60">
                  <th className="px-6 py-4 text-xs font-black text-teal-800/60 dark:text-teal-400/60 uppercase tracking-widest w-16"></th>
                  <th className="px-6 py-4 text-xs font-black text-teal-800/60 dark:text-teal-400/60 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-xs font-black text-teal-800/60 dark:text-teal-400/60 uppercase tracking-widest text-right">Daily Statistics</th>
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
                        className={`cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-gradient-to-r from-teal-50/50 to-white/10 dark:from-teal-900/20 dark:to-transparent border-l-4 border-l-teal-500' : 'hover:bg-white/80 dark:hover:bg-gray-700/40 border-l-4 border-l-transparent'}`}
                      >
                        <td className="px-6 py-5 w-16">
                          <button className={`p-1.5 rounded-lg transition-all duration-300 ${isExpanded ? 'rotate-90 text-teal-600 bg-teal-100/50 dark:bg-teal-900/50 dark:text-teal-400' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <ChevronRight size={18} />
                          </button>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className={`font-bold transition-all duration-300 flex items-center gap-3 ${isExpanded ? 'text-teal-700 dark:text-teal-300 text-base' : 'text-gray-800 dark:text-gray-200 text-sm'}`}>
                            <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                              <Calendar size={16} />
                            </div>
                            {dateFormatted}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right flex justify-end">
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold whitespace-nowrap">
                              <Users size={12} className="opacity-70" /> Total: {stats.totalCore}
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold whitespace-nowrap">
                              <CheckCircle2 size={12} className="opacity-70" /> Present: {stats.presentCore}
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold whitespace-nowrap">
                              <XCircle size={12} className="opacity-70" /> Absent: {stats.absentCore}
                            </span>
                            {stats.borrowedIn.length > 0 && (
                               <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-bold whitespace-nowrap" title={`Borrowed in from: ${Array.from(new Set(stats.borrowedIn.map(b => b.assignedDepartment))).join(', ')}`}>
                                  <ArrowRightLeft size={12} className="opacity-70" /> +{stats.borrowedIn.length} Borrowed In
                               </span>
                            )}
                            {stats.borrowedOut.length > 0 && (
                               <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs font-bold whitespace-nowrap" title={`Sent out to: ${Array.from(new Set(stats.borrowedOut.map(b => b.borrowedDepartment))).join(', ')}`}>
                                  <ArrowRightLeft size={12} className="opacity-70" /> -{stats.borrowedOut.length} Sent Out
                               </span>
                            )}
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
                                  {row.records.map((record, idx) => (
                                    <div
                                      key={record.id}
                                      className="min-w-[220px] max-w-[240px] flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-2xl p-4 shadow-xl shadow-gray-200/50 dark:shadow-none border border-white dark:border-gray-700 relative overflow-hidden z-10 transition-transform hover:-translate-y-1"
                                    >
                                      <div className="flex items-start justify-between mb-3 relative z-10">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 font-bold text-xs shrink-0">
                                            {record.workerName.charAt(0).toUpperCase()}
                                          </div>
                                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate pr-2" title={record.workerName}>
                                            {record.workerName}
                                          </h4>
                                        </div>
                                        <button
                                          onClick={() => handleOpenDeleteModal(record)}
                                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors shrink-0"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>

                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <Clock size={12} className="text-emerald-500" />
                                          <span className="text-xs text-gray-600 dark:text-gray-400">In:</span>
                                          <span className="text-xs font-bold text-gray-900 dark:text-white ml-auto">{record.timeIn}</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                                          <Clock size={12} className="text-blue-500" />
                                          <span className="text-xs text-gray-600 dark:text-gray-400">Out:</span>
                                          <span className="text-xs font-bold text-gray-900 dark:text-white ml-auto">{record.timeOut}</span>
                                        </div>
                                      </div>
                                      
                                      {/* Badges for OT and Borrowed */}
                                      <div className="flex gap-2 mt-3 flex-wrap">
                                        {record.otHours && record.otHours !== '0' && (
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                                            <Clock size={10} /> OT: {record.otHours} hr
                                          </span>
                                        )}
                                        {record.borrowedDepartment && (
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-[10px] font-bold uppercase tracking-wider" title={`Borrowed from ${record.assignedDepartment}`}>
                                            <ArrowRightLeft size={10} /> From {record.assignedDepartment}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
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
              onClick={handleCloseModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col"
            >
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="text-teal-500" size={22}/>
                  Bulk Log Department
                </h3>
                <button onClick={handleCloseModal} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-6">

                {/* 1. Date & Department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Log Date</label>
                     <input
                        type="date"
                        value={logDate}
                        onChange={e => setLogDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Department</label>
                    <div className="flex gap-2">
                      {DEPARTMENTS.map(dept => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => handleDeptSelect(dept)}
                          className={`flex-1 px-2 py-2 text-xs font-bold rounded-lg transition-all border ${
                            selectedDeptLog === dept
                              ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-transparent shadow-md'
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Timing Buttons */}
                <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Shift Timing</label>
                    <div className="flex gap-2 flex-wrap">
                      {SHIFTS.map(shift => (
                         <button
                           key={shift.label}
                           type="button"
                           onClick={() => setShiftType(shift.label)}
                           className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all border ${
                             shiftType === shift.label
                               ? 'bg-gradient-to-r ' + shift.color + ' text-white border-transparent shadow'
                               : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                           }`}
                         >
                           {shift.icon}
                           {shift.label} ({shift.in} - {shift.out})
                         </button>
                      ))}
                      <button
                           type="button"
                           onClick={() => setShiftType('Custom')}
                           className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all border ${
                             shiftType === 'Custom'
                               ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow'
                               : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                           }`}
                         >
                           <Clock size={14} />
                           Custom
                      </button>
                    </div>
                  </div>

                  {shiftType === 'Custom' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Time In</label>
                        <input type="time" value={customTimeIn} onChange={e => setCustomTimeIn(e.target.value)} className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 rounded-lg outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Time Out</label>
                        <input type="time" value={customTimeOut} onChange={e => setCustomTimeOut(e.target.value)} className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 rounded-lg outline-none" />
                      </div>
                    </motion.div>
                  )}

                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Set Universal OT (For all Present workers)</label>
                     <div className="flex gap-2 flex-wrap">
                       {['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4'].map(hrs => (
                         <button
                           key={hrs}
                           type="button"
                           onClick={() => {
                             setOtHours(hrs);
                             // Update all workerOTs for workers marked present
                             const updatedOTs = { ...workerOTs };
                             [...currentDeptWorkers, ...borrowedWorkers].forEach(w => {
                               if (workerStatuses[w.workerName] === 'Present') {
                                 updatedOTs[w.workerName] = hrs;
                               }
                             });
                             setWorkerOTs(updatedOTs);
                           }}
                           className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all border ${
                             otHours === hrs
                               ? 'bg-purple-600 text-white border-transparent shadow-md'
                               : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                           }`}
                         >
                           {hrs === '0' ? 'No OT' : hrs === '0.5' ? '+30 min' : hrs.includes('.5') ? `+${Math.floor(parseFloat(hrs))}h 30m` : `+${hrs} hr`}
                         </button>
                       ))}
                     </div>
                  </div>
                </div>

                {/* 3. Workers Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Briefcase size={16} className="text-gray-400" />
                      {selectedDeptLog} Workers
                    </h4>
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                      {currentDeptWorkers.length + borrowedWorkers.length} Total
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                    {[...currentDeptWorkers, ...borrowedWorkers].map(worker => {
                      const isBorrowed = worker.department !== selectedDeptLog;
                      const status = workerStatuses[worker.workerName];
                      const isPresent = status === 'Present';

                      return (
                         <div key={worker.id} className={`flex flex-col p-2.5 rounded-xl border transition-all ${isPresent ? 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800/40' : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 opacity-60'}`}>
                           {/* Top Row: Avatar & Name */}
                           <div className="flex items-center gap-2 mb-2">
                             <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${isPresent ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'}`}>
                               {worker.workerName.charAt(0)}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className={`font-bold text-xs truncate ${isPresent ? 'text-teal-900 dark:text-teal-100' : 'text-gray-500 line-through'}`}>
                                 {worker.workerName}
                               </p>
                               {isBorrowed && (
                                 <p className="text-[9px] text-orange-600 font-bold truncate leading-tight">From {worker.department}</p>
                               )}
                             </div>
                           </div>
                           
                           {/* Bottom Row: OT Selector & Status Toggle */}
                           <div className="flex items-center justify-between gap-2">
                             <div className="flex-1 min-w-0">
                               {isPresent && (
                                 <select
                                   value={workerOTs[worker.workerName] || '0'}
                                   onChange={(e) => setWorkerOTs(prev => ({ ...prev, [worker.workerName]: e.target.value }))}
                                   className="w-full text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-teal-500 transition-all text-teal-700 dark:text-teal-400 h-7"
                                 >
                                   {['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4'].map(h => (
                                     <option key={h} value={h}>
                                       {h === '0' ? 'No OT' : h === '0.5' ? '30 min OT' : h.includes('.5') ? `${Math.floor(parseFloat(h))}h 30m OT` : `${h} hr OT`}
                                     </option>
                                   ))}
                                 </select>
                               )}
                             </div>

                             <button
                               type="button"
                               onClick={() => toggleWorkerStatus(worker.workerName)}
                               className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-black transition-all h-7 ${
                                 isPresent 
                                   ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-sm' 
                                   : 'bg-white text-gray-400 hover:bg-gray-50 border border-gray-100'
                               }`}
                             >
                               {isPresent ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                               {isPresent ? 'PRESENT' : 'ABSENT'}
                             </button>
                           </div>
                         </div>
                      )
                    })}

                    {currentDeptWorkers.length === 0 && borrowedWorkers.length === 0 && (
                      <div className="col-span-full py-6 text-center text-gray-500 text-sm">
                        No workers in this department.
                      </div>
                    )}
                  </div>

                  {/* Add Borrowed Worker Button */}
                  <div className="mt-4">
                    {!showBorrowList ? (
                       <button type="button" onClick={() => setShowBorrowList(true)} className="flex items-center gap-1 text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors">
                         <Plus size={14} /> Add borrowed worker
                       </button>
                    ) : (
                       <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-200 dark:border-orange-900/30">
                         <div className="flex items-center justify-between mb-3">
                           <h5 className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase">Select Worker to Borrow</h5>
                           <button type="button" onClick={() => setShowBorrowList(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                         </div>
                         {otherDeptWorkers.length > 0 ? (
                           <div className="flex gap-2 flex-wrap">
                             {otherDeptWorkers.map(w => (
                               <button
                                 key={w.id}
                                 type="button"
                                 onClick={() => addBorrowedWorker(w)}
                                 className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 text-xs font-semibold rounded-lg hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm"
                               >
                                 {w.workerName} ({w.department})
                               </button>
                             ))}
                           </div>
                         ) : (
                           <p className="text-xs text-gray-500">No other workers available to borrow.</p>
                         )}
                       </motion.div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shrink-0 flex gap-3">
                  <button type="button" onClick={handleCloseModal} className="flex-1 px-5 py-2.5 text-sm font-semibold bg-gray-200 dark:bg-gray-700 rounded-xl hover:bg-gray-300 text-gray-700 dark:text-white transition-all">Cancel</button>
                  <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-2 px-8 py-2.5 text-sm font-bold bg-teal-600 shadow-[0_4px_14px_0_rgba(13,148,136,0.39)] text-white rounded-xl hover:bg-teal-700 disabled:opacity-70 flex justify-center items-center gap-2 transition-all">
                    {submitting ? <Loader2 className="animate-spin" size={14} /> : null} Submit Department Attendance
                  </button>
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
              className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-red-100 text-center"
            >
              <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-500" size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Shift</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 mx-auto">
                Remove log for <span className="font-bold text-gray-700 dark:text-gray-200">"{recordToDelete?.workerName}"</span>? This will permanently erase this row.
              </p>

              <div className="flex gap-2">
                <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-semibold bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="button" onClick={handleDelete} disabled={submitting} className="flex-1 px-4 py-2 text-sm font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-70 flex justify-center items-center gap-2">
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
