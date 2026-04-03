'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Briefcase, 
  Banknote, 
  Edit2, 
  Trash2, 
  Plus, 
  X,
  AlertTriangle,
  Loader2,
  Users,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

interface WorkerData {
  id: string;
  workerName: string;
  department: string;
  salary: string;
  rowIndex: number;
}

const DEPARTMENTS = ['Devender', 'Neeraj', 'Rahul'];

export default function WorkerInformation() {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<WorkerData | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<WorkerData | null>(null);
  const [formData, setFormData] = useState({ workerName: '', department: '', salary: '' });
  const [submitting, setSubmitting] = useState(false);
  
  // Drill-down state
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const res = await fetch('/api/production/workers');
      const data = await res.json();
      if (data.workers) {
        setWorkers(data.workers);
      }
    } catch (error) {
      console.error('Failed to fetch workers', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (worker?: WorkerData) => {
    if (worker) {
      setWorkerToEdit(worker);
      setFormData({ 
        workerName: worker.workerName, 
        department: worker.department, 
        salary: worker.salary 
      });
    } else {
      setWorkerToEdit(null);
      setFormData({ workerName: '', department: selectedDept || '', salary: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setWorkerToEdit(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (workerToEdit) {
        // Update
        const res = await fetch('/api/production/workers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, id: workerToEdit.id, rowIndex: workerToEdit.rowIndex }),
        });
        const updated = await res.json();
        setWorkers(workers.map(w => w.id === updated.id ? updated : w));
      } else {
        // Create
        const res = await fetch('/api/production/workers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const created = await res.json();
        const indexToAppend = workers.length > 0 ? workers[workers.length-1].rowIndex + 1 : 2;
        setWorkers([...workers, { ...created, rowIndex: indexToAppend }]);
        fetchWorkers();
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save worker', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (worker: WorkerData) => {
    setWorkerToDelete(worker);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!workerToDelete) return;
    setSubmitting(true);
    try {
      await fetch(`/api/production/workers?rowIndex=${workerToDelete.rowIndex}`, {
        method: 'DELETE',
      });
      setWorkers(workers.filter(w => w.id !== workerToDelete.id));
      setIsDeleteModalOpen(false);
      setWorkerToDelete(null);
      fetchWorkers();
    } catch (error) {
      console.error('Failed to delete worker', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Compute department counts
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DEPARTMENTS.forEach(d => counts[d] = 0);
    workers.forEach(w => {
      if (counts[w.department] !== undefined) {
        counts[w.department]++;
      }
    });
    return counts;
  }, [workers]);

  const filteredWorkers = useMemo(() => {
    if (!selectedDept) return workers;
    return workers.filter(w => w.department === selectedDept);
  }, [workers, selectedDept]);

  return (
    <div className="space-y-4">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-4 rounded-xl border border-white/20 dark:border-gray-700/30 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          {selectedDept && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedDept(null)}
              className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-[var(--theme-primary)] transition-colors"
            >
              <ArrowLeft size={18} />
            </motion.button>
          )}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="text-[var(--theme-primary)]" size={20} />
              {selectedDept ? `${selectedDept}'s Team` : 'Worker Directory'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedDept ? `Manage workers under ${selectedDept}` : 'Select a department to view workers'}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg shadow transition-all hover:opacity-90"
        >
          <Plus size={16} />
          Add Worker
        </motion.button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <Loader2 className="animate-spin text-[var(--theme-primary)] mb-3" size={32} />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Syncing with Google Sheets...</p>
        </div>
      ) : !selectedDept ? (
        /* Department View Grid (Compact Level 1) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <AnimatePresence>
            {DEPARTMENTS.map((dept, index) => (
              <motion.div
                key={dept}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedDept(dept)}
                className="group cursor-pointer bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-indigo-900/10 border border-white/60 dark:border-gray-700/30 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 flex items-center justify-between relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/40 dark:to-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-2xl shadow-inner border border-indigo-200/50 dark:border-indigo-700/50">
                    {dept.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-xl leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1.5">{dept}</h3>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-900/50 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
                      <Users size={12} className="opacity-70" /> {deptCounts[dept] || 0} Workers
                    </p>
                  </div>
                </div>
                <div className="text-gray-300 group-hover:text-indigo-500 transition-colors">
                  <ChevronRight size={20} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : filteredWorkers.length === 0 ? (
        /* Empty State inside Department */
        <div className="flex flex-col items-center justify-center py-16 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
          <div className="w-16 h-16 bg-[var(--theme-primary)]/10 rounded-full flex items-center justify-center mb-4">
            <Users className="text-[var(--theme-primary)]" size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Workers in {selectedDept}</h3>
          <p className="text-sm text-gray-500 mb-4">Add the first worker to this department.</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="px-4 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-lg shadow hover:opacity-90 transition-all"
          >
            Add Now
          </motion.button>
        </div>
      ) : (
        /* Workers Grid (Compact Level 2) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredWorkers.map((worker, index) => (
              <motion.div
                key={worker.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-indigo-900/10 border border-white dark:border-gray-700/50 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-gray-100 to-white dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 font-black text-lg shadow-sm border border-gray-200/50 dark:border-gray-600/50">
                    {worker.workerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleOpenModal(worker)}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/20 dark:hover:text-blue-400 rounded-lg transition-all"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenDeleteModal(worker)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 dark:hover:text-red-400 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white truncate mb-3">
                    {worker.workerName}
                  </h3>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                      <Briefcase size={12} className="text-gray-400" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300 text-ellipsis overflow-hidden whitespace-nowrap">
                        {worker.department}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/10 px-2 py-1.5 rounded-lg border border-green-100 dark:border-green-800/30">
                      <Banknote size={12} className="text-green-500" />
                      <span className="text-xs font-bold text-green-700 dark:text-green-400">
                        ₹{worker.salary}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Modal (Compact Version) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={handleCloseModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {workerToEdit ? <Edit2 className="text-blue-500" size={18}/> : <User className="text-indigo-500" size={18}/>}
                  {workerToEdit ? 'Edit Worker' : 'New Worker'}
                </h3>
                <button 
                  onClick={handleCloseModal}
                  className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Worker Name</label>
                  <input
                    required
                    type="text"
                    value={formData.workerName}
                    onChange={e => setFormData({...formData, workerName: e.target.value})}
                    placeholder="Enter full name"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Department</label>
                  <div className="flex gap-2">
                    {DEPARTMENTS.map(dept => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setFormData({...formData, department: dept})}
                        className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all border ${
                          formData.department === dept
                            ? 'bg-gradient-to-r from-[var(--theme-primary)] to-purple-500 text-white border-transparent shadow-md'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Salary</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</div>
                    <input
                      required
                      type="number"
                      value={formData.salary}
                      onChange={e => setFormData({...formData, salary: e.target.value})}
                      placeholder="e.g. 25000"
                      className="w-full pl-7 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 font-semibold bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formData.department}
                    className="flex-1 px-4 py-2 text-sm text-white font-bold bg-[var(--theme-primary)] rounded-lg hover:opacity-90 disabled:opacity-70 flex justify-center items-center gap-2"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={14} /> : null}
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setIsDeleteModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-red-100 text-center"
            >
              <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-500" size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Worker</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 mx-auto">
                Delete <span className="font-bold text-gray-700 dark:text-gray-200">"{workerToDelete?.workerName}"</span>? This will permanently remove the row.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm text-gray-700 font-semibold bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 text-sm text-white font-bold bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : null}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
