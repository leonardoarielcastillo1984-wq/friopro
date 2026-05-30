'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export interface DemoStatus {
  isDemo: boolean;
  isExpired: boolean;
  daysLeft: number;
  demoStartedAt: string | null;
  demoExpiresAt: string | null;
  limits: {
    documents: number;
    indicators: number;
    nonConformities: number;
    audits: number;
    users: number;
    storageMb: number;
  };
}

const INITIAL: DemoStatus = {
  isDemo: false,
  isExpired: false,
  daysLeft: 7,
  demoStartedAt: null,
  demoExpiresAt: null,
  limits: { documents: 3, indicators: 2, nonConformities: 2, audits: 1, users: 1, storageMb: 100 },
};

// Checklist stored in localStorage per tenant
const CHECKLIST_KEY = (tenantId: string) => `demo_checklist_${tenantId}`;

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'document', label: 'Crear 1 Documento', done: false },
  { id: 'indicator', label: 'Crear 1 Indicador', done: false },
  { id: 'ncr', label: 'Crear 1 No Conformidad', done: false },
  { id: 'dashboard', label: 'Visualizar Dashboard', done: false },
];

export function useDemoMode(tenantId?: string | null) {
  const [status, setStatus] = useState<DemoStatus>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);

  const fetchStatus = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    try {
      const data = await apiFetch<DemoStatus>('/demo/status');
      setStatus(data);
    } catch {
      // fail-open: assume no demo mode on error
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Load checklist from localStorage
  useEffect(() => {
    if (!tenantId) return;
    try {
      const stored = localStorage.getItem(CHECKLIST_KEY(tenantId));
      if (stored) setChecklist(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [tenantId]);

  const markChecklistItem = useCallback((id: string) => {
    if (!tenantId) return;
    setChecklist(prev => {
      const next = prev.map(item => item.id === id ? { ...item, done: true } : item);
      try { localStorage.setItem(CHECKLIST_KEY(tenantId), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [tenantId]);

  const allDone = checklist.every(i => i.done);

  return { status, loading, checklist, markChecklistItem, allDone, refresh: fetchStatus };
}
