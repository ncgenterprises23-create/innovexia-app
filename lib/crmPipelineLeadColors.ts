/** Odoo-style kanban card highlight colors */
export const LEAD_CARD_COLOR_OPTIONS = [
  /** Default must read on white popover: use tint + border, not plain white */
  {
    id: '',
    label: 'Default',
    cardClass: 'bg-white dark:bg-slate-800',
    swatchClass: 'bg-slate-100 border-2 border-slate-400 dark:bg-slate-600 dark:border-slate-300',
  },
  { id: 'coral', label: 'Coral', cardClass: 'bg-[#fdecea] dark:bg-red-950/40', swatchClass: 'bg-[#F06050]' },
  { id: 'orange', label: 'Orange', cardClass: 'bg-[#fff4e5] dark:bg-orange-950/30', swatchClass: 'bg-[#F6A821]' },
  { id: 'yellow', label: 'Yellow', cardClass: 'bg-[#fffbe6] dark:bg-yellow-950/30', swatchClass: 'bg-[#F7CD1F]' },
  { id: 'lime', label: 'Lime', cardClass: 'bg-[#f4fce3] dark:bg-lime-950/30', swatchClass: 'bg-[#9BCB3C]' },
  { id: 'green', label: 'Green', cardClass: 'bg-[#e8f5e9] dark:bg-green-950/30', swatchClass: 'bg-[#00A04A]' },
  { id: 'teal', label: 'Teal', cardClass: 'bg-[#e0f2f1] dark:bg-teal-950/30', swatchClass: 'bg-[#00A09A]' },
  { id: 'cyan', label: 'Cyan', cardClass: 'bg-[#e0f7fa] dark:bg-cyan-950/30', swatchClass: 'bg-[#00BCD4]' },
  { id: 'blue', label: 'Blue', cardClass: 'bg-[#e3f2fd] dark:bg-blue-950/30', swatchClass: 'bg-[#4A90E2]' },
  { id: 'indigo', label: 'Indigo', cardClass: 'bg-[#e8eaf6] dark:bg-indigo-950/30', swatchClass: 'bg-[#5C6BC0]' },
  { id: 'purple', label: 'Purple', cardClass: 'bg-[#f3e5f5] dark:bg-purple-950/30', swatchClass: 'bg-[#9C27B0]' },
  { id: 'pink', label: 'Pink', cardClass: 'bg-[#fce4ec] dark:bg-pink-950/30', swatchClass: 'bg-[#E91E63]' },
] as const;

export function leadCardSurfaceClass(cardColor?: string): string {
  const id = String(cardColor || '');
  return LEAD_CARD_COLOR_OPTIONS.find((c) => c.id === id)?.cardClass ?? LEAD_CARD_COLOR_OPTIONS[0].cardClass;
}
