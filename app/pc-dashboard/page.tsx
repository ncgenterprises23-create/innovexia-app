'use client';

import React, { useState, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ensureSessionId } from '@/utils/session';
import { parseDateString, parseSheetDate } from '@/lib/dateUtils';
import TaskDetailModal from '@/components/TaskDetailModal';
import { motion, AnimatePresence } from 'framer-motion';

export interface UnifiedTask {
    id: string;
    title: string;
    sourceModule: string;
    status: 'Pending' | 'Completed';
    dueDate: Date | null;
    updatedDate: Date | null;
    doerName: string;
    rawTaskData: any;
}

export default function PCDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<UnifiedTask[]>([]);

    const [dailyJobs, setDailyJobs] = useState<UnifiedTask[]>([]);
    const [delayedJobs, setDelayedJobs] = useState<UnifiedTask[]>([]);
    const [pendingJobs, setPendingJobs] = useState<UnifiedTask[]>([]);

    const [expandedSection, setExpandedSection] = useState<'daily' | 'delayed' | 'pending' | null>('daily');
    const [activeTab, setActiveTab] = useState<'overview' | 'charts'>('overview');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
    const [isSystemDropdownOpen, setIsSystemDropdownOpen] = useState(false);

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        tasks: any[];
        type: any;
    }>({
        isOpen: false,
        title: '',
        tasks: [],
        type: 'delegation'
    });

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const sessionId = ensureSessionId();
            const headers = { 'x-session-id': sessionId };

            // Fetch everything robustly
            const endpoints = [
                '/api/delegations', '/api/checklists', '/api/todos',
                '/api/o2d', '/api/o2d-config',
                '/api/crm', '/api/crm-config',
                '/api/client-complain', '/api/client-complain-config',
                '/api/purchase-fms', '/api/purchase-fms-config',
                '/api/factory-requirements', '/api/factory-requirements-config',
                '/api/job-work', '/api/job-work-config',
                '/api/rm-defects', '/api/rm-defects-config',
                '/api/fms-product-search', '/api/fms-product-search-config',
                '/api/export-fms', '/api/export-fms-config',
                '/api/sales-export-purchase-enquiry-fms', '/api/sales-export-purchase-enquiry-fms-config',
                '/api/igst-refund', '/api/igst-refund-config',
                '/api/collection', '/api/collection/doer',
                '/api/payable', '/api/payable/doer'
            ];

            const responses = await Promise.allSettled(
                endpoints.map(ep => fetch(ep, { headers, cache: 'no-store' }).then(r => {
                    if (!r.ok) throw new Error(`Failed ${ep}`);
                    return r.json();
                }))
            );

            const data = responses.map(r => r.status === 'fulfilled' ? r.value : null);

            let allTasks: UnifiedTask[] = [];

            // 1. Delegations
            const delData = data[0];
            if (delData?.delegations) {
                delData.delegations.forEach((d: any) => {
                    allTasks.push({
                        id: `del-${d.id}`,
                        title: d.delegation_name || d.description || 'Delegation Task',
                        sourceModule: 'Delegation',
                        status: d.status?.toLowerCase() === 'completed' ? 'Completed' : 'Pending',
                        dueDate: parseDateString(d.due_date),
                        updatedDate: parseDateString(d.updated_at),
                        doerName: d.doer_name || d.assigned_to || 'Unassigned',
                        rawTaskData: { ...d, type: 'delegation' }
                    });
                });
            }

            // 2. Checklists
            const chkData = data[1];
            if (chkData?.checklists) {
                chkData.checklists.forEach((c: any) => {
                    allTasks.push({
                        id: `chk-${c.id}`,
                        title: c.question || 'Checklist Task',
                        sourceModule: 'Checklist',
                        status: c.status?.toLowerCase() === 'completed' ? 'Completed' : 'Pending',
                        dueDate: parseDateString(c.due_date),
                        updatedDate: parseDateString(c.updated_at),
                        doerName: c.doer_name || c.assignee || 'Unassigned',
                        rawTaskData: { ...c, type: 'checklist' }
                    });
                });
            }

            // 3. Todos
            const todoData = data[2];
            if (todoData?.todos) {
                todoData.todos.forEach((t: any) => {
                    allTasks.push({
                        id: `todo-${t.id}`,
                        title: t.task || 'Todo Task',
                        sourceModule: 'Todo',
                        status: t.status?.toLowerCase() === 'completed' ? 'Completed' : 'Pending',
                        dueDate: parseDateString(t.due_date),
                        updatedDate: parseDateString(t.updated_at),
                        doerName: t.doer_name || t.assigned_to || 'Unassigned',
                        rawTaskData: { ...t, type: 'todo' }
                    });
                });
            }

            // FMS Helper
            const parseFms = (moduleName: string, fmsData: any, fmsConfig: any, maxSteps: number = 11, typeStr: string) => {
                if (!fmsData || !fmsConfig?.config) return;
                const dList = Array.isArray(fmsData) ? fmsData : (fmsData?.data && Array.isArray(fmsData.data) ? fmsData.data : []);
                const cList = Array.isArray(fmsConfig.config) ? fmsConfig.config : [];

                dList.forEach((order: any) => {
                    const itemsToProcess = Array.isArray(order.items) ? order.items : [order];
                    itemsToProcess.forEach((item: any) => {
                        for (let i = 1; i <= maxSteps; i++) {
                            const stepConfig = cList.find((c: any) => String(c.step) === String(i));
                            if (stepConfig) {
                                const itemKeys = Object.keys(item);
                                const plannedKey = itemKeys.find(k => k.toLowerCase() === `planned_${i}`);
                                const actualKey = itemKeys.find(k => k.toLowerCase() === `actual_${i}`);

                                const plannedRaw = plannedKey ? item[plannedKey] : undefined;
                                const actualRaw = actualKey ? item[actualKey] : undefined;

                                const plannedDate = parseSheetDate(plannedRaw);
                                const actualDate = parseSheetDate(actualRaw);

                                if (plannedDate || actualDate) {
                                    allTasks.push({
                                        id: `${typeStr}-${item.id || item.Id || item.ID || order.id || order.Id || order.ID || Math.random().toString(36).substring(2, 10)}-${i}`,
                                        title: `${order.party_name || item.party_name || order.client_name || order.clientName || item.clientName || order['Client Name'] || item['Client Name'] || order.vendor_name || order.vendorName || item.vendorName || order['Vendor Name'] || item['Vendor Name'] || order.materialName || item.materialName || order.Product || item.Product || order.piNumber || order.PI_Number || item.piNumber || order.invoice_number || order.Invoice_Number || item.invoice_number || order['Job Work Name'] || item['Job Work Name'] || order['Item Name'] || item['Item Name'] || order['Party Name'] || item['Party Name'] || order.Company_Name || item.Company_Name || order.Item_name || item.Item_name || order.Party_Name || item.Party_Name || order.Name || item.Name || order.requirement || item.requirement || order['Po No.'] || item['Po No.'] || 'Item'} - ${stepConfig.stepName}`,
                                        sourceModule: moduleName,
                                        status: actualDate ? 'Completed' : 'Pending',
                                        dueDate: plannedDate ? new Date(plannedDate) : null,
                                        updatedDate: actualDate ? new Date(actualDate) : null,
                                        doerName: stepConfig.doerName || 'Unassigned',
                                        rawTaskData: { 
                                            ...item, 
                                            type: typeStr,
                                            step_number: i,
                                            step_name: stepConfig.stepName,
                                            planned_date: plannedDate || null,
                                            actual_date: actualDate || null
                                        }
                                    });
                                }
                            }
                        }
                    });
                });
            };

            parseFms('O2D', data[3], data[4], 8, 'o2d');
            parseFms('CRM', data[5], data[6], 11, 'crm');
            parseFms('Client Complain', data[7], data[8], 11, 'complain');
            parseFms('Purchase FMS', data[9], data[10], 11, 'purchase');
            parseFms('Factory Req.', data[11], data[12], 11, 'factory');
            parseFms('Job Work', data[13], data[14], 11, 'jobwork');
            parseFms('RM Defects', data[15], data[16], 11, 'rmdefect');
            parseFms('New Product Search', data[17], data[18], 11, 'productsearch');
            parseFms('Export FMS', data[19], data[20], 11, 'exportfms');
            parseFms('Sales Export FMS', data[21], data[22], 11, 'salesexportfms');
            parseFms('IGST Refund', data[23], data[24], 11, 'igstrefund');

            // Parse Collection & Payable
            const parseCollectionPayable = (moduleName: string, ledgerData: any, doerData: any, typeStr: string) => {
                if (!ledgerData || !ledgerData.data) return;
                const doerName = doerData?.doer || 'Unassigned';

                ledgerData.data.forEach((item: any) => {
                    const pendingAmount = parseFloat(item.PendingAmount || '0');
                    if (pendingAmount <= 0) return; // Only process pending payments

                    let history: any[] = [];
                    try {
                        if (typeof item['Follow Up'] === 'string') {
                            const parsed = JSON.parse(item['Follow Up']);
                            history = Array.isArray(parsed) ? parsed : [parsed];
                        } else if (Array.isArray(item['Follow Up'])) {
                            history = item['Follow Up'];
                        } else if (item['Follow Up']) {
                            history = [{ remark: item['Follow Up'], timestamp: 'Legacy' }];
                        }
                    } catch {
                        history = item['Follow Up'] ? [{ remark: item['Follow Up'], timestamp: 'Legacy' }] : [];
                    }

                    const sortedHistory = [...history].sort((a: any, b: any) => {
                        const tA = a.timestamp === 'Legacy' ? 0 : new Date(a.timestamp).getTime();
                        const tB = b.timestamp === 'Legacy' ? 0 : new Date(b.timestamp).getTime();
                        return tB - tA;
                    });
                    
                    const latestWithDate = sortedHistory.find((h: any) => h.next_followup);
                    const effectiveDateStr = latestWithDate?.next_followup || item['1 Day Before Due Date'];
                    
                    if (!effectiveDateStr) return;
                    
                    const dueDate = parseSheetDate(effectiveDateStr);

                    allTasks.push({
                        id: `${typeStr}-${item.Id || Math.random().toString(36).substring(2, 10)}`,
                        title: `${item.Name || item.party_name || 'Item'} - ₹${pendingAmount.toLocaleString()}`,
                        sourceModule: moduleName,
                        status: pendingAmount > 0 ? 'Pending' : 'Completed',
                        dueDate: dueDate ? new Date(dueDate) : null,
                        updatedDate: null,
                        doerName: doerName,
                        rawTaskData: {
                            ...item,
                            type: typeStr,
                            step_name: `Pending Amount: ₹${pendingAmount.toLocaleString()}`,
                            party_name: item.Name,
                            planned_date: effectiveDateStr,
                            actual_date: null,
                            step_number: 1,
                        }
                    });
                });
            };

            parseCollectionPayable('Collection', data[25], data[26], 'collection');
            parseCollectionPayable('Payable', data[27], data[28], 'payable');

            setTasks(allTasks);
            categorizeTasks(allTasks);

        } catch (error) {
            console.error('Error fetching PC Dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const categorizeTasks = (allTasks: UnifiedTask[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isToday = (d: Date | null) => {
            if (!d) return false;
            return d.getFullYear() === today.getFullYear() &&
                d.getMonth() === today.getMonth() &&
                d.getDate() === today.getDate();
        };

        const isBeforeToday = (d: Date | null) => {
            if (!d) return false;
            const target = new Date(d);
            if (isNaN(target.getTime())) return false;
            target.setHours(0, 0, 0, 0);
            return target.getTime() < today.getTime();
        };

        const isTodayOrFuture = (d: Date | null) => {
            if (!d) return true;
            const target = new Date(d);
            if (isNaN(target.getTime())) return true;
            target.setHours(0, 0, 0, 0);
            return target.getTime() >= today.getTime();
        };

        const daily = allTasks.filter(t => t.status === 'Completed' && isToday(t.updatedDate));
        const delayed = allTasks.filter(t => t.status === 'Pending' && isBeforeToday(t.dueDate));
        const pending = allTasks.filter(t => t.status === 'Pending' && isTodayOrFuture(t.dueDate));

        console.log('--- PC DASHBOARD TASK CATEGORIZATION ---');
        console.log('All Tasks Length:', allTasks.length);
        console.log('Job Work FMS:', allTasks.filter(t => t.sourceModule === 'Job Work').length);
        console.log('Sales Export FMS:', allTasks.filter(t => t.sourceModule === 'Sales Export FMS').length);
        console.log('Collection:', allTasks.filter(t => t.sourceModule === 'Collection').length);
        console.log('Payable:', allTasks.filter(t => t.sourceModule === 'Payable').length);
        
        console.log('Daily:', daily.length);
        console.log('Delayed:', delayed.length);
        console.log('Pending:', pending.length);

        setDailyJobs(daily);
        setDelayedJobs(delayed);
        setPendingJobs(pending);
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const displayedDailyJobs = dailyJobs.filter(t => 
        (selectedUsers.length === 0 || selectedUsers.includes(t.doerName.trim() || 'Missing Assignee')) &&
        (selectedSystems.length === 0 || selectedSystems.includes(t.sourceModule))
    );
    const displayedDelayedJobs = delayedJobs.filter(t => 
        (selectedUsers.length === 0 || selectedUsers.includes(t.doerName.trim() || 'Missing Assignee')) &&
        (selectedSystems.length === 0 || selectedSystems.includes(t.sourceModule))
    );
    const displayedPendingJobs = pendingJobs.filter(t => 
        (selectedUsers.length === 0 || selectedUsers.includes(t.doerName.trim() || 'Missing Assignee')) &&
        (selectedSystems.length === 0 || selectedSystems.includes(t.sourceModule))
    );

    const getFilterDropdownUsers = () => {
        const statsMap = new Map<string, { daily: number, delayed: number, pending: number }>();
        const initUser = (name: string) => {
            if (!statsMap.has(name)) {
                statsMap.set(name, { daily: 0, delayed: 0, pending: 0 });
            }
        };
        dailyJobs.forEach(t => { const n = t.doerName.trim() || 'Missing Assignee'; initUser(n); statsMap.get(n)!.daily += 1; });
        delayedJobs.forEach(t => { const n = t.doerName.trim() || 'Missing Assignee'; initUser(n); statsMap.get(n)!.delayed += 1; });
        pendingJobs.forEach(t => { const n = t.doerName.trim() || 'Missing Assignee'; initUser(n); statsMap.get(n)!.pending += 1; });
        
        return Array.from(statsMap.entries()).map(([name, counts]) => ({
            doerName: name,
            daily: counts.daily,
            delayed: counts.delayed,
            pending: counts.pending,
            total: counts.daily + counts.delayed + counts.pending
        })).sort((a, b) => b.total - a.total); 
    };
    const filterOptions = getFilterDropdownUsers();

    const getFilterDropdownSystems = () => {
        const ALL_SYSTEMS = [
            'Delegation', 'Checklist', 'Todo', 'O2D', 'CRM', 'Client Complain', 
            'Purchase FMS', 'Factory Req.', 'Job Work', 'RM Defects', 
            'New Product Search', 'Export FMS', 'Sales Export FMS', 'IGST Refund',
            'Collection', 'Payable'
        ];
        const statsMap = new Map<string, { daily: number, delayed: number, pending: number }>();
        const initSystem = (name: string) => {
            if (!statsMap.has(name)) {
                statsMap.set(name, { daily: 0, delayed: 0, pending: 0 });
            }
        };
        ALL_SYSTEMS.forEach(initSystem);
        dailyJobs.forEach(t => { const n = t.sourceModule; initSystem(n); statsMap.get(n)!.daily += 1; });
        delayedJobs.forEach(t => { const n = t.sourceModule; initSystem(n); statsMap.get(n)!.delayed += 1; });
        pendingJobs.forEach(t => { const n = t.sourceModule; initSystem(n); statsMap.get(n)!.pending += 1; });
        
        return Array.from(statsMap.entries()).map(([name, counts]) => ({
            systemName: name,
            daily: counts.daily,
            delayed: counts.delayed,
            pending: counts.pending,
            total: counts.daily + counts.delayed + counts.pending
        })).sort((a, b) => b.total - a.total); 
    };
    const systemFilterOptions = getFilterDropdownSystems();

    const handleOpenTask = (task: UnifiedTask) => {
        let modalType = task.rawTaskData?.type || 'delegation';
        
        setModalConfig({
            isOpen: true,
            title: task.title,
            tasks: [task.rawTaskData],
            type: modalType
        });
    };

    const getUserStats = () => {
        const statsMap = new Map<string, { daily: number, delayed: number, pending: number }>();
        
        const initUser = (name: string) => {
            if (!statsMap.has(name)) {
                statsMap.set(name, { daily: 0, delayed: 0, pending: 0 });
            }
        };

        displayedDailyJobs.forEach(t => {
           const name = t.doerName.trim() || 'Missing Assignee';
           initUser(name);
           statsMap.get(name)!.daily += 1;
        });
        displayedDelayedJobs.forEach(t => {
           const name = t.doerName.trim() || 'Missing Assignee';
           initUser(name);
           statsMap.get(name)!.delayed += 1;
        });
        displayedPendingJobs.forEach(t => {
           const name = t.doerName.trim() || 'Missing Assignee';
           initUser(name);
           statsMap.get(name)!.pending += 1;
        });
      
        return Array.from(statsMap.entries()).map(([name, counts]) => ({
            doerName: name,
            daily: counts.daily,
            delayed: counts.delayed,
            pending: counts.pending,
            total: counts.daily + counts.delayed + counts.pending
        })).sort((a, b) => b.total - a.total); 
    };

    const UserChartsView = () => {
        const userStats = getUserStats();
        if(userStats.length === 0) return <div className="text-gray-500 p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-750">No data available for charts</div>;
        
        const maxTotal = Math.max(...userStats.map(u => Math.max(u.daily, u.delayed, u.pending)));
    
        return (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-750">
               <h3 className="text-xl font-black mb-8 text-gray-900 dark:text-white flex items-center gap-3">
                   <div className="p-2 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded-lg">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   </div>
                   User-wise Task Distribution
                   <div className="ml-auto flex items-center gap-4 text-xs font-bold bg-gray-50 dark:bg-gray-900/50 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hidden lg:flex">
                       <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> Daily</span>
                       <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> Delayed</span>
                       <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Pending</span>
                   </div>
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {userStats.map((u, i) => (
                      <div key={i} className="flex flex-col gap-3 p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-750 hover:shadow-md hover:-translate-y-0.5 transition-all">
                          {/* Name Header */}
                          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
                              <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 truncate">
                                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-600 dark:text-gray-300 font-bold uppercase shrink-0">
                                      {u.doerName.charAt(0)}
                                  </div>
                                  <span className="truncate" title={u.doerName}>{u.doerName}</span>
                              </div>
                              <span className="text-xs font-black text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">Total: {u.total}</span>
                          </div>
                          
                          {/* Bars Container */}
                          <div className="flex flex-col gap-2.5 pt-1">
                              <div className="flex items-center gap-3">
                                  <span className="text-[10px] w-12 text-gray-500 dark:text-gray-400 font-bold uppercase shrink-0">Daily</span>
                                  <div className="flex-1 h-3.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex items-center">
                                      <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: maxTotal > 0 ? `${(u.daily / maxTotal) * 100}%` : '0%' }}
                                          className="h-full bg-green-500 rounded-full"
                                          transition={{ duration: 1, ease: 'easeOut' }}
                                      />
                                  </div>
                                  <span className="text-[11px] font-black w-6 text-right text-gray-600 dark:text-gray-300 shrink-0">{u.daily}</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                  <span className="text-[10px] w-12 text-gray-500 dark:text-gray-400 font-bold uppercase shrink-0">Delayed</span>
                                  <div className="flex-1 h-3.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex items-center">
                                      <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: maxTotal > 0 ? `${(u.delayed / maxTotal) * 100}%` : '0%' }}
                                          className="h-full bg-red-500 rounded-full"
                                          transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
                                      />
                                  </div>
                                  <span className="text-[11px] font-black w-6 text-right text-gray-600 dark:text-gray-300 shrink-0">{u.delayed}</span>
                              </div>
    
                              <div className="flex items-center gap-3">
                                  <span className="text-[10px] w-12 text-gray-500 dark:text-gray-400 font-bold uppercase shrink-0">Pending</span>
                                  <div className="flex-1 h-3.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex items-center">
                                      <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: maxTotal > 0 ? `${(u.pending / maxTotal) * 100}%` : '0%' }}
                                          className="h-full bg-blue-500 rounded-full"
                                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                                      />
                                  </div>
                                  <span className="text-[11px] font-black w-6 text-right text-gray-600 dark:text-gray-300 shrink-0">{u.pending}</span>
                              </div>
                          </div>
                      </div>
                  ))}
               </div>
            </div>
        );
    }

    const TaskRow = ({ task }: { task: UnifiedTask }) => {
        const isCompleted = task.status === 'Completed';
        const isDelayed = task.status === 'Pending' && task.dueDate && task.dueDate < new Date();
        const rowColorClass = isCompleted ? 'border-green-500' : isDelayed ? 'border-red-500' : 'border-blue-500';
        const badgeColor = isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : isDelayed ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';

        return (
            <motion.div 
                whileHover={{ scale: 1.002, x: 2 }}
                whileTap={{ scale: 0.995 }}
                onClick={() => handleOpenTask(task)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 bg-white dark:bg-gray-800 rounded-xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)] transition-all cursor-pointer group border-l-[4px] ${rowColorClass} border-t border-r border-b border-gray-100 dark:border-gray-750`}
            >
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded flex items-center whitespace-nowrap">
                            {task.sourceModule}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded flex items-center ${badgeColor}`}>
                            {task.status}
                        </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-[var(--theme-primary)] transition-colors">
                        {task.title}
                    </h4>
                </div>
                
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-0.5 mt-2 sm:mt-0 text-[10px] sm:text-xs sm:text-right shrink-0">
                    <div className="flex flex-col sm:items-end">
                        <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Assignee</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-300 shrink-0 font-bold uppercase">
                                {task.doerName.charAt(0)}
                            </div>
                            {task.doerName}
                        </span>
                    </div>
                    {isCompleted ? (
                        <div className="flex flex-col sm:items-end text-right">
                            <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Completed On</span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                                {task.updatedDate ? task.updatedDate.toLocaleDateString('en-GB') : 'N/A'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:items-end text-right">
                            <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Due Date</span>
                            <span className={`font-bold ${isDelayed ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                {task.dueDate ? task.dueDate.toLocaleDateString('en-GB') : 'Not Set'}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    const StatCard = ({ title, count, icon, active, onClick, gradientClass, textColorClass, ringClass }: any) => (
        <div 
            onClick={onClick}
            className={`cursor-pointer rounded-xl p-3 sm:p-4 transition-all duration-300 relative overflow-hidden group border focus:outline-none flex items-center justify-between ${
                active 
                ? `${gradientClass} text-white shadow-md scale-[1.01] ring-2 ${ringClass} ring-opacity-50 border-transparent z-10` 
                : `bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 border-gray-100 dark:border-gray-750 z-0`
            }`}
        >
            <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full opacity-20 blur-xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-30 ${active ? 'bg-white' : textColorClass.replace('text-', 'bg-')}`}></div>
            
            <div className="flex items-center gap-3 relative z-10">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shadow-inner backdrop-blur-sm transition-colors ${active ? 'bg-white/25 text-white' : `${textColorClass} bg-opacity-10 bg-current`}`}>
                    {icon}
                </div>
                <h3 className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${active ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>{title}</h3>
            </div>
            <span className={`text-2xl sm:text-3xl font-black tracking-tight relative z-10 ${active ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{count}</span>
        </div>
    );

    return (
        <LayoutWrapper>
            <div className="w-full h-full min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
                <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1920px] mx-auto">
                    {/* Header */}
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 relative z-50">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">PC Dashboard</h1>
                            <p className="text-sm sm:text-base text-gray-500 font-medium mt-1">Overview of all operational tasks across the ERP</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
                            {/* System Filter Dropdown */}
                            <div className="relative w-full sm:w-64">
                                <button 
                                    onClick={() => setIsSystemDropdownOpen(!isSystemDropdownOpen)}
                                    className="w-full flex items-center justify-between px-4 py-2 border border-gray-100 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none hover:border-gray-200 dark:hover:border-gray-600 sm:text-sm transition-colors shadow-sm"
                                >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <span className="truncate font-medium text-gray-600 dark:text-gray-300">
                                            {selectedSystems.length === 0 ? "Filter purely by system..." : `${selectedSystems.length} system${selectedSystems.length > 1 ? 's' : ''} selected`}
                                        </span>
                                    </div>
                                    <svg className={`h-5 w-5 text-gray-400 shrink-0 transition-transform ${isSystemDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                <AnimatePresence>
                                    {isSystemDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsSystemDropdownOpen(false)}></div>
                                            <motion.div 
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute z-50 mt-2 w-full sm:min-w-[320px] max-w-md right-0 sm:left-0 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] ring-1 ring-black ring-opacity-5"
                                            >
                                                <div className="p-2 space-y-1">
                                                    {systemFilterOptions.length === 0 ? (
                                                        <div className="text-center p-4 text-sm text-gray-500">No systems found</div>
                                                    ) : systemFilterOptions.map((opt) => (
                                                        <label key={opt.systemName} className="flex items-center p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors group">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedSystems.includes(opt.systemName)}
                                                                onChange={(e) => {
                                                                    if(e.target.checked) setSelectedSystems(prev => [...prev, opt.systemName]);
                                                                    else setSelectedSystems(prev => prev.filter(name => name !== opt.systemName));
                                                                }}
                                                                className="w-4 h-4 text-[var(--theme-primary)] rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-[var(--theme-primary)]/50 shrink-0"
                                                            />
                                                            <div className="ml-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 overflow-hidden">
                                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate" title={opt.systemName}>{opt.systemName}</span>
                                                                <div className="flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                                                                    {opt.total === 0 ? (
                                                                        <span className="text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">0 Tasks</span>
                                                                    ) : (
                                                                        <>
                                                                            {opt.daily > 0 && <span className="text-green-700 bg-green-100/80 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-md">Daily: {opt.daily}</span>}
                                                                            {opt.delayed > 0 && <span className="text-red-700 bg-red-100/80 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded-md">Del: {opt.delayed}</span>}
                                                                            {opt.pending > 0 && <span className="text-blue-700 bg-blue-100/80 dark:bg-blue-900/40 dark:text-blue-400 px-1.5 py-0.5 rounded-md">Pend: {opt.pending}</span>}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* User Filter Dropdown */}
                            <div className="relative w-full sm:w-80">
                                <button 
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="w-full flex items-center justify-between px-4 py-2 border border-gray-100 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none hover:border-gray-200 dark:hover:border-gray-600 sm:text-sm transition-colors shadow-sm"
                                >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                        </svg>
                                        <span className="truncate font-medium text-gray-600 dark:text-gray-300">
                                            {selectedUsers.length === 0 ? "Filter purely by user..." : `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} selected`}
                                        </span>
                                    </div>
                                    <svg className={`h-5 w-5 text-gray-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                <AnimatePresence>
                                    {isDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                                            <motion.div 
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute z-50 mt-2 w-full sm:min-w-[320px] max-w-md right-0 sm:left-0 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] ring-1 ring-black ring-opacity-5"
                                            >
                                                <div className="p-2 space-y-1">
                                                    {filterOptions.length === 0 ? (
                                                        <div className="text-center p-4 text-sm text-gray-500">No users found</div>
                                                    ) : filterOptions.map((opt) => (
                                                        <label key={opt.doerName} className="flex items-center p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors group">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedUsers.includes(opt.doerName)}
                                                                onChange={(e) => {
                                                                    if(e.target.checked) setSelectedUsers(prev => [...prev, opt.doerName]);
                                                                    else setSelectedUsers(prev => prev.filter(name => name !== opt.doerName));
                                                                }}
                                                                className="w-4 h-4 text-[var(--theme-primary)] rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-[var(--theme-primary)]/50 shrink-0"
                                                            />
                                                            <div className="ml-3 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 overflow-hidden">
                                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate" title={opt.doerName}>{opt.doerName}</span>
                                                                <div className="flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                                                                    {opt.daily > 0 && <span className="text-green-700 bg-green-100/80 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-md">Daily: {opt.daily}</span>}
                                                                    {opt.delayed > 0 && <span className="text-red-700 bg-red-100/80 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded-md">Del: {opt.delayed}</span>}
                                                                    {opt.pending > 0 && <span className="text-blue-700 bg-blue-100/80 dark:bg-blue-900/40 dark:text-blue-400 px-1.5 py-0.5 rounded-md">Pend: {opt.pending}</span>}
                                                                </div>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Tabs */}
                            <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 w-full sm:w-fit">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveTab('charts')}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'charts' ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    Charts
                                </button>
                            </div>

                            {loading && (
                                <div className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-sm font-bold text-[var(--theme-primary)] border border-gray-100 dark:border-gray-700 ml-auto">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--theme-primary)] opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--theme-primary)]"></span>
                                    </span>
                                    Syncing Data...
                                </div>
                            )}
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <motion.div 
                                key="overview"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                                    <StatCard 
                                        title="Daily Job Report" 
                                        count={displayedDailyJobs.length} 
                                        active={expandedSection === 'daily'}
                                        onClick={() => setExpandedSection(expandedSection === 'daily' ? null : 'daily')}
                                        gradientClass="bg-gradient-to-br from-emerald-400 to-green-600"
                                        textColorClass="text-green-500"
                                        ringClass="ring-green-400 dark:ring-offset-gray-900"
                                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                                    />
                                    <StatCard 
                                        title="Delayed Jobs" 
                                        count={displayedDelayedJobs.length} 
                                        active={expandedSection === 'delayed'}
                                        onClick={() => setExpandedSection(expandedSection === 'delayed' ? null : 'delayed')}
                                        gradientClass="bg-gradient-to-br from-rose-400 to-red-600"
                                        textColorClass="text-red-500"
                                        ringClass="ring-red-400 dark:ring-offset-gray-900"
                                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                    />
                                    <StatCard 
                                        title="Pending Jobs" 
                                        count={displayedPendingJobs.length} 
                                        active={expandedSection === 'pending'}
                                        onClick={() => setExpandedSection(expandedSection === 'pending' ? null : 'pending')}
                                        gradientClass="bg-gradient-to-br from-blue-400 to-indigo-600"
                                        textColorClass="text-blue-500"
                                        ringClass="ring-blue-400 dark:ring-offset-gray-900"
                                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                    />
                                </div>

                                {/* Expanded Sections */}
                                <div className="space-y-4 pt-2">
                                    <AnimatePresence mode="wait">
                                        {expandedSection === 'daily' && (
                                            <motion.div 
                                                key="daily"
                                                initial={{ opacity: 0, scale: 0.98, y: 10, height: 0 }}
                                                animate={{ opacity: 1, scale: 1, y: 0, height: 'auto' }}
                                                exit={{ opacity: 0, scale: 0.98, y: -10, height: 0 }}
                                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                className="space-y-4"
                                            >
                                                <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 flex items-center gap-3 pl-2">
                                                    <span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                                                    Daily Job Report <span className="text-base font-bold text-gray-400 bg-gray-200 dark:bg-gray-700 px-3 py-0.5 rounded-full">{displayedDailyJobs.length}</span>
                                                </h3>
                                                {displayedDailyJobs.length === 0 ? (
                                                    <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        </div>
                                                        <p className="text-lg text-gray-500 font-bold">No tasks completed today yet.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                                                        {displayedDailyJobs.map(task => <TaskRow key={task.id} task={task} />)}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                        
                                        {expandedSection === 'delayed' && (
                                            <motion.div 
                                                key="delayed"
                                                initial={{ opacity: 0, scale: 0.98, y: 10, height: 0 }}
                                                animate={{ opacity: 1, scale: 1, y: 0, height: 'auto' }}
                                                exit={{ opacity: 0, scale: 0.98, y: -10, height: 0 }}
                                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                className="space-y-4"
                                            >
                                                <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 flex items-center gap-3 pl-2">
                                                    <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse"></span>
                                                    Delayed Jobs <span className="text-base font-bold text-gray-400 bg-gray-200 dark:bg-gray-700 px-3 py-0.5 rounded-full">{displayedDelayedJobs.length}</span>
                                                </h3>
                                                {displayedDelayedJobs.length === 0 ? (
                                                    <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                                        <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        </div>
                                                        <p className="text-lg text-gray-500 font-bold">No delayed tasks found. Great job!</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                                                        {displayedDelayedJobs.map(task => <TaskRow key={task.id} task={task} />)}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                        
                                        {expandedSection === 'pending' && (
                                            <motion.div 
                                                key="pending"
                                                initial={{ opacity: 0, scale: 0.98, y: 10, height: 0 }}
                                                animate={{ opacity: 1, scale: 1, y: 0, height: 'auto' }}
                                                exit={{ opacity: 0, scale: 0.98, y: -10, height: 0 }}
                                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                className="space-y-4"
                                            >
                                                <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 flex items-center gap-3 pl-2">
                                                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                                                    Pending Jobs <span className="text-base font-bold text-gray-400 bg-gray-200 dark:bg-gray-700 px-3 py-0.5 rounded-full">{displayedPendingJobs.length}</span>
                                                </h3>
                                                {displayedPendingJobs.length === 0 ? (
                                                    <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        </div>
                                                        <p className="text-lg text-gray-500 font-bold">No pending tasks for today.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                                                        {displayedPendingJobs.map(task => <TaskRow key={task.id} task={task} />)}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                        
                        {activeTab === 'charts' && (
                            <motion.div
                                key="charts"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                            >
                                <UserChartsView />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Task Detail Modal */}
            <TaskDetailModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                title={modalConfig.title}
                tasks={modalConfig.tasks}
                type={modalConfig.type}
            />
        </LayoutWrapper>
    );
}
