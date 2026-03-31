'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { parseDateString } from '@/lib/dateUtils';

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    tasks: any[]; // Using any[] for flexibility, can be typed strictly if needed
    type: 'delegation' | 'checklist' | 'o2d' | 'crm' | 'complain' | 'purchase' | 'factory' | 'jobwork' | 'rmdefect' | 'collection';
}

export default function TaskDetailModal({ isOpen, onClose, title, tasks, type }: TaskDetailModalProps) {
    if (!isOpen) return null;

    // Helper to check if task is on time (exact datetime comparison)
    const isOnTime = (task: any) => {
        const isFms = type !== 'delegation' && type !== 'checklist';
        const status = (task.status)?.toLowerCase() || '';
        const isCompleted = status === 'completed' || status === 'on time' || status === 'delayed' || !!(isFms && task.actual_date);

        if (!isCompleted) return false;

        // For O2D and other FMS types
        if (isFms) {
            if (!task.planned_date || !task.actual_date) return false;
            const plannedD = parseDateString(task.planned_date);
            const actualD = parseDateString(task.actual_date);
            if (!plannedD || !actualD) return false;
            // Exact datetime comparison — completed after planned time = late
            return actualD.getTime() <= plannedD.getTime();
        }
        // For Delegation/Checklist
        if (!task.due_date || !task.updated_at) return false;
        const dDate = parseDateString(task.due_date);
        const uDate = parseDateString(task.updated_at);
        if (!dDate || !uDate) return false;
        // Exact datetime comparison
        return uDate.getTime() <= dDate.getTime();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    className="relative z-10 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} found
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content - Scrollable Table */}
                    <div className="flex-1 overflow-auto p-0">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Task Title</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Due Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Completed On</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">On Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {tasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            No tasks found in this category.
                                        </td>
                                    </tr>
                                ) : (
                                    tasks.map((task, index) => {
                                        const onTime = isOnTime(task);
                                        const isFms = type !== 'delegation' && type !== 'checklist';
                                        const status = (task.status)?.toLowerCase() || '';
                                        const isCompleted = status === 'completed' || status === 'on time' || status === 'delayed' || !!(isFms && task.actual_date);

                                        const title = type === 'delegation'
                                            ? (task.description || task.delegation_name || task.task_title || 'Untitled Delegation')
                                            : type === 'checklist'
                                                ? (task.question || task.title || 'Untitled Checklist')
                                                : `${task.material_name || task.party_name || task.client_name || task.vendor_name || 'Item'} - Step ${task.step_number}: ${task.step_name}`;

                                        const dueDate = isFms ? task.planned_date : task.due_date;
                                        const completedDate = isFms ? (task.actual_date || null) : (task.updated_at || null);

                                        return (
                                            <tr key={`${task.id ?? ''}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900 dark:text-white line-clamp-2">
                                                        {title}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize
                                                        ${isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                            status === 'pending' || status === 'approval_waiting' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}
                                                    `}>
                                                        {status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                                    {dueDate ? (() => { const d = parseDateString(dueDate); return d ? d.toLocaleDateString('en-GB') + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'; })() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                                    {isCompleted && completedDate ? (() => { const d = parseDateString(completedDate); return d ? d.toLocaleDateString('en-GB') + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'; })() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {isCompleted ? (
                                                        onTime ? (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full" title="On Time">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full" title="Late">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
