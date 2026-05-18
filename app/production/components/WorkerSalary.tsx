'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Banknote, CalendarDays, Users, Loader2, Search, X } from 'lucide-react';

interface WorkerData {
  id: string;
  workerName: string;
  department: string;
  salary: string;
  incentive: string;
  gender: string;
  otRate: string;
}

interface AttendanceData {
  id: string;
  date: string;
  workerName: string;
  otHours?: string;
}

export default function WorkerSalary() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const workingDaysInMonth = useMemo(() => {
    return daysInMonth; // Sundays are now included in daily calculation
  }, [daysInMonth]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

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

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isFutureDate = (day: number) => {
    if (year > currentYear) return true;
    if (year === currentYear && month > currentMonth) return true;
    if (year === currentYear && month === currentMonth && day > currentDay) return true;
    return false;
  };

  const passedWorkingDaysCount = useMemo(() => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (!isFutureDate(day)) {
        count++; // Sundays now included in expected count
      }
    }
    return count;
  }, [daysInMonth, isFutureDate]);

  // Derive Daily Base Salary from API's salary field
  const getDailyBase = (salaryStr: string) => {
    const s = Number(salaryStr) || 0;
    if (s > 5000) return Math.round(s / 30);
    return s;
  };

  const groupedWorkers = useMemo(() => {
    const grouped: Record<string, WorkerData[]> = {};
    const filteredWorkers = workers.filter(w => {
      if (!searchQuery) return true;
      return w.workerName.toLowerCase().includes(searchQuery.toLowerCase());
    });
    filteredWorkers.forEach(w => {
      const dept = w.department || 'Unassigned';
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(w);
    });
    return grouped;
  }, [workers, searchQuery]);

  const getAttendanceRecord = (workerName: string, dayOffset: number) => {
    // Use native Date to handle month/year rollovers (e.g. day 0 or day 32)
    const targetDate = new Date(year, month, dayOffset);
    // Format as YYYY-MM-DD in local time to avoid timezone shifts
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    return attendance.find(a => a.workerName === workerName && a.date === dateStr);
  };

  const calculateDaySalary = (worker: WorkerData, day: number) => {
    const record = getAttendanceRecord(worker.workerName, day);
    const dateObj = new Date(year, month, day);
    const isSunday = dateObj.getDay() === 0;
    const baseDaily = getDailyBase(worker.salary);

    if (!record) {
      if (isSunday) {
        // Sandwich Rule: Unpaid if absent on both Saturday and Monday
        const satRecord = getAttendanceRecord(worker.workerName, day - 1);
        const monRecord = getAttendanceRecord(worker.workerName, day + 1);
        
        const isSandwichAbsent = !satRecord && !monRecord;

        if (isSandwichAbsent) {
          return {
            present: false,
            isPaidSunday: false,
            base: 0,
            ot: 0,
            total: 0,
            otHours: 0
          };
        }

        return {
          present: false,
          isPaidSunday: true,
          base: baseDaily,
          ot: 0,
          total: baseDaily,
          otHours: 0
        };
      }
      return { present: false, isPaidSunday: false, base: 0, ot: 0, total: 0, otHours: 0 };
    }

    const otRate = parseFloat(worker.otRate) || 40;
    const otHours = record.otHours ? parseFloat(record.otHours) : 0;
    const otAmount = Math.round(otHours * otRate);

    return {
      present: true,
      isPaidSunday: isSunday,
      base: baseDaily,
      ot: otAmount,
      total: baseDaily + otAmount,
      otHours
    };
  };

  const calculateMonthlyTotals = (worker: WorkerData) => {
    let absentOnWorkingDay = false;
    let absentDaysCount = 0;
    let totalOtAmount = 0;
    const baseDaily = getDailyBase(worker.salary);
    const monthlySalary = Number(worker.salary) || 0;

    for (let day = 1; day <= daysInMonth; day++) {
      if (!isFutureDate(day)) {
        const salaryInfo = calculateDaySalary(worker, day);
        
        // If a day is a working day and they are absent, or if Sunday is unpaid (sandwich absent)
        const dateObj = new Date(year, month, day);
        const isSunday = dateObj.getDay() === 0;

        if (isSunday) {
          if (!salaryInfo.isPaidSunday) {
            absentDaysCount++;
          }
        } else {
          if (!salaryInfo.present) {
            absentDaysCount++;
            absentOnWorkingDay = true;
          }
        }

        if (salaryInfo.present) {
          totalOtAmount += salaryInfo.ot;
        }
      }
    }

    const expected = Math.round((passedWorkingDaysCount / daysInMonth) * monthlySalary);
    const achievedBase = Math.max(0, expected - (absentDaysCount * baseDaily));
    const achieved = achievedBase + totalOtAmount;
    const incentive = (!absentOnWorkingDay && worker.incentive === 'Yes') ? 500 : 0;

    return { expected, achieved, incentive };
  };

  return (
    <div className="space-y-6">
      <div className="relative z-50 flex flex-col sm:flex-row items-center justify-between gap-4 w-full bg-white/60 dark:bg-gray-800/60 p-4 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Banknote size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Worker Salary</h2>
            <p className="text-xs text-gray-500 font-medium">Monthly salary breakdown with OT</p>
          </div>
        </div>

        {/* Searchable Dropdown */}
        <div className="relative flex-1 w-full max-sm sm:mx-6 shrink-0 z-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search worker by name..." 
            className="w-full pl-9 pr-8 py-2.5 text-sm font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none shadow-sm transition-all text-gray-800 dark:text-gray-200"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
          />
          {searchQuery && (
            <button 
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-full transition-colors"
              onClick={() => {
                setSearchQuery('');
                setIsDropdownOpen(false);
              }}
            >
              <X size={12}/>
            </button>
          )}

          {/* Dropdown Menu */}
          {isDropdownOpen && searchQuery && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto overflow-x-hidden">
               {workers.filter(w => w.workerName.toLowerCase().includes(searchQuery.toLowerCase())).map(w => (
                  <div 
                    key={w.id} 
                    className="px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 cursor-pointer flex items-center justify-between transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                    onClick={() => {
                       setSearchQuery(w.workerName);
                       setIsDropdownOpen(false);
                    }}
                  >
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{w.workerName}</span>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-md">{w.department} Dept</span>
                  </div>
               ))}
               {workers.filter(w => w.workerName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-sm text-center text-gray-500 font-medium pb-4">No matching workers found</div>
               )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 bg-gray-50/50 dark:bg-gray-900/30 p-1.5 rounded-xl border border-gray-100 dark:border-gray-800 shrink-0">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePrevMonth}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-700 hover:text-emerald-600 transition-colors"
          >
            <ChevronLeft size={18} />
          </motion.button>
          
          <div className="flex items-center gap-2 px-4 w-40 justify-center">
            <CalendarDays size={16} className="text-emerald-500" />
            <span className="font-bold text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap">
              {monthName}
            </span>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNextMonth}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-700 hover:text-emerald-600 transition-colors"
          >
            <ChevronRight size={18} />
          </motion.button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <Loader2 className="animate-spin text-emerald-600 mb-3" size={32} />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Syncing Salaries with Google Sheets...</p>
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-emerald-900/10 border border-white/60 dark:border-gray-700/30 overflow-hidden">
          <div className="overflow-x-auto max-w-[calc(100vw-3rem)]">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50/80 to-emerald-50/40 dark:from-gray-900/80 dark:to-emerald-900/20 border-b border-gray-200/60 dark:border-gray-700/60">
                  <th className="px-4 py-4 text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest sticky left-0 w-[160px] bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-20 border-r border-gray-200/60 dark:border-gray-700/60 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                    Worker Name
                  </th>
                  <th className="px-4 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest text-center sticky left-[160px] w-[100px] bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-20 border-r border-gray-200/60 dark:border-gray-700/60 shadow-[4px_0_10px_rgba(0,0,0,0.02)]" title="Expected salary till current date">
                    Expected
                  </th>
                  <th className="px-4 py-4 text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest text-center sticky left-[260px] w-[100px] bg-emerald-50/95 dark:bg-emerald-900/95 backdrop-blur-sm z-20 border-r border-emerald-200/60 dark:border-emerald-800/60 shadow-[4px_0_10px_rgba(0,0,0,0.02)]" title="Achieved based on Attendance & OT">
                    Achieved
                  </th>
                  <th className="px-4 py-4 text-xs font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest text-center sticky left-[360px] w-[90px] bg-purple-50/95 dark:bg-purple-900/95 backdrop-blur-sm z-20 border-r border-purple-200/60 dark:border-purple-800/60 shadow-[4px_0_10px_rgba(0,0,0,0.02)]" title="₹500 for perfect attendance">
                    Incentive
                  </th>
                  {days.map(day => {
                    const dateObj = new Date(year, month, day);
                    const dayName = dateObj.toLocaleString('default', { weekday: 'short' });
                    return (
                      <th key={day} className={`px-2 py-3 text-[10px] font-black uppercase tracking-tighter text-center min-w-[65px] border-l border-gray-100/30 dark:border-gray-800/30 ${isFutureDate(day) ? 'text-gray-400/50 dark:text-gray-600/50' : 'text-gray-500 dark:text-gray-400'}`}>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] opacity-60 font-bold">{dayName}</span>
                          <span className="text-xs">{day}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50 border-0">
                {Object.keys(groupedWorkers).map(dept => (
                  <React.Fragment key={dept}>
                    <tr className="bg-gray-100/60 dark:bg-gray-800/60 font-medium">
                      <td className="px-4 py-2 sticky left-0 w-[160px] bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-md z-10 border-r border-gray-200 dark:border-gray-700 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-bold text-sm">
                          <Users size={14} className="text-gray-500" />
                          {dept} Dept
                        </div>
                      </td>
                      <td className="px-4 py-2 sticky left-[160px] w-[100px] bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-md z-10 border-r border-gray-200 dark:border-gray-700 shadow-[4px_0_10px_rgba(0,0,0,0.02)]"></td>
                      <td className="px-4 py-2 sticky left-[260px] w-[100px] bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-md z-10 border-r border-gray-200 dark:border-gray-700 shadow-[4px_0_10px_rgba(0,0,0,0.02)]"></td>
                      <td className="px-4 py-2 sticky left-[360px] w-[90px] bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-md z-10 border-r border-gray-200 dark:border-gray-700 shadow-[4px_0_10px_rgba(0,0,0,0.02)]"></td>
                      <td colSpan={daysInMonth} className="px-2 py-2"></td>
                    </tr>

                    {groupedWorkers[dept].map((worker) => {
                      const baseDaily = getDailyBase(worker.salary);
                      const { expected, achieved, incentive } = calculateMonthlyTotals(worker);

                      return (
                        <tr key={worker.id} className="hover:bg-white/80 dark:hover:bg-gray-700/40 transition-colors">
                          <td className="px-4 py-3 sticky left-0 w-[160px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md z-10 border-r border-gray-100 dark:border-gray-800 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{worker.workerName}</span>
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                <span className="text-[10px] text-gray-500 font-medium leading-none">Month: ₹{Number(worker.salary).toLocaleString()}</span>
                                <span className="text-[10px] text-gray-400 font-normal leading-none">Base: ₹{baseDaily}/d</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 sticky left-[160px] w-[100px] bg-gray-50/90 dark:bg-gray-900/20 backdrop-blur-md z-10 border-r border-gray-200 dark:border-gray-800 font-semibold text-sm text-gray-600 dark:text-gray-400 shadow-[4px_0_10px_rgba(0,0,0,0.02)] text-center">
                            ₹{expected.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 sticky left-[260px] w-[100px] bg-emerald-50/90 dark:bg-emerald-900/20 backdrop-blur-md z-10 border-r border-emerald-100 dark:border-emerald-800/40 font-black text-sm text-emerald-600 dark:text-emerald-400 shadow-[4px_0_10px_rgba(0,0,0,0.02)] text-center">
                            ₹{achieved.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 sticky left-[360px] w-[90px] bg-purple-50/90 dark:bg-purple-900/20 backdrop-blur-md z-10 border-r border-purple-100 dark:border-purple-800/40 font-black text-sm text-purple-600 dark:text-purple-400 shadow-[4px_0_10px_rgba(0,0,0,0.02)] text-center">
                            ₹{incentive}
                          </td>
                          {days.map(day => {
                            const isFuture = isFutureDate(day);
                            const salaryInfo = calculateDaySalary(worker, day);
                            
                            return (
                              <td key={day} className="px-1 py-1 text-center">
                                {isFuture ? (
                                  <div className="mx-auto w-12 py-1.5 text-xs font-medium text-gray-300 dark:text-gray-600">
                                    -
                                  </div>
                                ) : (
                                  <div className={`mx-auto min-w-[3rem] px-2 py-1.5 rounded-lg transition-all flex flex-col justify-center items-center ${
                                    salaryInfo.present || salaryInfo.isPaidSunday
                                      ? salaryInfo.ot > 0 
                                        ? 'bg-emerald-100/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700' 
                                        : 'bg-emerald-50 dark:bg-emerald-900/20 border border-transparent'
                                      : 'bg-red-50 dark:bg-red-900/10 border border-transparent'
                                  }`}>
                                    {salaryInfo.present || salaryInfo.isPaidSunday ? (
                                      <>
                                        <div className="flex items-center gap-1">
                                          <span className={`text-xs font-bold ${salaryInfo.ot > 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            ₹{salaryInfo.total}
                                          </span>
                                          {!salaryInfo.present && salaryInfo.isPaidSunday && (
                                            <span className="text-[10px] font-black text-red-500/80 dark:text-red-400/80">A</span>
                                          )}
                                        </div>
                                        {salaryInfo.ot > 0 && (
                                          <span className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-400/80 -mt-0.5 whitespace-nowrap">
                                            {salaryInfo.base}+{salaryInfo.ot}
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-xs font-bold text-red-500 dark:text-red-400">A</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}

                {Object.keys(groupedWorkers).length === 0 && !loading && (
                   <tr>
                     <td colSpan={daysInMonth + 4} className="px-4 py-8 text-center text-gray-500">
                       No workers found. Add workers in the Worker Information tab.
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
