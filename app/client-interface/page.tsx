'use client';

import { useState, useEffect, useMemo } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { TableToolbar } from '@/components/TableToolbar';
import { useLoader } from '@/components/LoaderProvider';
import { useToast } from '@/components/ToastProvider';

const tabs = [
  { id: 'Client User', label: 'Client User', icon: '👤' },
  { id: 'PreOrder', label: 'PreOrder', icon: '📝' },
  { id: 'Orders', label: 'Orders', icon: '🛒' },
  { id: 'Inventory', label: 'Inventory', icon: '📦' },
  { id: 'Freshness Report', label: 'Freshness Report', icon: '✨' },
  { id: 'Tracker', label: 'Tracker', icon: '⏱️' },
  { id: 'Documents', label: 'Documents', icon: '📄' },
];

const ITEMS_PER_PAGE = 10;

export default function ClientInterfacePage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({ Username: '', Password: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  const { showLoader, hideLoader } = useLoader();
  const { addToast } = useToast();

  const fetchData = async (tabName: string) => {
    setLoading(true);
    showLoader();
    try {
      const response = await fetch(`/api/client-interface?tab=${encodeURIComponent(tabName)}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      
      // Reverse to show latest on top
      setData(Array.isArray(result) ? [...result].reverse() : []);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast(`Error loading ${tabName} data`, 'error');
      setData([]);
    } finally {
      setLoading(false);
      hideLoader();
    }
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(q)
      )
    );
  }, [data, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const headers = useMemo(() => {
    if (activeTab === 'Client User') return ['Username', 'Password'];
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data, activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader();
    try {
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem 
        ? { 
            tab: activeTab, 
            identifierKey: 'Username', 
            identifierValue: editingItem.Username, 
            updates: formData 
          }
        : { tab: activeTab, data: formData };

      const response = await fetch('/api/client-interface', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to save');
      }
      
      addToast(editingItem ? 'User updated' : 'User created', 'success');
      setShowModal(false);
      fetchData(activeTab);
    } catch (error: any) {
      addToast(error.message || 'Failed to save user', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    showLoader();
    try {
      const response = await fetch(`/api/client-interface?tab=${encodeURIComponent(activeTab)}&identifierKey=Username&identifierValue=${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      
      addToast('User deleted', 'success');
      fetchData(activeTab);
    } catch (error) {
      addToast('Failed to delete user', 'error');
    } finally {
      hideLoader();
    }
  };

  const isUrl = (str: string) => {
      if (typeof str !== 'string') return false;
      return str.startsWith('http://') || str.startsWith('https://');
  };

  return (
    <LayoutWrapper>
      <div className="min-h-screen bg-[var(--theme-light)] dark:bg-gray-900 transition-colors duration-300">
        <div className="p-4 max-w-[1600px] mx-auto space-y-4">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md p-4 rounded-2xl border border-white/20 dark:border-gray-700/30">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-none">Client Interface</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage all client operations</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-grow md:flex-grow-0">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full md:w-64 pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-[var(--theme-primary)] outline-none transition-all shadow-sm"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {activeTab === 'Client User' && (
                  <button 
                    onClick={() => {
                        setEditingItem(null);
                        setFormData({ Username: '', Password: '' });
                        setShowPassword(false);
                        setShowModal(true);
                    }}
                    className="px-4 py-2 bg-[var(--theme-primary)] text-gray-900 font-bold rounded-xl text-sm shadow-sm hover:scale-105 transition-transform"
                  >
                      + Add User
                  </button>
              )}

              {data.length > 0 && (
                <div className="flex items-center">
                  <TableToolbar 
                    data={filteredData} 
                    fileName={`Client_Interface_${activeTab}`} 
                    columns={headers.map(h => ({ key: h, label: h }))} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-1 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md p-1 rounded-xl border border-white/20 dark:border-gray-700/30 shadow-sm overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[var(--theme-primary)] text-gray-900 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Pagination Row - Before Table */}
          {!loading && filteredData.length > 0 && (
            <div className="flex items-center justify-between px-6 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border border-white/20 dark:border-gray-700/30 shadow-sm">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                Showing <span className="text-[var(--theme-primary)] dark:text-[var(--theme-primary)]">{(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</span> of {filteredData.length} entries
              </div>
              
              <div className="flex items-center gap-2">
                {/* Jump to First */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First Page"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] dark:hover:bg-[var(--theme-primary)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm group"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] dark:hover:bg-[var(--theme-primary)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                
                <div className="flex items-center px-4 py-1.5 text-xs font-black text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg border-2 border-[var(--theme-primary)] shadow-sm">
                  PAGE {currentPage} / {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] dark:hover:bg-[var(--theme-primary)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                {/* Jump to Last */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last Page"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] dark:hover:bg-[var(--theme-primary)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Table Area */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] no-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-10 h-10 border-3 border-[var(--theme-primary)]/20 border-t-[var(--theme-primary)] rounded-full animate-spin mb-3" />
                  <p className="text-xs text-gray-500 font-medium">Loading...</p>
                </div>
              ) : data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="text-4xl mb-4">🏜️</div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Data Available</h3>
                  <p className="text-xs text-gray-500 max-w-xs mt-1">
                    No records found in the {activeTab} sheet.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse table-auto">
                  <thead className="sticky top-0 z-10 bg-[var(--theme-primary)] shadow-sm">
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-4 py-3 text-[10px] font-black text-gray-900 uppercase tracking-widest border-b border-gray-100/20 dark:border-gray-700/30">
                          {header.replace(/_/g, ' ')}
                        </th>
                      ))}
                      {activeTab === 'Client User' && (
                          <th className="px-4 py-3 text-[10px] font-black text-gray-900 uppercase tracking-widest border-b border-gray-100/20 dark:border-gray-700/30 text-right">
                              Actions
                          </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {paginatedData.map((row, i) => (
                      <tr
                        key={i}
                        className="group hover:bg-[var(--theme-primary)]/5 dark:hover:bg-[var(--theme-primary)]/10 transition-colors"
                      >
                        {headers.map((header) => (
                          <td key={header} className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {row[header] === null || row[header] === undefined ? (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            ) : isUrl(String(row[header])) ? (
                                <a 
                                    href={String(row[header])} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg hover:scale-105 transition-transform border border-indigo-100 dark:border-indigo-800"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    View Image
                                </a>
                            ) : (
                              String(row[header])
                            )}
                          </td>
                        ))}
                        {activeTab === 'Client User' && (
                            <td className="px-4 py-2.5 text-xs text-right whitespace-nowrap">
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => {
                                            setEditingItem(row);
                                            setFormData({ Username: row.Username || '', Password: row.Password || '' });
                                            setShowPassword(false);
                                            setShowModal(true);
                                        }}
                                        className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.242 19.242L19 16.5M17.5 15l2.5 2.5m-10.5-2.5l2.5 2.5m1-1l1.5 1.5M16 3.13a4 4 0 015.66 5.66L8.5 21.93l-4.5 1 1-4.5L16 3.13z" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(row.Username)}
                                        className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CRUD Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-[var(--theme-primary)]">
                <h2 className="text-xl font-black text-gray-900">
                  {editingItem ? 'Edit Client User' : 'Add Client User'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-900 hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={formData.Username}
                    onChange={(e) => setFormData({ ...formData, Username: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Password</label>
                  <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.Password}
                        onChange={(e) => setFormData({ ...formData, Password: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white pr-12"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                          {showPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                          )}
                      </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[var(--theme-primary)] text-gray-900 font-bold rounded-xl shadow-sm hover:scale-105 transition-transform"
                  >
                    {editingItem ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </LayoutWrapper>
  );
}
