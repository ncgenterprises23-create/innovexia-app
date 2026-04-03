'use client';

import { useState } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Factory, 
  Search,
  Filter,
  Users,
  CalendarCheck,
  LineChart,
  FileText
} from 'lucide-react';
import WorkerInformation from './components/WorkerInformation';
import WorkerAttendance from './components/WorkerAttendance';
import DailyProduction from './components/DailyProduction';

const TABS = [
  { id: 'worker-info', label: 'Worker Information', icon: <Users size={18} /> },
  { id: 'worker-attendance', label: 'Worker Attendance', icon: <CalendarCheck size={18} /> },
  { id: 'daily-production', label: 'Daily Production', icon: <LineChart size={18} /> },
  { id: 'report', label: 'Report', icon: <FileText size={18} /> },
];

export default function ProductionPage() {
  const [activeTab, setActiveTab] = useState('worker-info');

  return (
    <LayoutWrapper>
      <div className="p-4 max-w-[1600px] mx-auto space-y-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="p-2 bg-[var(--theme-primary)]/10 rounded-xl text-[var(--theme-primary)] shadow-sm backdrop-blur-md border border-[var(--theme-primary)]/20">
                <Factory size={22} />
              </span>
              Production Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Monitor and control real-time factory production lines
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] outline-none shadow-sm transition-all"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
            >
              <Filter className="text-gray-500" size={16} />
            </motion.button>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="bg-white/50 dark:bg-gray-800/50 p-1.5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm self-start inline-flex flex-wrap gap-1 shadow-sm sm:flex-nowrap w-full sm:w-auto overflow-x-auto hide-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 w-full sm:w-auto whitespace-nowrap focus:outline-none ${
                  isActive
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/30'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="productionTabIndicator"
                    className="absolute inset-0 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <span className={`${isActive ? 'text-[var(--theme-primary)]' : ''}`}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Section */}
        <div className="mt-6 min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'worker-info' && <WorkerInformation />}
              
              {activeTab === 'worker-attendance' && <WorkerAttendance />}

              {activeTab === 'daily-production' && <DailyProduction />}

              {activeTab === 'report' && (
                <div className="flex flex-col items-center justify-center h-64 bg-white/40 dark:bg-gray-800/40 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                  <FileText className="text-gray-300 dark:text-gray-600 mb-4" size={48} />
                  <h3 className="text-xl font-bold text-gray-500">Report Tab</h3>
                  <p className="text-gray-400">Coming soon in the next phase</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
      `}</style>
    </LayoutWrapper>
  );
}
