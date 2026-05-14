'use client';

import LayoutWrapper from '@/components/LayoutWrapper';
import { motion } from 'framer-motion';

export default function DocumentsPage() {
  return (
    <LayoutWrapper>
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-2xl">
              📂
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">Documents</h1>
              <p className="text-gray-500 dark:text-gray-400">Access and manage all shared documents and reports.</p>
            </div>
          </div>
          
          <div className="mt-12 flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Coming Soon</h2>
            <p className="text-gray-500">The document management system is being finalized.</p>
          </div>
        </motion.div>
      </div>
    </LayoutWrapper>
  );
}
