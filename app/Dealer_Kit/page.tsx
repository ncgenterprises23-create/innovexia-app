'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import { useThemeColor } from '@/components/ThemeColorProvider';
import { ensureSessionId } from '@/utils/session';
import {
  Loader2, Pencil, Plus, Trash2, RefreshCcw, Search, CalendarDays,
  Users, Megaphone, FileText, Truck, BadgeCheck, Sparkles, ArrowRight,
  MapPin, Globe2, Link2, X, ClipboardList, Layers3, ChevronDown,
  User, Phone, MessageCircle, Building2, Map, Languages, Tag, MessageSquare, Clock, Info
} from 'lucide-react';

const CATEGORY_COLOR_PALETTE = [
  { idle: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100', active: 'border-sky-600 bg-sky-600 text-white shadow-sm shadow-sky-300/50', badge: 'border-sky-200 bg-sky-100 text-sky-700', icon: 'text-sky-500', countIdle: 'bg-sky-100', countActive: 'bg-white/20' },
  { idle: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100', active: 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-300/50', badge: 'border-emerald-200 bg-emerald-100 text-emerald-700', icon: 'text-emerald-500', countIdle: 'bg-emerald-100', countActive: 'bg-white/20' },
  { idle: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100', active: 'border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-300/50', badge: 'border-violet-200 bg-violet-100 text-violet-700', icon: 'text-violet-500', countIdle: 'bg-violet-100', countActive: 'bg-white/20' },
  { idle: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100', active: 'border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-300/50', badge: 'border-rose-200 bg-rose-100 text-rose-700', icon: 'text-rose-500', countIdle: 'bg-rose-100', countActive: 'bg-white/20' },
  { idle: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100', active: 'border-amber-600 bg-amber-600 text-white shadow-sm shadow-amber-300/50', badge: 'border-amber-200 bg-amber-100 text-amber-800', icon: 'text-amber-500', countIdle: 'bg-amber-100', countActive: 'bg-white/20' },
  { idle: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100', active: 'border-teal-600 bg-teal-600 text-white shadow-sm shadow-teal-300/50', badge: 'border-teal-200 bg-teal-100 text-teal-700', icon: 'text-teal-500', countIdle: 'bg-teal-100', countActive: 'bg-white/20' },
  { idle: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100', active: 'border-fuchsia-600 bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-300/50', badge: 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700', icon: 'text-fuchsia-500', countIdle: 'bg-fuchsia-100', countActive: 'bg-white/20' },
  { idle: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100', active: 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-300/50', badge: 'border-indigo-200 bg-indigo-100 text-indigo-700', icon: 'text-indigo-500', countIdle: 'bg-indigo-100', countActive: 'bg-white/20' },
  { idle: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100', active: 'border-orange-600 bg-orange-600 text-white shadow-sm shadow-orange-300/50', badge: 'border-orange-200 bg-orange-100 text-orange-700', icon: 'text-orange-500', countIdle: 'bg-orange-100', countActive: 'bg-white/20' },
  { idle: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100', active: 'border-cyan-600 bg-cyan-600 text-white shadow-sm shadow-cyan-300/50', badge: 'border-cyan-200 bg-cyan-100 text-cyan-700', icon: 'text-cyan-500', countIdle: 'bg-cyan-100', countActive: 'bg-white/20' },
] as const;

const UNCATEGORIZED_COLOR = {
  idle: 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100',
  active: 'border-gray-600 bg-gray-600 text-white shadow-sm shadow-gray-300/50',
  badge: 'border-gray-200 bg-gray-100 text-gray-600',
  icon: 'text-gray-400',
  countIdle: 'bg-gray-100',
  countActive: 'bg-white/20',
} as const;

function getCategoryColor(category: string) {
  const key = (category || '').trim();
  if (!key || key === '__uncategorized__') return UNCATEGORIZED_COLOR;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_COLOR_PALETTE[hash % CATEGORY_COLOR_PALETTE.length];
}

interface DealerSummary {
  annualCycle?: string;
  dealerCount?: number;
  festivalWhatsapp?: number;
  videos?: number;
  insightLetters?: number;
  activeDealers?: number;
  pendingContent?: number;
  completedContent?: number;
  upcomingDispatches?: number;
  whatsappCampaigns?: number;
  courierCampaigns?: number;
}

interface Festival {
  id: string;
  month: string;
  festival: string;
  date: string;
  medium: string;
  status: string;
}

interface Dealer {
  dealerId: string;
  firmName: string;
  contactPerson: string;
  whatsappMobile: string;
  city: string;
  state: string;
  pincode: string;
  courierAddress: string;
  category: string;
  preferredLanguage: string;
  relationshipOwner: string;
  customerType: string;
  whatsappConsent: string;
  numberSavedCuboc: string;
  courierAddressVerified: string;
  activeInKit: string;
  lastOrderDate: string;
  potentialProductInterest: string;
  notes: string;
}

interface MonthlyPlan {
  contentId: string;
  month: string;
  medium: string;
  contentType: string;
  dueDate: string;
  releaseDate: string;
  topic: string;
  draftOwner: string;
  designOwner: string;
  approvalStatus: string;
  fileLink: string;
  printQty: number;
  courierQty: number;
  whatsappTarget: number;
  productionStatus: string;
  remarks: string;
  category: string;
  status: 'Overdue' | 'Upcoming' | 'Scheduled';
}

interface TrackingStatus {
  doneBy?: string;
  dealerId: string;
  contentId: string;
  status: string;
  link: string;
  comments?: string;
}


type ActiveTab = 'summary' | 'festivals' | 'dealers' | 'monthly';
type ModalMode = 'add' | 'edit';

const DEALER_FORM_DEFAULT: Dealer = {
  dealerId: '',
  firmName: '',
  contactPerson: '',
  whatsappMobile: '',
  city: '',
  state: '',
  pincode: '',
  courierAddress: '',
  category: '',
  preferredLanguage: 'Hindi',
  relationshipOwner: '',
  customerType: '',
  whatsappConsent: 'Yes',
  numberSavedCuboc: 'No',
  courierAddressVerified: 'No',
  activeInKit: 'Yes',
  lastOrderDate: '',
  potentialProductInterest: '',
  notes: '',
};

function statusBadgeClass(status: string) {
  if (status === 'Overdue') return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'Upcoming') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function formatDate(value: string | number) {
  if (!value || String(value).trim() === '' || String(value) === '0' || String(value) === '-') return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (date.getFullYear() <= 1970) return '-';
  const d = String(date.getDate()).padStart(2, '0');
  const m = date.toLocaleString('en-GB', { month: 'short' });
  const y = String(date.getFullYear()).slice(-2);
  return `${d} ${m} ${y}`;
}

function formatCompactDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function normalizeYesNo(value: string | undefined) {
  return String(value || '').toLowerCase() === 'no' ? 'No' : 'Yes';
}

function normalizeLanguage(value: string | undefined) {
  return String(value || '').toLowerCase() === 'english' ? 'English' : 'Hindi';
}

function YesNoToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: 'Yes' | 'No') => void;
}) {
  const isYes = normalizeYesNo(value) === 'Yes';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isYes}
      onClick={() => onChange(isYes ? 'No' : 'Yes')}
      className={`group inline-flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-sm font-black transition ${isYes
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-rose-300 bg-rose-50 text-rose-800'
        }`}
    >
      <span className="uppercase tracking-[0.12em]">{isYes ? 'Yes' : 'No'}</span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isYes ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${isYes ? 'translate-x-5' : 'translate-x-1'
            }`}
        />
      </span>
    </button>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accent.replace('bg-', 'bg-').replace('/60', '/15')} border border-current/10`}>
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  note,
  className,
  icon,
}: {
  title: string;
  value: string | number;
  note?: string;
  className: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className={`relative overflow-hidden rounded-3xl border border-white/60 bg-white/75 p-4 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.2)] backdrop-blur-xl ${className}`}
    >
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.9),transparent_38%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">{title}</p>
          <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
          {note && <p className="mt-1 text-xs font-medium text-gray-600">{note}</p>}
        </div>
        <div className="rounded-2xl bg-white/60 p-2 shadow-sm border border-white/60 text-gray-900">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-600">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}

function InputShell(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-gray-200 bg-white/90 px-4 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/15 ${props.className || ''}`}
    />
  );
}

function TextAreaShell(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-gray-200 bg-white/90 px-4 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/15 ${props.className || ''}`}
    />
  );
}

function CreatableCategoryCombobox({
  value,
  onChange,
  options,
  placeholder = 'Search or type a new category',
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const updateMenuPosition = () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuMaxHeight = 208;
    const openUp = spaceBelow < menuMaxHeight && rect.top > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 180),
      zIndex: 10050,
      maxHeight: menuMaxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase());
  const canCreate = Boolean(query.trim()) && !exactMatch;
  const showMenu = open && (filtered.length > 0 || canCreate);

  const select = (opt: string) => {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  };

  const createNew = () => {
    const next = query.trim();
    if (!next) return;
    onChange(next);
    setQuery(next);
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            requestAnimationFrame(updateMenuPosition);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            requestAnimationFrame(updateMenuPosition);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canCreate) createNew();
              else if (filtered[0]) select(filtered[0]);
              else setOpen(false);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          className="w-full rounded-2xl border border-gray-200 bg-white/90 px-4 py-2.5 pr-10 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/15"
        />
        {query ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        )}
      </div>

      {showMenu &&
        createPortal(
          <ul
            ref={menuRef}
            style={menuStyle}
            className="overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
          >
            {filtered.map((opt) => {
              const color = getCategoryColor(opt);
              return (
                <li
                  key={opt}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(opt);
                  }}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    opt === value
                      ? 'bg-[var(--theme-primary)]/10 font-bold text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-black ${color.badge}`}>
                    <Tag className={`h-3 w-3 ${color.icon}`} />
                    {opt}
                  </span>
                </li>
              );
            })}
            {canCreate && (
              <li
                onMouseDown={(e) => {
                  e.preventDefault();
                  createNew();
                }}
                className="flex cursor-pointer items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add &ldquo;{query.trim()}&rdquo;
              </li>
            )}
          </ul>,
          document.body
        )}
    </div>
  );
}

export default function DealerKitPage() {
  const { colors } = useThemeColor();
  const [activeTab, setActiveTab] = useState<ActiveTab>('summary');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DealerSummary>({});
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([]);
  const [trackingData, setTrackingData] = useState<TrackingStatus[]>([]);

  const [search, setSearch] = useState('');
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerCategoryTab, setDealerCategoryTab] = useState('all');
  const [monthlyCategoryTab, setMonthlyCategoryTab] = useState('all');
  const [monthFilter, setMonthFilter] = useState(() => new Date().toLocaleString('en-US', { month: 'long' }));

  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalData, setInfoModalData] = useState<{title: string; remark: string} | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<string>('');

  const [dealerModalOpen, setDealerModalOpen] = useState(false);
  const [dealerModalMode, setDealerModalMode] = useState<ModalMode>('add');
  const [dealerForm, setDealerForm] = useState<Dealer>(DEALER_FORM_DEFAULT);

  const [festivalModalOpen, setFestivalModalOpen] = useState(false);
  const [festivalModalMode, setFestivalModalMode] = useState<ModalMode>('add');
  const [festivalForm, setFestivalForm] = useState<Festival>({
    id: '', month: '', festival: '', date: '', medium: 'WhatsApp Greeting', status: 'Scheduled'
  });

  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [monthlyModalMode, setMonthlyModalMode] = useState<ModalMode>('add');
  const [batchItems, setBatchItems] = useState<{ contentId?: string; month: string; medium: string; contentType: string; dueDate: string; remarks: string; fileLink?: string; category?: string; isUploading?: boolean }[]>([]);

  const [trackingSavingKey, setTrackingSavingKey] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const toast = useToast();
  const loader = useLoader();

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [summaryRes, festivalsRes, dealersRes, monthlyRes, trackingRes] = await Promise.all([
        fetch('/api/dealer-kit/summary'),
        fetch('/api/dealer-kit/festivals'),
        fetch('/api/dealer-kit/dealers'),
        fetch('/api/dealer-kit/monthly-frequency'),
        fetch('/api/dealer-kit/tracking'),
      ]);

      const [summaryJson, festivalsJson, dealersJson, monthlyJson, trackingJson] = await Promise.all([
        summaryRes.json(),
        festivalsRes.json(),
        dealersRes.json(),
        monthlyRes.json(),
        trackingRes.json(),
      ]);

      setSummary(summaryJson.data || {});
      setFestivals(festivalsJson.data || []);
      setDealers(dealersJson.data || []);
      setMonthlyPlans(monthlyJson.data || []);
      setTrackingData(trackingJson.tracking || []);
    } catch (error) {
      console.error('Failed to load Dealer_Kit data:', error);
      toast.error('Failed to load Dealer_Kit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    
    // Fetch logged in user
    const checkAuth = async () => {
      try {
        const sessionId = ensureSessionId();
        const response = await fetch('/api/auth', { headers: { 'x-session-id': sessionId } });
        const data = await response.json();
        if (data.authenticated && data.user) {
          setLoggedInUser(data.user.full_name || data.user.username || '');
        }
      } catch (e) {
        // ignore
      }
    };
    checkAuth();
  }, []);

  const dealerCategories = useMemo(() => {
    const cats = new Set<string>();
    let hasUncategorized = false;
    dealers.forEach((dealer) => {
      const cat = (dealer.category || '').trim();
      if (cat) cats.add(cat);
      else hasUncategorized = true;
    });
    const sorted = Array.from(cats).sort((a, b) => a.localeCompare(b));
    if (hasUncategorized) sorted.push('__uncategorized__');
    return sorted;
  }, [dealers]);

  const existingCategoryOptions = useMemo(
    () => dealerCategories.filter((c) => c !== '__uncategorized__'),
    [dealerCategories]
  );

  const monthlyCategories = useMemo(() => {
    const cats = new Set<string>();
    let hasUncategorizedPlans = false;

    monthlyPlans.forEach((plan) => {
      const cat = (plan.category || '').trim();
      if (cat) cats.add(cat);
      else hasUncategorizedPlans = true;
    });

    const sorted = Array.from(cats).sort((a, b) => a.localeCompare(b));
    if (hasUncategorizedPlans) sorted.push('__uncategorized__');
    return sorted;
  }, [monthlyPlans]);

  useEffect(() => {
    if (monthlyCategories.length === 0) {
      if (monthlyCategoryTab !== 'all') setMonthlyCategoryTab('all');
      return;
    }
    if (monthlyCategoryTab === 'all' || !monthlyCategories.includes(monthlyCategoryTab)) {
      setMonthlyCategoryTab(monthlyCategories[0]);
    }
  }, [monthlyCategories, monthlyCategoryTab]);

  useEffect(() => {
    if (dealerCategoryTab !== 'all' && !dealerCategories.includes(dealerCategoryTab)) {
      setDealerCategoryTab('all');
    }
  }, [dealerCategories, dealerCategoryTab]);

  const filteredDealers = useMemo(() => {
    let q = search.toLowerCase();
    if (activeTab === 'monthly') {
      q = dealerSearch.toLowerCase();
    }

    let list = dealers;

    if (q.trim()) {
      list = list.filter((dealer) =>
        [
          dealer.dealerId,
          dealer.firmName,
          dealer.contactPerson,
          dealer.whatsappMobile,
          dealer.city,
          dealer.state,
          dealer.pincode,
          dealer.courierAddress,
          dealer.category,
          dealer.preferredLanguage,
          dealer.relationshipOwner,
          dealer.customerType,
          dealer.potentialProductInterest,
          dealer.notes,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    if (activeTab === 'dealers' && dealerCategoryTab !== 'all') {
      list = list.filter((dealer) => {
        const cat = (dealer.category || '').trim();
        if (dealerCategoryTab === '__uncategorized__') return !cat;
        return cat === dealerCategoryTab;
      });
    }

    if (activeTab === 'monthly' && monthlyCategoryTab !== 'all') {
      list = list.filter((dealer) => {
        const cat = (dealer.category || '').trim();
        if (monthlyCategoryTab === '__uncategorized__') return !cat;
        return cat === monthlyCategoryTab;
      });
    }

    return list;
  }, [dealers, search, dealerSearch, activeTab, dealerCategoryTab, monthlyCategoryTab]);

  const monthlyMonths = useMemo(() => {
    const set = new Set(
      monthlyPlans.map((plan) => {
        if (!plan.dueDate) return '';
        return new Date(plan.dueDate).toLocaleString('en-US', { month: 'long' });
      }).filter(Boolean)
    );
    const currentM = new Date().toLocaleString('en-US', { month: 'long' });
    set.add(currentM);
    return Array.from(set);
  }, [monthlyPlans]);

  const filteredMonthlyPlans = useMemo(() => {
    return monthlyPlans.filter((plan) => {
      const derivedMonth = plan.dueDate ? new Date(plan.dueDate).toLocaleString('en-US', { month: 'long' }) : '';
      if (monthFilter !== 'all') {
        if (derivedMonth.toLowerCase() !== monthFilter.toLowerCase()) return false;
      }

      if (monthlyCategoryTab !== 'all') {
        const cat = (plan.category || '').trim();
        if (monthlyCategoryTab === '__uncategorized__') {
          if (cat) return false;
        } else if (cat !== monthlyCategoryTab) {
          return false;
        }
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [plan.contentId, derivedMonth, plan.topic, plan.medium, plan.contentType, plan.draftOwner, plan.designOwner, plan.category]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [monthlyPlans, monthFilter, search, monthlyCategoryTab]);

  const stats = useMemo(() => {
    const totalDealers = dealers.length;
    const activeDealers = dealers.filter((d) => String(d.activeInKit).toLowerCase() === 'yes').length || totalDealers;
    const totalTasks = totalDealers * monthlyPlans.length;
    const completedTasks = trackingData.filter((t) => t.status === 'Done').length;
    const pendingTasks = Math.max(0, totalTasks - completedTasks);
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const videos = monthlyPlans.filter(p => p.contentType?.toLowerCase().includes('video')).length;
    const insightLetters = monthlyPlans.filter(p => p.contentType?.toLowerCase().includes('insight letter') || p.contentType?.toLowerCase().includes('report')).length;
    const whatsappCampaigns = monthlyPlans.filter(p => p.medium?.toLowerCase().includes('whatsapp')).length;
    const courierCampaigns = monthlyPlans.filter(p => p.medium?.toLowerCase().includes('courier')).length;
    const festivalWhatsapp = festivals.filter(f => f.medium?.toLowerCase().includes('whatsapp')).length;
    const annualCycle = monthlyPlans.length > 0 ? `${monthlyMonths.length} Months` : '-';

    return {
      totalDealers, activeDealers, completedTasks, pendingTasks, completionPercent,
      videos, insightLetters, whatsappCampaigns, courierCampaigns, festivalWhatsapp, annualCycle,
      totalTasks
    };
  }, [dealers, monthlyPlans, trackingData, festivals, monthlyMonths]);

  const cards = useMemo(() => {
    return [
      { label: 'Total Dealers', value: stats.totalDealers },
      { label: 'Active Dealers', value: stats.activeDealers },
      { label: 'Pending Content', value: stats.pendingTasks },
      { label: 'Completed Content', value: stats.completedTasks },
      { label: 'Total Campaigns', value: monthlyPlans.length },
      { label: 'Completion', value: `${stats.completionPercent}%` },
    ];
  }, [stats, monthlyPlans]);

  const openAddDealerModal = () => {
    setDealerModalMode('add');
    setDealerForm(DEALER_FORM_DEFAULT);
    setDealerModalOpen(true);
  };

  const openEditDealerModal = (dealer: Dealer) => {
    setDealerModalMode('edit');
    setDealerForm({
      ...dealer,
      preferredLanguage: normalizeLanguage(dealer.preferredLanguage),
      whatsappConsent: normalizeYesNo(dealer.whatsappConsent),
      numberSavedCuboc: normalizeYesNo(dealer.numberSavedCuboc),
      courierAddressVerified: normalizeYesNo(dealer.courierAddressVerified),
      activeInKit: normalizeYesNo(dealer.activeInKit),
    });
    setDealerModalOpen(true);
  };

  const BATCH_TEMPLATE = [
    { month: '', medium: 'WhatsApp', contentType: 'Festival Greeting', remarks: 'Send on festival morning or evening before', fileLink: '', category: '' },
    { month: '', medium: 'WhatsApp', contentType: 'Video 1', remarks: '30-60 sec; dealer education/product', fileLink: '', category: '' },
    { month: '', medium: 'Courier', contentType: 'Insight Letter', remarks: 'Print 10 extra copies', fileLink: '', category: '' },
    { month: '', medium: 'Courier', contentType: 'Special Report', remarks: 'Send inside monthly packet', fileLink: '', category: '' },
    { month: '', medium: 'WhatsApp', contentType: 'Video 2', remarks: '30-60 sec; send after 5 PM', fileLink: '', category: '' },
  ];

  const openAddMonthlyModal = () => {
    setMonthlyModalMode('add');
    const defaultCategory = monthlyCategoryTab !== 'all' && monthlyCategoryTab !== '__uncategorized__'
      ? monthlyCategoryTab
      : '';
    setBatchItems(BATCH_TEMPLATE.map(t => ({ ...t, dueDate: '', category: defaultCategory || t.category })));
    setMonthlyModalOpen(true);
  };

  const openEditMonthlyModal = (plan: MonthlyPlan) => {
    setMonthlyModalMode('edit');
    setBatchItems([{
      contentId: plan.contentId,
      month: plan.month || '',
      medium: plan.medium || '',
      contentType: plan.contentType || '',
      dueDate: plan.dueDate || '',
      remarks: plan.remarks || '',
      fileLink: plan.fileLink || '',
      category: plan.category || '',
    }]);
    setMonthlyModalOpen(true);
  };

  const saveDealer = async () => {
    if (!dealerForm.firmName.trim()) {
      toast.error('Firm Name is required');
      return;
    }

    try {
      setSaving(true);
      loader.showLoader();

      const method = dealerModalMode === 'add' ? 'POST' : 'PUT';
      const payload = {
        ...dealerForm,
        preferredLanguage: normalizeLanguage(dealerForm.preferredLanguage),
        whatsappConsent: normalizeYesNo(dealerForm.whatsappConsent),
        numberSavedCuboc: normalizeYesNo(dealerForm.numberSavedCuboc),
        courierAddressVerified: normalizeYesNo(dealerForm.courierAddressVerified),
        activeInKit: normalizeYesNo(dealerForm.activeInKit),
      };
      const response = await fetch('/api/dealer-kit/dealers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to save dealer');
      }

      toast.success(dealerModalMode === 'add' ? 'Dealer created' : 'Dealer updated');
      setDealerModalOpen(false);
      await fetchAll();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save dealer');
    } finally {
      setSaving(false);
      loader.hideLoader();
    }
  };

  const saveMonthlyBatch = async () => {
    try {
      setSaving(true);
      loader.showLoader();

      const payloads = batchItems.map(item => {
        let derivedMonth = item.month;
        if (!derivedMonth && item.dueDate) {
          derivedMonth = new Date(item.dueDate).toLocaleString('en-US', { month: 'long' });
        }
        return {
          contentId: item.contentId,
          month: derivedMonth,
          medium: item.medium,
          contentType: item.contentType,
          dueDate: item.dueDate,
          remarks: item.remarks,
          fileLink: item.fileLink,
          category: item.category || '',
        };
      });

      const method = monthlyModalMode === 'add' ? 'POST' : 'PUT';
      const response = await fetch('/api/dealer-kit/monthly-frequency', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloads),
      });

      if (!response.ok) throw new Error(`Failed to ${monthlyModalMode === 'add' ? 'create' : 'update'} plan items`);

      toast.success(monthlyModalMode === 'add' ? 'Batch plan created' : 'Plan updated');
      setMonthlyModalOpen(false);
      await fetchAll();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save monthly plans');
    } finally {
      setSaving(false);
      loader.hideLoader();
    }
  };

  const deleteDealer = async (dealerId: string) => {
    const confirmed = window.confirm(`Delete dealer ${dealerId}?`);
    if (!confirmed) return;

    try {
      setDeletingKey(dealerId);
      const response = await fetch('/api/dealer-kit/dealers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete dealer');
      }

      toast.success('Dealer deleted');
      await fetchAll();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to delete dealer');
    } finally {
      setDeletingKey(null);
    }
  };

  const deleteMonthly = async (contentId: string) => {
    const confirmed = window.confirm(`Delete monthly plan ${contentId}?`);
    if (!confirmed) return;

    try {
      setDeletingKey(contentId);
      const response = await fetch('/api/dealer-kit/monthly-frequency', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete monthly plan');
      }

      toast.success('Plan item deleted');
      await fetchAll();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to delete monthly plan');
    } finally {
      setDeletingKey(null);
    }
  };

  const getDoneByUser = () => {
    let defaultDoneBy = loggedInUser;
    if (!defaultDoneBy && typeof window !== 'undefined') {
      try {
        const erpUserStr = localStorage.getItem('erp_logged_user');
        if (erpUserStr) {
          const erpUser = JSON.parse(erpUserStr);
          defaultDoneBy = erpUser.username || erpUser.name || '';
        } else {
          defaultDoneBy = localStorage.getItem('user_name') || '';
        }
      } catch (e) { }
    }
    return defaultDoneBy;
  };

  const toggleTrackingStatus = async (dealer: Dealer, plan: MonthlyPlan, tracking?: TrackingStatus) => {
    const key = `${dealer.dealerId}-${plan.contentId}`;
    const isDone = tracking?.status === 'Done';
    const nextStatus = isDone ? 'Pending' : 'Done';
    const doneBy = nextStatus === 'Done' ? getDoneByUser() : '';
    const previousTracking = trackingData;

    // Optimistic local update — no full page reload
    setTrackingData((prev) => {
      const idx = prev.findIndex(
        (t) => t.dealerId === dealer.dealerId && t.contentId === plan.contentId
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: nextStatus,
          doneBy,
          comments: '',
        };
        return next;
      }
      return [
        ...prev,
        {
          dealerId: dealer.dealerId,
          contentId: plan.contentId,
          status: nextStatus,
          link: '',
          doneBy,
          comments: '',
        },
      ];
    });

    try {
      setTrackingSavingKey(key);
      const response = await fetch('/api/dealer-kit/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId: dealer.dealerId,
          contentId: plan.contentId,
          dealerName: dealer.firmName || dealer.contactPerson || dealer.dealerId,
          month: plan.dueDate ? new Date(plan.dueDate).toLocaleString('en-US', { month: 'long' }) : '',
          contentName: plan.contentType || '',
          status: nextStatus,
          link: tracking?.link || '',
          comments: '',
          doneBy,
        }),
      });

      if (!response.ok) throw new Error('Failed to update tracking');

      toast.success(nextStatus === 'Done' ? 'Marked as done' : 'Marked as pending');
    } catch (error: any) {
      setTrackingData(previousTracking);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setTrackingSavingKey(null);
    }
  };

  const handleBatchFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      const newItems = [...batchItems];
      newItems[index] = { ...newItems[index], isUploading: true };
      setBatchItems(newItems);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'dealer_kit');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Upload failed');
      }

      const result = await response.json();
      setBatchItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], fileLink: result.url, isUploading: false };
        return updated;
      });
      toast.success('File uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
      setBatchItems(prev => {
        const updated = [...prev];
        if(updated[index]) updated[index] = { ...updated[index], isUploading: false };
        return updated;
      });
    } finally {
      e.target.value = '';
    }
  };

  const openAddFestivalModal = () => {
    setFestivalModalMode('add');
    setFestivalForm({ id: '', month: '', festival: '', date: '', medium: 'WhatsApp Greeting', status: 'Scheduled' });
    setFestivalModalOpen(true);
  };

  const openEditFestivalModal = (festival: Festival) => {
    setFestivalModalMode('edit');
    setFestivalForm(festival);
    setFestivalModalOpen(true);
  };

  const saveFestival = async () => {
    if (!festivalForm.festival.trim()) {
      toast.error('Festival name is required');
      return;
    }

    try {
      setSaving(true);
      loader.showLoader();

      const method = festivalModalMode === 'add' ? 'POST' : 'PUT';
      const response = await fetch('/api/dealer-kit/festivals', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(festivalForm),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to save festival');
      }

      toast.success(festivalModalMode === 'add' ? 'Festival created' : 'Festival updated');
      setFestivalModalOpen(false);
      await fetchAll();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save festival');
    } finally {
      setSaving(false);
      loader.hideLoader();
    }
  };

  const deleteFestival = async (id: string) => {
    const confirmed = window.confirm(`Delete festival?`);
    if (!confirmed) return;

    try {
      setDeletingKey(id);
      const response = await fetch('/api/dealer-kit/festivals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete festival');
      }

      toast.success('Festival deleted');
      await fetchAll();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to delete festival');
    } finally {
      setDeletingKey(null);
    }
  };

  const monthlyPlansByMonth = useMemo(() => {
    const grouped: Record<string, MonthlyPlan[]> = {};
    const sortedPlans = [...filteredMonthlyPlans].sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
    sortedPlans.forEach(plan => {
      const m = plan.dueDate ? new Date(plan.dueDate).toLocaleString('en-US', { month: 'long' }) : 'Unscheduled';
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(plan);
    });
    return grouped;
  }, [filteredMonthlyPlans]);

  return (
    <LayoutWrapper>
      <div className="dealer-kit-page relative min-h-full overflow-hidden bg-[var(--theme-light)] p-4 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[var(--theme-primary)]/15 blur-3xl" />
        <div className="pointer-events-none absolute top-32 -left-20 h-64 w-64 rounded-full bg-[var(--theme-secondary)]/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-52 w-52 rounded-full bg-[var(--theme-tertiary)]/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1600px] space-y-6">
          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 shadow-[0_25px_70px_-35px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="bg-[linear-gradient(135deg,var(--theme-primary),var(--theme-secondary),var(--theme-tertiary))] px-5 py-4 text-gray-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/25 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-gray-900 backdrop-blur">
                    <Sparkles className="h-3.5 w-3.5" /> Dealer Relationship KIT
                  </div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Dealer_Kit</h1>
                  <p className="max-w-2xl text-sm font-medium text-gray-900/85">
                    Dealer calendar, festival mapping, and monthly content workflow in one colorful planning dashboard.
                    {summary.annualCycle ? ` Annual cycle ${summary.annualCycle}.` : ''}
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={fetchAll}
                  className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/40 bg-white/90 px-4 py-2.5 text-sm font-black text-gray-900 shadow-lg shadow-black/10"
                >
                  <RefreshCcw className="h-4 w-4" /> Refresh Data
                </motion.button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-6">
              <StatCard title="Total Dealers" value={cards[0].value} note="Master database" className="bg-gradient-to-br from-sky-50 via-white to-sky-100" icon={<Users className="h-5 w-5 text-sky-600" />} />
              <StatCard title="Active Dealers" value={cards[1].value} note="Currently engaged" className="bg-gradient-to-br from-emerald-50 via-white to-emerald-100" icon={<BadgeCheck className="h-5 w-5 text-emerald-600" />} />
              <StatCard title="Pending Content" value={cards[2].value} note="Awaiting execution" className="bg-gradient-to-br from-amber-50 via-white to-orange-100" icon={<ClipboardList className="h-5 w-5 text-amber-600" />} />
              <StatCard title="Completed Content" value={cards[3].value} note="Approved or done" className="bg-gradient-to-br from-violet-50 via-white to-fuchsia-100" icon={<Layers3 className="h-5 w-5 text-violet-600" />} />
              <StatCard title="Upcoming Dispatches" value={cards[4].value} note="Due soon" className="bg-gradient-to-br from-rose-50 via-white to-pink-100" icon={<Truck className="h-5 w-5 text-rose-600" />} />
              <StatCard title="Completion" value={cards[5].value} note="Workflow health" className="bg-gradient-to-br from-cyan-50 via-white to-teal-100" icon={<Sparkles className="h-5 w-5 text-cyan-600" />} />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-3 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.16)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto hide-scrollbar">
                {[
                  {
                    key: 'summary',
                    label: 'Summary',
                    icon: <Sparkles className="h-4 w-4" />,
                    activeClass: 'bg-sky-600 text-white border-sky-700 shadow-sm shadow-sky-300/60',
                    idleClass: 'bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100',
                  },
                  {
                    key: 'festivals',
                    label: 'Festival Calendar',
                    icon: <CalendarDays className="h-4 w-4" />,
                    activeClass: 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-300/60',
                    idleClass: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100',
                  },
                  {
                    key: 'dealers',
                    label: 'Dealer Master',
                    icon: <Users className="h-4 w-4" />,
                    activeClass: 'bg-amber-600 text-white border-amber-700 shadow-sm shadow-amber-300/60',
                    idleClass: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
                  },
                  {
                    key: 'monthly',
                    label: 'Monthly Frequency KIT',
                    icon: <Megaphone className="h-4 w-4" />,
                    activeClass: 'bg-violet-600 text-white border-violet-700 shadow-sm shadow-violet-300/60',
                    idleClass: 'bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100',
                  },
                ].map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as ActiveTab)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition-all ${isActive ? tab.activeClass : tab.idleClass
                        }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-center">
                <div className="relative w-full xl:w-[360px]">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <InputShell
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={activeTab === 'monthly' ? 'Search plans by month, topic, type, owner...' : 'Search dealers by name, city, state, language...'}
                    className="pl-10"
                  />
                </div>


              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-16 flex items-center justify-center shadow-[0_18px_50px_-30px_rgba(0,0,0,0.16)] backdrop-blur-xl">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.24 }}
                className="space-y-6"
              >
                {activeTab === 'summary' && (
                  <div className="grid gap-6 xl:grid-cols-2">
                    <SectionCard
                      title="Dashboard Snapshot"
                      subtitle="High level plan status and campaign volume"
                      accent="bg-gradient-to-r from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-tertiary)]"
                      icon={<Sparkles className="h-5 w-5 text-white" />}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-white p-4 border border-sky-100">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">Annual Cycle</p>
                          <p className="mt-2 text-lg font-black text-gray-900">{stats.annualCycle}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 border border-emerald-100">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">Festival WhatsApp</p>
                          <p className="mt-2 text-lg font-black text-gray-900">{stats.festivalWhatsapp}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-white p-4 border border-violet-100">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600">Videos</p>
                          <p className="mt-2 text-lg font-black text-gray-900">{stats.videos}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-white p-4 border border-rose-100">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">Insight Letters</p>
                          <p className="mt-2 text-lg font-black text-gray-900">{stats.insightLetters}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-4 border border-amber-100">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600">WhatsApp Campaigns</p>
                          <p className="mt-2 text-lg font-black text-gray-900">{stats.whatsappCampaigns}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-white p-4 border border-cyan-100">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Courier Campaigns</p>
                          <p className="mt-2 text-lg font-black text-gray-900">{stats.courierCampaigns}</p>
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard
                      title="Execution Rhythm"
                      subtitle="Current workflow split by active status"
                      accent="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
                      icon={<ClipboardList className="h-5 w-5 text-white" />}
                    >
                      <div className="space-y-4">
                        {[
                          { label: 'Pending tasks', value: stats.pendingTasks, color: 'from-amber-400 to-orange-500' },
                          { label: 'Completed tasks', value: stats.completedTasks, color: 'from-emerald-400 to-green-500' },
                          { label: 'Total tasks', value: stats.totalTasks, color: 'from-sky-400 to-blue-500' },
                        ].map((item) => (
                          <div key={item.label} className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                            <div className="flex items-center justify-between text-sm font-bold text-gray-700">
                              <span>{item.label}</span>
                              <span>{item.value}</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
                              <div className={`h-full rounded-full bg-gradient-to-r ${item.color}`} style={{ width: `${Math.max(8, Math.min(100, Number(item.value) * 12 || 8))}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </div>
                )}

                {activeTab === 'festivals' && (
                  <SectionCard
                    title="Festival Calendar"
                    subtitle="Promotional activity and greeting schedule"
                    accent="bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-500"
                    icon={<CalendarDays className="h-5 w-5 text-white" />}
                  >
                    <div className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-fuchsia-50 via-rose-50 to-orange-50 px-4 py-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-700">Festival schedule</p>
                          <p className="text-sm text-gray-600">Manage promotional activities and greetings.</p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={openAddFestivalModal}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--theme-secondary)] px-4 py-2.5 text-sm font-black text-gray-900 shadow-lg shadow-[var(--theme-secondary)]/30 hover:bg-[var(--theme-tertiary)]"
                        >
                          <Plus className="h-4 w-4" /> Add Festival
                        </motion.button>
                      </div>

                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Month</th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Festival</th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Date</th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Medium</th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Status</th>
                              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.18em]">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {festivals.map((festival) => (
                              <tr key={festival.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                                <td className="px-4 py-3 font-semibold text-gray-800">{festival.month}</td>
                                <td className="px-4 py-3 font-black text-gray-900">{festival.festival}</td>
                                <td className="px-4 py-3 text-gray-700">{formatDate(festival.date)}</td>
                                <td className="px-4 py-3 text-gray-700">{festival.medium}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClass(festival.status)}`}>
                                    {festival.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => openEditFestivalModal(festival)}
                                      className="rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700 hover:bg-rose-100"
                                      title="Edit Festival"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteFestival(festival.id)}
                                      className="rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700 hover:bg-rose-100"
                                      title="Delete Festival"
                                      disabled={deletingKey === festival.id}
                                    >
                                      {deletingKey === festival.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {festivals.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No festival items found</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </SectionCard>
                )}

                {activeTab === 'dealers' && (
                  <SectionCard
                    title="Dealer Master"
                    subtitle="Main relationship database with quick edit and delete actions"
                    accent="bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500"
                    icon={<Users className="h-5 w-5 text-white" />}
                  >
                    <div className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-sky-50 via-cyan-50 to-teal-50 px-4 py-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Dealer records</p>
                          <p className="text-sm text-gray-600">Maintain dealer master entries and communication status.</p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={openAddDealerModal}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--theme-secondary)] px-4 py-2.5 text-sm font-black text-gray-900 shadow-lg shadow-[var(--theme-secondary)]/30 hover:bg-[var(--theme-tertiary)]"
                        >
                          <Plus className="h-4 w-4" /> Add Dealer
                        </motion.button>
                      </div>

                      {dealerCategories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDealerCategoryTab('all')}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all ${
                              dealerCategoryTab === 'all'
                                ? 'border-slate-700 bg-slate-700 text-white shadow-sm shadow-slate-300/50'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            All
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                              dealerCategoryTab === 'all' ? 'bg-white/20' : 'bg-slate-200/80'
                            }`}>
                              {dealers.length}
                            </span>
                          </button>
                          {dealerCategories.map((category) => {
                            const isUncategorized = category === '__uncategorized__';
                            const label = isUncategorized ? 'Uncategorized' : category;
                            const color = getCategoryColor(category);
                            const count = dealers.filter((d) => {
                              const cat = (d.category || '').trim();
                              return isUncategorized ? !cat : cat === category;
                            }).length;
                            const isActive = dealerCategoryTab === category;
                            return (
                              <button
                                key={category}
                                type="button"
                                onClick={() => setDealerCategoryTab(category)}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all ${
                                  isActive ? color.active : color.idle
                                }`}
                              >
                                <Tag className={`h-3 w-3 ${isActive ? 'text-white' : color.icon}`} />
                                {label}
                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                                  isActive ? color.countActive : color.countIdle
                                }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-amber-700 text-amber-50">
                            <tr>
                              {/* <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Dealer ID</th> */}
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Dealer Details</th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Location & Address</th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Profile & Ownership</th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em]">Communication & Status</th>
                              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.18em]">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDealers.map((dealer) => (
                              <tr key={dealer.dealerId} className="border-t border-gray-100 hover:bg-gray-50/80">
                                {/* <td className="px-4 py-3 font-black text-gray-900">{dealer.dealerId}</td> */}
                                <td className="px-4 py-3 text-gray-700 align-top">
                                  <div className="space-y-2">
                                    <p className="font-black text-gray-900 text-base">{dealer.firmName || '-'}</p>
                                    <div className="flex items-center gap-2 text-sm">
                                      <User className="h-4 w-4 text-sky-500" />
                                      <span>{dealer.contactPerson || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <MessageCircle className="h-4 w-4 text-emerald-500" />
                                      <span>{dealer.whatsappMobile || '-'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-700 align-top">
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                      <Building2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                      <span>{dealer.city || '-'}, {dealer.state || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                                      <span>{dealer.pincode || '-'}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <Truck className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                                      <span className="max-w-[280px] line-clamp-2" title={dealer.courierAddress || '-'}>{dealer.courierAddress || '-'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-700 align-top">
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2" title="Category">
                                      {dealer.category ? (() => {
                                        const color = getCategoryColor(dealer.category);
                                        return (
                                          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-black ${color.badge}`}>
                                            <Tag className={`h-3.5 w-3.5 ${color.icon}`} />
                                            {dealer.category}
                                          </span>
                                        );
                                      })() : (
                                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                                          <Tag className="h-4 w-4" />
                                          -
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2" title="Preferred Language">
                                      <Languages className="h-4 w-4 text-blue-500 shrink-0" />
                                      <span>{dealer.preferredLanguage || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2" title="Relationship Owner">
                                      <Users className="h-4 w-4 text-teal-500 shrink-0" />
                                      <span>{dealer.relationshipOwner || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2" title="Customer Type">
                                      <BadgeCheck className="h-4 w-4 text-orange-500 shrink-0" />
                                      <span>{dealer.customerType || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2" title="Potential Product Interest">
                                      <Sparkles className="h-4 w-4 text-yellow-500 shrink-0" />
                                      <span className="truncate max-w-[150px]">{dealer.potentialProductInterest || '-'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-700 align-top">
                                  <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${String(dealer.whatsappConsent).toLowerCase() === 'yes'
                                          ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                                          : 'border-rose-200 bg-rose-100 text-rose-700'
                                        }`} title="WhatsApp Consent">
                                        WA
                                      </span>
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${String(dealer.numberSavedCuboc).toLowerCase() === 'yes'
                                          ? 'border-sky-200 bg-sky-100 text-sky-700'
                                          : 'border-gray-200 bg-gray-100 text-gray-500'
                                        }`} title="Number Saved in Cuboc">
                                        Cuboc
                                      </span>
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${String(dealer.courierAddressVerified).toLowerCase() === 'yes'
                                          ? 'border-violet-200 bg-violet-100 text-violet-700'
                                          : 'border-gray-200 bg-gray-100 text-gray-500'
                                        }`} title="Courier Address Verified">
                                        Verified
                                      </span>
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${String(dealer.activeInKit).toLowerCase() === 'yes'
                                          ? 'border-amber-200 bg-amber-100 text-amber-700'
                                          : 'border-gray-200 bg-gray-100 text-gray-500'
                                        }`} title="Active in KIT">
                                        Active
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 text-sm">
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                                        <span>{formatDate(dealer.lastOrderDate)}</span>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <MessageSquare className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2 text-xs text-gray-500 italic" title={dealer.notes || '-'}>{dealer.notes || '-'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => openEditDealerModal(dealer)}
                                      className="rounded-2xl border border-sky-200 bg-sky-50 p-2.5 text-sky-700 hover:bg-sky-100"
                                      title="Edit Dealer"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteDealer(dealer.dealerId)}
                                      className="rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700 hover:bg-rose-100"
                                      title="Delete Dealer"
                                      disabled={deletingKey === dealer.dealerId}
                                    >
                                      {deletingKey === dealer.dealerId ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {filteredDealers.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No dealer records found</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </SectionCard>
                )}

                {activeTab === 'monthly' && (
                  <SectionCard
                    title="Monthly Frequency KIT"
                    subtitle="Main content workflow with approval and dispatch tracking"
                    accent="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500"
                    icon={<Megaphone className="h-5 w-5 text-white" />}
                  >
                    <div className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white shadow-sm">
                      <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-rose-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Monthly plan</p>
                          <p className="text-sm text-gray-600">Track due dates, release dates, and production status.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="relative">
                            <input 
                              list="dealer-names" 
                              value={dealerSearch} 
                              onChange={(e) => setDealerSearch(e.target.value)} 
                              placeholder="Filter by Dealer..."
                              className="rounded-xl border border-violet-200 bg-white/90 px-3 py-2 text-sm font-semibold shadow-sm outline-none focus:border-violet-500 min-w-[200px]"
                            />
                            <datalist id="dealer-names">
                              {dealers.map(d => <option key={d.dealerId} value={d.firmName || d.contactPerson || d.dealerId} />)}
                            </datalist>
                          </div>
                          <select
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="rounded-xl border border-violet-200 bg-white/90 px-3 py-2 text-sm font-semibold shadow-sm outline-none focus:border-violet-500"
                          >
                            <option value="all">All Months</option>
                            {monthlyMonths.map((month) => (
                              <option key={month} value={month}>{month}</option>
                            ))}
                          </select>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={openAddMonthlyModal}
                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--theme-secondary)] px-4 py-2 text-sm font-black text-gray-900 shadow-sm shadow-[var(--theme-secondary)]/30 hover:bg-[var(--theme-tertiary)]"
                          >
                            <Plus className="h-4 w-4" /> Add Monthly Batch
                          </motion.button>
                        </div>
                      </div>

                      {monthlyCategories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
                          {monthlyCategories.map((category) => {
                            const isUncategorized = category === '__uncategorized__';
                            const label = isUncategorized ? 'Uncategorized' : category;
                            const color = getCategoryColor(category);
                            const planCount = monthlyPlans.filter((p) => {
                              const cat = (p.category || '').trim();
                              return isUncategorized ? !cat : cat === category;
                            }).length;
                            const isActive = monthlyCategoryTab === category;
                            return (
                              <button
                                key={category}
                                type="button"
                                onClick={() => setMonthlyCategoryTab(category)}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all ${
                                  isActive ? color.active : color.idle
                                }`}
                              >
                                <Tag className={`h-3 w-3 ${isActive ? 'text-white' : color.icon}`} />
                                {label}
                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                                  isActive ? color.countActive : color.countIdle
                                }`}>
                                  {planCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="overflow-auto max-h-[65vh] border-b border-gray-100 shadow-inner rounded-b-2xl">
                        <table className="w-full text-sm whitespace-nowrap">
                          <thead className="bg-gray-50 text-gray-700 sticky top-0 z-30 shadow-sm">
                            <tr>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] border-r border-b border-gray-200 bg-gray-50 sticky left-0 z-40" rowSpan={4}>
                                Dealer Name
                              </th>
                              {Object.entries(monthlyPlansByMonth).map(([month, plans]) => (
                                <th key={month} colSpan={plans.length} className="px-4 py-2 text-center text-sm font-black uppercase tracking-[0.18em] border-b border-r border-gray-300 bg-violet-50 text-violet-800">
                                  {month}
                                </th>
                              ))}
                            </tr>
                            <tr>
                              {Object.entries(monthlyPlansByMonth).map(([month, plans]) =>
                                plans.map(plan => (
                                  <th key={`date-${plan.contentId}`} className="px-4 py-2 text-center text-xs font-bold border-b border-r border-gray-300 bg-sky-50">
                                    {formatDate(plan.dueDate)}
                                  </th>
                                ))
                              )}
                            </tr>
                            <tr>
                              {Object.entries(monthlyPlansByMonth).map(([month, plans]) =>
                                plans.map(plan => (
                                  <th key={`medium-${plan.contentId}`} className="px-4 py-2 border-b border-r border-gray-300 bg-rose-50">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-bold tracking-[0.1em] text-gray-500 uppercase">{plan.medium}</span>
                                      <div className="flex items-center gap-0.5">
                                        {plan.fileLink && (
                                          <a href={plan.fileLink} target="_blank" rel="noreferrer" className="p-1 rounded-md text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition" title="View Attachment">
                                            <Link2 className="h-3 w-3" />
                                          </a>
                                        )}
                                        {plan.remarks && (
                                          <div className="group relative flex items-center">
                                            <div className="p-1 rounded-md text-sky-500 hover:text-sky-700 hover:bg-sky-50 transition cursor-help">
                                              <Info className="h-3 w-3" />
                                            </div>
                                            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 w-48 opacity-0 transition-opacity group-hover:opacity-100 bg-gray-900 text-white text-[11px] font-normal normal-case tracking-normal rounded-lg py-2 px-3 text-center shadow-xl whitespace-normal">
                                              {plan.remarks}
                                              <div className="absolute top-full left-1/2 -ml-1.5 border-[6px] border-transparent border-t-gray-900"></div>
                                            </div>
                                          </div>
                                        )}
                                        <button onClick={() => openEditMonthlyModal(plan)} className="p-1 rounded-md text-sky-500 hover:text-sky-700 hover:bg-sky-50 transition" title="Edit Plan">
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button onClick={() => deleteMonthly(plan.contentId)} className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition" title="Delete Plan" disabled={deletingKey === plan.contentId}>
                                          {deletingKey === plan.contentId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                        </button>
                                      </div>
                                    </div>
                                  </th>
                                ))
                              )}
                            </tr>
                            <tr>
                              {Object.entries(monthlyPlansByMonth).map(([month, plans]) =>
                                plans.map(plan => (
                                  <th key={`type-${plan.contentId}`} className="px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.1em] border-b border-r border-gray-300 text-gray-700 bg-amber-50">
                                    {plan.contentType}
                                  </th>
                                ))
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDealers.map(dealer => (
                              <tr key={dealer.dealerId} className="border-t border-gray-300 hover:bg-gray-50">
                                <td className="px-4 py-3 font-black text-gray-900 border-r border-gray-300 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                  {dealer.firmName || dealer.contactPerson}
                                </td>
                                {Object.entries(monthlyPlansByMonth).map(([month, plans]) =>
                                  plans.map(plan => {
                                    const tracking = trackingData.find(t => t.dealerId === dealer.dealerId && t.contentId === plan.contentId);
                                    const isDone = tracking?.status === 'Done';
                                    const cellKey = `${dealer.dealerId}-${plan.contentId}`;
                                    const isSaving = trackingSavingKey === cellKey;

                                    return (
                                      <td key={`cell-${dealer.dealerId}-${plan.contentId}`} className="px-4 py-3 text-center border-r border-gray-300 min-w-[120px]">
                                        <label
                                          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition ${
                                            isDone
                                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                              : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/40'
                                          } ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}
                                        >
                                          {isSaving ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                          ) : (
                                            <input
                                              type="checkbox"
                                              checked={isDone}
                                              onChange={() => toggleTrackingStatus(dealer, plan, tracking)}
                                              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                          )}
                                          <span className="text-xs font-bold">{isDone ? 'Done' : 'Pending'}</span>
                                          {isDone && tracking?.link && (
                                            <a
                                              href={tracking.link}
                                              target="_blank"
                                              rel="noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="text-emerald-600 hover:text-emerald-800 p-0.5 rounded-md"
                                              title="View Video/Link"
                                            >
                                              <Link2 className="h-3.5 w-3.5" />
                                            </a>
                                          )}
                                        </label>
                                      </td>
                                    );
                                  })
                                )}
                              </tr>
                            ))}
                            {filteredDealers.length === 0 && (
                              <tr>
                                <td colSpan={100} className="px-4 py-10 text-center text-gray-500">No dealers found</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </SectionCard>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      <AnimatePresence>
        {dealerModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="w-full max-w-[1000px] overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_80px_-35px_rgba(0,0,0,0.35)]"
            >
              <div className="bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 px-6 py-5 text-gray-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900/75">Dealer form</p>
                    <h3 className="mt-1 text-2xl font-black">{dealerModalMode === 'add' ? 'Add Dealer' : 'Edit Dealer'}</h3>
                    <p className="mt-1 text-sm font-medium text-gray-900/80">Keep the dealer master colorful, structured and easy to maintain.</p>
                  </div>
                  <button
                    onClick={() => setDealerModalOpen(false)}
                    className="rounded-2xl bg-white/30 p-2.5 text-gray-900 transition hover:bg-white/45"
                    aria-label="Close dealer modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[78vh] overflow-auto bg-gradient-to-b from-white to-sky-50/40 p-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <SectionCard
                    title="Core Details"
                    subtitle="Identity and relationship basics"
                    accent="bg-gradient-to-r from-sky-500 to-cyan-500"
                    icon={<Users className="h-5 w-5 text-white" />}
                  >
                    <div className="grid gap-4">
                      <Field
                        label="Dealer ID"
                        hint={dealerModalMode === 'add' ? 'Auto generated on save (D001 format)' : undefined}
                      >
                        <div className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
                          <span className="text-sm font-black text-sky-900">
                            {dealerModalMode === 'add' ? 'Auto-generated (D001...)' : (dealerForm.dealerId || 'Auto-generated')}
                          </span>
                          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-sky-700">
                            System
                          </span>
                        </div>
                      </Field>
                      <Field label="Firm Name">
                        <InputShell value={dealerForm.firmName} onChange={(e) => setDealerForm((s) => ({ ...s, firmName: e.target.value }))} placeholder="Firm Name *" />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Contact Person"><InputShell value={dealerForm.contactPerson} onChange={(e) => setDealerForm((s) => ({ ...s, contactPerson: e.target.value }))} placeholder="Contact Person" /></Field>
                        <Field label="WhatsApp Mobile"><InputShell value={dealerForm.whatsappMobile} onChange={(e) => setDealerForm((s) => ({ ...s, whatsappMobile: e.target.value }))} placeholder="WhatsApp Mobile" /></Field>
                      </div>
                      <Field label="Courier Address">
                        <TextAreaShell value={dealerForm.courierAddress} onChange={(e) => setDealerForm((s) => ({ ...s, courierAddress: e.target.value }))} placeholder="Courier Address" className="min-h-[92px]" />
                      </Field>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Profile & Status"
                    subtitle="Communication, audience and commercial details"
                    accent="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    icon={<BadgeCheck className="h-5 w-5 text-white" />}
                  >
                    <div className="grid gap-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="City"><InputShell value={dealerForm.city} onChange={(e) => setDealerForm((s) => ({ ...s, city: e.target.value }))} placeholder="City" /></Field>
                        <Field label="State"><InputShell value={dealerForm.state} onChange={(e) => setDealerForm((s) => ({ ...s, state: e.target.value }))} placeholder="State" /></Field>
                      </div>
                      <Field label="Pincode"><InputShell value={dealerForm.pincode} onChange={(e) => setDealerForm((s) => ({ ...s, pincode: e.target.value }))} placeholder="Pincode" /></Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Category">
                          <CreatableCategoryCombobox
                            value={dealerForm.category}
                            onChange={(category) => setDealerForm((s) => ({ ...s, category }))}
                            options={existingCategoryOptions}
                            placeholder="Search or add category"
                          />
                        </Field>
                        <Field label="Preferred Language">
                          <div className="grid grid-cols-2 gap-2">
                            {(['Hindi', 'English'] as const).map((lang) => (
                              <button
                                key={lang}
                                type="button"
                                onClick={() => setDealerForm((s) => ({ ...s, preferredLanguage: lang }))}
                                className={`rounded-2xl border px-3 py-2.5 text-sm font-black transition ${dealerForm.preferredLanguage === lang
                                    ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/15 text-gray-900'
                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                  }`}
                              >
                                {lang}
                              </button>
                            ))}
                          </div>
                        </Field>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Relationship Owner"><InputShell value={dealerForm.relationshipOwner} onChange={(e) => setDealerForm((s) => ({ ...s, relationshipOwner: e.target.value }))} placeholder="Relationship Owner" /></Field>
                        <Field label="Customer Type"><InputShell value={dealerForm.customerType} onChange={(e) => setDealerForm((s) => ({ ...s, customerType: e.target.value }))} placeholder="Customer Type" /></Field>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="WhatsApp Consent">
                          <YesNoToggle
                            value={dealerForm.whatsappConsent}
                            onChange={(value) => setDealerForm((s) => ({ ...s, whatsappConsent: value }))}
                          />
                        </Field>
                        <Field label="Number Saved Cuboc?">
                          <YesNoToggle
                            value={dealerForm.numberSavedCuboc}
                            onChange={(value) => setDealerForm((s) => ({ ...s, numberSavedCuboc: value }))}
                          />
                        </Field>
                        <Field label="Courier Address Verified">
                          <YesNoToggle
                            value={dealerForm.courierAddressVerified}
                            onChange={(value) => setDealerForm((s) => ({ ...s, courierAddressVerified: value }))}
                          />
                        </Field>
                      </div>
                      <Field label="Active in KIT?">
                        <YesNoToggle
                          value={dealerForm.activeInKit}
                          onChange={(value) => setDealerForm((s) => ({ ...s, activeInKit: value }))}
                        />
                      </Field>
                      <Field label="Last Order Date">
                        <InputShell type="date" value={dealerForm.lastOrderDate ? String(dealerForm.lastOrderDate).slice(0, 10) : ''} onChange={(e) => setDealerForm((s) => ({ ...s, lastOrderDate: e.target.value }))} />
                      </Field>
                      <Field label="Potential Product Interest"><InputShell value={dealerForm.potentialProductInterest} onChange={(e) => setDealerForm((s) => ({ ...s, potentialProductInterest: e.target.value }))} placeholder="Potential Product Interest" /></Field>
                      <Field label="Notes">
                        <TextAreaShell value={dealerForm.notes} onChange={(e) => setDealerForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Internal notes" className="min-h-[92px]" />
                      </Field>
                    </div>
                  </SectionCard>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:justify-end">
                <button onClick={() => setDealerModalOpen(false)} className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={saveDealer} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-tertiary)] px-5 py-2.5 text-sm font-black text-gray-900 shadow-lg shadow-[var(--theme-primary)]/20">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Save Dealer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {monthlyModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_80px_-35px_rgba(0,0,0,0.35)]"
            >
              <div className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 px-6 py-5 text-gray-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900/75">Monthly plan form</p>
                    <h3 className="mt-1 text-2xl font-black">{monthlyModalMode === 'add' ? 'Add Monthly Batch' : 'Edit Monthly Plan'}</h3>
                    <p className="mt-1 text-sm font-medium text-gray-900/80">Track production, approvals and dispatches with a brighter workflow sheet.</p>
                  </div>
                  <button
                    onClick={() => setMonthlyModalOpen(false)}
                    className="rounded-2xl bg-white/30 p-2.5 text-gray-900 transition hover:bg-white/45"
                    aria-label="Close monthly modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[78vh] overflow-auto bg-gradient-to-b from-white to-violet-50/40 p-6">
                <div className="space-y-6">
                  <SectionCard
                    title="Batch Setup"
                    subtitle="Plan the content distribution"
                    accent="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    icon={<Megaphone className="h-5 w-5 text-white" />}
                  >
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.18em] text-[11px] w-16">ID</th>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.18em] text-[11px]">Medium</th>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.18em] text-[11px]">Content Type</th>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.18em] text-[11px] w-48">Due Date</th>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.18em] text-[11px]">Remarks</th>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.18em] text-[11px] w-24">Upload</th>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.18em] text-[11px] min-w-[180px]">Category</th>
                            <th className="px-4 py-3 text-right font-black uppercase tracking-[0.18em] text-[11px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchItems.map((item, i) => (
                            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-3 font-black text-gray-900">{item.contentId || (i + 1)}</td>
                              <td className="px-4 py-3">
                                <InputShell
                                  value={item.medium}
                                  onChange={(e) => {
                                    const newItems = [...batchItems];
                                    newItems[i].medium = e.target.value;
                                    setBatchItems(newItems);
                                  }}
                                  placeholder="WhatsApp"
                                  className="py-1.5"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <InputShell
                                  value={item.contentType}
                                  onChange={(e) => {
                                    const newItems = [...batchItems];
                                    newItems[i].contentType = e.target.value;
                                    setBatchItems(newItems);
                                  }}
                                  placeholder="Greeting"
                                  className="py-1.5"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <InputShell
                                  type="date"
                                  value={item.dueDate ? String(item.dueDate).slice(0, 10) : ''}
                                  onChange={(e) => {
                                    const newItems = [...batchItems];
                                    newItems[i].dueDate = e.target.value;
                                    setBatchItems(newItems);
                                  }}
                                  className="py-1.5"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <InputShell
                                  value={item.remarks}
                                  onChange={(e) => {
                                    const newItems = [...batchItems];
                                    newItems[i].remarks = e.target.value;
                                    setBatchItems(newItems);
                                  }}
                                  placeholder="Remarks"
                                  className="py-1.5"
                                />
                              </td>
                              <td className="px-4 py-3">
                                {item.fileLink ? (
                                  <div className="flex items-center gap-1 bg-emerald-50 rounded border border-emerald-200 px-2 py-1">
                                    <a href={item.fileLink} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-800" title="View File">
                                      <Link2 className="h-4 w-4" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newItems = [...batchItems];
                                        newItems[i].fileLink = '';
                                        setBatchItems(newItems);
                                      }}
                                      className="text-rose-500 hover:text-rose-700 p-1"
                                      title="Remove"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <input
                                      type="file"
                                      onChange={(e) => handleBatchFileUpload(e, i)}
                                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                      disabled={item.isUploading}
                                    />
                                    <div className={`flex items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-500 transition ${item.isUploading ? 'opacity-50' : 'hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600'}`}>
                                      {item.isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                      {item.isUploading ? '...' : 'Upload'}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 min-w-[180px]">
                                <CreatableCategoryCombobox
                                  value={item.category || ''}
                                  onChange={(category) => {
                                    const newItems = [...batchItems];
                                    newItems[i].category = category;
                                    setBatchItems(newItems);
                                  }}
                                  options={existingCategoryOptions}
                                  placeholder="Category"
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...batchItems];
                                    newItems.splice(i, 1);
                                    setBatchItems(newItems);
                                  }}
                                  className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                                  title="Remove Row"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="border-t border-gray-100 bg-gray-50/50 p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setBatchItems([...batchItems, { month: '', medium: '', contentType: '', dueDate: '', remarks: '', category: monthlyCategoryTab !== 'all' && monthlyCategoryTab !== '__uncategorized__' ? monthlyCategoryTab : '' }]);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm font-black text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition"
                        >
                          <Plus className="h-4 w-4" /> Add Row
                        </button>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:justify-end">
                <button onClick={() => setMonthlyModalOpen(false)} className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={saveMonthlyBatch} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-tertiary)] px-5 py-2.5 text-sm font-black text-gray-900 shadow-lg shadow-[var(--theme-primary)]/20">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Save Batch
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {festivalModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_80px_-35px_rgba(0,0,0,0.35)]"
            >
              <div className="bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-500 px-6 py-5 text-gray-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900/75">Festival form</p>
                    <h3 className="mt-1 text-2xl font-black">{festivalModalMode === 'add' ? 'Add Festival' : 'Edit Festival'}</h3>
                  </div>
                  <button
                    onClick={() => setFestivalModalOpen(false)}
                    className="rounded-2xl bg-white/30 p-2.5 text-gray-900 transition hover:bg-white/45"
                    aria-label="Close festival modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[78vh] overflow-auto bg-gradient-to-b from-white to-rose-50/40 p-6">
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Month">
                      <select
                        value={festivalForm.month}
                        onChange={(e) => setFestivalForm((s) => ({ ...s, month: e.target.value }))}
                        className="w-full rounded-2xl border border-gray-200 bg-white/90 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/15"
                      >
                        <option value="" disabled>Select Month</option>
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Festival Date"><InputShell type="date" value={festivalForm.date ? String(festivalForm.date).slice(0, 10) : ''} onChange={(e) => setFestivalForm((s) => ({ ...s, date: e.target.value }))} /></Field>
                  </div>
                  <Field label="Festival Name"><InputShell value={festivalForm.festival} onChange={(e) => setFestivalForm((s) => ({ ...s, festival: e.target.value }))} placeholder="Festival Name *" /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Medium"><InputShell value={festivalForm.medium} onChange={(e) => setFestivalForm((s) => ({ ...s, medium: e.target.value }))} placeholder="WhatsApp Greeting" /></Field>
                    <Field label="Status"><InputShell value={festivalForm.status} onChange={(e) => setFestivalForm((s) => ({ ...s, status: e.target.value }))} placeholder="Status (e.g. Scheduled)" /></Field>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:justify-end">
                <button onClick={() => setFestivalModalOpen(false)} className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={saveFestival} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-tertiary)] px-5 py-2.5 text-sm font-black text-gray-900 shadow-lg shadow-[var(--theme-primary)]/20">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Save Festival
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Info Modal */}
        {infoModalOpen && infoModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="bg-sky-500 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{infoModalData.title}</h2>
                <button onClick={() => setInfoModalOpen(false)} className="text-white hover:bg-sky-600 p-1.5 rounded-lg transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-wrap">{infoModalData.remark}</p>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setInfoModalOpen(false)}
                  className="px-4 py-2 font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </LayoutWrapper>
  );
}
