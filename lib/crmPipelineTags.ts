/** CRM Pipeline tag catalog (Odoo-style labels + pill colors) */
export type CrmTagDef = { name: string; className: string };

const TAG_STYLE: Record<string, string> = {
  'Known us': 'bg-sky-100 text-sky-900 border-sky-200',
  New: 'bg-pink-100 text-pink-900 border-pink-200',
  IndiaMart: 'bg-orange-100 text-orange-900 border-orange-200',
  Linkedin: 'bg-amber-100 text-amber-900 border-amber-200',
  'LinkedIn New': 'bg-orange-100 text-orange-900 border-orange-300',
  'Linkedln New': 'bg-orange-100 text-orange-900 border-orange-300',
  CRR: 'bg-violet-100 text-violet-900 border-violet-200',
  My: 'bg-slate-100 text-slate-800 border-slate-200',
  Replied: 'bg-teal-100 text-teal-900 border-teal-200',
  Payal: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
  'NBD Incoming': 'bg-indigo-100 text-indigo-900 border-indigo-200',
  NBD: 'bg-indigo-100 text-indigo-900 border-indigo-200',
  Engaging: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  Approaching: 'bg-lime-100 text-lime-900 border-lime-200',
  important: 'bg-red-100 text-red-900 border-red-200',
  lin: 'bg-gray-100 text-gray-800 border-gray-200',
  Cidco: 'bg-cyan-100 text-cyan-900 border-cyan-200',
  'ALDI Group': 'bg-rose-100 text-rose-900 border-rose-200',
  Walmart: 'bg-blue-100 text-blue-900 border-blue-200',
  Organizer: 'bg-purple-100 text-purple-900 border-purple-200',
  'ATL/BTL': 'bg-yellow-100 text-yellow-900 border-yellow-200',
  'Linkedln-Cuboc': 'bg-amber-50 text-amber-900 border-amber-200',
  Referral: 'bg-green-100 text-green-900 border-green-200',
  Directory: 'bg-stone-100 text-stone-800 border-stone-200',
  Coorporate: 'bg-slate-100 text-slate-800 border-slate-200',
  Corporate: 'bg-slate-100 text-slate-800 border-slate-200',
  'Linkedin cuboc': 'bg-amber-50 text-amber-900 border-amber-200',
  Fabricator: 'bg-zinc-100 text-zinc-800 border-zinc-200',
  'Event Agency': 'bg-violet-50 text-violet-900 border-violet-200',
  Exhibitor: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  'Signage Company': 'bg-blue-50 text-blue-900 border-blue-200',
  'Luxury Automotive': 'bg-neutral-100 text-neutral-900 border-neutral-200',
  'F&B': 'bg-orange-50 text-orange-900 border-orange-200',
  'Marketing Agency': 'bg-pink-50 text-pink-900 border-pink-200',
  'Retail Branding Agency': 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200',
  Old: 'bg-gray-200 text-gray-700 border-gray-300',
  'Corporate Vendor': 'bg-slate-100 text-slate-800 border-slate-200',
  Consultant: 'bg-teal-50 text-teal-900 border-teal-200',
  'B2B Marketing & Growth Consultant': 'bg-teal-50 text-teal-900 border-teal-200',
  'Corporate Branding Vendor': 'bg-slate-100 text-slate-800 border-slate-200',
  'ATL / BTL Agency': 'bg-yellow-50 text-yellow-900 border-yellow-200',
  'Exhibition Organizer': 'bg-purple-50 text-purple-900 border-purple-200',
  BharatTex: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  'Exhibition Consultant': 'bg-cyan-50 text-cyan-900 border-cyan-200',
  'Branding & Design Agency': 'bg-pink-50 text-pink-900 border-pink-200',
  'Banking & Financial Services': 'bg-blue-50 text-blue-900 border-blue-200',
};

const FALLBACK_CLASSES = [
  'bg-sky-100 text-sky-900 border-sky-200',
  'bg-rose-100 text-rose-900 border-rose-200',
  'bg-amber-100 text-amber-900 border-amber-200',
  'bg-violet-100 text-violet-900 border-violet-200',
  'bg-emerald-100 text-emerald-900 border-emerald-200',
  'bg-pink-100 text-pink-900 border-pink-200',
  'bg-indigo-100 text-indigo-900 border-indigo-200',
];

export const CRM_PIPELINE_TAG_NAMES = Object.keys(TAG_STYLE);

const CUSTOM_TAGS_STORAGE_KEY = 'crm_pipeline_custom_tags_v1';

export function readCustomCrmPipelineTags(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Save a user-created tag for reuse in Search: Tags (browser localStorage). */
export function persistCustomCrmPipelineTag(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed || typeof window === 'undefined') return readCustomCrmPipelineTags();
  const lower = trimmed.toLowerCase();
  if (CRM_PIPELINE_TAG_NAMES.some((n) => n.toLowerCase() === lower)) {
    return readCustomCrmPipelineTags();
  }
  const existing = readCustomCrmPipelineTags();
  if (existing.some((t) => t.toLowerCase() === lower)) return existing;
  const next = [...existing, trimmed];
  window.localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function mergeBuiltinAndCustomTags(custom: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...CRM_PIPELINE_TAG_NAMES, ...custom]) {
    const trimmed = n.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function getTagClassName(tag: string): string {
  const trimmed = tag.trim();
  if (TAG_STYLE[trimmed]) return TAG_STYLE[trimmed];
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) hash = (hash + trimmed.charCodeAt(i) * 17) % FALLBACK_CLASSES.length;
  return FALLBACK_CLASSES[hash];
}

export function tagsToString(tags: string[]): string {
  return tags.filter(Boolean).join(', ');
}

export function mergeTagNames(existing: string[], add: string): string[] {
  const set = new Set(existing.map((t) => t.trim()).filter(Boolean));
  if (add.trim()) set.add(add.trim());
  return Array.from(set);
}
