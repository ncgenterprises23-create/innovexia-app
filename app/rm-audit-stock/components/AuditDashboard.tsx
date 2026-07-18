'use client';

import { useAuditAnalytics } from '../useAuditAnalytics';
import { motion } from 'framer-motion';
import { 
  BarChart3, PackageSearch, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Filter 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, LabelList
} from 'recharts';

const COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  orange: '#f59e0b',
  red: '#ef4444',
  gray: '#9ca3af',
  indigo: '#6366f1'
};

export default function AuditDashboard() {
  const analytics = useAuditAnalytics();

  if (analytics.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Analyzing Audit Data...</h3>
      </div>
    );
  }

  const {
    filters,
    executiveSummary: exec,
    rawMaterialSummary,
    varianceRanking,
    excessStockReport,
    shortageReport,
    perfectMatchReport,
    dailySummary,
    weeklySummary,
    monthlySummary,
    materialAccuracyRanking,
    frequentMismatches,
    largestDifference,
    materialMovementHistory,
    materialHealthScore,
    actionReport
  } = analytics;

  // Reusable card for KPI
  const KpiCard = ({ title, value, subtitle, icon, colorClass }: any) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${colorClass}`}>
        {icon}
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{title}</h4>
        <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">{value}</div>
        {subtitle && <p className="text-xs font-medium text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );

  // Data pre-processing for charts
  const topVariancesForChart = [...varianceRanking].slice(0, 10).map(v => ({
    name: v.rawMaterial.substring(0, 15) + (v.rawMaterial.length > 15 ? '...' : ''),
    Diff: v.diff,
  }));

  const healthScoreDistribution = [
    { name: 'Excellent', value: materialHealthScore.filter(m => m.health.includes('Excellent')).length, color: COLORS.emerald },
    { name: 'Good', value: materialHealthScore.filter(m => m.health.includes('Good')).length, color: COLORS.orange },
    { name: 'Poor', value: materialHealthScore.filter(m => m.health.includes('Poor')).length, color: COLORS.red },
  ].filter(d => d.value > 0);

  // Weekly Trend Chart Data
  const weeklyTrendData = [...weeklySummary].reverse().map(w => ({
    name: w.week,
    Accuracy: w.accuracy,
    'Total Diff': w.totalDiff
  }));

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
          <p className="font-bold text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-gray-600 dark:text-gray-400">{p.name}:</span>
              <span className="font-bold text-gray-900 dark:text-white">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-gray-500 mr-4">
            <Filter size={18} />
            <span className="text-sm font-bold uppercase tracking-wider">Filters</span>
        </div>
        
        <select value={filters.selectedYear} onChange={e => filters.setSelectedYear(e.target.value)} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium outline-none">
            {filters.years.map((y: string) => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
        </select>
        
        <select value={filters.selectedMonth} onChange={e => filters.setSelectedMonth(e.target.value)} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium outline-none">
            {filters.months.map((m: string) => <option key={m} value={m}>{m === 'All' ? 'All Months' : m}</option>)}
        </select>

        <select value={filters.selectedWeek} onChange={e => filters.setSelectedWeek(e.target.value)} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium outline-none">
            {filters.weeks.map((w: string) => <option key={w} value={w}>{w === 'All' ? 'All Weeks' : w}</option>)}
        </select>
        
        <select value={filters.selectedMaterial} onChange={e => filters.setSelectedMaterial(e.target.value)} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium outline-none">
            {filters.materials.map((m: string) => <option key={m} value={m}>{m === 'All' ? 'All Materials' : m}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
            title="Total Difference" 
            value={exec.totalDiff} 
            subtitle="Overall stock variance"
            icon={<BarChart3 size={24} />} 
            colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" 
        />
        <KpiCard 
            title="Overall Accuracy" 
            value={`${exec.accuracy}%`} 
            subtitle="Perfect match ratio"
            icon={<CheckCircle2 size={24} />} 
            colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" 
        />
        <KpiCard 
            title="Excess Stock" 
            value={`+${exec.excessStock}`} 
            subtitle="Total units over-stocked"
            icon={<TrendingUp size={24} />} 
            colorClass="bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" 
        />
        <KpiCard 
            title="Shortage Stock" 
            value={exec.shortageStock} 
            subtitle="Total units under-stocked"
            icon={<TrendingDown size={24} />} 
            colorClass="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" 
        />
      </div>
      
      {/* Visual Analytics Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
        {/* Top Variances Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Top Variances (Live vs Actual)</h3>
          </div>
          <div className="p-4 flex-1 h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topVariancesForChart} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip content={customTooltip} />
                      <Bar dataKey="Diff">
                          <LabelList dataKey="Diff" position="top" fill="#6b7280" fontSize={12} fontWeight="bold" />
                          {topVariancesForChart.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.Diff > 0 ? COLORS.emerald : COLORS.red} />
                          ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Accuracy Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Weekly Accuracy Trend (%)</h3>
          </div>
          <div className="p-4 flex-1 h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                          <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.8}/>
                              <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
                          </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={['auto', 100]} tick={{ fontSize: 12 }} />
                      <RechartsTooltip content={customTooltip} />
                      <Area type="monotone" dataKey="Accuracy" stroke={COLORS.blue} fillOpacity={1} fill="url(#colorAccuracy)">
                          <LabelList dataKey="Accuracy" position="top" fill="#3b82f6" fontSize={12} fontWeight="bold" formatter={(val: any) => val + '%'} />
                      </Area>
                  </AreaChart>
              </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Grid Layout for Tables & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Material Health Score Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Material Health Distribution</h3>
          </div>
          <div className="p-4 flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                      <Pie
                          data={healthScoreDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                      >
                          <LabelList dataKey="value" position="outside" fill="#6b7280" fontSize={12} fontWeight="bold" />
                          {healthScoreDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                      </Pie>
                      <RechartsTooltip content={customTooltip} />
                      <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
              </ResponsiveContainer>
          </div>
        </div>

        {/* Shortage Report Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 flex items-center justify-between">
            <h3 className="font-bold text-red-600 dark:text-red-400">Critical Shortages</h3>
            <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full">{shortageReport.length} Items</span>
          </div>
          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="p-3">Material</th>
                  <th className="p-3">Shortage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {shortageReport.slice(0, 15).map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3 font-semibold text-gray-900 dark:text-white">{s.rawMaterial}</td>
                    <td className="p-3 font-bold text-red-500">{`${s.diff}${s.unit ? ' ' + s.unit : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Excess Report Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-orange-100 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-900/10 flex items-center justify-between">
            <h3 className="font-bold text-orange-600 dark:text-orange-400">Excess Stock</h3>
            <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-full">{excessStockReport.length} Items</span>
          </div>
          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="p-3">Material</th>
                  <th className="p-3">Excess</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {excessStockReport.slice(0, 15).map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3 font-semibold text-gray-900 dark:text-white">{s.rawMaterial}</td>
                    <td className="p-3 font-bold text-orange-500">{`+${s.diff}${s.unit ? ' ' + s.unit : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Raw Material Summary Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Raw Material Ledger</h3>
          </div>
          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="p-3">Material</th>
                  <th className="p-3">Live</th>
                  <th className="p-3">Actual</th>
                  <th className="p-3">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rawMaterialSummary.map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3 font-semibold text-gray-900 dark:text-white">{s.rawMaterial}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{`${s.liveStock}${s.unit ? ' ' + s.unit : ''}`}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{`${s.actualStock}${s.unit ? ' ' + s.unit : ''}`}</td>
                    <td className={`p-3 font-bold ${s.diff > 0 ? 'text-emerald-500' : s.diff < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        {s.diff > 0 ? '+' : ''}{`${s.diff}${s.unit ? ' ' + s.unit : ''}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Management Action Report */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Management Action Report</h3>
          </div>
          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="p-3">Material</th>
                  <th className="p-3">Issue</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {actionReport.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3 font-bold text-gray-900 dark:text-white">{a.material}</td>
                    <td className="p-3 font-semibold text-red-500">{a.issue}</td>
                    <td className="p-3 text-xs font-bold text-gray-500">{a.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Full-width Matrices */}
      <div className="space-y-6">
        
        {/* Weekly Matrix */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Weekly Difference Matrix</h3>
          </div>
          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 shadow-sm z-10">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="p-3 sticky left-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Raw Materials</th>
                  {analytics.weeklyMatrix.weeks.map((week: string) => (
                    <th key={week} className="p-3 text-center">{week}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {analytics.weeklyMatrix.data.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
                      {row.material}
                    </td>
                    {analytics.weeklyMatrix.weeks.map((week: string) => {
                       const raw = row[week];
                       let display = '-';
                       let num: number | null = null;
                       let unit = '';
                       if (raw && typeof raw === 'object' && 'value' in raw) {
                         num = raw.value;
                         unit = raw.unit || '';
                         display = `${num}${unit ? ' ' + unit : ''}`;
                       } else if (typeof raw === 'number') {
                         num = raw;
                         display = String(raw);
                       } else {
                         display = raw;
                       }
                       const color = num === null ? 'text-gray-400' : num > 0 ? 'text-emerald-500 font-bold' : num < 0 ? 'text-red-500 font-bold' : 'text-gray-500';
                       return (
                         <td key={week} className={`p-3 text-center ${color}`}>
                           {display}
                         </td>
                       )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Matrix */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Monthly Difference Matrix</h3>
          </div>
          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 shadow-sm z-10">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="p-3 sticky left-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Raw Materials</th>
                  {analytics.monthlyMatrix.months.map((month: string) => (
                    <th key={month} className="p-3 text-center">{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {analytics.monthlyMatrix.data.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
                      {row.material}
                    </td>
                    {analytics.monthlyMatrix.months.map((month: string) => {
                       const raw = row[month];
                       let display = '-';
                       let num: number | null = null;
                       let unit = '';
                       if (raw && typeof raw === 'object' && 'value' in raw) {
                         num = raw.value;
                         unit = raw.unit || '';
                         display = `${num}${unit ? ' ' + unit : ''}`;
                       } else if (typeof raw === 'number') {
                         num = raw;
                         display = String(raw);
                       } else {
                         display = raw;
                       }
                       const color = num === null ? 'text-gray-400' : num > 0 ? 'text-emerald-500 font-bold' : num < 0 ? 'text-red-500 font-bold' : 'text-gray-500';
                       return (
                         <td key={month} className={`p-3 text-center ${color}`}>
                           {display}
                         </td>
                       )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
