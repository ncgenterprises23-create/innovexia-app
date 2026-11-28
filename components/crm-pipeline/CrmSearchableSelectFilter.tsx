'use client';

import { useEffect, useId, useMemo, useState } from 'react';

export type SearchableSelectOption = { value: string; label: string };

type Props = {
  value: string;
  options: SearchableSelectOption[];
  /** When set, datalist includes this label and maps to `allValue` when chosen or cleared. */
  allValue?: string;
  allLabel?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  inputClassName?: string;
  disabled?: boolean;
};

function resolveSelection(
  raw: string,
  options: SearchableSelectOption[],
  allValue: string | undefined,
  allLabel: string | undefined
): string | null {
  const t = raw.trim();
  if (allValue !== undefined && allLabel !== undefined) {
    if (!t || t.toLowerCase() === allLabel.toLowerCase()) return allValue;
  }
  const byLabel = options.find((o) => o.label.toLowerCase() === t.toLowerCase());
  if (byLabel) return byLabel.value;
  const byValue = options.find((o) => o.value.toLowerCase() === t.toLowerCase());
  if (byValue) return byValue.value;
  const partial = options.filter((o) => o.label.toLowerCase().includes(t.toLowerCase()));
  if (partial.length === 1) return partial[0].value;
  return null;
}

function labelForValue(
  value: string,
  options: SearchableSelectOption[],
  allValue: string | undefined,
  allLabel: string | undefined
): string {
  if (allValue !== undefined && value === allValue && allLabel) return allLabel;
  return options.find((o) => o.value === value)?.label ?? value;
}

export default function CrmSearchableSelectFilter({
  value,
  options,
  allValue,
  allLabel,
  placeholder = 'Type to search…',
  onChange,
  inputClassName = '',
  disabled = false,
}: Props) {
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');

  const committedLabel = useMemo(
    () => labelForValue(value, options, allValue, allLabel),
    [value, options, allValue, allLabel]
  );

  useEffect(() => {
    if (!focused) setText(committedLabel);
  }, [committedLabel, focused]);

  const commit = (raw: string) => {
    const next = resolveSelection(raw, options, allValue, allLabel);
    if (next !== null) {
      onChange(next);
      return;
    }
    setText(committedLabel);
  };

  const baseClass =
    inputClassName ||
    'rounded-lg border border-[var(--theme-primary)]/25 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm min-w-0 w-full';

  return (
    <div className="relative w-full min-w-0">
      <input
        type="text"
        disabled={disabled}
        list={listId}
        className={`${baseClass} block w-full`}
        value={focused ? text : committedLabel}
        placeholder={focused ? committedLabel : placeholder}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => {
          setFocused(true);
          setText('');
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setText(committedLabel);
            setFocused(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <datalist id={listId}>
        {allLabel ? <option value={allLabel} /> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.label} />
        ))}
      </datalist>
    </div>
  );
}