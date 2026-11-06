'use client';

import type { ReactNode, InputHTMLAttributes } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ensureSessionId } from '@/utils/session';
import { useToast } from '@/components/ToastProvider';
import { formatDateToLocalTimezone } from '@/utils/timezone';
import Icon from '@/components/Icon';
import {
  User,
  Briefcase,
  Mail,
  Phone,
  IndianRupee,
  Star,
  Clock,
  StickyNote,
  Tag,
  CheckCircle2,
  XCircle,
  Building2,
  Percent,
  Calendar,
  RefreshCw,
  Minimize2,
  Pencil,
  Wand2,
  Trash2,
  Hand,
  Filter,
  Layers,
  Star as StarIcon,
  ChevronDown,
  Plus,
  X,
  MoreVertical,
  Check,
  MessageSquare,
  ListTodo,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  CRM_PIPELINE_TAG_NAMES,
  getTagClassName,
  mergeTagNames,
  tagsToString,
} from '@/lib/crmPipelineTags';
import { LEAD_CARD_COLOR_OPTIONS, leadCardSurfaceClass } from '@/lib/crmPipelineLeadColors';
import { parseSheetDate } from '@/lib/dateUtils';
import { compareBySequenceThenId } from '@/lib/crmPipelineStageSort';

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';
const LIGHT_BG = 'bg-[var(--theme-light)] dark:bg-[var(--theme-primary)]/15';
const LIGHT_BORDER = 'border border-[var(--theme-primary)]/25';
const LIGHT_SURFACE = `${LIGHT_BG} ${LIGHT_BORDER} ${DASH_SHADOW}`;
const PIPELINE_ICON = 'w-4 h-4 shrink-0 text-[var(--theme-primary)] opacity-90';
const BTN_SPINNER = 'w-4 h-4 animate-spin shrink-0';
const LEAD_CARD =
  'p-2.5 rounded-md border border-slate-200/90 dark:border-slate-600/50 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow';
const GHOST_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors';
/** Odoo-style: bottom line only, no focus ring box */
const ODDO_INPUT =
  'w-full min-w-0 bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border-0 border-b border-slate-300/90 dark:border-slate-600 rounded-none outline-none shadow-none ring-0 focus:outline-none focus:ring-0 focus:shadow-none focus:border-[var(--theme-primary)] appearance-none';

type Pipeline = { id: string; name: string; sequence?: number };
type Stage = { id: string; pipeline_id: string; name: string; sequence?: number };
type Opportunity = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  expected_revenue?: number | string;
  recurring_revenue?: number | string;
  revenue_period?: string;
  probability?: number | string;
  priority?: number | string;
  tags?: string;
  salesperson?: string;
  expected_closing?: string;
  notes?: string;
  extra_info?: string;
  card_color?: string;
  outcome?: string;
};
type Activity = {
  id: string;
  event_type: string;
  summary?: string;
  /** API may return parsed JSON from some layers; normalize before string ops */
  body?: string | Record<string, unknown>;
  activity_type?: string;
  due_date?: string;
  is_done?: string;
  user_name?: string;
  created_at?: string;
  old_value?: string;
  new_value?: string;
  field_name?: string;
};

type OppDraft = {
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  company: string;
  expected_revenue: string;
  recurring_revenue: string;
  revenue_period: string;
  probability: string;
  salesperson: string;
  expected_closing: string;
  tags: string;
  priority: number;
  notes: string;
  extra_info: string;
};

function buildOppDraftFrom(opp: Opportunity): OppDraft {
  const strField = (v: unknown) => (v == null ? '' : String(v));
  const numish = (v: unknown) =>
    v != null && v !== '' && String(v).toLowerCase() !== 'null' ? String(v) : '';
  return {
    name: strField(opp.name),
    contact_name: strField(opp.contact_name),
    email: strField(opp.email),
    phone: strField(opp.phone),
    company: strField(opp.company),
    expected_revenue: numish(opp.expected_revenue),
    recurring_revenue: numish(opp.recurring_revenue),
    revenue_period: strField(opp.revenue_period),
    probability: numish(opp.probability),
    salesperson: strField(opp.salesperson),
    expected_closing: opp.expected_closing ? strField(opp.expected_closing).slice(0, 10) : '',
    tags: strField(opp.tags),
    priority: Number(opp.priority) || 0,
    notes: strField(opp.notes),
    extra_info: strField(opp.extra_info),
  };
}

function formatInr(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '₹ 0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function parseTags(tags?: string): string[] {
  if (!tags) return [];
  return String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function Stars({
  value,
  onChange,
  readOnly,
  size = 18,
}: {
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  const v = Math.min(3, Math.max(0, Number(value) || 0));
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star === v ? 0 : star)}
          className={readOnly ? 'cursor-default' : 'hover:scale-110'}
        >
          <Star
            size={size}
            className={star <= v ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
            strokeWidth={size >= 18 ? 1.75 : 1.5}
          />
        </button>
      ))}
    </div>
  );
}

function QuickInputRow({
  icon: IconComp,
  ...props
}: { icon: LucideIcon } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <IconComp className={PIPELINE_ICON} strokeWidth={1.75} />
      <input className={`flex-1 text-xs ${ODDO_INPUT}`} {...props} />
    </div>
  );
}

function avatarColor(name?: string): string {
  const palette = ['bg-emerald-500', 'bg-teal-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500'];
  const ch = (name || '?').charCodeAt(0);
  return palette[ch % palette.length];
}

function TagPills({ tags, max = 4 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.slice(0, max).map((t) => (
        <span
          key={t}
          className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${getTagClassName(t)}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function formatFollowUpShort(d?: string): string {
  const iso = parseSheetDate(d);
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function activityBodyToString(body: Activity['body']): string {
  if (body == null || body === '') return '';
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }
  return String(body);
}

function formatActivityBodyDisplay(act: Activity): { title?: string; lines: string[] } {
  const raw = activityBodyToString(act.body);
  if (!raw.trim()) return { lines: [] };
  try {
    const parsed = JSON.parse(raw) as Record<string, any>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.kind === 'note' && typeof parsed.text === 'string') {
        return { lines: [parsed.text] };
      }
      if (parsed.kind === 'scheduled_activity') {
        const lines: string[] = [];
        if (parsed.summary) lines.push(String(parsed.summary));
        if (parsed.body) lines.push(String(parsed.body));
        if (parsed.due_date) lines.push(`Due: ${parsed.due_date}`);
        return { lines };
      }
      if (parsed.kind === 'lead_fields' && parsed.changes && typeof parsed.changes === 'object') {
        const lines = Object.entries(parsed.changes).map(
          ([k, v]: [string, any]) =>
            `${k}: "${v?.from ?? ''}" → "${v?.to ?? ''}"`
        );
        return { title: 'Updated fields', lines };
      }
      if (parsed.kind === 'stage_change') {
        const from = String(parsed.from_label ?? parsed.from_stage_id ?? '');
        const to = String(parsed.to_label ?? parsed.to_stage_id ?? '');
        return { title: 'Stage', lines: [`${from} → ${to}`] };
      }
    }
  } catch {
    /* not JSON */
  }
  return { lines: [raw] };
}

function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={className ?? BTN_SPINNER} aria-hidden />;
}

export default function CrmPipelinePage() {
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [openActivities, setOpenActivities] = useState<Record<string, Activity>>({});
  const [myOnly, setMyOnly] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pipelineDropdownOpen, setPipelineDropdownOpen] = useState(false);
  const [stageMenuAnchor, setStageMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [leadMenuOppId, setLeadMenuOppId] = useState<string | null>(null);
  const [leadMenuAnchor, setLeadMenuAnchor] = useState<{ top: number; left: number } | null>(null);

  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newStageName, setNewStageName] = useState('');
  const [addingStage, setAddingStage] = useState(false);

  const [quickAddStageId, setQuickAddStageId] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState({
    contact_name: '',
    name: '',
    email: '',
    phone: '',
    expected_revenue: '',
  });

  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [oppDraft, setOppDraft] = useState<OppDraft | null>(null);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [quickAddingOpp, setQuickAddingOpp] = useState(false);
  const [movingOppId, setMovingOppId] = useState<string | null>(null);
  const [movingToStageId, setMovingToStageId] = useState<string | null>(null);
  const [settingOutcome, setSettingOutcome] = useState<'won' | 'lost' | null>(null);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [schedulingActivity, setSchedulingActivity] = useState(false);
  const [markingActivityId, setMarkingActivityId] = useState<string | null>(null);
  const [deletingOppId, setDeletingOppId] = useState<string | null>(null);
  const [renamingStageId, setRenamingStageId] = useState<string | null>(null);
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [reorderingStages, setReorderingStages] = useState(false);
  const [patchingCardColorOppId, setPatchingCardColorOppId] = useState<string | null>(null);
  const [drawerMotionEntered, setDrawerMotionEntered] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [chatterTab, setChatterTab] = useState<'note' | 'activity'>('note');
  const [noteText, setNoteText] = useState('');
  const [activityForm, setActivityForm] = useState({
    activity_type: 'call',
    summary: 'Call',
    due_date: '',
    body: '',
  });

  const [dragOppId, setDragOppId] = useState<string | null>(null);
  const [dragStageId, setDragStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [stageMenuId, setStageMenuId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [stageEditInline, setStageEditInline] = useState<string | null>(null);
  const [foldedStageIds, setFoldedStageIds] = useState<Set<string>>(new Set());
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const quickAddRef = useRef<HTMLDivElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const pipelineDropdownRef = useRef<HTMLDivElement>(null);
  const leadMenuRef = useRef<HTMLDivElement>(null);

  const userPayload = useMemo(
    () =>
      currentUser
        ? { id: currentUser.id, username: currentUser.username, full_name: currentUser.full_name }
        : undefined,
    [currentUser]
  );

  const loadPipelines = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/crm-pipeline/pipelines');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load pipelines');
    const list: Pipeline[] = (data.pipelines || []).map((p: Pipeline) => ({
      ...p,
      id: String(p.id),
    }));
    setPipelines(list);
    setSelectedPipelineId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      return list[0]?.id || '';
    });
    const current =
      selectedPipelineId && list.some((p) => p.id === selectedPipelineId)
        ? selectedPipelineId
        : list[0]?.id || '';
    return current;
  }, [selectedPipelineId]);

  const loadBoard = useCallback(async (pipelineId: string) => {
    if (!pipelineId) return;
    const mine = myOnly && currentUser?.username ? currentUser.username : undefined;
    const [stRes, opRes] = await Promise.all([
      fetch(`/api/crm-pipeline/stages?pipelineId=${encodeURIComponent(pipelineId)}`),
      fetch(
        `/api/crm-pipeline/opportunities?pipelineId=${encodeURIComponent(pipelineId)}&outcome=open${mine ? `&mine=${encodeURIComponent(mine)}` : ''}`
      ),
    ]);
    const stData = await stRes.json();
    const opData = await opRes.json();
    if (!stRes.ok) throw new Error(stData.error);
    if (!opRes.ok) throw new Error(opData.error);
    setStages(stData.stages || []);
    setOpportunities(opData.opportunities || []);
    setOpenActivities(opData.openActivities || {});
  }, [myOnly, currentUser?.username]);

  const loadActivities = useCallback(async (oppId: string) => {
    const res = await fetch(`/api/crm-pipeline/activities?opportunityId=${encodeURIComponent(oppId)}`);
    const data = await res.json();
    if (res.ok) setActivities(data.activities || []);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const sessionId = ensureSessionId();
        const authRes = await fetch('/api/auth', { headers: { 'x-session-id': sessionId } });
        const auth = await authRes.json();
        if (!auth.authenticated) {
          router.push('/login');
          return;
        }
        setCurrentUser(auth.user);
        await loadPipelines();
      } catch (e) {
        console.error(e);
        toast.error('Failed to load CRM Pipeline');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, toast, loadPipelines]);

  useEffect(() => {
    if (!selectedPipelineId) return;
    loadBoard(selectedPipelineId).catch((e) => {
      console.error(e);
      toast.error('Failed to load board');
    });
  }, [selectedPipelineId, loadBoard, toast]);

  useEffect(() => {
    if (selectedOpp) loadActivities(selectedOpp.id);
  }, [selectedOpp, loadActivities]);

  useEffect(() => {
    if (selectedOpp) {
      setOppDraft(buildOppDraftFrom(selectedOpp));
    } else {
      setOppDraft(null);
      setDrawerMotionEntered(false);
    }
  }, [selectedOpp]);

  useEffect(() => {
    if (selectedOpp?.id) setDrawerMotionEntered(false);
  }, [selectedOpp?.id]);

  useEffect(() => {
    if (!quickAddStageId) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-pipeline-quick-add-trigger]')) return;
      if (quickAddRef.current?.contains(target)) return;
      setQuickAddStageId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [quickAddStageId]);

  const stageMenuStage = useMemo(
    () => stages.find((s) => s.id === stageMenuId) ?? null,
    [stages, stageMenuId]
  );

  const leadMenuOpp = useMemo(
    () => opportunities.find((o) => o.id === leadMenuOppId) ?? null,
    [opportunities, leadMenuOppId]
  );

  const stageProgressItems = useMemo(() => {
    return [...stages].sort(compareBySequenceThenId).map((s, idx) => ({ stage: s, order: idx + 1 }));
  }, [stages]);

  useEffect(() => {
    if (!tagDropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (tagPickerRef.current?.contains(t)) return;
      setTagDropdownOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [tagDropdownOpen]);

  useEffect(() => {
    if (!filterPanelOpen && !pipelineDropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (filterBarRef.current?.contains(t)) return;
      if (pipelineDropdownRef.current?.contains(t)) return;
      setFilterPanelOpen(false);
      setPipelineDropdownOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [filterPanelOpen, pipelineDropdownOpen]);

  useEffect(() => {
    if (!leadMenuOppId) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (leadMenuRef.current?.contains(t)) return;
      if (t.closest('[data-lead-menu-trigger]')) return;
      setLeadMenuOppId(null);
      setLeadMenuAnchor(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [leadMenuOppId]);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId]
  );

  const filteredOpps = useMemo(() => {
    let list = opportunities;
    if (myOnly && currentUser?.username) {
      const mine = String(currentUser.username).toLowerCase();
      const name = String(currentUser.full_name || '').toLowerCase();
      list = list.filter((o) => {
        const sp = String(o.salesperson || '').toLowerCase();
        return sp === mine || sp.includes(mine) || (name && sp.includes(name));
      });
    }
    if (filterUnassigned) {
      list = list.filter((o) => !String(o.salesperson || '').trim());
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) =>
      [o.name, o.contact_name, o.company, o.email, o.tags, o.salesperson]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [opportunities, search, myOnly, filterUnassigned, currentUser]);

  const displayStages = useMemo(() => {
    if (!dragStageId || !dragOverStageId || dragStageId === dragOverStageId) return stages;
    const list = [...stages];
    const fromIdx = list.findIndex((s) => s.id === dragStageId);
    const toIdx = list.findIndex((s) => s.id === dragOverStageId);
    if (fromIdx < 0 || toIdx < 0) return stages;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    return list;
  }, [stages, dragStageId, dragOverStageId]);

  const oppsByStage = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    for (const s of stages) map[s.id] = [];
    for (const o of filteredOpps) {
      if (map[o.stage_id]) map[o.stage_id].push(o);
    }
    return map;
  }, [stages, filteredOpps]);

  const stageTotals = useMemo(() => {
    const totals: Record<string, { revenue: number; mrr: number }> = {};
    for (const s of stages) {
      const list = oppsByStage[s.id] || [];
      totals[s.id] = {
        revenue: list.reduce((sum, o) => sum + (Number(o.expected_revenue) || 0), 0),
        mrr: list.reduce((sum, o) => sum + (Number(o.recurring_revenue) || 0), 0),
      };
    }
    return totals;
  }, [stages, oppsByStage]);

  const refreshAll = async () => {
    await loadPipelines();
    if (selectedPipelineId) await loadBoard(selectedPipelineId);
    if (selectedOpp) await loadActivities(selectedOpp.id);
  };

  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim()) return;
    if (creatingPipeline) return;
    setCreatingPipeline(true);
    try {
      const res = await fetch('/api/crm-pipeline/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPipelineName, user: userPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Pipeline created');
      setShowNewPipeline(false);
      setNewPipelineName('');
      setSelectedPipelineId(data.pipeline.id);
      await refreshAll();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setCreatingPipeline(false);
    }
  };

  const handleAddStage = async () => {
    const name = newStageName.trim();
    if (!name) {
      toast.error('Enter a stage name');
      return;
    }
    if (addingStage) return;
    setAddingStage(true);
    try {
      let pipelineId = selectedPipelineId;
      if (!pipelineId) {
        pipelineId = await loadPipelines();
      }
      if (!pipelineId) {
        toast.error('Create a pipeline first, then add stages.');
        setShowNewPipeline(true);
        return;
      }
      const res = await fetch('/api/crm-pipeline/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add stage');
      const stage = data.stage
        ? { ...data.stage, id: String(data.stage.id), pipeline_id: String(data.stage.pipeline_id) }
        : null;
      if (stage) {
        setStages((prev) => [...prev, stage].sort(compareBySequenceThenId));
      }
      setNewStageName('');
      toast.success(`Stage “${name}” added`);
      await loadBoard(pipelineId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to add stage');
    } finally {
      setAddingStage(false);
    }
  };

  const handleQuickAdd = async (stageId: string) => {
    if (!selectedPipelineId) return;
    if (quickAddingOpp) return;
    setQuickAddingOpp(true);
    try {
      const res = await fetch('/api/crm-pipeline/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: selectedPipelineId,
          stage_id: stageId,
          ...quickForm,
          salesperson: userPayload?.full_name || userPayload?.username,
          user: userPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Opportunity added');
      setQuickAddStageId(null);
      setQuickForm({ contact_name: '', name: '', email: '', phone: '', expected_revenue: '' });
      await loadBoard(selectedPipelineId);
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setQuickAddingOpp(false);
    }
  };

  const moveToStage = async (oppId: string, stageId: string) => {
    if (movingOppId) return;
    setMovingOppId(oppId);
    setMovingToStageId(stageId);
    try {
      const res = await fetch('/api/crm-pipeline/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: oppId, stage_id: stageId, user: userPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpportunities((prev) =>
        prev.map((o) => (o.id === oppId ? { ...o, stage_id: stageId, ...(data.opportunity || {}) } : o))
      );
      if (selectedOpp && String(selectedOpp.id) === String(oppId)) {
        setSelectedOpp((prev) =>
          prev && String(prev.id) === String(oppId)
            ? { ...prev, stage_id: stageId, ...(data.opportunity || {}) }
            : prev
        );
        void loadActivities(oppId);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to move');
    } finally {
      setMovingOppId(null);
      setMovingToStageId(null);
    }
  };

  const patchLead = async (
    oppId: string,
    updates: Partial<Opportunity>,
    current?: Opportunity | null,
    opts?: { cardColorSpinner?: boolean; successToast?: string }
  ): Promise<boolean> => {
    const base = current ?? opportunities.find((o) => o.id === oppId);
    if (!base) return false;
    const hasChange = Object.entries(updates).some(
      ([key, val]) => String(base[key as keyof Opportunity] ?? '') !== String(val ?? '')
    );
    if (!hasChange) return true;
    if (opts?.cardColorSpinner) setPatchingCardColorOppId(oppId);
    try {
      const res = await fetch('/api/crm-pipeline/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: oppId, user: userPayload, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpportunities((prev) =>
        prev.map((o) => (o.id === oppId ? { ...o, ...updates, ...(data.opportunity || {}) } : o))
      );
      if (selectedOpp?.id === oppId) {
        setSelectedOpp((prev) =>
          prev && prev.id === oppId
            ? { ...prev, ...updates, ...(data.opportunity || {}) }
            : prev
        );
        void loadActivities(oppId);
      }
      if (opts?.successToast) toast.success(opts.successToast);
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
      return false;
    } finally {
      if (opts?.cardColorSpinner) setPatchingCardColorOppId(null);
    }
  };

  const submitLeadUpdates = async () => {
    if (!selectedOpp || !oppDraft) return;
    const base = buildOppDraftFrom(selectedOpp);
    const updates: Record<string, string | number> = {};
    if (oppDraft.name !== base.name) updates.name = oppDraft.name;
    if (oppDraft.contact_name !== base.contact_name) updates.contact_name = oppDraft.contact_name;
    if (oppDraft.email !== base.email) updates.email = oppDraft.email;
    if (oppDraft.phone !== base.phone) updates.phone = oppDraft.phone;
    if (oppDraft.company !== base.company) updates.company = oppDraft.company;
    if (oppDraft.expected_revenue !== base.expected_revenue) updates.expected_revenue = oppDraft.expected_revenue;
    if (oppDraft.recurring_revenue !== base.recurring_revenue) updates.recurring_revenue = oppDraft.recurring_revenue;
    if (oppDraft.revenue_period !== base.revenue_period) updates.revenue_period = oppDraft.revenue_period;
    if (oppDraft.probability !== base.probability) updates.probability = oppDraft.probability;
    if (oppDraft.salesperson !== base.salesperson) updates.salesperson = oppDraft.salesperson;
    if (oppDraft.expected_closing !== base.expected_closing) updates.expected_closing = oppDraft.expected_closing;
    if (oppDraft.tags !== base.tags) updates.tags = oppDraft.tags;
    if (oppDraft.priority !== base.priority) updates.priority = oppDraft.priority;
    if (oppDraft.notes !== base.notes) updates.notes = oppDraft.notes;
    if (oppDraft.extra_info !== base.extra_info) updates.extra_info = oppDraft.extra_info;
    if (Object.keys(updates).length === 0) {
      toast.info('No changes to save');
      return;
    }
    setSubmittingLead(true);
    try {
      const res = await fetch('/api/crm-pipeline/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOpp.id, user: userPayload, batchSubmit: true, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const merged = data.opportunity as Opportunity;
      setSelectedOpp((prev) => (prev && prev.id === merged.id ? merged : prev));
      setOppDraft(buildOppDraftFrom(merged));
      setOpportunities((prev) => prev.map((o) => (o.id === merged.id ? { ...o, ...merged } : o)));
      void loadActivities(selectedOpp.id);
      toast.success('Lead updated');
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    } finally {
      setSubmittingLead(false);
    }
  };

  const deleteLead = async (opp: Opportunity) => {
    if (!window.confirm(`Delete “${opp.name}”?`)) return;
    closeLeadMenu();
    if (deletingOppId) return;
    setDeletingOppId(opp.id);
    try {
      const res = await fetch('/api/crm-pipeline/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: opp.id, user: userPayload, outcome: 'deleted' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpportunities((prev) => prev.filter((o) => o.id !== opp.id));
      if (selectedOpp?.id === opp.id) setSelectedOpp(null);
      toast.success('Lead removed');
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    } finally {
      setDeletingOppId(null);
    }
  };

  const closeLeadMenu = () => {
    setLeadMenuOppId(null);
    setLeadMenuAnchor(null);
  };

  const openLeadMenu = (opp: Opportunity, anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    setLeadMenuAnchor({
      top: rect.bottom + 6,
      left: rect.right,
    });
    setLeadMenuOppId(opp.id);
    closeStageMenu();
  };

  const setOutcome = async (outcome: 'won' | 'lost') => {
    if (!selectedOpp || settingOutcome) return;
    setSettingOutcome(outcome);
    try {
      const ok = await patchLead(
        selectedOpp.id,
        { outcome } as Partial<Opportunity>,
        selectedOpp,
        { successToast: outcome === 'won' ? 'Marked as Won' : 'Marked as Lost' }
      );
      if (ok) setSelectedOpp(null);
    } finally {
      setSettingOutcome(null);
    }
  };

  const submitNote = async () => {
    if (!selectedOpp || !noteText.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      const res = await fetch('/api/crm-pipeline/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: selectedOpp.id,
          type: 'note',
          payload: { text: noteText.trim() },
          user: userPayload,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setNoteText('');
      void loadActivities(selectedOpp.id);
      toast.success('Note logged');
    } catch {
      toast.error('Failed to log note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const submitActivity = async () => {
    if (!selectedOpp || schedulingActivity) return;
    setSchedulingActivity(true);
    try {
      const res = await fetch('/api/crm-pipeline/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: selectedOpp.id,
          type: 'activity',
          payload: {
            activity_type: activityForm.activity_type,
            summary: activityForm.summary,
            due_date: activityForm.due_date,
            body: activityForm.body,
            assigned_to: userPayload?.full_name || userPayload?.username || '',
          },
          user: userPayload,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setActivityForm({ activity_type: 'call', summary: 'Call', due_date: '', body: '' });
      void loadActivities(selectedOpp.id);
      void loadBoard(selectedPipelineId);
      toast.success('Activity scheduled');
    } catch {
      toast.error('Failed to schedule');
    } finally {
      setSchedulingActivity(false);
    }
  };

  const closeOpportunityDrawer = () => {
    setSelectedOpp(null);
    setShowTagModal(false);
    setTagDropdownOpen(false);
    setTagSearch('');
  };

  const filteredCatalogTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    const list = CRM_PIPELINE_TAG_NAMES;
    if (!q) return list;
    return list.filter((n) => n.toLowerCase().includes(q));
  }, [tagSearch]);

  const markActivityDone = async (activityId: string) => {
    if (markingActivityId) return;
    setMarkingActivityId(activityId);
    try {
      const res = await fetch('/api/crm-pipeline/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, user: userPayload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      if (selectedOpp) void loadActivities(selectedOpp.id);
      void loadBoard(selectedPipelineId);
      toast.success('Activity completed');
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark done');
    } finally {
      setMarkingActivityId(null);
    }
  };

  const renameStage = async (stageId: string) => {
    if (!editStageName.trim()) {
      toast.error('Enter a stage name');
      return;
    }
    const name = editStageName.trim();
    if (renamingStageId) return;
    setRenamingStageId(stageId);
    try {
      const res = await fetch('/api/crm-pipeline/stages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename');
      setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, name } : s)));
      closeStageMenu();
      toast.success('Stage renamed');
      void loadBoard(selectedPipelineId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to rename stage');
    } finally {
      setRenamingStageId(null);
    }
  };

  const reorderStages = async (fromId: string, toId: string) => {
    if (fromId === toId || !selectedPipelineId || reorderingStages) return;
    const previous = stages;
    const list = [...stages];
    const fromIdx = list.findIndex((s) => s.id === fromId);
    const toIdx = list.findIndex((s) => s.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    const reordered = list.map((s, i) => ({ ...s, sequence: i + 1 }));
    setStages(reordered);
    setReorderingStages(true);
    try {
      await Promise.all(
        reordered.map((s) =>
          fetch('/api/crm-pipeline/stages', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stageId: s.id, sequence: s.sequence }),
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || res.statusText);
            return res;
          })
        )
      );
      toast.success('Stage order saved');
    } catch (e: any) {
      toast.error(e.message || 'Could not save stage order');
      setStages(previous);
      await loadBoard(selectedPipelineId);
    } finally {
      setReorderingStages(false);
    }
  };

  const closeStageMenu = () => {
    setStageMenuId(null);
    setStageEditInline(null);
    setStageMenuAnchor(null);
  };

  const openStageMenu = (stage: Stage, anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    setStageMenuAnchor({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
    setStageMenuId(stage.id);
    setEditStageName(stage.name);
    setStageEditInline(null);
  };

  const deleteStage = async (stageId: string) => {
    if (deletingStageId) return;
    setDeletingStageId(stageId);
    try {
      const res = await fetch('/api/crm-pipeline/stages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId, pipelineId: selectedPipelineId, action: 'delete' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      closeStageMenu();
      await loadBoard(selectedPipelineId);
      toast.success('Stage removed');
    } catch (e: any) {
      toast.error(e.message || 'Cannot delete stage');
    } finally {
      setDeletingStageId(null);
    }
  };

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="flex items-center justify-center min-h-[50vh] text-slate-500">Loading CRM Pipeline…</div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0 bg-[var(--theme-light)] dark:bg-slate-900">
        <div className={`flex flex-wrap items-center gap-3 px-4 py-2.5 border-b ${LIGHT_BORDER} bg-white/90 dark:bg-slate-900/90`}>
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 shrink-0">
            CRM Pipeline
          </h1>

          <div className="relative shrink-0" ref={pipelineDropdownRef}>
            <button
              type="button"
              onClick={() => setPipelineDropdownOpen((v) => !v)}
              className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg text-sm font-bold ${LIGHT_SURFACE} min-w-[8rem]`}
            >
              <span className="truncate max-w-[10rem]">{selectedPipeline?.name || 'Pipeline'}</span>
              <ChevronDown size={16} className="text-slate-500 shrink-0" />
            </button>
            {pipelineDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[12rem] rounded-lg border border-slate-200 bg-white dark:bg-slate-900 shadow-xl py-1 text-sm">
                {pipelines.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPipelineId(p.id);
                      setPipelineDropdownOpen(false);
                    }}
                    className={`flex w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      p.id === selectedPipelineId ? 'font-bold text-[var(--theme-primary)]' : ''
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPipelineDropdownOpen(false);
                      setShowNewPipeline(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-slate-700 hover:bg-[var(--theme-light)]"
                  >
                    <Plus size={16} className="text-[var(--theme-primary)]" />
                    Add pipeline
                  </button>
                </div>
              </div>
            )}
          </div>

          <div ref={filterBarRef} className="flex-1 flex min-w-[200px] max-w-3xl relative">
            <div
              className={`flex flex-1 items-center gap-2 px-3 py-2 rounded-lg border border-slate-200/90 dark:border-slate-600 bg-white dark:bg-slate-800 ${DASH_SHADOW} min-h-[2.75rem]`}
            >
              <button
                type="button"
                title="Filters"
                onClick={() => setFilterPanelOpen((v) => !v)}
                className={`shrink-0 p-1.5 rounded-md transition-colors ${
                  filterPanelOpen || myOnly || filterUnassigned
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Filter size={18} strokeWidth={2} />
              </button>
              {myOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 text-violet-900 text-xs font-semibold shrink-0">
                  My Pipeline
                  <button type="button" onClick={() => setMyOnly(false)} className="hover:opacity-70">
                    <X size={12} />
                  </button>
                </span>
              )}
              {filterUnassigned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold shrink-0">
                  Unassigned
                  <button type="button" onClick={() => setFilterUnassigned(false)} className="hover:opacity-70">
                    <X size={12} />
                  </button>
                </span>
              )}
              <Icon name="search" size={18} className="text-slate-400 shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => {
                  setPipelineDropdownOpen(false);
                  setFilterPanelOpen(true);
                }}
                placeholder="Search…"
                className="flex-1 min-w-0 bg-transparent text-sm outline-none ring-0 focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setFilterPanelOpen((v) => !v)}
                className="shrink-0 p-1 text-slate-400 hover:text-slate-600"
              >
                <ChevronDown size={18} className={filterPanelOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
            </div>

            {filterPanelOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-700">
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                      <Filter size={14} /> Filters
                    </div>
                    <ul className="space-y-1 text-sm">
                      {[
                        { id: 'my', label: 'My Pipeline', active: myOnly, toggle: () => setMyOnly((v) => !v) },
                        { id: 'unassigned', label: 'Unassigned', active: filterUnassigned, toggle: () => setFilterUnassigned((v) => !v) },
                        { id: 'open', label: 'Open Opportunities', active: true, toggle: () => toast.info('Showing open leads only') },
                      ].map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={f.toggle}
                            className={`flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                              f.active ? 'font-semibold text-violet-800 bg-violet-50/80' : ''
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${f.active ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300'}`}>
                              {f.active ? '✓' : ''}
                            </span>
                            {f.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                      <Layers size={14} /> Group By
                    </div>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {['Salesperson', 'Stage', 'Company', 'Expected Closing'].map((label) => (
                        <li key={label}>
                          <button
                            type="button"
                            className="w-full px-2 py-1.5 rounded-md text-left hover:bg-slate-50 dark:hover:bg-slate-800 opacity-70"
                            onClick={() => toast.info(`${label} grouping coming soon`)}
                          >
                            {label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                      <StarIcon size={14} /> Favorites
                    </div>
                    <button
                      type="button"
                      className="text-sm text-violet-700 font-semibold hover:underline"
                      onClick={() => toast.info('Save search — coming soon')}
                    >
                      Save current search
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-3 min-h-0 bg-[var(--theme-light)] dark:bg-slate-900">
          <div className="flex gap-2 h-full min-w-max pb-2 items-start">
            {displayStages.map((stage) => (
              <motion.div
                key={stage.id}
                layout={false}
                className={`w-[17rem] flex flex-col max-h-full flex-shrink-0 rounded-lg transition-all duration-200 ${
                  dragStageId === stage.id ? 'opacity-40 scale-[0.97]' : ''
                } ${
                  dragOverStageId === stage.id && dragStageId && dragStageId !== stage.id
                    ? 'ring-2 ring-[var(--theme-primary)]/50 ml-3 mr-1'
                    : ''
                } ${
                  dragOverStageId === stage.id && dragOppId ? 'ring-2 ring-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-900/10' : ''
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (dragStageId || dragOppId) setDragOverStageId(stage.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragLeave={(e) => {
                  const rel = e.relatedTarget as Node | null;
                  if (rel && (e.currentTarget as HTMLElement).contains(rel)) return;
                  setDragOverStageId((cur) => (cur === stage.id ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragStageId) {
                    void reorderStages(dragStageId, stage.id);
                    setDragStageId(null);
                    setDragOverStageId(null);
                    return;
                  }
                  if (dragOppId) {
                    void moveToStage(dragOppId, stage.id);
                    setDragOppId(null);
                    setDragOverStageId(null);
                  }
                }}
              >
                <div className="flex items-center gap-1 mb-1 select-none">
                  <span
                    draggable={!reorderingStages}
                    title={reorderingStages ? 'Saving order…' : 'Drag to reorder stage'}
                    onDragStart={(e) => {
                      if (reorderingStages) {
                        e.preventDefault();
                        return;
                      }
                      setDragStageId(stage.id);
                      setDragOppId(null);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', stage.id);
                    }}
                    onDragEnd={() => {
                      setDragStageId(null);
                      setDragOverStageId(null);
                    }}
                    className={`p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 ${
                      reorderingStages ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'
                    }`}
                  >
                    <Hand size={16} strokeWidth={1.75} />
                  </span>
                  <h3 className="flex-1 min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {stage.name}
                  </h3>
                  <div className="flex items-center shrink-0 rounded-md border border-slate-200/80 dark:border-slate-600/80 bg-white/40 dark:bg-slate-800/40 overflow-hidden">
                    <button
                      type="button"
                      title="Quick add"
                      data-pipeline-quick-add-trigger
                      onClick={() =>
                        setQuickAddStageId((prev) => (prev === stage.id ? null : stage.id))
                      }
                      className={`${GHOST_BTN} rounded-none w-8 h-8 border-0 cursor-pointer`}
                    >
                      <Icon name="plus" size={16} />
                    </button>
                    <button
                      type="button"
                      title="Stage settings"
                      onClick={(e) => openStageMenu(stage, e.currentTarget)}
                      className={`${GHOST_BTN} rounded-none w-8 h-8 border-0 border-l border-slate-200/80 dark:border-slate-600/80 cursor-pointer`}
                    >
                      <Icon name="settings" size={15} />
                    </button>
                  </div>
                </div>
                <div className="h-1 bg-slate-200/90 dark:bg-slate-700 rounded-full mb-1 overflow-hidden">
                  <div
                    className="h-full bg-[var(--theme-primary)]/70 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((oppsByStage[stage.id]?.length || 0) / Math.max(1, opportunities.length)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] font-medium text-slate-500 mb-2 tabular-nums">
                  {formatInr(stageTotals[stage.id]?.revenue)}
                  {stageTotals[stage.id]?.mrr ? ` · MRR ${formatInr(stageTotals[stage.id].mrr)}` : ''}
                </p>

                {quickAddStageId === stage.id && (
                  <div ref={quickAddRef} className={`mb-2 p-2.5 ${LEAD_CARD} bg-white dark:bg-slate-800 cursor-default space-y-0`}>
                    <QuickInputRow
                      icon={User}
                      placeholder="Contact name"
                      value={quickForm.contact_name}
                      onChange={(e) => setQuickForm({ ...quickForm, contact_name: e.target.value })}
                    />
                    <QuickInputRow
                      icon={Briefcase}
                      placeholder="Opportunity name"
                      value={quickForm.name}
                      onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })}
                    />
                    <QuickInputRow
                      icon={Mail}
                      placeholder="Email"
                      value={quickForm.email}
                      onChange={(e) => setQuickForm({ ...quickForm, email: e.target.value })}
                    />
                    <QuickInputRow
                      icon={Phone}
                      placeholder="Phone"
                      value={quickForm.phone}
                      onChange={(e) => setQuickForm({ ...quickForm, phone: e.target.value })}
                    />
                    <QuickInputRow
                      icon={IndianRupee}
                      placeholder="Expected revenue"
                      value={quickForm.expected_revenue}
                      onChange={(e) => setQuickForm({ ...quickForm, expected_revenue: e.target.value })}
                    />
                    <div className="flex items-center gap-1 pt-2">
                      <button
                        type="button"
                        disabled={quickAddingOpp}
                        onClick={() => handleQuickAdd(stage.id)}
                        className="flex-1 py-1.5 rounded-md bg-[var(--theme-primary)] text-xs font-bold text-gray-900 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {quickAddingOpp ? <InlineSpinner className="w-3.5 h-3.5" /> : null}
                        {quickAddingOpp ? 'Adding…' : 'Add'}
                      </button>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => setQuickAddStageId(null)}
                        className={GHOST_BTN}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        type="button"
                        title="Discard"
                        onClick={() => {
                          setQuickAddStageId(null);
                          setQuickForm({ contact_name: '', name: '', email: '', phone: '', expected_revenue: '' });
                        }}
                        className={GHOST_BTN}
                      >
                        <Icon name="trash" size={15} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                )}

                <div className={`flex-1 overflow-y-auto space-y-2 min-h-[80px] pr-0.5 ${foldedStageIds.has(stage.id) ? 'hidden' : ''}`}>
                  {(oppsByStage[stage.id] || []).map((opp) => {
                    const tags = parseTags(opp.tags);
                    const openAct = openActivities[opp.id];
                    const displayName = opp.contact_name || opp.company || '';
                    const initial = (displayName || opp.name || '?')[0]?.toUpperCase();
                    return (
                      <div
                        key={opp.id}
                        draggable
                        onDragStart={(e) => {
                          setDragOppId(opp.id);
                          setDragStageId(null);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', opp.id);
                        }}
                        onDragEnd={() => {
                          setDragOppId(null);
                          setDragOverStageId(null);
                        }}
                        onClick={() => {
                          if (dragOppId) return;
                          setSelectedOpp(opp);
                        }}
                        className={`${LEAD_CARD} ${leadCardSurfaceClass(opp.card_color)} ${dragOppId === opp.id ? 'opacity-50 ring-2 ring-[var(--theme-primary)]/40' : ''}`}
                      >
                        <div className="flex items-start gap-1 mb-0.5">
                          <div className="flex-1 min-w-0 text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
                            {opp.name}
                          </div>
                          <button
                            type="button"
                            data-lead-menu-trigger
                            title="Actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (leadMenuOppId === opp.id) {
                                closeLeadMenu();
                                return;
                              }
                              openLeadMenu(opp, e.currentTarget);
                            }}
                            className="shrink-0 p-0.5 rounded border border-transparent hover:border-slate-200 hover:bg-white/80 text-slate-500"
                          >
                            <MoreVertical size={14} strokeWidth={2} />
                          </button>
                        </div>
                        {displayName && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-700">
                            <span
                              className={`w-5 h-5 rounded-sm ${avatarColor(displayName)} text-white flex items-center justify-center font-bold text-[10px]`}
                            >
                              {initial}
                            </span>
                            <span className="truncate font-medium">{opp.company || opp.contact_name}</span>
                          </div>
                        )}
                        <TagPills tags={tags} />
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80">
                          <Stars value={Number(opp.priority) || 0} readOnly size={18} />
                          <div className="flex items-center gap-1.5">
                            {openAct && (
                              <span
                                className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400 max-w-[7rem]"
                                title={`${openAct.summary || 'Follow-up'}${openAct.due_date ? ` · ${formatFollowUpShort(openAct.due_date)}` : ''}${openAct.user_name ? ` · ${openAct.user_name}` : ''}`}
                              >
                                <Clock size={13} strokeWidth={2} className="shrink-0" />
                                {openAct.due_date && (
                                  <span className="text-[9px] font-bold truncate tabular-nums">
                                    {formatFollowUpShort(openAct.due_date)}
                                  </span>
                                )}
                              </span>
                            )}
                            <span className="w-6 h-6 rounded-sm bg-slate-700 text-white text-[10px] flex items-center justify-center font-bold">
                              {(opp.salesperson || 'U')[0]?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {openAct?.due_date && (
                          <div className="text-[9px] text-slate-500 mt-1 truncate" title={openAct.user_name || ''}>
                            {openAct.user_name ? `By ${openAct.user_name}` : 'Scheduled'}
                          </div>
                        )}
                        {Number(opp.expected_revenue) > 0 && (
                          <div className="text-[10px] font-bold text-emerald-700 mt-1.5 flex items-center gap-1">
                            <IndianRupee size={11} />
                            {formatInr(opp.expected_revenue).replace('₹', '').trim()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}

            <div className="flex items-start flex-shrink-0 gap-2 pl-2 self-stretch min-h-[12rem]">
              <div className="w-9 shrink-0 rounded-md bg-slate-200/70 dark:bg-slate-700/50 flex items-start justify-center pt-3 min-h-full">
                <Icon name="plus" size={18} className="text-slate-500" />
              </div>
              <div className="w-52 flex flex-col pt-1">
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleAddStage();
                  }}
                >
                  <input
                    id="new-stage-input"
                    type="text"
                    placeholder="Stage…"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setNewStageName('');
                    }}
                    className="flex-1 min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 pb-1 outline-none ring-0 focus:outline-none focus:ring-0 shadow-none appearance-none bg-transparent border-0 border-b border-dashed border-slate-400/50 focus:border-[var(--theme-primary)] rounded-none"
                  />
                  <button
                    type="submit"
                    title="Add stage"
                    disabled={addingStage}
                    className="p-1.5 rounded-md bg-[var(--theme-primary)] text-gray-900 disabled:opacity-50 inline-flex items-center justify-center min-w-[2.25rem]"
                  >
                    {addingStage ? <InlineSpinner className="w-4 h-4" /> : <CheckCircle2 size={16} strokeWidth={2} />}
                  </button>
                  <button
                    type="button"
                    title="Clear"
                    onClick={() => setNewStageName('')}
                    className="p-1.5 rounded-md border border-red-200 text-red-600 bg-white/80 dark:bg-slate-800"
                  >
                    <XCircle size={16} strokeWidth={2} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNewPipeline && (
          <Modal onClose={() => setShowNewPipeline(false)} title="New pipeline">
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
              placeholder="Pipeline name"
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
            />
            <button
              type="button"
              disabled={creatingPipeline}
              onClick={() => void handleCreatePipeline()}
              className="w-full py-2 rounded-xl bg-[var(--theme-primary)] font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creatingPipeline && <InlineSpinner />}
              {creatingPipeline ? 'Creating…' : 'Create'}
            </button>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedOpp && (
          <>
            <motion.div
              key="opp-drawer-backdrop"
              initial={drawerMotionEntered ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={closeOpportunityDrawer}
            />
            <motion.div
              key={selectedOpp.id}
              ref={drawerRef}
              initial={drawerMotionEntered ? false : { x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              onAnimationComplete={() => setDrawerMotionEntered(true)}
              className="fixed top-0 right-0 bottom-0 w-full max-w-5xl z-50 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
                <div className="min-w-0 flex-1">
                  {oppDraft ? (
                    <>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 truncate">
                        Pipeline / {oppDraft.name || 'Opportunity'}
                      </div>
                      <label className="sr-only" htmlFor="opp-drawer-title">
                        Opportunity name
                      </label>
                      <input
                        id="opp-drawer-title"
                        className="mt-0.5 w-full min-w-0 text-lg font-bold bg-transparent text-slate-900 dark:text-slate-100 border-0 border-b border-transparent rounded-none pb-0.5 outline-none focus:border-[var(--theme-primary)] placeholder:text-slate-400"
                        placeholder="Opportunity name"
                        value={oppDraft.name}
                        onChange={(e) => setOppDraft((d) => d && { ...d, name: e.target.value })}
                      />
                    </>
                  ) : (
                    <>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500">Pipeline / {selectedOpp.name}</div>
                      <h2 className="text-lg font-bold truncate">{selectedOpp.name}</h2>
                    </>
                  )}
                </div>
                <button type="button" onClick={closeOpportunityDrawer} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0">
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="px-4 py-2 flex flex-wrap gap-2 border-b">
                <button
                  type="button"
                  disabled={settingOutcome !== null}
                  onClick={() => void setOutcome('won')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {settingOutcome === 'won' && <InlineSpinner className="w-3.5 h-3.5 text-white" />}
                  Won
                </button>
                <button
                  type="button"
                  disabled={settingOutcome !== null}
                  onClick={() => void setOutcome('lost')}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {settingOutcome === 'lost' && <InlineSpinner className="w-3.5 h-3.5 text-white" />}
                  Lost
                </button>
              </div>

              <div className="px-4 py-3 border-b space-y-2 bg-slate-50/80 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center gap-1.5">
                  {stageProgressItems.map(({ stage: s }) => {
                    const cur = String(selectedOpp.stage_id || '');
                    const id = String(s.id);
                    const isCurrent = id === cur;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={s.name}
                        disabled={movingOppId === selectedOpp.id}
                        onClick={() => void moveToStage(selectedOpp.id, s.id)}
                        className={`max-w-[11rem] shrink-0 truncate rounded-full px-3 py-1.5 text-left text-[11px] font-bold transition-all border inline-flex items-center gap-1 disabled:opacity-60 ${
                          isCurrent
                            ? 'bg-[var(--theme-primary)] text-gray-900 border-[var(--theme-primary)] shadow-sm ring-2 ring-[var(--theme-primary)]/35'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                      >
                        {movingOppId === selectedOpp.id && movingToStageId === s.id && (
                          <InlineSpinner className="w-3 h-3 shrink-0" />
                        )}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500">
                  Current: <span className="font-semibold text-slate-700 dark:text-slate-200">{stages.find((x) => String(x.id) === String(selectedOpp.stage_id))?.name || '—'}</span>
                  {' · '}
                  Click a stage to move the lead.
                </p>
              </div>

              <div className="flex-1 flex min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 border-r bg-white dark:bg-slate-900">
                  {oppDraft && (
                    <>
                      <div className="mb-4 pb-3 border-b border-slate-100">
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                          <span className="text-slate-500">Expected Revenue</span>
                          <span className="font-bold text-slate-900">{formatInr(oppDraft.expected_revenue)}</span>
                          {Number(oppDraft.recurring_revenue) > 0 && (
                            <span className="text-slate-600">
                              + {formatInr(oppDraft.recurring_revenue)}{' '}
                              {oppDraft.revenue_period ? `(${oppDraft.revenue_period})` : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                          <Percent size={14} /> Probability{' '}
                          <span className="font-semibold text-slate-800">
                            {oppDraft.probability !== '' ? `${oppDraft.probability}%` : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-0 max-w-xl">
                        <OdooFormRow label="Contact">
                          <input
                            className={`text-sm py-1 ${ODDO_INPUT}`}
                            value={oppDraft.contact_name}
                            onChange={(e) => setOppDraft((d) => d && { ...d, contact_name: e.target.value })}
                          />
                        </OdooFormRow>
                        <OdooFormRow label="Email">
                          <input
                            className={`text-sm py-1 ${ODDO_INPUT}`}
                            type="email"
                            value={oppDraft.email}
                            onChange={(e) => setOppDraft((d) => d && { ...d, email: e.target.value })}
                          />
                        </OdooFormRow>
                        <OdooFormRow label="Phone">
                          <input
                            className={`text-sm py-1 ${ODDO_INPUT}`}
                            value={oppDraft.phone}
                            onChange={(e) => setOppDraft((d) => d && { ...d, phone: e.target.value })}
                          />
                        </OdooFormRow>
                        <OdooFormRow label="Company">
                          <input
                            className={`text-sm py-1 ${ODDO_INPUT}`}
                            value={oppDraft.company}
                            onChange={(e) => setOppDraft((d) => d && { ...d, company: e.target.value })}
                          />
                        </OdooFormRow>
                        <OdooFormRow label="Expected revenue">
                          <input
                            className={`text-sm py-1 ${ODDO_INPUT}`}
                            value={oppDraft.expected_revenue}
                            onChange={(e) => setOppDraft((d) => d && { ...d, expected_revenue: e.target.value })}
                          />
                        </OdooFormRow>
                        <OdooFormRow label="Recurring">
                          <div className="flex gap-2 items-center">
                            <input
                              className={`text-sm py-1 flex-1 ${ODDO_INPUT}`}
                              placeholder="Amount"
                              value={oppDraft.recurring_revenue}
                              onChange={(e) => setOppDraft((d) => d && { ...d, recurring_revenue: e.target.value })}
                            />
                            <input
                              className={`text-sm py-1 flex-1 ${ODDO_INPUT}`}
                              placeholder="e.g. Monthly"
                              value={oppDraft.revenue_period}
                              onChange={(e) => setOppDraft((d) => d && { ...d, revenue_period: e.target.value })}
                            />
                          </div>
                        </OdooFormRow>
                        <OdooFormRow label="Probability">
                          <input
                            className={`text-sm py-1 ${ODDO_INPUT}`}
                            value={oppDraft.probability}
                            onChange={(e) => setOppDraft((d) => d && { ...d, probability: e.target.value })}
                          />
                        </OdooFormRow>
                        <OdooFormRow label="Salesperson">
                          <input
                            className={`text-sm py-1 ${ODDO_INPUT}`}
                            value={oppDraft.salesperson}
                            onChange={(e) => setOppDraft((d) => d && { ...d, salesperson: e.target.value })}
                          />
                        </OdooFormRow>
                        <OdooFormRow label="Expected closing">
                          <input
                            type="date"
                            className={`text-sm py-1 ${ODDO_INPUT}`}
                            value={oppDraft.expected_closing}
                            onChange={(e) => setOppDraft((d) => d && { ...d, expected_closing: e.target.value })}
                          />
                        </OdooFormRow>
                        <OdooFormRow label="Tags">
                          <div className="relative" ref={tagPickerRef}>
                            <div
                              className="flex flex-wrap gap-1 min-h-[2rem] items-center cursor-text py-0.5"
                              onClick={() => setTagDropdownOpen(true)}
                            >
                              {parseTags(oppDraft.tags).map((t) => (
                                <span
                                  key={t}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${getTagClassName(t)}`}
                                >
                                  {t}
                                  <button
                                    type="button"
                                    className="opacity-70 hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = parseTags(oppDraft.tags).filter((x) => x !== t);
                                      setOppDraft((d) => d && { ...d, tags: tagsToString(next) });
                                    }}
                                  >
                                    <Icon name="close" size={12} />
                                  </button>
                                </span>
                              ))}
                              {!parseTags(oppDraft.tags).length && (
                                <span className="text-xs text-slate-400">Add tags…</span>
                              )}
                            </div>
                            {tagDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1 z-40 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm">
                                {CRM_PIPELINE_TAG_NAMES.filter((n) => !parseTags(oppDraft.tags).includes(n))
                                  .slice(0, 12)
                                  .map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      className="block w-full text-left px-3 py-1.5 hover:bg-slate-50"
                                      onClick={() => {
                                        const next = mergeTagNames(parseTags(oppDraft.tags), n);
                                        setOppDraft((d) => d && { ...d, tags: tagsToString(next) });
                                        setTagDropdownOpen(false);
                                      }}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                <button
                                  type="button"
                                  className="block w-full text-left px-3 py-1.5 text-teal-700 font-medium border-t border-slate-100"
                                  onClick={() => {
                                    setTagDropdownOpen(false);
                                    setShowTagModal(true);
                                  }}
                                >
                                  Search more…
                                </button>
                              </div>
                            )}
                          </div>
                        </OdooFormRow>
                        <OdooFormRow label="Priority">
                          <Stars
                            value={oppDraft.priority}
                            size={22}
                            onChange={(n) => setOppDraft((d) => d && { ...d, priority: n })}
                          />
                        </OdooFormRow>
                      </div>

                      <div className="mt-8 max-w-xl space-y-6 border-t border-slate-100 pt-6">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Notes</h3>
                          <p className="text-xs text-slate-500 mb-2">Internal description (saved with Submit).</p>
                          <textarea
                            className="text-sm min-h-[140px] w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                            placeholder="Add a description…"
                            value={oppDraft.notes}
                            onChange={(e) => setOppDraft((d) => d && { ...d, notes: e.target.value })}
                          />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Extra info</h3>
                          <p className="text-xs text-slate-500 mb-2">Extra details, links, or context (saved with Submit).</p>
                          <textarea
                            className="text-sm min-h-[140px] w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                            placeholder="Extra information…"
                            value={oppDraft.extra_info}
                            onChange={(e) => setOppDraft((d) => d && { ...d, extra_info: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          disabled={submittingLead}
                          onClick={() => void submitLeadUpdates()}
                          className="px-6 py-2.5 rounded-lg bg-[var(--theme-primary)] text-sm font-bold text-gray-900 disabled:opacity-50 shadow-md inline-flex items-center gap-2"
                        >
                          {submittingLead && <InlineSpinner />}
                          {submittingLead ? 'Saving…' : 'Submit'}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="w-[22rem] flex flex-col min-h-0 bg-gradient-to-b from-slate-50 to-slate-100/90 dark:from-slate-900 dark:to-slate-800/90 border-l border-slate-200/80 dark:border-slate-700">
                  <div className="flex p-1.5 gap-1 border-b border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40">
                    {(['note', 'activity'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setChatterTab(tab)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${
                          chatterTab === tab
                            ? 'bg-[var(--theme-primary)] text-gray-900 shadow-sm'
                            : 'text-slate-500 hover:bg-white/80 dark:hover:bg-slate-800'
                        }`}
                      >
                        {tab === 'note' ? <MessageSquare size={14} /> : <ListTodo size={14} />}
                        {tab === 'note' ? 'Log note' : 'Activity'}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 border-b border-slate-200/60 dark:border-slate-700 bg-white/50 dark:bg-slate-900/30">
                    {chatterTab === 'note' ? (
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 shadow-sm">
                        <textarea
                          className="w-full text-sm rounded-lg border-0 bg-slate-50 dark:bg-slate-800 p-2.5 min-h-[72px] placeholder:text-slate-400 focus:ring-2 focus:ring-[var(--theme-primary)]/40"
                          placeholder="Log an internal note…"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={submittingNote}
                          onClick={(e) => {
                            e.stopPropagation();
                            void submitNote();
                          }}
                          className="mt-2 w-full py-2 rounded-lg bg-[var(--theme-primary)] text-xs font-black text-gray-900 shadow-md hover:brightness-105 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {submittingNote && <InlineSpinner className="w-4 h-4" />}
                          {submittingNote ? 'Adding…' : 'Add note'}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 shadow-sm space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {(['todo', 'email', 'call', 'meeting'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() =>
                                setActivityForm({
                                  ...activityForm,
                                  activity_type: t,
                                  summary: t.charAt(0).toUpperCase() + t.slice(1),
                                })
                              }
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold capitalize transition-colors ${
                                activityForm.activity_type === t
                                  ? 'bg-[var(--theme-primary)] text-gray-900 shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 border border-slate-200/80 dark:border-slate-600'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <input
                          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 px-2.5 py-2 bg-slate-50/80 dark:bg-slate-800"
                          value={activityForm.summary}
                          onChange={(e) => setActivityForm({ ...activityForm, summary: e.target.value })}
                        />
                        <div className="relative">
                          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="date"
                            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 pl-8 pr-2 py-2 bg-slate-50/80 dark:bg-slate-800"
                            value={activityForm.due_date}
                            onChange={(e) => setActivityForm({ ...activityForm, due_date: e.target.value })}
                          />
                        </div>
                        <textarea
                          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 min-h-[56px] bg-slate-50/80 dark:bg-slate-800 placeholder:text-slate-400"
                          placeholder="Details…"
                          value={activityForm.body}
                          onChange={(e) => setActivityForm({ ...activityForm, body: e.target.value })}
                        />
                        <button
                          type="button"
                          disabled={schedulingActivity}
                          onClick={(e) => {
                            e.stopPropagation();
                            void submitActivity();
                          }}
                          className="w-full py-2 rounded-lg bg-[var(--theme-primary)] text-xs font-black text-gray-900 shadow-md hover:brightness-105 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {schedulingActivity && <InlineSpinner className="w-4 h-4" />}
                          {schedulingActivity ? 'Scheduling…' : 'Schedule'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-0.5">Timeline</div>
                    {activities.map((act) => {
                      const isNote = act.event_type === 'note';
                      const isActivity = act.event_type === 'activity';
                      const isStage = act.event_type === 'stage_change';
                      const accent = isNote
                        ? 'border-l-violet-500 bg-violet-50/40 dark:bg-violet-950/20'
                        : isActivity
                          ? 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/15'
                          : isStage
                            ? 'border-l-sky-500 bg-sky-50/30 dark:bg-sky-950/15'
                            : 'border-l-slate-300 bg-white dark:bg-slate-800/80';
                      return (
                        <div
                          key={act.id}
                          className={`relative pl-3 border-l-2 rounded-r-xl border border-slate-200/80 dark:border-slate-600 p-2.5 text-xs shadow-sm ${accent}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{act.user_name || 'User'}</span>
                              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-700/80 text-slate-500 shrink-0">
                                {act.event_type?.replace(/_/g, ' ') || 'event'}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-400 tabular-nums shrink-0">
                              {act.created_at ? formatDateToLocalTimezone(act.created_at) : ''}
                            </span>
                          </div>
                          <div className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{act.summary || act.event_type}</div>
                          {act.body &&
                            (() => {
                              const { title, lines } = formatActivityBodyDisplay(act);
                              if (!lines.length) return null;
                              return (
                                <div className="mt-1.5 text-slate-600 dark:text-slate-300 space-y-0.5 text-[11px]">
                                  {title && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{title}</p>}
                                  {lines.map((line, i) => (
                                    <p key={i} className="whitespace-pre-wrap break-words leading-snug">
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              );
                            })()}
                          {act.event_type === 'field_change' && (
                            <p className="text-[10px] text-slate-500 mt-1.5 font-mono">
                              {act.old_value} → {act.new_value} ({act.field_name})
                            </p>
                          )}
                          {act.event_type === 'activity' && String(act.is_done).toUpperCase() !== 'Y' && (
                            <button
                              type="button"
                              disabled={markingActivityId !== null}
                              onClick={() => void markActivityDone(act.id)}
                              className="mt-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md bg-emerald-100/80 dark:bg-emerald-900/40 hover:bg-emerald-200/80 inline-flex items-center gap-1 disabled:opacity-60"
                            >
                              {markingActivityId === act.id && <InlineSpinner className="w-3 h-3" />}
                              Mark done
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {leadMenuOpp && leadMenuAnchor && (
        <div
          ref={leadMenuRef}
          className="fixed z-[70]"
          style={{
            top: leadMenuAnchor.top,
            left: leadMenuAnchor.left,
            transform: 'translateX(-100%)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="relative w-[11.5rem] rounded-lg border border-slate-200 bg-white dark:bg-slate-900 shadow-2xl text-sm overflow-hidden">
            <div
              className="absolute -top-[7px] right-3 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-l-transparent border-r-transparent border-b-white dark:border-b-slate-900"
              aria-hidden
            />
            <button
              type="button"
              className="flex w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                setSelectedOpp(leadMenuOpp);
                closeLeadMenu();
              }}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={deletingOppId !== null}
              className="flex w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 disabled:opacity-50"
              onClick={() => void deleteLead(leadMenuOpp)}
            >
              {deletingOppId === leadMenuOpp.id ? (
                <span className="inline-flex items-center gap-2">
                  <InlineSpinner className="w-4 h-4" />
                  Deleting…
                </span>
              ) : (
                'Delete'
              )}
            </button>
            <div className="border-t border-slate-100 dark:border-slate-700 px-3 py-2.5 bg-slate-50/80 dark:bg-slate-800/50">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                Card color
              </p>
              <div className="grid grid-cols-4 gap-2">
                {LEAD_CARD_COLOR_OPTIONS.map((opt) => {
                  const selected = String(leadMenuOpp.card_color || '') === opt.id;
                  const lightSwatch = ['', 'yellow', 'lime'].includes(opt.id);
                  return (
                    <button
                      key={opt.id || 'default'}
                      type="button"
                      title={opt.label}
                      aria-label={opt.label}
                      disabled={patchingCardColorOppId === leadMenuOpp.id}
                      onClick={() => {
                        void (async () => {
                          setLeadMenuOppId(leadMenuOpp.id);
                          const ok = await patchLead(
                            leadMenuOpp.id,
                            { card_color: opt.id },
                            leadMenuOpp,
                            { cardColorSpinner: true, successToast: 'Card color updated' }
                          );
                          if (ok) {
                            setOpportunities((prev) =>
                              prev.map((o) => (o.id === leadMenuOpp.id ? { ...o, card_color: opt.id } : o))
                            );
                          }
                        })();
                      }}
                      className={`relative w-8 h-8 rounded-full ${opt.swatchClass} ring-1 ring-slate-300/90 dark:ring-slate-500 shadow-sm hover:scale-110 hover:ring-2 hover:ring-[var(--theme-primary)] transition-all mx-auto disabled:opacity-60`}
                    >
                      {patchingCardColorOppId === leadMenuOpp.id ? (
                        <InlineSpinner className="absolute inset-0 m-auto w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />
                      ) : (
                        selected && (
                          <Check
                            size={14}
                            className={
                              lightSwatch
                                ? 'absolute inset-0 m-auto text-slate-800 dark:text-slate-900 drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]'
                                : 'absolute inset-0 m-auto text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]'
                            }
                            strokeWidth={3}
                          />
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {stageMenuStage && stageMenuId && stageMenuAnchor && (
        <>
          <div className="fixed inset-0 z-[64]" onClick={closeStageMenu} aria-hidden />
          <div
            className="fixed z-[65] min-w-[13rem]"
            style={{
              top: stageMenuAnchor.top,
              left: stageMenuAnchor.left,
              transform: 'translateX(-50%)',
            }}
            role="dialog"
            aria-label="Stage actions"
          >
            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-600 py-1 text-sm">
              <div
                className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-l-transparent border-r-transparent border-b-white dark:border-b-slate-900 drop-shadow-sm"
                aria-hidden
              />
              <div className="absolute -top-[8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-slate-200 dark:border-b-slate-600 -z-10" aria-hidden />
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
              onClick={() => {
                setFoldedStageIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(stageMenuStage.id)) next.delete(stageMenuStage.id);
                  else next.add(stageMenuStage.id);
                  return next;
                });
                closeStageMenu();
              }}
            >
              <Minimize2 size={16} className="text-slate-500 shrink-0" /> Fold
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
              onClick={() => setStageEditInline(stageMenuStage.id)}
            >
              <Pencil size={16} className="text-slate-500 shrink-0" /> Edit
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-500"
              onClick={() => {
                toast.error('Automations coming soon');
                closeStageMenu();
              }}
            >
              <Wand2 size={16} className="shrink-0" /> Automations
            </button>
            <button
              type="button"
              disabled={deletingStageId !== null || renamingStageId !== null}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-red-50 text-red-600 text-left disabled:opacity-50"
              onClick={() => {
                closeStageMenu();
                void deleteStage(stageMenuStage.id);
              }}
            >
              <Trash2 size={16} className="shrink-0" />
              {deletingStageId === stageMenuStage.id ? 'Deleting…' : 'Delete'}
            </button>
            {stageEditInline === stageMenuStage.id && (
              <div className="px-4 pb-3 pt-2 border-t border-slate-100 space-y-2">
                <input
                  value={editStageName}
                  onChange={(e) => setEditStageName(e.target.value)}
                  className={`text-sm ${ODDO_INPUT}`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void renameStage(stageMenuStage.id);
                    if (e.key === 'Escape') setStageEditInline(null);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={renamingStageId === stageMenuStage.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--theme-primary)] text-xs font-bold text-gray-900 disabled:opacity-60"
                    onClick={() => void renameStage(stageMenuStage.id)}
                  >
                    {renamingStageId === stageMenuStage.id ? (
                      <InlineSpinner className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    {renamingStageId === stageMenuStage.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-slate-500"
                    onClick={() => setStageEditInline(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </>
      )}

      {showTagModal && selectedOpp && oppDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowTagModal(false)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-bold text-slate-800">Search: Tags</h3>
              <button type="button" onClick={() => setShowTagModal(false)} className="p-1 rounded hover:bg-slate-100">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="px-4 py-2 border-b">
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg ${LIGHT_SURFACE}`}>
                <Icon name="search" size={16} className="text-slate-400" />
                <input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Search…"
                  className="flex-1 text-sm bg-transparent outline-none ring-0"
                />
              </label>
              <p className="text-[10px] text-slate-500 mt-1">
                1–{filteredCatalogTags.length} / {CRM_PIPELINE_TAG_NAMES.length}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[200px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Tag Name</th>
                    <th className="px-4 py-2 font-semibold w-16">Color</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalogTags.map((name) => (
                    <tr
                      key={name}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        const next = mergeTagNames(parseTags(oppDraft.tags), name);
                        setOppDraft((d) => d && { ...d, tags: tagsToString(next) });
                      }}
                    >
                      <td className="px-4 py-2">{name}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block w-4 h-4 rounded-full border ${getTagClassName(name)}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t flex flex-wrap gap-2 items-center">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name"
                className={`flex-1 min-w-[120px] text-sm py-1.5 ${ODDO_INPUT}`}
              />
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-[var(--theme-primary)] text-xs font-bold text-gray-900"
                onClick={() => {
                  if (!newTagName.trim()) return;
                  const next = mergeTagNames(parseTags(oppDraft.tags), newTagName.trim());
                  setOppDraft((d) => d && { ...d, tags: tagsToString(next) });
                  setNewTagName('');
                  toast.success('Tag added');
                }}
              >
                Create New
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
                onClick={() => setShowTagModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </LayoutWrapper>
  );
}

function OdooFormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-x-3 items-start py-2 border-b border-slate-100 dark:border-slate-800">
      <span className="text-sm text-slate-600 dark:text-slate-400 pt-1">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold mb-3">{title}</h3>
        {children}
      </motion.div>
    </motion.div>
  );
}
