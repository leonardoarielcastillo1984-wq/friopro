'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import type { DemoStatus, ChecklistItem } from '@/hooks/useDemoMode';

interface Props {
  status: DemoStatus;
  checklist: ChecklistItem[];
  allDone: boolean;
}

export function DemoChecklist({ status, checklist, allDone }: Props) {
  const [open, setOpen] = useState(true);
  if (!status.isDemo || status.isExpired) return null;

  const done = checklist.filter(i => i.done).length;

  return (
    <div
      style={{
        position: 'fixed', bottom: 36, right: 16, zIndex: 9998,
        background: 'white', borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
        border: '1px solid rgba(0,0,0,0.08)',
        width: 220, overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#1d4ed8', color: 'white', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ListChecks size={14} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>Demo guiada</span>
          <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 7px' }}>
            {done}/{checklist.length}
          </span>
        </div>
        {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {open && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checklist.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {item.done
                ? <CheckCircle2 size={15} color="#16a34a" />
                : <Circle size={15} color="#d1d5db" />}
              <span style={{
                fontSize: 12, color: item.done ? '#6b7280' : '#111827',
                textDecoration: item.done ? 'line-through' : 'none',
              }}>
                {item.label}
              </span>
            </div>
          ))}
          {allDone && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
              ✓ ¡Demo completada! Activá un plan para continuar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
