'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart, PieChart, Pie, Cell, Area, AreaChart, LabelList
} from 'recharts';
import { 
  Activity, ArrowUpRight, ArrowDownRight, Package, Scale, 
  CalendarDays, TrendingUp, AlertCircle, Hash, Zap
} from 'lucide-react';
import { useScrapAnalytics, ScrapRow } from '../useScrapAnalytics';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

export default function ScrapDashboard({ data }: { data: ScrapRow[] }) {
  const [filters, setFilters] = useState({
    year: '',
    quarter: '',
    month: '',
    week: '',
    date: '',
    item: ''
  });

  const {
    kpis,
    trends,
    itemRanking,
    paretoData,
    heatmapData,
    heatmapDays,
    insights
  } = useScrapAnalytics(data, filters);

  const [activeTrend, setActiveTrend] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly');

  // Helper for heatmap colors (light green to dark green)
  const getHeatmapColor = (val: number, max: number) => {
    if (!val) return 'bg-gray-50 dark:bg-gray-800/50';
    const intensity = Math.max(0.1, val / max);
    // return rgba string
    return `rgba(16, 185, 129, ${intensity})`; // Emerald 500 base
  };

  const heatmapMax = Math.max(...heatmapData.map(r => Math.max(...heatmapDays.map(d => r[d] || 0))));

  // Filter Unique Options
  const years = Array.from(new Set(data.map(d => d.Year))).filter(Boolean);
  const months = Array.from(new Set(data.map(d => d.Month))).filter(Boolean);
  const items = Array.from(new Set(data.map(d => d['Item Description']))).filter(Boolean);

  return (
    <div className="space-y-6">
      
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500 uppercase">Filters:</span>
        </div>
        <select 
          value={filters.year} 
          onChange={(e) => setFilters({...filters, year: e.target.value})}
          className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select 
          value={filters.month} 
          onChange={(e) => setFilters({...filters, month: e.target.value})}
          className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select 
          value={filters.item} 
          onChange={(e) => setFilters({...filters, item: e.target.value})}
          className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All Items</option>
          {items.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <button 
          onClick={() => setFilters({ year: '', quarter: '', month: '', week: '', date: '', item: '' })}
          className="text-xs font-semibold text-red-500 hover:text-red-600 px-2"
        >
          Clear Filters
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Weight', value: `${kpis.totalWeight.toLocaleString()} kg`, icon: <Scale size={20} />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'Total Qty', value: kpis.totalQty.toLocaleString(), icon: <Hash size={20} />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Avg Weight / Day', value: `${kpis.avgScrapPerDay.toFixed(1)} kg`, icon: <Activity size={20} />, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
          { label: "Today's Scrap", value: `${kpis.todayScrap.toLocaleString()} kg`, icon: <CalendarDays size={20} />, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
          { label: 'Highest Day', value: `${kpis.highestScrapDay.weight} kg`, icon: <TrendingUp size={20} />, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', sub: kpis.highestScrapDay.date },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{kpi.label}</p>
              <div className={`p-1.5 rounded-lg ${kpi.bg} ${kpi.color}`}>
                {kpi.icon}
              </div>
            </div>
            <div className="mt-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid 1: Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend Chart */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Scrap Trend Analysis</h2>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              {['daily', 'weekly', 'monthly', 'quarterly'].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTrend(t as any)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize ${activeTrend === t ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <ComposedChart data={trends[activeTrend]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey={activeTrend === 'daily' ? 'date' : 'name'} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="weight" name="Weight (kg)" fill="#10B981" radius={[4,4,0,0]}>
                  <LabelList dataKey="weight" position="top" style={{ fill: '#4B5563', fontSize: 10 }} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="qty" name="Quantity" stroke="#3B82F6" strokeWidth={3} dot={false}>
                  <LabelList dataKey="qty" position="top" style={{ fill: '#3B82F6', fontSize: 10 }} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pareto Chart */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Pareto Analysis (80/20)</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <ComposedChart data={paretoData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="weight" name="Weight (kg)" fill="#F59E0B" radius={[4,4,0,0]}>
                  <LabelList dataKey="weight" position="top" style={{ fill: '#4B5563', fontSize: 10 }} />
                </Bar>
                <Line yAxisId="right" type="step" dataKey="cumulativePercent" name="Cumulative %" stroke="#EF4444" strokeWidth={3} dot={true}>
                  <LabelList dataKey="cumulativePercent" position="top" formatter={(val: any) => `${Math.round(val)}%`} style={{ fill: '#EF4444', fontSize: 10 }} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Grid 2: Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Top Scrap Types</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={itemRanking.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="weight" name="Weight (kg)" fill="#3B82F6" radius={[0,4,4,0]}>
                  <LabelList dataKey="weight" position="right" style={{ fill: '#4B5563', fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Scrap Contribution</h2>
          <div className="h-64 w-full flex items-center justify-center relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={itemRanking.slice(0, 5)} // Top 5 for cleaner pie
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="weight"
                >
                  {itemRanking.slice(0,5).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList dataKey="weight" position="outside" style={{ fill: '#4B5563', fontSize: 10 }} />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="text-xs text-gray-500 font-semibold">Total</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{kpis.totalWeight}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap & Smart Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Heatmap */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm lg:col-span-3 overflow-x-auto">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Daily Heat Map (Last {heatmapDays.length} Active Days)</h2>
          <div className="min-w-[600px]">
             {/* Header Row */}
             <div className="flex mb-4 h-16 items-end">
                <div className="w-32 flex-shrink-0"></div>
                {heatmapDays.map(date => {
                  const d = new Date(date);
                  const formatted = isNaN(d.getTime()) ? date.split('T')[0] : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                  return (
                    <div key={date} className="flex-1 text-center relative h-full">
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 -rotate-45 origin-bottom-left text-xs font-semibold text-gray-400 whitespace-nowrap">
                        {formatted}
                      </div>
                    </div>
                  );
                })}
             </div>
             {/* Matrix Rows */}
             {heatmapData.map((row) => (
               <div key={row.item} className="flex items-center gap-1 mb-1">
                 <div className="w-32 flex-shrink-0 text-xs font-semibold text-gray-700 dark:text-gray-300 truncate pr-2">
                   {row.item}
                 </div>
                 {heatmapDays.map(date => (
                   <div 
                     key={`${row.item}-${date}`} 
                     className="flex-1 h-8 rounded border border-gray-100 dark:border-gray-800 flex items-center justify-center group relative cursor-pointer transition-transform hover:scale-110"
                     style={{ backgroundColor: getHeatmapColor(row[date], heatmapMax) }}
                   >
                      {row[date] > 0 && (
                        <span className="text-[10px] font-bold text-emerald-950 dark:text-emerald-950/80 pointer-events-none">
                          {row[date]}
                        </span>
                      )}
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none shadow-md">
                        {row[date] ? `${row[date]} kg` : '0 kg'}
                      </div>
                   </div>
                 ))}
               </div>
             ))}
          </div>
        </div>

        {/* Smart Insights */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="text-amber-500" size={20} />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Smart Insights</h2>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto">
            {insights.map((insight, i) => (
              <div key={i} className="flex gap-3 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-100 dark:border-amber-500/20">
                <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{insight}</p>
              </div>
            ))}
            {insights.length === 0 && (
                <p className="text-sm text-gray-500 text-center mt-10">Not enough data to generate insights.</p>
            )}
          </div>
        </div>
      </div>

      {/* Item Ranking Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Management Summary Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rank</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scrap Item</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Total Qty</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Total Weight</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Avg Weight/Entry</th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">% Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {itemRanking.map((item) => (
                <tr key={item.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
                  <td className="p-4 text-sm font-bold text-gray-900 dark:text-white">#{item.rank}</td>
                  <td className="p-4 text-sm font-medium text-gray-900 dark:text-white">
                     <div className="flex items-center gap-2">
                        <Package size={16} className="text-gray-400" />
                        {item.name}
                     </div>
                  </td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-300 text-right">{item.qty}</td>
                  <td className="p-4 text-sm font-semibold text-gray-900 dark:text-white text-right">{item.weight} kg</td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-300 text-right">{item.avgWeight.toFixed(1)} kg</td>
                  <td className="p-4 text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-semibold text-emerald-600">{item.contribution.toFixed(1)}%</span>
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.contribution}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {itemRanking.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No item data found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
