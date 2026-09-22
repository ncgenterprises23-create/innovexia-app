'use client';

import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, X, Search, Ban, RotateCcw, Filter, Plus, Pencil, Trash2,
    ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, Settings2, Download,
    ClipboardList, FileText, Package, Factory, Boxes, Truck, Clock,
    Hash, CalendarDays, Link2, CircleDollarSign, Landmark, Timer, Hammer
} from 'lucide-react';
import { useSetupViewFromQuery } from '@/hooks/useSetupViewFromQuery';

interface StepConfig {
    step: number;
    stepName: string;
    doerName: string;
    tatValue: number;
    tatUnit: 'hours' | 'days';
}

interface ProductFMS {
    id: string;
    Timestamp?: string;
    Cancelled?: string;
    _rowIndex?: number;
    [key: string]: any;
}

type ViewMode = 'data' | 'cancelled' | 'setup';
type ListStyle = 'smart' | 'standard';
type ColumnFilters = Record<string, string[]>;

const ITEMS_PER_PAGE = 10;
const PRODUCT_MAX_STEP = 15;
const FALLBACK_IDENTITY = ['Raw Material Name / Dye Name', 'Finish Products Goods'];
const IDENTITY_LABELS: Record<string, string> = {
    'Raw Material Name / Dye Name': 'Raw Material Name / Dye Name',
    'Finish Products Goods': 'Finish Products Goods',
    'Finished Product Name': 'Finish Products Goods',
    'Product Name': 'Finish Products Goods',
    'Party_Name': 'Raw Material Name / Dye Name',
    'Party Name': 'Raw Material Name / Dye Name',
};

function identityLabel(key: string) {
    return IDENTITY_LABELS[key] || key.replace(/_/g, ' ');
}

const STEP_COL = /^(Planned|Actual|Status|Step)_\d+$/;

function isMetaKey(key: string) {
    return !key || key === 'id' || key === '_rowIndex' || /^cancelled$/i.test(key) || /^timestamp$/i.test(key);
}

function isStepKey(key: string) {
    return STEP_COL.test(key);
}

function isExtraKey(key: string) {
    const match = key.match(/_(\d+)$/);
    if (!match || isStepKey(key)) return false;
    const step = Number(match[1]);
    return step >= 1 && step <= 30;
}

function isIdentityKey(key: string) {
    return !isMetaKey(key) && !isStepKey(key) && !isExtraKey(key);
}

function gv(item: any, ...keys: string[]) {
    for (const key of keys) {
        const value = item?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    const wanted = keys.map((k) => String(k).toLowerCase().replace(/[\s._-]+/g, ''));
    for (const [header, value] of Object.entries(item || {})) {
        const n = String(header).toLowerCase().replace(/[\s._-]+/g, '');
        if (wanted.includes(n) && value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
}

function formatDateTime(dateStr?: string) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateBadge(dateStr?: string) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '').toUpperCase();
}

function formatDateShort(dateStr?: string) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateInput(value: string) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDelayInfo(planned?: string, actual?: string) {
    if (!planned) return null;
    const pDate = new Date(planned);
    const refDate = actual ? new Date(actual) : new Date();
    if (isNaN(pDate.getTime()) || isNaN(refDate.getTime())) return null;
    const diffMin = Math.floor((refDate.getTime() - pDate.getTime()) / (1000 * 60));
    if (diffMin > 0) {
        return { text: `${Math.floor(diffMin / 60)}H ${diffMin % 60}M LATE`, color: 'text-rose-500' };
    }
    const absMin = Math.abs(diffMin);
    return { text: `${Math.floor(absMin / 60)}H ${absMin % 60}M ${actual ? 'AHEAD' : 'LEFT'}`, color: 'text-emerald-600' };
}

function isCancelled(item: ProductFMS) {
    return String(item.Cancelled || '').trim().toLowerCase() === 'yes';
}

function isStepPassed(item: ProductFMS, step: number) {
    if (item[`Actual_${step}`]) return true;
    return String(item[`Status_${step}`] || '').trim().toLowerCase() === 'skipped';
}

function isStepSkipped(item: ProductFMS, step: number) {
    return !item[`Actual_${step}`] && String(item[`Status_${step}`] || '').trim().toLowerCase() === 'skipped';
}

function getCurrentStep(item: ProductFMS, maxStep: number) {
    let step = 1;
    for (let s = 1; s <= maxStep; s++) {
        if (isStepPassed(item, s)) step = s + 1;
        else break;
    }
    return step;
}

function extraFieldKeys(item: ProductFMS, step: number) {
    const suffix = `_${step}`;
    const skip = new Set([`Planned_${step}`, `Actual_${step}`, `Status_${step}`, `Step_${step}`]);
    return Object.keys(item).filter((key) => (
        key.endsWith(suffix) &&
        !skip.has(key) &&
        !/^Step_\d+$/.test(key) &&
        !key.startsWith('_') &&
        !isMetaKey(key)
    ));
}

function fieldLabel(key: string, step: number) {
    return key.replace(new RegExp(`_${step}$`), '').replace(/_/g, ' ');
}

function isDateish(key: string) {
    return /date|eta|timestamp/i.test(key);
}

function isYesNoField(key: string) {
    return /die.?required|sample.?ok/i.test(key);
}

function isYesNoValue(value: string) {
    return /^(y|yes|n|no|true|false|1|0)$/i.test(String(value || '').trim());
}

function extraFieldMeta(key: string) {
    const k = key.toLowerCase();
    if (/die/.test(k)) return { Icon: Hammer, color: 'text-orange-500' };
    if (/sample/.test(k)) return { Icon: Package, color: 'text-amber-600' };
    if (/qty|quantity|piece/.test(k)) return { Icon: Boxes, color: 'text-orange-500' };
    if (/value|amount|price|cost|duty/.test(k)) return { Icon: CircleDollarSign, color: 'text-emerald-500' };
    if (/order.?no|reference|voucher|\bno\b/.test(k)) return { Icon: Hash, color: 'text-violet-500' };
    if (/date|eta/.test(k)) return { Icon: CalendarDays, color: 'text-sky-500' };
    if (/url|copy|document/.test(k)) return { Icon: Link2, color: 'text-amber-500' };
    if (/factory|plant|warehouse/.test(k)) return { Icon: Factory, color: 'text-teal-500' };
    if (/party|supplier|vendor/.test(k)) return { Icon: Landmark, color: 'text-indigo-500' };
    if (/remark|reason|feedback/.test(k)) return { Icon: FileText, color: 'text-slate-500' };
    if (/stock|po/.test(k)) return { Icon: Truck, color: 'text-cyan-600' };
    return { Icon: ClipboardList, color: 'text-slate-500' };
}

function productTitle(item: ProductFMS) {
    return String(gv(
        item,
        'Finish Products Goods',
        'Finished Product Name',
        'Product Name',
        'Item_name',
        'Item Name',
        'Product',
    ) || 'Untitled');
}

function productMaterial(item: ProductFMS) {
    return String(gv(
        item,
        'Raw Material Name / Dye Name',
        'Raw Material Name',
        'Dye Name',
        'Party_Name',
        'Party Name',
    ) || '');
}

function extraDetailFields(item: ProductFMS) {
    const preferred = [
        'Die_Cost_2',
        'Plant_Cost_2',
        'Piece_Requirement_3',
        'Die_Required_1',
        'Die_Due_Date_2',
        'Piece_Due_Date_3',
        'New_Sample_Due_Date_9',
        'Sample_OK_10',
    ];
    const seen = new Set<string>();
    const details: { key: string; label: string; value: string }[] = [];
    const push = (key: string, value: any) => {
        if (seen.has(key)) return;
        const text = value == null ? '' : String(value).trim();
        if (!text) return;
        seen.add(key);
        const step = Number(String(key).split('_').pop());
        details.push({
            key,
            label: Number.isFinite(step) ? fieldLabel(key, step) : key.replace(/_/g, ' '),
            value: isDateish(key) ? formatDateShort(text) : text,
        });
    };
    preferred.forEach((key) => push(key, gv(item, key)));
    Object.keys(item || {}).forEach((key) => {
        if (!isExtraKey(key) || isStepKey(key)) return;
        push(key, item[key]);
    });
    return details;
}

function ensureCompleteExtras(item: ProductFMS, step: number) {
    const extras: Record<string, string> = {};
    extraFieldKeys(item, step).forEach((key) => {
        extras[key] = item[key] == null ? '' : String(item[key]);
    });
    const has = (re: RegExp) => Object.keys(extras).some((key) => re.test(key));
    if (step === 1 && !has(/die.?required/i)) extras.Die_Required_1 = String(gv(item, 'Die_Required_1', 'Die Required', 'Die_Required') || '');
    if (step === 3 && !has(/piece.?due/i)) extras.Piece_Due_Date_3 = String(gv(item, 'Piece_Due_Date_3', 'Piece Due Date', 'Piece_Due_Date') || '');
    if (step === 9 && !has(/sample.?due|due.?date/i)) extras.New_Sample_Due_Date_9 = String(gv(item, 'New_Sample_Due_Date_9', 'New Sample Due Date', 'New_Sample_Due_Date', 'Sample Due Date') || '');
    if (step === 10 && !has(/sample.?ok/i)) extras.Sample_OK_10 = String(gv(item, 'Sample_OK_10', 'Sample OK', 'Sample_OK') || '');
    return extras;
}

const STEP_ICONS = [ClipboardList, Hammer, FileText, Clock, Timer, CalendarDays, Package, FileText, CalendarDays, CheckCircle2, Clock, Timer, Package, Boxes, Truck];
const STEP_TONES = [
    'text-orange-500',
    'text-teal-600',
    'text-sky-500',
    'text-violet-500',
    'text-amber-600',
    'text-emerald-600',
    'text-rose-500',
    'text-cyan-600',
    'text-indigo-500',
    'text-lime-600',
    'text-fuchsia-500',
    'text-blue-500',
    'text-pink-500',
    'text-green-600',
    'text-yellow-600',
];

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';
const LIGHT_BG = 'bg-[var(--theme-light)] dark:bg-[var(--theme-primary)]/15';
const LIGHT_BORDER = 'border border-[var(--theme-primary)]/25';
const LIGHT_SURFACE = `${LIGHT_BG} ${LIGHT_BORDER} ${DASH_SHADOW}`;

const STEP_LABELS: Record<number, string> = {
    1: 'Check if Die is Required',
    2: 'Capture Die Details (Die Cost, Die Due Date, Plant Cost)',
    3: 'Confirm Piece Requirement (Piece Requirement, Piece Due Date)',
    4: 'Follow-up 1',
    5: 'Follow-up 2',
    6: 'Follow-up 3',
    7: 'Sample Received',
    8: 'Provide Feedback and Request New Sample',
    9: 'Enter New Sample Due Date',
    10: 'Sample OK',
    11: 'Follow-up 1 before new sample',
    12: 'Follow-up 2 before new sample',
    13: '2nd Sample Received',
    14: 'Stock Ready / Stock Received',
    15: 'Order Stock Create PO',
};

const STEP_SHORT_LABELS: Record<number, string> = {
    1: 'Check Die Required',
    2: 'Capture Die Details',
    3: 'Confirm Piece Req',
    4: 'Follow-up 1',
    5: 'Follow-up 2',
    6: 'Follow-up 3',
    7: 'Sample Received',
    8: 'Provide Feedback',
    9: 'New Sample Due Date',
    10: 'Sample OK',
    11: 'Resample Follow-up 1',
    12: 'Resample Follow-up 2',
    13: '2nd Sample Received',
    14: 'Stock Ready',
    15: 'Order Stock',
};

function labelForStep(step: number, sheetName?: string) {
    const fromSheet = String(sheetName || '').trim();
    return fromSheet || STEP_LABELS[step] || '';
}

function shortStepName(step: number, full?: string) {
    const source = String(full || '').trim();
    const mapped = STEP_SHORT_LABELS[step];
    if (mapped && (!source || source === STEP_LABELS[step])) return mapped;
    if (source.length <= 22) return source || mapped || `Step ${step}`;
    return `${source.slice(0, 20).trimEnd()}…`;
}

function defaultSetupRows(fromSheet: StepConfig[] = []): StepConfig[] {
    const byStep = new Map(fromSheet.map((c) => [Number(c.step), c]));
    return Array.from({ length: PRODUCT_MAX_STEP }, (_, i) => {
        const step = i + 1;
        const cfg = byStep.get(step);
        const tatRaw = cfg?.tatValue;
        const tatValue = tatRaw != null && String(tatRaw).trim() !== '' && Number(tatRaw) > 0 ? Number(tatRaw) : 0;
        return {
            step,
            stepName: labelForStep(step, cfg?.stepName),
            doerName: cfg?.doerName || '',
            tatValue,
            tatUnit: (cfg?.tatUnit || 'days') as 'hours' | 'days',
        };
    });
}

function isRmIdentityField(key: string) {
    return /raw material|dye name|^party_name$|^party name$/i.test(key);
}

function isFgIdentityField(key: string) {
    return /finish products goods|finished product|^product name$/i.test(key);
}

function NameCombobox({
    label,
    value,
    options,
    onChange,
    placeholder,
    Icon,
    iconColor,
    loading = false,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder: string;
    Icon: typeof Search;
    iconColor: string;
    loading?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => { setQuery(value); }, [value]);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const needle = query.trim().toLowerCase();
    const filtered = needle
        ? options.filter((opt) => opt.toLowerCase().includes(needle))
        : options;
    const exactMatch = options.some((opt) => opt.toLowerCase() === needle);
    const canAdd = needle !== '' && !exactMatch;
    const visible = filtered.slice(0, 120);

    const select = (next: string) => {
        onChange(next);
        setQuery(next);
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1">{label}</label>
            <div className="relative">
                <Icon className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${iconColor}`} />
                <input
                    type="text"
                    value={query}
                    placeholder={placeholder}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    className={`w-full pl-10 pr-8 py-2.5 rounded-xl ${LIGHT_BG} ${LIGHT_BORDER} text-sm outline-none`}
                />
                {loading ? (
                    <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                ) : (
                    <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                )}
            </div>
            {open && (
                <div className={`absolute z-[10002] mt-1 w-full max-h-56 overflow-y-auto rounded-xl ${LIGHT_BG} ${LIGHT_BORDER} ${DASH_SHADOW}`}>
                    {loading && options.length === 0 && (
                        <p className="px-3 py-2 text-[11px] text-slate-400">Loading names…</p>
                    )}
                    {!loading && visible.length === 0 && !canAdd && (
                        <p className="px-3 py-2 text-[11px] text-slate-400">No matches. Type a name to add it.</p>
                    )}
                    {visible.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onMouseDown={() => select(opt)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--theme-primary)]/20 ${opt === value ? 'font-black text-gray-900' : 'text-slate-700 dark:text-slate-200'}`}
                        >
                            {opt}
                        </button>
                    ))}
                    {canAdd && (
                        <button
                            type="button"
                            onMouseDown={() => select(query.trim())}
                            className="w-full text-left px-3 py-2 text-xs font-black text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/20 border-t border-[var(--theme-primary)]/20"
                        >
                            Add new “{query.trim()}”
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function FieldStat({ label, value, tone, Icon }: { label: string; value: string; tone: string; Icon: typeof Hash }) {
    return (
        <div className="min-w-0">
            <p className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${tone}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
            </p>
            <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-tight">{value || '—'}</p>
        </div>
    );
}

function StepMiniCard({
    step,
    name,
    planned,
    actual,
    extras,
    isCurrent,
    skipped,
}: {
    step: number;
    name: string;
    planned?: string;
    actual?: string;
    extras: { key: string; label: string; value: string }[];
    isCurrent?: boolean;
    skipped?: boolean;
}) {
    const delay = skipped ? null : getDelayInfo(planned, actual);
    const completed = !!actual;
    const displayValue = (key: string, value: string) => {
        if (!value) return '-';
        if (isDateish(key)) return formatDateShort(value).toUpperCase();
        return value;
    };
    return (
        <div className={`w-[210px] shrink-0 rounded-2xl border px-3 py-2.5 ${isCurrent ? 'border-emerald-400 bg-emerald-50/70' : skipped ? 'border-slate-200 bg-slate-50 dark:bg-slate-900' : 'border-emerald-300 bg-white dark:bg-slate-900'} ${DASH_SHADOW}`}>
            <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wide">ST {step}</p>
                {skipped ? (
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Skipped</span>
                ) : completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
            </div>
            <p className="text-[13px] font-black text-slate-800 dark:text-white leading-snug mt-0.5 line-clamp-2 min-h-[2.2rem]">{name || `Step ${step}`}</p>
            <div className="mt-2 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Planned</span>
                    <span className="text-[11px] font-bold text-slate-700">{planned ? formatDateShort(planned).toUpperCase() : '-'}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Actual</span>
                    <span className="text-[11px] font-bold text-slate-700">{skipped ? 'SKIPPED' : actual ? formatDateShort(actual).toUpperCase() : '-'}</span>
                </div>
                {extras.map((field) => (
                    <div key={field.key} className="flex items-baseline justify-between gap-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 shrink-0">{field.label}</span>
                        <span className="text-[11px] font-bold text-slate-700 text-right break-all">{displayValue(field.key, field.value)}</span>
                    </div>
                ))}
            </div>
            <p className={`mt-1.5 text-right text-[11px] font-black ${delay?.color || 'text-slate-300'}`}>{delay?.text || '—'}</p>
        </div>
    );
}

export default function ProductFmsPage() {
    const [data, setData] = useState<ProductFMS[]>([]);
    const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('data');
    const [listStyle, setListStyle] = useState<ListStyle>('smart');
    useSetupViewFromQuery(setViewMode);
    const [activeStepFilter, setActiveStepFilter] = useState<number | 'all' | 'completed'>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState<ColumnFilters>({});
    const [filterQueries, setFilterQueries] = useState<Record<string, string>>({});
    const [openFilterKey, setOpenFilterKey] = useState<string>('');

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDoneModalOpen, setIsDoneModalOpen] = useState(false);
    const [isRemoveOpen, setIsRemoveOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [cancellingItem, setCancellingItem] = useState<ProductFMS | null>(null);
    const [deletingItem, setDeletingItem] = useState<ProductFMS | null>(null);
    const [doneItem, setDoneItem] = useState<ProductFMS | null>(null);
    const [removeTarget, setRemoveTarget] = useState<ProductFMS | null>(null);
    const [removeStep, setRemoveStep] = useState<number | 'all'>('all');
    const [editingItem, setEditingItem] = useState<ProductFMS | null>(null);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [stepExtras, setStepExtras] = useState<Record<string, string>>({});

    const toast = useToast();
    const loader = useLoader();
    const [stepConfigs, setStepConfigs] = useState<StepConfig[]>(() => defaultSetupRows());
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [rmNames, setRmNames] = useState<string[]>([]);
    const [fgNames, setFgNames] = useState<string[]>([]);
    const [imsLoading, setImsLoading] = useState(false);

    const identityFields = useMemo(() => {
        const seen = new Set<string>();
        const keys: string[] = [];
        const add = (key: string) => {
            if (!isIdentityKey(key) || seen.has(key)) return;
            seen.add(key);
            keys.push(key);
        };
        sheetHeaders.forEach(add);
        data.forEach((item) => Object.keys(item).forEach(add));
        if (keys.length === 0) FALLBACK_IDENTITY.forEach(add);
        return keys.map((key) => ({ key, label: identityLabel(key) }));
    }, [sheetHeaders, data]);

    const inferredMaxStep = useMemo(() => {
        let max = 0;
        data.forEach((item) => {
            Object.keys(item).forEach((key) => {
                const match = key.match(/^(?:Planned|Actual|Status)_(\d+)$/);
                if (match) max = Math.max(max, Number(match[1]));
            });
        });
        return max;
    }, [data]);

    const maxStep = Math.max(
        PRODUCT_MAX_STEP,
        inferredMaxStep,
        ...stepConfigs.map((c) => Number(c.step) || 0),
    );

    const navSteps = useMemo(() => {
        const byStep = new Map(stepConfigs.map((c) => [Number(c.step), c]));
        const count = Math.max(
            PRODUCT_MAX_STEP,
            inferredMaxStep,
            stepConfigs.reduce((m, c) => Math.max(m, Number(c.step) || 0), 0),
        );
        return Array.from({ length: count }, (_, i) => {
            const step = i + 1;
            const cfg = byStep.get(step);
            return {
                step,
                stepName: labelForStep(step, cfg?.stepName),
                doerName: cfg?.doerName || '',
                tatValue: cfg?.tatValue || 0,
                tatUnit: (cfg?.tatUnit || 'days') as 'hours' | 'days',
            };
        });
    }, [stepConfigs, inferredMaxStep]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/product-fms', { cache: 'no-store' });
            const json = await res.json();
            setData(Array.isArray(json.data) ? json.data : []);
            setSheetHeaders(Array.isArray(json.headers) ? json.headers : []);
        } catch {
            toast.error('Failed to load Product FMS data');
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/product-fms-config', { cache: 'no-store' });
            const json = await res.json();
            setStepConfigs(defaultSetupRows(Array.isArray(json.config) ? json.config : []));
        } catch {
            setStepConfigs(defaultSetupRows());
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const json = await res.json();
                setSystemUsers(json.users || []);
            }
        } catch {
            setSystemUsers([]);
        }
    };

    const extractImsNames = (rows: any[]) => {
        const names = new Set<string>();
        rows.forEach((row) => {
            const value = row?.item_name ?? row?.['Item Name'] ?? row?.Item_Name ?? row?.itemName ?? row?.Item ?? row?.name ?? row?.Name ?? '';
            const name = String(value || '').trim();
            if (name && name !== '-') names.add(name);
        });
        return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    };

    const fetchImsNames = async () => {
        setImsLoading(true);
        const load = async (type: 'rm' | 'fg') => {
            try {
                const res = await fetch(`/api/ims-item?type=${type}`, { cache: 'no-store' });
                if (res.ok) {
                    const json = await res.json();
                    if (Array.isArray(json.names) && json.names.length > 0) return json.names as string[];
                }
            } catch {
                // fall through to the IMS list APIs
            }
            try {
                const sheet = type === 'rm' ? 'Raw Material' : 'Finish Goods';
                const path = type === 'rm' ? '/api/ims-rm' : '/api/ims-fg';
                const res = await fetch(`${path}?sheetName=${encodeURIComponent(sheet)}`, { cache: 'no-store' });
                if (!res.ok) return [];
                const rows = await res.json();
                return extractImsNames(Array.isArray(rows) ? rows : []);
            } catch {
                return [];
            }
        };
        try {
            const [rm, fg] = await Promise.all([load('rm'), load('fg')]);
            setRmNames(rm);
            setFgNames(fg);
        } finally {
            setImsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchConfig();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!isFormOpen) return;
        if (rmNames.length > 0 && fgNames.length > 0) return;
        fetchImsNames();
    }, [isFormOpen]);

    const activePool = useMemo(() => (
        data.filter((d) => viewMode === 'cancelled' ? isCancelled(d) : !isCancelled(d))
    ), [data, viewMode]);

    const activeData = useMemo(() => {
        let filtered = [...activePool];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter((item) => Object.values(item).some((val) => String(val || '').toLowerCase().includes(q)));
        }

        identityFields.forEach((field) => {
            const selected = appliedFilters[field.key] || [];
            if (!selected.length) return;
            filtered = filtered.filter((item) => selected.includes(String(gv(item, field.key) || '').trim()));
        });

        if (viewMode === 'data' && activeStepFilter === 'completed' && maxStep > 0) {
            filtered = filtered.filter((item) => getCurrentStep(item, maxStep) > maxStep);
        } else if (viewMode === 'data' && activeStepFilter !== 'all' && maxStep > 0) {
            filtered = filtered.filter((item) => getCurrentStep(item, maxStep) === activeStepFilter);
        }

        if (viewMode === 'data' && activeTimeFilter) {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            filtered = filtered.filter((item) => {
                const currentStep = getCurrentStep(item, maxStep);
                if (currentStep > maxStep) return false;
                const plannedStr = item[`Planned_${currentStep}`];
                if (!plannedStr) return false;
                const pDate = new Date(plannedStr);
                if (isNaN(pDate.getTime())) return false;
                const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
                const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);
                if (activeTimeFilter === 'Yesterday') return diffDays === -1;
                if (activeTimeFilter === 'Today') return diffDays === 0;
                if (activeTimeFilter === 'Tomorrow') return diffDays === 1;
                return true;
            });
        }

        return filtered;
    }, [activePool, viewMode, activeStepFilter, activeTimeFilter, searchQuery, maxStep, appliedFilters, identityFields]);

    const statusStats = useMemo(() => {
        const stats: Record<string, number> = { all: activePool.length };
        navSteps.forEach((cfg) => {
            stats[String(cfg.step)] = activePool.filter((r) => getCurrentStep(r, maxStep) === cfg.step).length;
        });
        stats.completed = activePool.filter((r) => maxStep > 0 && getCurrentStep(r, maxStep) > maxStep).length;
        return stats;
    }, [activePool, navSteps, maxStep]);

    const timeStats = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const stats = { Yesterday: 0, Today: 0, Tomorrow: 0 };
        activePool.forEach((item) => {
            const currentStep = getCurrentStep(item, maxStep);
            if (currentStep > maxStep) return;
            const plannedStr = item[`Planned_${currentStep}`];
            if (!plannedStr) return;
            const pDate = new Date(plannedStr);
            if (isNaN(pDate.getTime())) return;
            const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
            const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);
            if (diffDays === -1) stats.Yesterday++;
            if (diffDays === 0) stats.Today++;
            if (diffDays === 1) stats.Tomorrow++;
        });
        return stats;
    }, [activePool, maxStep]);

    const filterOptions = useMemo(() => {
        const opts: Record<string, string[]> = {};
        identityFields.forEach((field) => {
            const unique = new Set<string>();
            activePool.forEach((item) => {
                const val = String(gv(item, field.key) || '').trim();
                if (val) unique.add(val);
            });
            opts[field.key] = Array.from(unique).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        });
        return opts;
    }, [activePool, identityFields]);

    const appliedFilterCount = identityFields.reduce((sum, field) => sum + (appliedFilters[field.key]?.length || 0), 0);

    const openFilterPanel = () => {
        setFilterQueries({});
        setOpenFilterKey('');
        setIsFilterOpen(true);
    };

    const toggleFilterValue = (key: string, value: string) => {
        setAppliedFilters((prev) => {
            const current = prev[key] || [];
            return {
                ...prev,
                [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
            };
        });
        setCurrentPage(1);
    };

    const selectAllFilter = (key: string, values: string[]) => {
        setAppliedFilters((prev) => ({
            ...prev,
            [key]: Array.from(new Set([...(prev[key] || []), ...values])),
        }));
        setCurrentPage(1);
    };

    const clearAllFilter = (key: string) => {
        setAppliedFilters((prev) => ({ ...prev, [key]: [] }));
        setCurrentPage(1);
    };

    const resetColumnFilters = () => {
        setAppliedFilters({});
        setFilterQueries({});
        setCurrentPage(1);
    };

    const cancelledCount = data.filter(isCancelled).length;
    const totalPages = Math.max(1, Math.ceil(activeData.length / ITEMS_PER_PAGE));
    const paginatedData = activeData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const switchView = (v: ViewMode) => {
        setViewMode(v);
        setCurrentPage(1);
        setActiveStepFilter('all');
    };

    const handleCancel = async () => {
        if (!cancellingItem) return;
        try {
            loader.showLoader();
            const restoring = isCancelled(cancellingItem);
            const res = await fetch('/api/product-fms', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cancellingItem.id, cancelled: !restoring }),
            });
            if (!res.ok) throw new Error('Cancel failed');
            toast.success(restoring ? 'Record restored' : 'Record cancelled');
            setIsCancelModalOpen(false);
            setCancellingItem(null);
            fetchData();
        } catch {
            toast.error('Failed to update cancel status');
        } finally {
            loader.hideLoader();
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        try {
            loader.showLoader();
            const res = await fetch('/api/product-fms', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: deletingItem.id }),
            });
            if (!res.ok) throw new Error('Delete failed');
            toast.success('Record deleted');
            setIsDeleteModalOpen(false);
            setDeletingItem(null);
            fetchData();
        } catch {
            toast.error('Failed to delete record');
        } finally {
            loader.hideLoader();
        }
    };

    const openRemoveFollowUp = (item: ProductFMS) => {
        setRemoveTarget(item);
        setRemoveStep('all');
        setIsRemoveOpen(true);
    };

    const handleRemoveFollowUp = async () => {
        if (!removeTarget) return;
        try {
            loader.showLoader();
            const from = removeStep === 'all' ? 1 : removeStep;
            const payload: Record<string, string> = { id: removeTarget.id };
            for (let s = 1; s <= maxStep; s++) {
                extraFieldKeys(removeTarget, s).forEach((key) => {
                    if (s >= from) payload[key] = '';
                });
                if (s < from) continue;
                payload[`Actual_${s}`] = '';
                payload[`Status_${s}`] = '';
                if (s > 1 && (removeStep === 'all' || s > from)) payload[`Planned_${s}`] = '';
            }
            const res = await fetch('/api/product-fms', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Remove failed');
            toast.success('Follow-up details removed');
            setIsRemoveOpen(false);
            setRemoveTarget(null);
            fetchData();
        } catch {
            toast.error('Error removing follow-up');
        } finally {
            loader.hideLoader();
        }
    };

    const openMarkDone = (item: ProductFMS) => {
        const step = getCurrentStep(item, maxStep);
        if (step > maxStep) return;
        setStepExtras(ensureCompleteExtras(item, step));
        setDoneItem(item);
        setIsDoneModalOpen(true);
    };

    const handleMarkDone = async () => {
        if (!doneItem) return;
        const step = getCurrentStep(doneItem, maxStep);
        if (step > maxStep) return;
        if (step === 1 && !Object.keys(stepExtras).some((key) => /die.?required/i.test(key) && isYesNoValue(stepExtras[key]))) {
            toast.error('Select whether a die is required');
            return;
        }
        if (step === 3 && !Object.keys(stepExtras).some((key) => /piece.?due/i.test(key) && String(stepExtras[key] || '').trim())) {
            toast.error('Enter the piece due date');
            return;
        }
        if (step === 9 && !Object.keys(stepExtras).some((key) => /sample.?due|due.?date/i.test(key) && String(stepExtras[key] || '').trim())) {
            toast.error('Enter the new sample due date');
            return;
        }
        if (step === 10 && !Object.keys(stepExtras).some((key) => /sample.?ok/i.test(key) && isYesNoValue(stepExtras[key]))) {
            toast.error('Select whether the sample is OK');
            return;
        }
        try {
            loader.showLoader();
            const res = await fetch('/api/product-fms', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: doneItem.id,
                    [`Actual_${step}`]: new Date().toISOString(),
                    [`Status_${step}`]: 'Completed',
                    ...stepExtras,
                }),
            });
            if (!res.ok) throw new Error('Mark done failed');
            toast.success('Step completed');
            setIsDoneModalOpen(false);
            setDoneItem(null);
            fetchData();
        } catch {
            toast.error('Failed to complete step');
        } finally {
            loader.hideLoader();
        }
    };

    const openCreate = () => {
        const values: Record<string, string> = {};
        identityFields.forEach((field) => { values[field.key] = ''; });
        setEditingItem(null);
        setFormValues(values);
        setIsFormOpen(true);
    };

    const openEdit = (item: ProductFMS) => {
        const values: Record<string, string> = {};
        identityFields.forEach((field) => {
            values[field.key] = item[field.key] == null ? '' : String(item[field.key]);
        });
        setEditingItem(item);
        setFormValues(values);
        setIsFormOpen(true);
    };

    const handleSaveRecord = async () => {
        if (!Object.values(formValues).some((value) => String(value || '').trim())) {
            toast.error('Enter at least one field');
            return;
        }
        try {
            loader.showLoader();
            const newRm = identityFields
                .filter((field) => isRmIdentityField(field.key))
                .map((field) => String(formValues[field.key] || '').trim())
                .filter((name) => name && !rmNames.some((opt) => opt.toLowerCase() === name.toLowerCase()));
            const newFg = identityFields
                .filter((field) => isFgIdentityField(field.key))
                .map((field) => String(formValues[field.key] || '').trim())
                .filter((name) => name && !fgNames.some((opt) => opt.toLowerCase() === name.toLowerCase()));

            await Promise.all([
                ...newRm.map((item_name) => fetch('/api/ims-item', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'rm', item_name }),
                })),
                ...newFg.map((item_name) => fetch('/api/ims-item', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'fg', item_name }),
                })),
            ]);

            const res = await fetch('/api/product-fms', {
                method: editingItem ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingItem ? { id: editingItem.id, ...formValues } : formValues),
            });
            if (!res.ok) throw new Error('Save failed');
            if (newRm.length) setRmNames((prev) => Array.from(new Set([...prev, ...newRm])).sort((a, b) => a.localeCompare(b)));
            if (newFg.length) setFgNames((prev) => Array.from(new Set([...prev, ...newFg])).sort((a, b) => a.localeCompare(b)));
            toast.success(editingItem ? 'Record updated' : 'Record created');
            setIsFormOpen(false);
            setEditingItem(null);
            fetchData();
        } catch {
            toast.error('Failed to save record');
        } finally {
            loader.hideLoader();
        }
    };

    const handleSaveConfig = async () => {
        try {
            loader.showLoader();
            const res = await fetch('/api/product-fms-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: stepConfigs }),
            });
            if (!res.ok) throw new Error('Save failed');
            toast.success('Configuration saved');
        } catch {
            toast.error('Failed to save configuration');
        } finally {
            loader.hideLoader();
        }
    };

    const handleExportCSV = () => {
        if (!activeData.length) {
            toast.error('No data to export');
            return;
        }
        const headers = ['id', 'Timestamp', ...identityFields.map((f) => f.key), 'Current Step'];
        const rows = activeData.map((item) => {
            const step = getCurrentStep(item, maxStep);
            const cfg = stepConfigs.find((c) => c.step === step);
            return [
                item.id,
                formatDateTime(gv(item, 'Timestamp')),
                ...identityFields.map((field) => gv(item, field.key)),
                step > maxStep ? 'Completed' : `${step} ${cfg?.stepName || ''}`.trim(),
            ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Product_FMS_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const toggleExpanded = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const stepName = (step: number) => labelForStep(step, stepConfigs.find((c) => c.step === step)?.stepName) || `Step ${step}`;
    const tableIdentity = identityFields.filter((field) => (
        !isFgIdentityField(field.key) && !isRmIdentityField(field.key)
    ));

    if (loading && data.length === 0) {
        return (
            <LayoutWrapper disableNotifications={true}>
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
                </div>
            </LayoutWrapper>
        );
    }

    return (
        <LayoutWrapper disableNotifications={true}>
            <div className="px-5 py-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="mr-auto">
                        <h1 className="text-[26px] leading-none font-black text-[var(--theme-primary)] tracking-tight">New Product Requirement FMS</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mt-1">Die, sample and stock readiness tracking</p>
                    </div>
                    <div className={`flex items-center rounded-full overflow-hidden ${LIGHT_SURFACE}`}>
                        {viewMode !== 'setup' && viewMode !== 'cancelled' && (
                            <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-[var(--theme-primary)]/20">
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        )}
                        <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-[var(--theme-primary)]/20">
                            <Download className="w-3.5 h-3.5" /> Export
                        </button>
                        <button onClick={() => switchView(viewMode === 'setup' ? 'data' : 'setup')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest border-l border-[var(--theme-primary)]/25 ${viewMode === 'setup' ? 'bg-[var(--theme-primary)] text-gray-900' : 'text-slate-600 hover:bg-[var(--theme-primary)]/20'}`}>
                            <Settings2 className="w-3.5 h-3.5" /> Config
                        </button>
                        <button onClick={() => switchView(viewMode === 'cancelled' ? 'data' : 'cancelled')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest border-l border-[var(--theme-primary)]/25 ${viewMode === 'cancelled' ? 'bg-rose-500 text-white' : 'text-slate-600 hover:bg-[var(--theme-primary)]/20'}`}>
                            <Ban className="w-3.5 h-3.5" /> Cancelled ({cancelledCount})
                        </button>
                    </div>
                    {viewMode !== 'setup' && (
                        <div className={`flex items-center rounded-full overflow-hidden ${LIGHT_SURFACE}`}>
                            <button onClick={() => setListStyle('standard')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${listStyle === 'standard' ? 'bg-[var(--theme-primary)] text-gray-900' : 'text-slate-500'}`}>Standard</button>
                            <button onClick={() => setListStyle('smart')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${listStyle === 'smart' ? 'bg-[var(--theme-primary)] text-gray-900' : 'text-slate-500'}`}>Smart View</button>
                        </div>
                    )}
                </div>

                {viewMode === 'setup' ? (
                    <div className={`${LIGHT_SURFACE} rounded-3xl p-6`}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Step Configuration</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Loaded from the Step Configuration sheet</p>
                            </div>
                            <button onClick={handleSaveConfig} className="bg-[var(--theme-primary)] text-gray-900 px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Save Configuration</button>
                        </div>
                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-2xl">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400">
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Step</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Name</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Responsible</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">TAT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                    {stepConfigs.map((config, index) => (
                                        <tr key={config.step}>
                                            <td className="px-4 py-3 font-black">#{config.step}</td>
                                            <td className="px-4 py-3 text-xs font-bold">{config.stepName}</td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={config.doerName || ''}
                                                    onChange={(e) => {
                                                        const next = [...stepConfigs];
                                                        next[index] = { ...next[index], doerName: e.target.value };
                                                        setStepConfigs(next);
                                                    }}
                                                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                                                >
                                                    <option value="">Select User</option>
                                                    {systemUsers.map((u: any) => <option key={u.id} value={u.username}>{u.username}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        placeholder=""
                                                        value={config.tatValue ? config.tatValue : ''}
                                                        onChange={(e) => {
                                                            const next = [...stepConfigs];
                                                            next[index] = { ...next[index], tatValue: parseInt(e.target.value, 10) || 0 };
                                                            setStepConfigs(next);
                                                        }}
                                                        className="w-20 h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                                                    />
                                                    <select
                                                        value={config.tatUnit || 'days'}
                                                        onChange={(e) => {
                                                            const next = [...stepConfigs];
                                                            next[index] = { ...next[index], tatUnit: e.target.value as 'hours' | 'days' };
                                                            setStepConfigs(next);
                                                        }}
                                                        className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase"
                                                    >
                                                        <option value="hours">H</option>
                                                        <option value="days">D</option>
                                                    </select>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-5">
                        <aside className="w-[300px] shrink-0 sticky top-3 max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
                            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Filters</p>
                            <button
                                onClick={() => { setActiveStepFilter('all'); setCurrentPage(1); }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-[12px] font-black uppercase tracking-wide mb-2 ${DASH_SHADOW} ${activeStepFilter === 'all' ? 'bg-[var(--theme-primary)] text-gray-900' : `${LIGHT_BG} ${LIGHT_BORDER} text-slate-600 hover:bg-[var(--theme-primary)]/20`}`}
                            >
                                <span>All Records</span>
                                <span>{statusStats.all || 0}</span>
                            </button>
                            {navSteps.map((cfg) => {
                                const Icon = STEP_ICONS[(cfg.step - 1) % STEP_ICONS.length];
                                const tone = STEP_TONES[(cfg.step - 1) % STEP_TONES.length];
                                const count = statusStats[String(cfg.step)] || 0;
                                const active = activeStepFilter === cfg.step;
                                return (
                                    <button
                                        key={cfg.step}
                                        onClick={() => { setActiveStepFilter(cfg.step); setCurrentPage(1); if (viewMode === 'cancelled') setViewMode('data'); }}
                                        className={`w-full flex items-start gap-2 px-3 py-2 rounded-xl text-left text-[11px] font-semibold mb-1.5 ${DASH_SHADOW} ${LIGHT_BORDER} ${active ? 'bg-[var(--theme-primary)] text-gray-900' : `${LIGHT_BG} text-slate-600 hover:bg-[var(--theme-primary)]/20`}`}
                                    >
                                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone}`} />
                                        <span className="flex-1 leading-snug uppercase tracking-wide">
                                            <span className={tone}>Step {cfg.step}</span>
                                            {cfg.stepName ? ` — ${shortStepName(cfg.step, cfg.stepName)}` : ''}
                                        </span>
                                        {count > 0 && (
                                            <span className={`ml-auto shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${active ? 'bg-white/50' : 'bg-[var(--theme-primary)]/30'}`}>{count}</span>
                                        )}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => { setActiveStepFilter('completed'); setCurrentPage(1); if (viewMode === 'cancelled') setViewMode('data'); }}
                                className={`w-full flex items-start gap-2 px-3 py-2 rounded-xl text-left text-[11px] font-semibold mb-1.5 ${DASH_SHADOW} ${LIGHT_BORDER} ${activeStepFilter === 'completed' ? 'bg-[var(--theme-primary)] text-gray-900' : `${LIGHT_BG} text-slate-600 hover:bg-[var(--theme-primary)]/20`}`}
                            >
                                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                                <span className="flex-1 leading-snug uppercase tracking-wide text-emerald-600">Completed All Steps</span>
                                {(statusStats.completed || 0) > 0 && (
                                    <span className={`ml-auto shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${activeStepFilter === 'completed' ? 'bg-white/50' : 'bg-[var(--theme-primary)]/30'}`}>{statusStats.completed}</span>
                                )}
                            </button>
                        </aside>

                        <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[180px] max-w-sm">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                        placeholder="Search..."
                                        className={`w-full pl-9 pr-3 py-2 rounded-full ${LIGHT_SURFACE} text-sm outline-none`}
                                    />
                                </div>
                                <div className={`inline-flex items-center rounded-full ${DASH_SHADOW} ${appliedFilterCount > 0 ? 'bg-[var(--theme-primary)] text-gray-900' : `${LIGHT_BG} ${LIGHT_BORDER} text-slate-600`}`}>
                                    <button
                                        onClick={openFilterPanel}
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${appliedFilterCount > 0 ? '' : 'hover:bg-[var(--theme-primary)]/20'}`}
                                    >
                                        <Filter className="w-3.5 h-3.5" />
                                        Filter
                                        {appliedFilterCount > 0 && (
                                            <span className="min-w-[1.1rem] h-4 px-1 rounded-full bg-white/70 text-[9px] font-black flex items-center justify-center">{appliedFilterCount}</span>
                                        )}
                                    </button>
                                    {appliedFilterCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={resetColumnFilters}
                                            title="Clear filters"
                                            className="pr-2.5 pl-0.5 text-rose-500 hover:text-rose-600"
                                        >
                                            <X className="w-3.5 h-3.5" strokeWidth={3} />
                                        </button>
                                    )}
                                </div>
                                {(['Yesterday', 'Today', 'Tomorrow'] as const).map((label) => (
                                    <button
                                        key={label}
                                        onClick={() => { setActiveTimeFilter(activeTimeFilter === label ? null : label); setCurrentPage(1); }}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${DASH_SHADOW} ${activeTimeFilter === label ? 'bg-[var(--theme-primary)] text-gray-900' : `${LIGHT_BG} ${LIGHT_BORDER} text-slate-600 hover:bg-[var(--theme-primary)]/20`}`}
                                    >
                                        {label} <span className="ml-1">{timeStats[label]}</span>
                                    </button>
                                ))}
                                <div className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Page {currentPage} of {totalPages}</span>
                                    <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded-lg disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                                    <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded-lg disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                                    <span className="pl-2">Show {ITEMS_PER_PAGE}</span>
                                </div>
                            </div>

                            {paginatedData.length === 0 ? (
                                <div className={`${LIGHT_SURFACE} rounded-3xl border-dashed p-16 text-center text-slate-400 font-bold`}>No records found</div>
                            ) : listStyle === 'smart' ? (
                                <div className="space-y-2.5">
                                    {paginatedData.map((item) => {
                                        const step = getCurrentStep(item, maxStep);
                                        const done = step > maxStep && maxStep > 0;
                                        const delay = getDelayInfo(item[`Planned_${done ? maxStep : step}`], item[`Actual_${done ? maxStep : step}`]);
                                        const expanded = expandedIds.has(item.id);
                                        const extraDetails = extraDetailFields(item);
                                        const cardStats = [
                                            { key: 'Finish Products Goods', Icon: Package, label: 'Finish Products Goods', value: productTitle(item), tone: 'text-orange-500' },
                                            { key: 'Created', Icon: CalendarDays, label: 'Created', value: formatDateTime(gv(item, 'Timestamp')), tone: 'text-sky-500' },
                                            ...extraDetails.map((field) => {
                                                const meta = extraFieldMeta(field.key);
                                                return {
                                                    key: field.key,
                                                    Icon: meta.Icon,
                                                    label: field.label,
                                                    value: field.value || '—',
                                                    tone: meta.color,
                                                };
                                            }),
                                        ];
                                        const statRows: typeof cardStats[] = [];
                                        for (let i = 0; i < cardStats.length; i += 5) statRows.push(cardStats.slice(i, i + 5));
                                        return (
                                            <div key={item.id} className={`${LIGHT_SURFACE} rounded-[22px] px-5 py-3.5`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                                                            <span className="text-[12px] font-black text-slate-500">PRD - {item.id}</span>
                                                            <span className="inline-flex items-center gap-1.5 text-[16px] font-black uppercase tracking-tight text-slate-800 dark:text-white">
                                                                <Factory className="w-4 h-4 text-teal-600 shrink-0" />
                                                                {productMaterial(item) || 'Untitled'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className={`flex items-stretch rounded-full overflow-hidden ${LIGHT_BORDER} ${DASH_SHADOW}`}>
                                                            <div className={`px-3.5 py-1.5 text-center ${LIGHT_BG}`}>
                                                                <p className="text-[10px] font-black text-slate-800 leading-tight">{formatDateBadge(item[`Planned_${done ? maxStep : step}`])}</p>
                                                                <p className={`text-[9px] font-black uppercase tracking-wide ${delay?.color || 'text-slate-400'}`}>{delay?.text || '—'}</p>
                                                            </div>
                                                            <div className="px-3.5 py-1.5 bg-[var(--theme-primary)] text-gray-900 flex items-center gap-1.5">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                <span className="text-[10px] font-black uppercase whitespace-nowrap">{done ? 'Completed' : `Step ${step} Pending`}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`flex items-center rounded-2xl overflow-hidden ${LIGHT_SURFACE}`}>
                                                            <button onClick={() => toggleExpanded(item.id)} className="p-2 text-slate-600 hover:bg-[var(--theme-primary)]/20" title="Expand">
                                                                <ChevronDown className={`w-4 h-4 transition ${expanded ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {viewMode !== 'cancelled' && (
                                                                <button onClick={() => openEdit(item)} className="p-2 text-slate-600 hover:bg-[var(--theme-primary)]/20" title="Edit">
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {!done && viewMode !== 'cancelled' && (
                                                                <button onClick={() => openMarkDone(item)} className="p-2 text-emerald-600 hover:bg-[var(--theme-primary)]/20" title="Mark done">
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {viewMode !== 'cancelled' && step > 1 && (
                                                                <button onClick={() => openRemoveFollowUp(item)} className="p-2 text-indigo-500 hover:bg-[var(--theme-primary)]/20" title="Remove Follow Up">
                                                                    <RotateCcw className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button onClick={() => { setCancellingItem(item); setIsCancelModalOpen(true); }} className="p-2 text-slate-600 hover:bg-[var(--theme-primary)]/20" title={isCancelled(item) ? 'Restore' : 'Cancel'}>
                                                                {isCancelled(item) ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                                            </button>
                                                            <button onClick={() => { setDeletingItem(item); setIsDeleteModalOpen(true); }} className="p-2 text-rose-500 hover:bg-[var(--theme-primary)]/20" title="Delete">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-3">
                                                    {statRows.map((row, rowIndex) => (
                                                        <div key={rowIndex}>
                                                            {rowIndex > 0 && <div className="my-1.5 border-t border-[var(--theme-primary)]/30" />}
                                                            <div className="grid grid-cols-5 gap-x-6">
                                                                {row.map((field) => (
                                                                    <FieldStat
                                                                        key={field.key}
                                                                        Icon={field.Icon}
                                                                        label={field.label}
                                                                        value={field.value}
                                                                        tone={field.tone}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {expanded && (
                                                    <div className="mt-3 pt-3 border-t border-[var(--theme-primary)]/20">
                                                        <div className="flex gap-3 overflow-x-auto pb-2 items-start">
                                                            {navSteps.map((cfg) => (
                                                                <StepMiniCard
                                                                    key={cfg.step}
                                                                    step={cfg.step}
                                                                    name={shortStepName(cfg.step, cfg.stepName)}
                                                                    planned={item[`Planned_${cfg.step}`]}
                                                                    actual={item[`Actual_${cfg.step}`]}
                                                                    extras={extraFieldKeys(item, cfg.step).map((key) => ({
                                                                        key,
                                                                        label: fieldLabel(key, cfg.step),
                                                                        value: item[key] == null || String(item[key]).trim() === '' ? '' : String(item[key]),
                                                                    }))}
                                                                    isCurrent={!done && cfg.step === step}
                                                                    skipped={isStepSkipped(item, cfg.step)}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className={`${LIGHT_SURFACE} rounded-3xl overflow-x-auto`}>
                                    <table className="text-left min-w-max">
                                        <thead>
                                            <tr className="bg-[var(--theme-primary)] text-gray-900">
                                                <th className="sticky left-0 z-20 bg-[var(--theme-primary)] px-3 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Actions</th>
                                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">ID</th>
                                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Finish Products Goods</th>
                                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Raw Material / Dye Name</th>
                                                {tableIdentity.map((field) => (
                                                    <th key={field.key} className="px-3 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{field.label}</th>
                                                ))}
                                                {navSteps.map((cfg) => (
                                                    <th key={cfg.step} className="px-3 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap min-w-[168px]">
                                                        Step {cfg.step} — {shortStepName(cfg.step, cfg.stepName)}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                            {paginatedData.map((item) => {
                                                const step = getCurrentStep(item, maxStep);
                                                const done = step > maxStep && maxStep > 0;
                                                return (
                                                    <tr key={item.id} className="hover:bg-[var(--theme-primary)]/10 dark:hover:bg-slate-700/40">
                                                        <td className={`sticky left-0 z-10 px-3 py-3 ${LIGHT_BG}`}>
                                                            <div className="flex gap-1">
                                                                {viewMode !== 'cancelled' && <button onClick={() => openEdit(item)} className="p-1.5 text-slate-600" title="Edit"><Pencil className="w-4 h-4" /></button>}
                                                                {!done && viewMode !== 'cancelled' && <button onClick={() => openMarkDone(item)} className="p-1.5 text-emerald-600" title="Mark done"><CheckCircle2 className="w-4 h-4" /></button>}
                                                                {viewMode !== 'cancelled' && step > 1 && <button onClick={() => openRemoveFollowUp(item)} className="p-1.5 text-indigo-500" title="Remove Follow Up"><RotateCcw className="w-4 h-4" /></button>}
                                                                <button onClick={() => { setCancellingItem(item); setIsCancelModalOpen(true); }} className="p-1.5" title={isCancelled(item) ? 'Restore' : 'Cancel'}>{isCancelled(item) ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</button>
                                                                <button onClick={() => { setDeletingItem(item); setIsDeleteModalOpen(true); }} className="p-1.5 text-rose-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-xs font-black">{item.id}</td>
                                                        <td className="px-3 py-3 text-xs font-bold whitespace-nowrap">{productTitle(item)}</td>
                                                        <td className="px-3 py-3 text-xs whitespace-nowrap">{productMaterial(item) || '-'}</td>
                                                        {tableIdentity.map((field) => (
                                                            <td key={field.key} className="px-3 py-3 text-xs whitespace-nowrap">{gv(item, field.key) || '-'}</td>
                                                        ))}
                                                        {navSteps.map((cfg) => {
                                                            const planned = item[`Planned_${cfg.step}`];
                                                            const actual = item[`Actual_${cfg.step}`];
                                                            const skipped = isStepSkipped(item, cfg.step);
                                                            const delay = skipped ? null : getDelayInfo(planned, actual);
                                                            return (
                                                                <td key={cfg.step} className="px-3 py-2 align-top">
                                                                    <div className="space-y-0.5 text-[10px] leading-4 whitespace-nowrap">
                                                                        <div className="flex items-baseline justify-between gap-3">
                                                                            <span className="font-black uppercase tracking-wider text-slate-400">Planned</span>
                                                                            <span className="font-bold text-slate-700">{planned ? formatDateTime(planned) : '-'}</span>
                                                                        </div>
                                                                        <div className="flex items-baseline justify-between gap-3">
                                                                            <span className="font-black uppercase tracking-wider text-slate-400">Actual</span>
                                                                            <span className="font-bold text-emerald-600">{skipped ? 'Skipped' : actual ? formatDateTime(actual) : '-'}</span>
                                                                        </div>
                                                                        <div className="flex items-baseline justify-between gap-3">
                                                                            <span className="font-black uppercase tracking-wider text-slate-400">Delay</span>
                                                                            <span className={`font-black ${delay?.color || 'text-slate-300'}`}>{delay?.text || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isFilterOpen && (
                    <Fragment>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsFilterOpen(false)}
                            className="fixed inset-0 bg-black/35 z-[10000]"
                        />
                        <motion.div
                            initial={{ x: 48, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 48, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                            className={`fixed top-5 bottom-5 right-5 z-[10001] w-[360px] max-w-[calc(100vw-2.5rem)] ${LIGHT_SURFACE} rounded-3xl overflow-hidden flex flex-col`}
                        >
                            <div className="p-4 bg-[var(--theme-primary)] text-gray-900 flex items-center justify-between shrink-0">
                                <h2 className="font-black uppercase text-sm flex items-center gap-2">
                                    <Filter className="w-4 h-4" /> Filter
                                </h2>
                                <button onClick={() => setIsFilterOpen(false)}><X className="w-4 h-4" /></button>
                            </div>
                            <div
                                className="flex-1 overflow-y-auto p-4 space-y-3"
                                onClick={() => setOpenFilterKey('')}
                            >
                                {identityFields.map((field) => {
                                    const query = (filterQueries[field.key] || '').toLowerCase();
                                    const selected = appliedFilters[field.key] || [];
                                    const options = (filterOptions[field.key] || []).filter((opt) => !query || opt.toLowerCase().includes(query));
                                    const open = openFilterKey === field.key;
                                    return (
                                        <div key={field.key} onClick={(e) => e.stopPropagation()}>
                                            <label className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                                                <span>{field.label}</span>
                                                {selected.length > 0 && (
                                                    <span className="min-w-[1.15rem] h-4 px-1.5 rounded-full bg-[var(--theme-primary)] text-[9px] font-black flex items-center justify-center">{selected.length}</span>
                                                )}
                                            </label>
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                <input
                                                    value={filterQueries[field.key] || ''}
                                                    onChange={(e) => {
                                                        setFilterQueries((prev) => ({ ...prev, [field.key]: e.target.value }));
                                                        setOpenFilterKey(field.key);
                                                    }}
                                                    onFocus={() => setOpenFilterKey(field.key)}
                                                    onClick={() => setOpenFilterKey(field.key)}
                                                    placeholder={`Search ${field.label.toLowerCase()}...`}
                                                    className={`w-full pl-8 pr-3 py-2 rounded-xl ${LIGHT_BG} ${LIGHT_BORDER} text-xs outline-none`}
                                                />
                                            </div>
                                            {open && (
                                                <div
                                                    className={`mt-1 rounded-xl ${LIGHT_BG} ${LIGHT_BORDER} overflow-hidden`}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                >
                                                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--theme-primary)]/20">
                                                        <button
                                                            type="button"
                                                            onClick={() => selectAllFilter(field.key, options)}
                                                            className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-gray-900"
                                                        >
                                                            Select All
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => clearAllFilter(field.key)}
                                                            className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600"
                                                        >
                                                            Clear All
                                                        </button>
                                                    </div>
                                                    <div className="max-h-40 overflow-y-auto">
                                                        {options.length === 0 ? (
                                                            <p className="text-[11px] text-slate-400 px-3 py-2">No values</p>
                                                        ) : options.map((opt) => (
                                                            <label key={opt} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--theme-primary)]/20 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selected.includes(opt)}
                                                                    onChange={() => toggleFilterValue(field.key, opt)}
                                                                    className="w-3.5 h-3.5 rounded accent-[var(--theme-primary)]"
                                                                />
                                                                <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{opt}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="p-3 shrink-0 border-t border-[var(--theme-primary)]/20">
                                <button onClick={resetColumnFilters} className="w-full px-4 py-2.5 rounded-xl bg-[var(--theme-primary)] text-gray-900 text-[10px] font-black uppercase">Reset</button>
                            </div>
                        </motion.div>
                    </Fragment>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isFormOpen && (
                    <Fragment>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsFormOpen(false)}
                            className="fixed inset-0 bg-black/35 z-[10000]"
                        />
                        <motion.div
                            initial={{ x: 48, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 48, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                            className={`fixed top-5 bottom-5 right-5 z-[10001] w-[360px] max-w-[calc(100vw-2.5rem)] ${LIGHT_SURFACE} rounded-3xl overflow-hidden flex flex-col`}
                        >
                            <div className="p-4 bg-[var(--theme-primary)] text-gray-900 flex items-center justify-between shrink-0">
                                <h2 className="font-black uppercase text-sm flex items-center gap-2">
                                    {editingItem ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    {editingItem ? 'Edit Record' : 'Create Record'}
                                </h2>
                                <button onClick={() => setIsFormOpen(false)}><X className="w-4 h-4" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {identityFields.length === 0 && (
                                    <p className="text-sm text-slate-500">No identity columns found on the sheet.</p>
                                )}
                                {identityFields.map((field) => {
                                    const { Icon, color } = extraFieldMeta(field.key);
                                    if (isRmIdentityField(field.key)) {
                                        return (
                                            <NameCombobox
                                                key={field.key}
                                                label={field.label}
                                                value={formValues[field.key] || ''}
                                                options={rmNames}
                                                loading={imsLoading}
                                                onChange={(value) => setFormValues({ ...formValues, [field.key]: value })}
                                                placeholder="Search IMS RM or add new"
                                                Icon={Icon}
                                                iconColor={color}
                                            />
                                        );
                                    }
                                    if (isFgIdentityField(field.key)) {
                                        return (
                                            <NameCombobox
                                                key={field.key}
                                                label={field.label}
                                                value={formValues[field.key] || ''}
                                                options={fgNames}
                                                loading={imsLoading}
                                                onChange={(value) => setFormValues({ ...formValues, [field.key]: value })}
                                                placeholder="Search IMS FG or add new"
                                                Icon={Icon}
                                                iconColor={color}
                                            />
                                        );
                                    }
                                    return (
                                        <div key={field.key}>
                                            <label className="block text-[10px] font-black uppercase tracking-widest mb-1">{field.label}</label>
                                            <div className="relative">
                                                <Icon className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${color}`} />
                                                <input
                                                    type={isDateish(field.key) ? 'date' : 'text'}
                                                    value={isDateish(field.key) ? toDateInput(formValues[field.key] || '') : (formValues[field.key] || '')}
                                                    onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
                                                    placeholder={`Enter ${field.label.toLowerCase()}`}
                                                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl ${LIGHT_BG} ${LIGHT_BORDER} text-sm outline-none`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="p-3 flex gap-2 shrink-0 border-t border-[var(--theme-primary)]/20">
                                <button onClick={() => setIsFormOpen(false)} className={`flex-1 px-4 py-2.5 rounded-xl ${LIGHT_BORDER} text-[10px] font-black uppercase`}>Cancel</button>
                                <button onClick={handleSaveRecord} className="flex-[1.4] px-4 py-2.5 rounded-xl bg-[var(--theme-primary)] text-gray-900 text-[10px] font-black uppercase">{editingItem ? 'Save' : 'Create'}</button>
                            </div>
                        </motion.div>
                    </Fragment>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isRemoveOpen && removeTarget && (
                    <Fragment>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsRemoveOpen(false)}
                            className="fixed inset-0 bg-black/35 z-[10000]"
                        />
                        <motion.div
                            initial={{ x: 48, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 48, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                            className={`fixed top-5 bottom-5 right-5 z-[10001] w-[360px] max-w-[calc(100vw-2.5rem)] ${LIGHT_SURFACE} rounded-3xl overflow-hidden flex flex-col`}
                        >
                            <div className="p-4 bg-[var(--theme-primary)] text-gray-900 flex items-center justify-between shrink-0">
                                <h2 className="font-black uppercase text-sm flex items-center gap-2">
                                    <RotateCcw className="w-4 h-4" /> Remove Follow Up
                                </h2>
                                <button onClick={() => setIsRemoveOpen(false)}><X className="w-4 h-4" /></button>
                            </div>
                            <div className="px-4 pt-3 shrink-0">
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 truncate">{productTitle(removeTarget)}</p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">{productMaterial(removeTarget)}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select range to clear</p>
                                <button
                                    type="button"
                                    onClick={() => setRemoveStep('all')}
                                    className={`w-full text-left px-3 py-3 rounded-2xl ${LIGHT_BORDER} ${DASH_SHADOW} ${removeStep === 'all' ? 'bg-[var(--theme-primary)] text-gray-900' : `${LIGHT_BG} text-slate-600`}`}
                                >
                                    <div className="text-[11px] font-black uppercase tracking-widest">Remove All</div>
                                    <p className="text-[10px] font-semibold opacity-70 mt-0.5">Clears all completed steps</p>
                                </button>
                                {navSteps.map((cfg) => {
                                    if (!isStepPassed(removeTarget, cfg.step)) return null;
                                    const selected = removeStep === cfg.step;
                                    return (
                                        <button
                                            key={cfg.step}
                                            type="button"
                                            onClick={() => setRemoveStep(cfg.step)}
                                            className={`w-full text-left px-3 py-3 rounded-2xl ${LIGHT_BORDER} ${DASH_SHADOW} ${selected ? 'bg-[var(--theme-primary)] text-gray-900' : `${LIGHT_BG} text-slate-600`}`}
                                        >
                                            <div className="text-[11px] font-black uppercase tracking-widest">From Step {cfg.step} — {shortStepName(cfg.step, cfg.stepName)}</div>
                                            <p className="text-[10px] font-semibold opacity-70 mt-0.5">Clears this step and everything after it</p>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="p-3 flex gap-2 shrink-0 border-t border-[var(--theme-primary)]/20">
                                <button onClick={() => setIsRemoveOpen(false)} className={`flex-1 px-4 py-2.5 rounded-xl ${LIGHT_BORDER} text-[10px] font-black uppercase`}>Cancel</button>
                                <button onClick={handleRemoveFollowUp} className="flex-[1.4] px-4 py-2.5 rounded-xl bg-[var(--theme-primary)] text-gray-900 text-[10px] font-black uppercase">Confirm Clear</button>
                            </div>
                        </motion.div>
                    </Fragment>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isDoneModalOpen && doneItem && (
                    <Fragment>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDoneModalOpen(false)}
                            className="fixed inset-0 bg-black/35 z-[10000]"
                        />
                        <motion.div
                            initial={{ x: 48, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 48, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                            className={`fixed top-5 bottom-5 right-5 z-[10001] w-[360px] max-w-[calc(100vw-2.5rem)] ${LIGHT_SURFACE} rounded-3xl overflow-hidden flex flex-col`}
                        >
                            <div className="p-4 bg-[var(--theme-primary)] text-gray-900 flex items-center justify-between shrink-0">
                                <h2 className="font-black uppercase text-sm flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Complete Step {getCurrentStep(doneItem, maxStep)}
                                </h2>
                                <button onClick={() => setIsDoneModalOpen(false)}><X className="w-4 h-4" /></button>
                            </div>
                            <div className="px-4 pt-3 shrink-0">
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">{stepName(getCurrentStep(doneItem, maxStep))}</p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">{productTitle(doneItem)}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {Object.keys(stepExtras).length === 0 && (
                                    <p className="text-sm text-slate-500">No extra fields for this step. Confirm to mark it done.</p>
                                )}
                                {Object.keys(stepExtras).map((key) => {
                                    const { Icon, color } = extraFieldMeta(key);
                                    const step = getCurrentStep(doneItem, maxStep);
                                    const label = fieldLabel(key, step);
                                    if (isYesNoField(key)) {
                                        return (
                                            <div key={key}>
                                                <label className="block text-[10px] font-black uppercase tracking-widest mb-1">{label}</label>
                                                <select
                                                    value={stepExtras[key]}
                                                    onChange={(e) => setStepExtras({ ...stepExtras, [key]: e.target.value })}
                                                    className={`w-full px-3 py-2.5 rounded-xl ${LIGHT_BG} ${LIGHT_BORDER} text-sm outline-none font-bold`}
                                                >
                                                    <option value="">Select Yes / No</option>
                                                    <option value="Yes">Yes</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={key}>
                                            <label className="block text-[10px] font-black uppercase tracking-widest mb-1">{label}</label>
                                            <div className="relative">
                                                <Icon className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${color}`} />
                                                <input
                                                    type={isDateish(key) ? 'date' : 'text'}
                                                    value={isDateish(key) ? toDateInput(stepExtras[key]) : stepExtras[key]}
                                                    onChange={(e) => setStepExtras({ ...stepExtras, [key]: e.target.value })}
                                                    placeholder={`Enter ${label.toLowerCase()}`}
                                                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl ${LIGHT_BG} ${LIGHT_BORDER} text-sm outline-none`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="p-3 flex gap-2 shrink-0 border-t border-[var(--theme-primary)]/20">
                                <button onClick={() => setIsDoneModalOpen(false)} className={`flex-1 px-4 py-2.5 rounded-xl ${LIGHT_BORDER} text-[10px] font-black uppercase`}>Cancel</button>
                                <button onClick={handleMarkDone} className="flex-[1.4] px-4 py-2.5 rounded-xl bg-[var(--theme-primary)] text-gray-900 text-[10px] font-black uppercase">Mark Done</button>
                            </div>
                        </motion.div>
                    </Fragment>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isCancelModalOpen && cancellingItem && (
                    <Fragment>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCancelModalOpen(false)} className="fixed inset-0 bg-black/40 z-[9998]" />
                        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6">
                                <h3 className="font-black text-lg mb-2">{isCancelled(cancellingItem) ? 'Restore this record?' : 'Cancel this record?'}</h3>
                                <p className="text-sm text-slate-500 mb-5">{productTitle(cancellingItem)}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsCancelModalOpen(false)} className="flex-1 py-2 rounded-xl border font-bold">No</button>
                                    <button onClick={handleCancel} className="flex-1 py-2 rounded-xl bg-rose-500 text-white font-bold">Yes</button>
                                </div>
                            </div>
                        </motion.div>
                    </Fragment>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isDeleteModalOpen && deletingItem && (
                    <Fragment>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteModalOpen(false)} className="fixed inset-0 bg-black/40 z-[9998]" />
                        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6">
                                <h3 className="font-black text-lg mb-2">Delete this record?</h3>
                                <p className="text-sm text-slate-500 mb-1">{productMaterial(deletingItem) || productTitle(deletingItem)}</p>
                                <p className="text-xs text-rose-500 mb-5">This removes the whole row from the sheet.</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 rounded-xl border font-bold">No</button>
                                    <button onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-rose-500 text-white font-bold">Delete</button>
                                </div>
                            </div>
                        </motion.div>
                    </Fragment>
                )}
            </AnimatePresence>
        </LayoutWrapper>
    );
}
