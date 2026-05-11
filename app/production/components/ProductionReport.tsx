'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Users, 
  TrendingUp, 
  IndianRupee, 
  Package, 
  Calendar,
  Filter,
  ArrowRight,
  TrendingDown,
  Info,
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, parseISO, isWithinInterval, addDays } from 'date-fns';

interface WorkerData {
  id: string;
  workerName: string;
  department: string;
  salary: string;
  gender: string;
  otRate: string;
}

interface AttendanceData {
  date: string;
  workerName: string;
  assignedDepartment: string;
  borrowedDepartment: string;
  otHours: string;
}

interface ProductionData {
  date: string;
  department: string;
  productionName: string;
  qty: number;
}

const DEPARTMENTS = ['Devender', 'Neeraj', 'Rahul'];

// Helper: Calculate working days in a month (Total days - Sundays)
const getWorkingDaysInMonth = (dateStr: string) => {
  const date = parseISO(dateStr);
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const days = eachDayOfInterval({ start, end });
  return days.length; // Now includes Sundays
};

export default function ProductionReport() {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData[]>([]);
  const [production, setProduction] = useState<ProductionData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<'all' | 'working' | 'assigned'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('All');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [workersRes, attRes, prodRes] = await Promise.all([
        fetch('/api/production/workers'),
        fetch('/api/production/attendance'),
        fetch('/api/production/daily-production')
      ]);
      const workersData = await workersRes.json();
      const attData = await attRes.json();
      const prodData = await prodRes.json();
      
      if (workersData.workers) setWorkers(workersData.workers);
      if (attData.attendance) setAttendance(attData.attendance);
      if (prodData.production) setProduction(prodData.production);
    } catch (error) {
      console.error('Failed to fetch report data', error);
    } finally {
      setLoading(false);
    }
  };

  const reportData = useMemo(() => {
    const range = { start: parseISO(fromDate), end: parseISO(toDate) };
    
    // 1. Group Attendance by Date and Dept
    const dailyStats: any = {};
    let ownWorkersInDept = 0;
    let borrowedWorkersInDept = 0;
    let ownCostInDept = 0;
    let borrowedCostInDept = 0;

    // 1. Calculate costs for each day in range (including Sundays)
    const daysInRange = eachDayOfInterval(range);
    
    daysInRange.forEach(dateObj => {
      const dateKey = format(dateObj, 'yyyy-MM-dd');
      const isSun = isSunday(dateObj);

      if (isSun) {
        // For Sundays, everyone gets paid their daily wage in their assigned dept
        workers.forEach(w => {
          const activeDept = w.department;
          if (selectedDept !== 'All' && activeDept !== selectedDept) return;
          if (filterType !== 'all' && filterType !== 'assigned') return; 

          // Sandwich Rule Check
          const satDate = format(addDays(dateObj, -1), 'yyyy-MM-dd');
          const monDate = format(addDays(dateObj, 1), 'yyyy-MM-dd');
          
          const satPresent = attendance.some(a => a.workerName === w.workerName && a.date === satDate);
          const monPresent = attendance.some(a => a.workerName === w.workerName && a.date === monDate);

          if (!satPresent && !monPresent) {
            // Unpaid Sunday due to sandwich absence
            return;
          }

          if (!dailyStats[dateKey]) dailyStats[dateKey] = {};
          if (!dailyStats[dateKey][activeDept]) {
            dailyStats[dateKey][activeDept] = { workersCount: 0, totalCost: 0, unitsProduced: 0, products: new Set() };
          }

          const workingDays = getWorkingDaysInMonth(dateKey);
          const monthlySalary = parseFloat(w.salary) || 0;
          const dailyWage = monthlySalary / workingDays;
          
          dailyStats[dateKey][activeDept].totalCost += dailyWage;
          ownCostInDept += dailyWage;
        });
      } else {
        // For non-Sundays, use attendance records
        const dateAtts = attendance.filter(a => a.date === dateKey);
        dateAtts.forEach(att => {
          const isBorrowed = att.borrowedDepartment && att.borrowedDepartment !== att.assignedDepartment;
          const activeDept = att.borrowedDepartment || att.assignedDepartment;

          if (selectedDept !== 'All' && activeDept !== selectedDept) return;

          const passesWorkforceFilter = 
            filterType === 'all' ||
            (filterType === 'assigned' && !isBorrowed) ||
            (filterType === 'working' && isBorrowed);

          if (!passesWorkforceFilter) return;

          if (!dailyStats[dateKey]) dailyStats[dateKey] = {};
          if (!dailyStats[dateKey][activeDept]) {
            dailyStats[dateKey][activeDept] = { workersCount: 0, totalCost: 0, unitsProduced: 0, products: new Set() };
          }

          const workerInfo = workers.find(w => w.workerName === att.workerName);
          if (workerInfo) {
            const workingDays = getWorkingDaysInMonth(dateKey);
            const monthlySalary = parseFloat(workerInfo.salary) || 0;
            const dailyWage = monthlySalary / workingDays;
            const otRate = parseFloat(workerInfo.otRate) || 40;
            const otHours = parseFloat(att.otHours) || 0;
            const totalCost = dailyWage + (otRate * otHours);

            dailyStats[dateKey][activeDept].workersCount += 1;
            dailyStats[dateKey][activeDept].totalCost += totalCost;

            if (isBorrowed) {
              borrowedWorkersInDept += 1;
              borrowedCostInDept += totalCost;
            } else {
              ownWorkersInDept += 1;
              ownCostInDept += totalCost;
            }
          }
        });
      }
    });

    // 2. Add Production quantities
    production.forEach(prod => {
      const prodDate = parseISO(prod.date);
      if (isWithinInterval(prodDate, range)) {
        if (selectedDept !== 'All' && prod.department !== selectedDept) return;

        if (!dailyStats[prod.date]) dailyStats[prod.date] = {};
        if (!dailyStats[prod.date][prod.department]) {
           dailyStats[prod.date][prod.department] = { workersCount: 0, totalCost: 0, unitsProduced: 0, products: new Set() };
        }
        dailyStats[prod.date][prod.department].unitsProduced += prod.qty;
        dailyStats[prod.date][prod.department].products.add(prod.productionName);
      }
    });

    // 3. Final Aggregation
    const tableRows: any[] = [];
    const deptTotals: any = {};
    const relevantDepts = selectedDept === 'All' ? DEPARTMENTS : [selectedDept];
    relevantDepts.forEach(d => deptTotals[d] = { units: 0, cost: 0 });

    Object.entries(dailyStats).forEach(([date, depts]: [string, any]) => {
      Object.entries(depts).forEach(([dept, stats]: [string, any]) => {
        const costPerUnit = stats.unitsProduced > 0 ? stats.totalCost / stats.unitsProduced : 0;
        tableRows.push({
          date,
          department: dept,
          workersPresent: stats.workersCount,
          totalSalary: stats.totalCost,
          productsMade: Array.from(stats.products).join(', '),
          totalQuantity: stats.unitsProduced,
          costPerUnit: costPerUnit
        });

        if (deptTotals[dept]) {
          deptTotals[dept].units += stats.unitsProduced;
          deptTotals[dept].cost += stats.totalCost;
        }
      });
    });

    const chartProduction = relevantDepts.map(d => ({
      name: d,
      units: deptTotals[d].units,
      cost: deptTotals[d].cost,
      costPerUnit: deptTotals[d].units > 0 ? deptTotals[d].cost / deptTotals[d].units : 0
    }));

    const totalWorkers = tableRows.reduce((acc, row) => acc + row.workersPresent, 0);
    const totalCost = tableRows.reduce((acc, row) => acc + row.totalSalary, 0);
    const totalUnits = tableRows.reduce((acc, row) => acc + row.totalQuantity, 0);
    const avgCostPerUnit = totalUnits > 0 ? totalCost / totalUnits : 0;

    return {
      tableRows: tableRows.sort((a,b) => b.date.localeCompare(a.date)),
      chartProduction,
      summary: { 
        totalWorkers, 
        totalCost, 
        totalUnits, 
        avgCostPerUnit,
        ownWorkersInDept,
        borrowedWorkersInDept,
        ownCostInDept,
        borrowedCostInDept
      }
    };
  }, [fromDate, toDate, filterType, selectedDept, workers, attendance, production]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* 1. Ultra-Compact Single Row Header */}
      <div className="flex flex-wrap items-center gap-4 bg-white/40 dark:bg-gray-800/40 p-4 rounded-[2rem] border border-white dark:border-gray-700/50 shadow-sm backdrop-blur-md">
        
        {/* Date Inputs - Ultra Compact */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100/50 dark:bg-gray-900/40 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="w-32 bg-transparent text-xs font-black outline-none dark:text-white"
          />
          <ArrowRight size={14} className="text-gray-400" />
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="w-32 bg-transparent text-xs font-black outline-none dark:text-white"
          />
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden lg:block"></div>

        {/* Department Buttons - LARGER & Colorful */}
        <div className="flex items-center gap-2">
          {['All', ...DEPARTMENTS].map((dept) => {
            const isActive = selectedDept === dept;
            const getDeptStyle = (d: string) => {
               if (d === 'All') return isActive 
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-xl' 
                : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600';
               if (d === 'Devender') return isActive 
                ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/40' 
                : 'bg-blue-100/50 dark:bg-blue-900/30 text-blue-500 hover:bg-blue-100';
               if (d === 'Neeraj') return isActive 
                ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/40' 
                : 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-500 hover:bg-emerald-100';
               if (d === 'Rahul') return isActive 
                ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/40' 
                : 'bg-amber-100/50 dark:bg-amber-900/30 text-amber-500 hover:bg-amber-100';
               return '';
            };

            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all duration-300 transform active:scale-95 ${getDeptStyle(dept)}`}
              >
                {dept.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Contextual Toggle - LARGER (All / Own / Borrowed) */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex p-1.5 bg-white/60 dark:bg-gray-900/60 rounded-[1.2rem] border border-gray-200/50 dark:border-gray-800/50 shadow-inner">
            <button
              onClick={() => setFilterType('all')}
              className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all duration-300 ${
                filterType === 'all'
                  ? 'bg-white dark:bg-gray-700 text-[var(--theme-primary)] shadow-md'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterType('assigned')}
              className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all duration-300 ${
                filterType === 'assigned'
                  ? 'bg-white dark:bg-gray-700 text-[var(--theme-primary)] shadow-md'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              OWN
            </button>
            <button
              onClick={() => setFilterType('working')}
              className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all duration-300 ${
                filterType === 'working'
                  ? 'bg-white dark:bg-gray-700 text-[var(--theme-primary)] shadow-md'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              BORROWED
            </button>
          </div>
        </div>
      </div>

      {/* 2. Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'Total Workers', 
            value: reportData.summary.totalWorkers, 
            icon: Users, 
            color: 'from-blue-500 to-indigo-600', 
            sub: selectedDept === 'All' 
              ? 'Present in period' 
              : `${reportData.summary.ownWorkersInDept} Own / ${reportData.summary.borrowedWorkersInDept} Borrowed`,
            split: selectedDept !== 'All' ? { own: reportData.summary.ownWorkersInDept, borrowed: reportData.summary.borrowedWorkersInDept } : null
          },
          { 
            label: 'Total Cost', 
            value: `₹${reportData.summary.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
            icon: IndianRupee, 
            color: 'from-emerald-500 to-teal-600', 
            sub: selectedDept === 'All' 
              ? 'Salary + OT' 
              : `Own: ₹${reportData.summary.ownCostInDept.toLocaleString()} | Brwd: ₹${reportData.summary.borrowedCostInDept.toLocaleString()}` 
          },
          { label: 'Total Units', value: reportData.summary.totalUnits.toLocaleString(), icon: Package, color: 'from-amber-400 to-orange-500', sub: 'Production Output' },
          { label: 'Avg Cost/Unit', value: `₹${reportData.summary.avgCostPerUnit.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`, icon: TrendingUp, color: 'from-purple-500 to-pink-600', sub: 'Efficiency Metric' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`relative p-5 rounded-3xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/40 dark:shadow-none group`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-[0.03] group-hover:opacity-10 rounded-full -mr-12 -mt-12 transition-all duration-500 group-hover:scale-150`}></div>
            <div className="flex flex-col gap-3 relative z-10">
              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg shadow-${stat.color.split('-')[1]}-500/20`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">{stat.value}</p>
                </div>
                
                {/* Visual indicator for workforce split */}
                {stat.split && (
                  <div className="flex h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden my-2 border border-gray-100 dark:border-gray-800">
                    <div 
                      className="bg-indigo-500 h-full transition-all duration-500" 
                      style={{ width: `${(stat.split.own / (stat.split.own + stat.split.borrowed)) * 100}%` }}
                    ></div>
                    <div 
                      className="bg-orange-500 h-full transition-all duration-500" 
                      style={{ width: `${(stat.split.borrowed / (stat.split.own + stat.split.borrowed)) * 100}%` }}
                    ></div>
                  </div>
                )}

                <div className="flex items-center gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                   <p className="text-[10px] font-bold text-gray-400">{stat.sub}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 3. Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Chart */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/30 dark:shadow-none">
          <div className="flex items-center justify-between mb-8">
             <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Production by Department</h3>
                <p className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-wider">Total Units Output</p>
             </div>
             <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl shadow-inner border border-amber-200/50">
                <Package size={20} />
             </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.chartProduction}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                   cursor={{ fill: 'rgba(239, 246, 255, 0.5)' }}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="units" radius={[10, 10, 0, 0]} barSize={40}>
                  {reportData.chartProduction.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Analysis Chart */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/30 dark:shadow-none">
          <div className="flex items-center justify-between mb-8">
             <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Cost Efficiency Analysis</h3>
                <p className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-wider">₹ Cost Per Unit per department</p>
             </div>
             <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-inner border border-indigo-200/50">
                <TrendingUp size={20} />
             </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={reportData.chartProduction}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Area type="monotone" dataKey="costPerUnit" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Detailed Table */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/30 dark:shadow-none overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Detailed Statistics</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5 ml-0.5">Daily breakdown by department</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl text-xs font-bold shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-colors">
             Export Data
             <ChevronDown size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/30">
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Department</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Present</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Total Cost</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Production</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Qty</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest text-right">Cost/Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {reportData.tableRows.map((row, i) => (
                <tr key={`${row.date}-${row.department}`} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/40 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-xs font-black text-gray-900 dark:text-white">{format(parseISO(row.date), 'dd MMM yyyy')}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider ${
                      row.department === 'Devender' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                      row.department === 'Neeraj' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                    }`}>
                      {row.department}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600 dark:text-gray-400">
                    {row.workersPresent}
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-gray-900 dark:text-white">
                    ₹{row.totalSalary.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col max-w-[200px]">
                       <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate" title={row.productsMade}>
                          {row.productsMade || '-'}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-indigo-600 dark:text-indigo-400">
                    {row.totalQuantity}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 font-black text-xs">
                       <span className={row.costPerUnit > reportData.summary.avgCostPerUnit ? 'text-red-500' : 'text-emerald-500'}>
                          ₹{row.costPerUnit.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                       </span>
                       {row.costPerUnit > 0 && (
                         row.costPerUnit > reportData.summary.avgCostPerUnit ? <TrendingUp size={12} className="text-red-400" /> : <TrendingDown size={12} className="text-emerald-400" />
                       )}
                    </div>
                  </td>
                </tr>
              ))}
              {reportData.tableRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                       <FileText size={48} />
                       <p className="text-lg font-black uppercase tracking-widest">No Data Found</p>
                       <p className="text-xs font-bold">Try adjusting the filter range</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
