'use client';

import LayoutWrapper from '@/components/LayoutWrapper';
import { motion } from 'framer-motion';

export default function PreOrderPage() {
  return (
    <LayoutWrapper>
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-2xl">
              📝
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">Pre Order</h1>
              <p className="text-gray-500 dark:text-gray-400">Manage and track your pre-orders efficiently.</p>
            </div>
          </div>
          
          <div className="mt-12 flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Coming Soon</h2>
            <p className="text-gray-500">We're working hard to bring you the Pre Order management system.</p>
          </div>
        </motion.div>
      </div>
    </LayoutWrapper>
  );
}
