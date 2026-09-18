'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ChevronDown, ExternalLink, Search, Users, Layers, AlertCircle } from 'lucide-react';

interface AlignmentStep {
    step: number;
    stepName: string;
    doerName: string;
    tatValue?: number;
    tatUnit?: string;
}

interface AlignmentModule {
    id: string;
    name: string;
    href: string;
    hasSetup: boolean;
    steps: AlignmentStep[];
}

interface AssignmentRow {
    moduleId: string;
    moduleName: string;
    href: string;
    hasSetup: boolean;
    step: number;
    stepName: string;
    doerName: string;
    tatValue?: number;
    tatUnit?: string;
}

const UNASSIGNED_KEY = '__unassigned__';

function jumpHref(mod: { href: string; hasSetup: boolean }) {
    return mod.hasSetup ? `${mod.href}?view=setup` : mod.href;
}

function formatTat(step: { tatValue?: number; tatUnit?: string }) {
    if (step.tatValue == null || Number.isNaN(step.tatValue) || !step.tatUnit) return '—';
    return `${step.tatValue} ${step.tatUnit}`;
}

function stepLabel(step: number, stepName: string) {
    if (!step) return stepName || 'Responsible';
    return `Step ${step}${stepName ? ` · ${stepName}` : ''}`;
}

export default function FmsDoerAlignmentPage() {
    const [modules, setModules] = useState<AlignmentModule[]>([]);
    const [users, setUsers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState<'doer' | 'module'>('doer');
    const [search, setSearch] = useState('');
    const [selectedDoer, setSelectedDoer] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError('');
                const [alignRes, usersRes] = await Promise.all([
                    fetch('/api/fms-doer-alignment', { cache: 'no-store' }),
                    fetch('/api/users', { cache: 'no-store' }),
                ]);

                if (!alignRes.ok) {
                    throw new Error('Failed to load alignment data');
                }

                const alignData = await alignRes.json();
                setModules(Array.isArray(alignData.modules) ? alignData.modules : []);

                if (usersRes.ok) {
                    const usersData = await usersRes.json();
                    const names = (usersData.users || [])
                        .map((u: any) => String(u.username || '').trim())
                        .filter(Boolean);
                    setUsers(names);
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load FMS doer alignment');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const assignments = useMemo<AssignmentRow[]>(() => {
        return modules.flatMap((mod) =>
            (mod.steps || []).map((step) => ({
                moduleId: mod.id,
                moduleName: mod.name,
                href: mod.href,
                hasSetup: mod.hasSetup,
                step: step.step,
                stepName: step.stepName,
                doerName: step.doerName,
                tatValue: step.tatValue,
                tatUnit: step.tatUnit,
            }))
        );
    }, [modules]);

    const query = search.trim().toLowerCase();

    const doerGroups = useMemo(() => {
        const map = new Map<string, AssignmentRow[]>();

        assignments.forEach((row) => {
            const key = row.doerName || UNASSIGNED_KEY;
            const list = map.get(key) || [];
            list.push(row);
            map.set(key, list);
        });

        const groups = Array.from(map.entries()).map(([key, rows]) => ({
            key,
            name: key === UNASSIGNED_KEY ? 'Unassigned' : key,
            isUnassigned: key === UNASSIGNED_KEY,
            rows,
        }));

        groups.sort((a, b) => {
            if (a.isUnassigned) return 1;
            if (b.isUnassigned) return -1;
            return a.name.localeCompare(b.name);
        });

        return groups.filter((group) => {
            if (selectedDoer) {
                if (selectedDoer === UNASSIGNED_KEY) return group.isUnassigned;
                return group.name.toLowerCase() === selectedDoer.toLowerCase();
            }
            if (!query) return true;
            if (group.name.toLowerCase().includes(query)) return true;
            return group.rows.some(
                (row) =>
                    row.moduleName.toLowerCase().includes(query) ||
                    row.stepName.toLowerCase().includes(query) ||
                    String(row.step).includes(query)
            );
        }).map((group) => {
            if (!query || group.name.toLowerCase().includes(query) || selectedDoer) return group;
            return {
                ...group,
                rows: group.rows.filter(
                    (row) =>
                        row.moduleName.toLowerCase().includes(query) ||
                        row.stepName.toLowerCase().includes(query) ||
                        String(row.step).includes(query)
                ),
            };
        });
    }, [assignments, query, selectedDoer]);

    const moduleGroups = useMemo(() => {
        return modules
            .filter((mod) => {
                if (!query) return true;
                if (mod.name.toLowerCase().includes(query)) return true;
                return (mod.steps || []).some(
                    (step) =>
                        step.stepName.toLowerCase().includes(query) ||
                        step.doerName.toLowerCase().includes(query)
                );
            })
            .map((mod) => {
                const matchModule = !query || mod.name.toLowerCase().includes(query);
                const steps = matchModule
                    ? mod.steps
                    : (mod.steps || []).filter(
                        (step) =>
                            step.stepName.toLowerCase().includes(query) ||
                            step.doerName.toLowerCase().includes(query)
                    );
                const unassignedCount = (mod.steps || []).filter((s) => !s.doerName).length;
                return { ...mod, steps, unassignedCount };
            });
    }, [modules, query]);

    const assignedPeople = useMemo(() => {
        const names = new Set<string>();
        assignments.forEach((row) => {
            if (row.doerName) names.add(row.doerName);
        });
        users.forEach((name) => names.add(name));
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [assignments, users]);

    const unassignedCount = assignments.filter((row) => !row.doerName).length;
    const peopleCount = new Set(assignments.filter((row) => row.doerName).map((row) => row.doerName.toLowerCase())).size;

    useEffect(() => {
        if (query || selectedDoer) {
            if (view === 'doer') {
                setExpanded(new Set(doerGroups.map((g) => g.key)));
            } else {
                setExpanded(new Set(moduleGroups.map((g) => g.id)));
            }
        }
    }, [query, selectedDoer, view, doerGroups, moduleGroups]);

    const toggle = (key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const ChangeLink = ({ href, hasSetup }: { href: string; hasSetup: boolean }) => (
        <Link
            href={jumpHref({ href, hasSetup })}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[var(--theme-primary)]/15 text-slate-800 dark:text-slate-100 hover:bg-[var(--theme-primary)] hover:text-white transition-colors"
        >
            {hasSetup ? 'Open Setup' : 'Change'}
            <ExternalLink className="w-3 h-3" />
        </Link>
    );

    return (
        <LayoutWrapper>
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            FMS Doer Alignment
                        </h1>
                        <p className="text-[12px] text-gray-400 font-bold underline decoration-[var(--theme-primary)] decoration-2 underline-offset-4 uppercase tracking-widest leading-none mt-2">
                            Lookup who is aligned to which FMS step. Change assignments on the module Setup page.
                        </p>
                    </div>

                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button
                            onClick={() => setView('doer')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'doer' ? 'bg-[var(--theme-primary)] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Doer-wise
                        </button>
                        <button
                            onClick={() => setView('module')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'module' ? 'bg-[var(--theme-primary)] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            Module-wise
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={view === 'doer' ? 'Search person, module, or step...' : 'Search module, step, or doer...'}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-[var(--theme-primary)]"
                        />
                    </div>
                    {view === 'doer' && (
                        <select
                            value={selectedDoer}
                            onChange={(e) => setSelectedDoer(e.target.value)}
                            className="md:w-64 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-[var(--theme-primary)]"
                        >
                            <option value="">All people</option>
                            <option value={UNASSIGNED_KEY}>Unassigned</option>
                            {assignedPeople.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        {modules.length} modules
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        {peopleCount} people aligned
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                        {unassignedCount} unassigned steps
                    </span>
                </div>

                {loading ? (
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-16 text-center shadow-sm">
                        <div className="w-10 h-10 border-2 border-slate-200 border-t-[var(--theme-primary)] rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading alignment...</p>
                    </div>
                ) : error ? (
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-red-100 dark:border-red-900 p-10 text-center shadow-sm">
                        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                        <p className="text-sm font-bold text-red-600">{error}</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {view === 'doer' ? (
                            <motion.div
                                key="doer"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="space-y-3"
                            >
                                {doerGroups.length === 0 ? (
                                    <EmptyState message="No matching people or steps." />
                                ) : (
                                    doerGroups.map((group) => {
                                        const open = expanded.has(group.key);
                                        return (
                                            <div key={group.key} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                                <button
                                                    onClick={() => toggle(group.key)}
                                                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${group.isUnassigned ? 'bg-amber-100 text-amber-700' : 'bg-[var(--theme-primary)]/20 text-slate-800 dark:text-slate-100'}`}>
                                                            <Users className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{group.name}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.rows.length} step{group.rows.length === 1 ? '' : 's'}</p>
                                                        </div>
                                                    </div>
                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                                                </button>
                                                {open && (
                                                    <div className="border-t border-slate-100 dark:border-slate-700 overflow-x-auto">
                                                        <table className="w-full text-left">
                                                            <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                <tr>
                                                                    <th className="px-5 py-3">Module</th>
                                                                    <th className="px-5 py-3">Step</th>
                                                                    <th className="px-5 py-3">Step name</th>
                                                                    <th className="px-5 py-3 text-right">Change</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {group.rows.map((row) => (
                                                                    <tr key={`${row.moduleId}-${row.step}-${row.stepName}`} className="border-t border-slate-50 dark:border-slate-700/60 text-sm">
                                                                        <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">{row.moduleName}</td>
                                                                        <td className="px-5 py-3 text-slate-500">{row.step || '—'}</td>
                                                                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{row.stepName || '—'}</td>
                                                                        <td className="px-5 py-3 text-right">
                                                                            <ChangeLink href={row.href} hasSetup={row.hasSetup} />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="module"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="space-y-3"
                            >
                                {moduleGroups.length === 0 ? (
                                    <EmptyState message="No matching modules or steps." />
                                ) : (
                                    moduleGroups.map((mod) => {
                                        const open = expanded.has(mod.id);
                                        return (
                                            <div key={mod.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                                <div className="flex items-center justify-between gap-4 px-5 py-4">
                                                    <button
                                                        onClick={() => toggle(mod.id)}
                                                        className="flex items-center gap-3 min-w-0 text-left flex-1 hover:opacity-80 transition-opacity"
                                                    >
                                                        <div className="w-9 h-9 rounded-xl bg-[var(--theme-primary)]/20 text-slate-800 dark:text-slate-100 flex items-center justify-center shrink-0">
                                                            <Layers className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{mod.name}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                {mod.steps.length} step{mod.steps.length === 1 ? '' : 's'}
                                                                {mod.unassignedCount > 0 ? ` · ${mod.unassignedCount} unassigned` : ''}
                                                            </p>
                                                        </div>
                                                    </button>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <ChangeLink href={mod.href} hasSetup={mod.hasSetup} />
                                                        <button onClick={() => toggle(mod.id)} className="p-1 text-slate-400 hover:text-slate-600">
                                                            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {open && (
                                                    <div className="border-t border-slate-100 dark:border-slate-700 overflow-x-auto">
                                                        <table className="w-full text-left">
                                                            <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                <tr>
                                                                    <th className="px-5 py-3">Step</th>
                                                                    <th className="px-5 py-3">Name</th>
                                                                    <th className="px-5 py-3">Doer</th>
                                                                    <th className="px-5 py-3">TAT</th>
                                                                    <th className="px-5 py-3 text-right">Change</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {mod.steps.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-400">No steps configured.</td>
                                                                    </tr>
                                                                ) : (
                                                                    mod.steps.map((step) => (
                                                                        <tr key={`${mod.id}-${step.step}-${step.stepName}`} className="border-t border-slate-50 dark:border-slate-700/60 text-sm">
                                                                            <td className="px-5 py-3 text-slate-500">{step.step || '—'}</td>
                                                                            <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">{step.stepName || stepLabel(step.step, step.stepName)}</td>
                                                                            <td className="px-5 py-3">
                                                                                {step.doerName ? (
                                                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{step.doerName}</span>
                                                                                ) : (
                                                                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-700 text-slate-400">Unassigned</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-5 py-3 text-slate-500">{formatTat(step)}</td>
                                                                            <td className="px-5 py-3 text-right">
                                                                                <ChangeLink href={mod.href} hasSetup={mod.hasSetup} />
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </LayoutWrapper>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-12 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{message}</p>
        </div>
    );
}
