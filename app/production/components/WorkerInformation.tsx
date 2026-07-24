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
  incentive: string;
  gender: string;
  otRate: string;
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
  const [formData, setFormData] = useState({ workerName: '', department: '', salary: '', incentive: 'No', gender: 'Male', otRate: '40' });
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
        salary: worker.salary,
        incentive: worker.incentive || 'No',
        gender: worker.gender || 'Male',
        otRate: worker.otRate || '40'
      });
    } else {
      setWorkerToEdit(null);
      setFormData({ workerName: '', department: selectedDept || '', salary: '', incentive: 'No', gender: 'Male', otRate: '40' });
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
                className="group relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-3xl p-6 shadow-[0_10px_40px_rgb(0,0,0,0.04)] dark:shadow-indigo-900/10 border border-white dark:border-gray-700/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1.5 transition-all duration-300 overflow-hidden"
              >
                {/* Background Accent */}
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.08] group-hover:scale-150 transition-transform duration-700 ${worker.gender === 'Female' ? 'bg-pink-500' : 'bg-blue-500'}`}></div>

                <div className="flex items-start justify-between mb-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border-2 border-white dark:border-gray-700 transform -rotate-3 group-hover:rotate-0 transition-transform duration-300 ${
                    worker.gender === 'Female' 
                      ? 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-pink-200 dark:shadow-pink-900/20' 
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-200 dark:shadow-blue-900/20'
                  }`}>
                    {worker.workerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex gap-1 bg-gray-50/50 dark:bg-gray-900/40 p-1 rounded-xl border border-gray-100 dark:border-gray-700/50">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenModal(worker); }}
                      className="relative z-20 p-2 text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all shadow-sm active:scale-90"
                      title="Edit"
                      aria-label="Edit worker"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal(worker); }}
                      className="relative z-20 p-2 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all shadow-sm active:scale-90"
                      title="Delete"
                      aria-label="Delete worker"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white truncate">
                      {worker.workerName}
                    </h3>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                      worker.gender === 'Female' 
                        ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' 
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {worker.gender === 'Female' ? 'F' : 'M'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-4">
                    <Briefcase size={12} className="opacity-70" />
                    <span className="text-xs font-bold">{worker.department} Department</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/30 shadow-inner">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest opacity-80">Monthly Salary</span>
                        <div className="flex items-center gap-1">
                          <Banknote size={10} className="text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">₹{worker.otRate}/h OT</span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">₹{Number(worker.salary).toLocaleString()}</span>
                        <span className="text-xs font-bold text-gray-400">/mo</span>
                      </div>
                    </div>
                    
                    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                      worker.incentive === 'Yes' 
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-400' 
                        : 'bg-gray-50 dark:bg-gray-900/40 border-gray-100 dark:border-gray-800 text-gray-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={12} className={worker.incentive === 'Yes' ? 'text-indigo-500' : 'opacity-40'} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Incentive</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        worker.incentive === 'Yes' 
                          ? 'bg-indigo-500 text-white shadow-sm' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}>
                        {worker.incentive === 'Yes' ? 'YES' : 'NO'}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Gender</label>
                    <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
                      {['Male', 'Female'].map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setFormData({
                            ...formData, 
                            gender: g, 
                            otRate: g === 'Female' ? '36' : '40' // Default rates
                          })}
                          className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                            formData.gender === g
                              ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-900/30'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {g.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">OT Rate / Hour</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</div>
                      <input
                        required
                        type="number"
                        value={formData.otRate}
                        onChange={e => setFormData({...formData, otRate: e.target.value})}
                        className="w-full pl-7 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${formData.incentive === 'Yes' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                      <AlertTriangle size={14} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 leading-none">Incentive Eligibility</p>
                      <p className="text-[9px] text-gray-500 mt-0.5">₹500 for perfect attendance</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, incentive: formData.incentive === 'Yes' ? 'No' : 'Yes'})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      formData.incentive === 'Yes' ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.incentive === 'Yes' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
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
