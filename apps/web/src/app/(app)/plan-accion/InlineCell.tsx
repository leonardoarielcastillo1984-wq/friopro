'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export type CellType = 'text' | 'textarea' | 'select' | 'date' | 'number';

export interface SelectOption { value: string; label: string; }

interface InlineCellProps {
  value: string | number | null | undefined;
  type: CellType;
  options?: SelectOption[];
  min?: number;
  max?: number;
  onSave: (newValue: string) => Promise<void>;
  editable?: boolean;
  displayValue?: string;
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export function InlineCell({
  value, type, options, min, max, onSave, editable = true, displayValue, className = '',
}: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' || type === 'number' || type === 'date') {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editing, type]);

  const startEdit = useCallback(() => {
    if (!editable) return;
    setDraft(String(value ?? ''));
    setError(false);
    setEditing(true);
  }, [editable, value]);

  const cancel = useCallback(() => {
    setEditing(false);
    setError(false);
  }, []);

  const save = useCallback(async () => {
    const oldVal = String(value ?? '');
    if (draft === oldVal) { setEditing(false); return; }
    setSaving(true);
    setError(false);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      setError(true);
    }
    setSaving(false);
  }, [draft, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && type !== 'textarea') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Enter' && type === 'textarea' && e.ctrlKey) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  if (!editable) {
    return (
      <span className={`text-xs text-neutral-600 ${className}`} title={displayValue ?? String(value ?? '')}>
        {displayValue ?? value ?? '—'}
      </span>
    );
  }

  if (editing) {
    return (
      <div className="relative inline-flex items-center gap-1 w-full">
        {type === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => void save()}
            rows={2}
            className="w-full text-xs border border-blue-400 rounded px-1.5 py-1 focus:outline-none focus:border-blue-600 resize-none bg-white"
          />
        ) : type === 'select' ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={e => { setDraft(e.target.value); }}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (draft !== String(value ?? '')) void save(); else cancel(); }}
            className="text-xs border border-blue-400 rounded px-1 py-0.5 focus:outline-none focus:border-blue-600 bg-white w-full"
          >
            <option value="">—</option>
            {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
            value={draft}
            min={min}
            max={max}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => void save()}
            className="text-xs border border-blue-400 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-600 bg-white w-full"
          />
        )}
        {saving && <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />}
        {error && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
      </div>
    );
  }

  const display = displayValue ?? value ?? '';
  const isEmpty = !value && value !== 0 && !displayValue;

  return (
    <span
      onClick={startEdit}
      className={`text-xs cursor-text px-1.5 py-1 rounded hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition-colors block min-h-[20px] whitespace-pre-wrap break-words ${isEmpty ? 'text-neutral-300 italic' : 'text-neutral-700'} ${error ? 'ring-1 ring-red-300' : ''} ${className}`}
      title={isEmpty ? 'Click para editar' : String(display)}
    >
      {isEmpty ? 'Click para editar...' : display}
    </span>
  );
}
