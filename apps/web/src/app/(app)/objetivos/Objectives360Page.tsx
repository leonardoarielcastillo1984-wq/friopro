'use client';
import PageTitleHelp from '@/components/ui/PageTitleHelp';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { EmployeeCombobox } from '@/components/ui/EmployeeCombobox';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  Plus,
  Search,
  Filter,
  X,
  Pencil,
  Trash2,
  Eye,
  BarChart3,
  Activity,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Calendar,
  FileText,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  ArrowRight,
  GitBranch,
  Link2,
  Gauge,
  History,
  ListChecks,
  UserCog,
} from 'lucide-react';

/* ─── Types ─── */
interface ProcessOption {
  id: string;
  name: string;
  code?: string;
  layer: string;
}

interface KpiOption {
  id: string;
  code: string;
  name: string;
  unit?: string;
  currentValue?: number | null;
  targetValue?: number | null;
  direction?: string;
  frequency?: string;
  category?: string;
}

interface PositionOption {
  id: string;
  name: string;
  code?: string;
}

interface ObjectiveProgressLogEntry {
  id: string;
  userName?: string | null;
  previousProgress?: number | null;
  newProgress?: number | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  kpiValue?: number | null;
  justification?: string | null;
  source: string;
  evidenceUrl?: string | null;
  evidenceName?: string | null;
  createdAt: string;
}

interface ObjectiveAssessment {
  progressMethod: string;
  actualProgress: number;
  expectedProgress: number | null;
  deviation: number | null;
  riskLevel: 'NORMAL' | 'ATTENTION' | 'AT_RISK';
  computedStatus: string;
  isAtRisk: boolean;
  isDelayed: boolean;
  reason: string;
  kpi?: {
    value: number | null;
    target: number | null;
    baseline: number | null;
    unit: string | null;
    direction: string | null;
    frequency: string | null;
  } | null;
}

interface Objective {
  id: string;
  code: string;
  title: string;
  description?: string;
  year: number;
  standard?: string;
  target: string;
  targetValue?: number;
  unit?: string;
  type?: string;
  scope?: string;
  sites?: string[];
  responsibleId?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  progress: number;
  indicatorId?: string;
  notes?: string;
  policyId?: string;
  processId?: string;
  priority?: string;
  kpiName?: string;
  kpiTarget?: number;
  kpiUnit?: string;
  owner?: string;
  responsible?: string;
  sede?: string;
  tags?: string;
  policy?: { id: string; name: string } | null;
  process?: { id: string; name: string } | null;
  activities?: ObjectiveActivity[];
  indicators?: ObjectiveIndicator[];
  audits?: ObjectiveAudit[];
  capas?: ObjectiveCAPA[];
  risks?: ObjectiveRisk[];
  // Trazabilidad estratégica
  originType?: string;
  originId?: string;
  strategicPriority?: string;
  strategicWeight?: number;
  contextYear?: number;
  // Gestión y medición avanzada
  primaryIndicatorId?: string;
  primaryIndicator?: KpiOption | null;
  baselineValue?: number;
  progressMethod?: string;
  lastProgressNote?: string;
  responsiblePositionId?: string;
  responsiblePosition?: PositionOption | null;
  involvedProcessIds?: string[];
  policyIds?: string[];
  progressLogs?: ObjectiveProgressLogEntry[];
  _assessment?: ObjectiveAssessment;
  createdAt: string;
  updatedAt: string;
}

interface ObjectiveActivity {
  id: string;
  name: string;
  responsibleId?: string;
  startDate?: string;
  endDate?: string;
  status: string;
}

interface ObjectiveIndicator {
  id: string;
  indicatorId: string;
  indicator?: { id: string; name: string };
}

interface ObjectiveAudit {
  id: string;
  auditId: string;
  audit?: { id: string; title: string };
}

interface ObjectiveCAPA {
  id: string;
  capaId: string;
  capa?: { id: string; title: string };
}

interface ObjectiveRisk {
  id: string;
  riskId: string;
  risk?: { id: string; description: string };
}

interface Policy {
  id: string;
  name: string;
  scope?: string;
  active: boolean;
}

interface DashboardStats {
  total: number;
  inProgress: number;
  achieved: number;
  planned: number;
  notAchieved: number;
  cancelled: number;
  atRisk: number;
  delayed: number;
  averageProgress: number;
}

interface FilterState {
  search: string;
  year: string;
  status: string;
  policyId: string;
  processId: string;
  originType: string;
  standard: string;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planificado',
  IN_PROGRESS: 'En progreso',
  ACHIEVED: 'Logrado',
  NOT_ACHIEVED: 'No logrado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-800 border-slate-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
  ACHIEVED: 'bg-green-100 text-green-800 border-green-300',
  NOT_ACHIEVED: 'bg-red-100 text-red-800 border-red-300',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
};

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
};

const ORIGIN_TYPE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  FO: 'Estrategia FO',
  FA: 'Estrategia FA',
  DO: 'Estrategia DO',
  DA: 'Estrategia DA',
  RISK: 'Riesgo',
  AUDIT: 'Hallazgo de Auditoría',
  REVIEW: 'Revisión por la Dirección',
  STAKEHOLDER: 'Parte Interesada',
  FODA: 'Contexto / FODA',
  PESTEL: 'PESTEL',
};

const ORIGIN_TYPE_COLORS: Record<string, string> = {
  FO: 'bg-green-100 text-green-800',
  FA: 'bg-blue-100 text-blue-800',
  DO: 'bg-amber-100 text-amber-800',
  DA: 'bg-red-100 text-red-800',
  RISK: 'bg-rose-100 text-rose-700',
  AUDIT: 'bg-purple-100 text-purple-800',
  REVIEW: 'bg-indigo-100 text-indigo-800',
  STAKEHOLDER: 'bg-teal-100 text-teal-800',
  FODA: 'bg-emerald-100 text-emerald-800',
  PESTEL: 'bg-cyan-100 text-cyan-800',
  MANUAL: 'bg-gray-100 text-gray-600',
};

const PROGRESS_METHOD_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  KPI: 'Automático por KPI',
  ACTIONS: 'Automático por acciones/hitos',
};

const RISK_LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  NORMAL: { label: 'Normal', color: 'bg-green-100 text-green-800 border-green-300' },
  ATTENTION: { label: 'Atención', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  AT_RISK: { label: 'En riesgo', color: 'bg-red-100 text-red-800 border-red-300' },
};

const PROGRESS_SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  KPI: 'KPI',
  ACTIONS: 'Acciones/Hitos',
  SYSTEM: 'Sistema',
};

/* ─── Component ─── */
export default function Objectives360Page() {
  const currentYear = new Date().getFullYear();

  /* State */
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    year: String(currentYear),
    status: '',
    policyId: '',
    processId: '',
    originType: '',
    standard: '',
  });
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [contextStrategies, setContextStrategies] = useState<{id: string; label: string}[]>([]);
  const [kpis, setKpis] = useState<KpiOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [detailObjective, setDetailObjective] = useState<Objective | null>(null);
  const [formData, setFormData] = useState<Partial<Objective>>({
    year: currentYear,
    status: 'PLANNED',
    progress: 0,
    sites: [],
  });
  const [activeTab, setActiveTab] = useState('info');

  /* Load data */
  const loadObjectives = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set('year', filters.year);
      if (filters.status) params.set('status', filters.status);
      if (filters.policyId) params.set('policyId', filters.policyId);
      if (filters.processId) params.set('processId', filters.processId);
      if (filters.search) params.set('search', filters.search);
      const res = await apiFetch(`/objectives?${params.toString()}`) as { items?: Objective[] };
      setObjectives(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadPolicies = useCallback(async () => {
    try {
      const res = (await apiFetch('/objectives/policies')) as Policy[];
      setPolicies(Array.isArray(res) ? res : []);
    } catch {
      setPolicies([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch(`/objectives/stats/summary?year=${filters.year}`) as DashboardStats;
      setStats(res);
    } catch (e) {
      console.error(e);
    }
  }, [filters.year]);

  const loadProcesses = useCallback(async () => {
    try {
      const res = await apiFetch('/objectives/processes') as ProcessOption[];
      setProcesses(Array.isArray(res) ? res : []);
    } catch { setProcesses([]); }
  }, []);

  const loadKpis = useCallback(async () => {
    try {
      const res = await apiFetch('/objectives/kpis') as KpiOption[];
      setKpis(Array.isArray(res) ? res : []);
    } catch { setKpis([]); }
  }, []);

  const loadPositions = useCallback(async () => {
    try {
      const res = await apiFetch('/objectives/positions') as PositionOption[];
      setPositions(Array.isArray(res) ? res : []);
    } catch { setPositions([]); }
  }, []);

  const loadContextStrategies = async (originType: string, year: number) => {
    const DAFO_TYPES = ['FO', 'FA', 'DO', 'DA'];
    if (!DAFO_TYPES.includes(originType)) { setContextStrategies([]); return; }
    try {
      const keyMap: Record<string, string> = { FO: 'dafoFo', FA: 'dafoFa', DO: 'dafoDo', DA: 'dafoDa' };
      const res = await apiFetch<{ item: any }>(`/context/${year}`);
      const text: string = res?.item?.[keyMap[originType]] || '';
      const lines = text.split('\n').map((s: string) => s.trim()).filter(Boolean);
      setContextStrategies(lines.map((l: string, i: number) => ({
        id: `${originType}-${i + 1}`,
        label: `${originType}-${i + 1} — ${l.length > 60 ? l.slice(0, 60) + '…' : l}`,
      })));
    } catch { setContextStrategies([]); }
  };

  useEffect(() => {
    loadObjectives();
    loadPolicies();
    loadStats();
    loadProcesses();
    loadKpis();
    loadPositions();
  }, [loadObjectives, loadPolicies, loadStats, loadProcesses, loadKpis, loadPositions]);

  // URL params pre-fill desde módulo Contexto
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const originType = params.get('originType');
    const originId = params.get('originId');
    const ctxYear = params.get('contextYear');
    if (originType || params.get('openForm') === 'true') {
      setEditingObjective(null);
      setFormData((d) => ({
        ...d,
        code: '',
        title: '',
        description: '',
        year: currentYear,
        standard: 'ISO 9001',
        target: '',
        type: 'STRATEGIC',
        sites: [],
        status: 'PLANNED',
        progress: 0,
        originType: originType || 'FO',
        originId: originId || '',
        contextYear: ctxYear ? Number(ctxYear) : currentYear,
      }));
      if (originType && ['FO','FA','DO','DA'].includes(originType)) {
        loadContextStrategies(originType, ctxYear ? Number(ctxYear) : currentYear);
      }
      setShowForm(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Actions */
  const handleCreate = () => {
    setEditingObjective(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      year: currentYear,
      standard: 'ISO 9001',
      target: '',
      targetValue: undefined,
      unit: '',
      type: 'STRATEGIC',
      sites: [],
      startDate: '',
      endDate: '',
      status: 'PLANNED',
      progress: 0,
      notes: '',
      policyId: '',
      processId: '',
      originType: 'MANUAL',
      originId: '',
      contextYear: currentYear,
      primaryIndicatorId: '',
      baselineValue: undefined,
      progressMethod: 'MANUAL',
      responsiblePositionId: '',
      involvedProcessIds: [],
      policyIds: [],
    });
    setShowForm(true);
  };

  const handleEdit = (obj: Objective) => {
    setEditingObjective(obj);
    setFormData({
      ...obj,
      startDate: obj.startDate ? obj.startDate.split('T')[0] : '',
      endDate: obj.endDate ? obj.endDate.split('T')[0] : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const payload: any = { ...formData, sites: formData.sites || [] };
      // Strip relation objects and auto-managed fields
      delete payload.id;
      delete payload.policy;
      delete payload.process;
      delete payload.activities;
      delete payload.indicators;
      delete payload.audits;
      delete payload.capas;
      delete payload.risks;
      delete payload.createdAt;
      delete payload.updatedAt;
      delete payload.primaryIndicator;
      delete payload.responsiblePosition;
      delete payload.progressLogs;
      delete payload._assessment;
      // Normalize empty strings to undefined for optional nullable fields
      const normalize = (val: any) => (val === '' || val === null ? undefined : val);
      payload.description = normalize(payload.description);
      payload.standard = normalize(payload.standard);
      payload.unit = normalize(payload.unit);
      payload.type = normalize(payload.type);
      payload.status = normalize(payload.status);
      payload.notes = normalize(payload.notes);
      payload.startDate = normalize(payload.startDate);
      payload.endDate = normalize(payload.endDate);
      payload.responsibleId = normalize(payload.responsibleId);
      payload.indicatorId = normalize(payload.indicatorId);
      payload.policyId = normalize(payload.policyId);
      payload.processId = normalize(payload.processId);
      payload.originType = normalize(payload.originType);
      payload.originId = normalize(payload.originId);
      payload.strategicPriority = normalize(payload.strategicPriority);
      payload.strategicWeight = payload.strategicWeight !== undefined && payload.strategicWeight !== '' ? Number(payload.strategicWeight) : undefined;
      payload.contextYear = payload.contextYear ? Number(payload.contextYear) : undefined;
      // Gestión y medición avanzada
      payload.primaryIndicatorId = normalize(payload.primaryIndicatorId);
      payload.responsiblePositionId = normalize(payload.responsiblePositionId);
      payload.progressMethod = normalize(payload.progressMethod) || 'MANUAL';
      payload.lastProgressNote = normalize(payload.lastProgressNote);
      payload.baselineValue = payload.baselineValue !== undefined && payload.baselineValue !== '' ? Number(payload.baselineValue) : undefined;
      payload.involvedProcessIds = Array.isArray(payload.involvedProcessIds) ? payload.involvedProcessIds : [];
      payload.policyIds = Array.isArray(payload.policyIds) ? payload.policyIds : [];
      // Convert numeric fields from strings to numbers for Zod schema
      payload.year = payload.year ? Number(payload.year) : undefined;
      payload.targetValue = payload.targetValue !== '' && payload.targetValue !== undefined ? Number(payload.targetValue) : undefined;
      payload.progress = payload.progress !== undefined ? Number(payload.progress) : undefined;
      if (editingObjective) {
        await apiFetch(`/objectives/${editingObjective.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/objectives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      loadObjectives();
      loadStats();
    } catch (e: any) {
      console.error(e);
      alert('Error al guardar objetivo: ' + (e?.message || ''));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este objetivo?')) return;
    try {
      await apiFetch(`/objectives/${id}`, { method: 'DELETE' });
      loadObjectives();
      loadStats();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDetail = async (obj: Objective) => {
    try {
      const res = await apiFetch(`/objectives/${obj.id}`) as { item: Objective };
      setDetailObjective(res.item);
      setActiveTab('info');
    } catch (e) {
      console.error(e);
    }
  };

  const filteredObjectives = useMemo(() => {
    return objectives.filter((o) => {
      const matchSearch = !filters.search ||
        o.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        o.code.toLowerCase().includes(filters.search.toLowerCase());
      return matchSearch;
    });
  }, [objectives, filters.search]);

  /* Render helpers */
  const renderStatusBadge = (status: string) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );

  const renderProgressBar = (progress: number) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className="bg-blue-600 h-2.5 rounded-full transition-all"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );

  /* ─── Dashboard ─── */
  const Dashboard = () => {
    if (!stats) return null;
    const cards = [
      { label: 'Total objetivos', value: stats.total, icon: Target, color: 'text-blue-600' },
      { label: 'Planificados', value: stats.planned ?? 0, icon: Calendar, color: 'text-slate-600' },
      { label: 'En curso', value: stats.inProgress, icon: Activity, color: 'text-amber-600' },
      { label: 'Cumplidos', value: stats.achieved, icon: CheckCircle2, color: 'text-green-600' },
      { label: 'En riesgo', value: stats.atRisk, icon: AlertTriangle, color: 'text-red-600' },
      { label: 'Retrasados', value: stats.delayed, icon: XCircle, color: 'text-orange-600' },
      { label: 'Progreso promedio', value: `${stats?.averageProgress ?? 0}%`, icon: TrendingUp, color: 'text-purple-600' },
    ];
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={`w-8 h-8 ${c.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  /* ─── Filters ─── */
  const FiltersPanel = () => (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título o código..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="pl-8"
        />
      </div>
      <Input
        type="number"
        placeholder="Año"
        value={filters.year}
        onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
        className="w-24"
      />
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={filters.status}
        onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
      >
        <option value="">Todos los estados</option>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={filters.policyId}
        onChange={(e) => setFilters((f) => ({ ...f, policyId: e.target.value }))}
      >
        <option value="">Todas las políticas</option>
        {policies.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={filters.standard}
        onChange={(e) => setFilters((f) => ({ ...f, standard: e.target.value }))}
      >
        <option value="">Todas las normas</option>
        <option value="ISO 9001">ISO 9001</option>
        <option value="ISO 14001">ISO 14001</option>
        <option value="ISO 45001">ISO 45001</option>
        <option value="MULTIPLE">Múltiple</option>
      </select>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={filters.originType}
        onChange={(e) => setFilters((f) => ({ ...f, originType: e.target.value }))}
      >
        <option value="">Todos los orígenes</option>
        {Object.entries(ORIGIN_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <Button variant="outline" onClick={() => {
        setFilters({ search: '', year: String(currentYear), status: '', policyId: '', processId: '', originType: '', standard: '' });
      }}>
        <X className="w-4 h-4 mr-1" /> Limpiar
      </Button>
    </div>
  );

  /* ─── Table ─── */
  const TableSection = () => (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Código</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Objetivo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Política</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Proceso</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Origen</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Meta</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Progreso</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fin</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredObjectives.map((obj) => (
              <tr key={obj.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenDetail(obj)}>
                <td className="px-4 py-3 font-mono text-xs">{obj.code}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{obj.title}</div>
                  <div className="text-xs text-muted-foreground">{obj.standard}</div>
                </td>
                <td className="px-4 py-3">{obj.policy?.name || '—'}</td>
                <td className="px-4 py-3">{obj.process?.name || '—'}</td>
                <td className="hidden md:table-cell px-4 py-3">
                  {obj.originType && obj.originType !== 'MANUAL' ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ORIGIN_TYPE_COLORS[obj.originType] || 'bg-gray-100 text-gray-600'}`}>
                      {ORIGIN_TYPE_LABELS[obj.originType] || obj.originType}
                      {obj.originId ? ` — ${obj.originId}` : ''}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  {obj.target} {obj.targetValue ? `(${obj.targetValue}${obj.unit || ''})` : ''}
                </td>
                <td className="px-4 py-3 w-32">
                  {renderProgressBar(obj.progress ?? 0)}
                  <span className="text-xs text-muted-foreground">{obj.progress ?? 0}%</span>
                </td>
                <td className="px-4 py-3">{renderStatusBadge(obj.status)}</td>
                <td className="px-4 py-3 text-xs">{obj.endDate ? new Date(obj.endDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleOpenDetail(obj); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(obj); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(obj.id); }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredObjectives.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No hay objetivos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ─── Form ─── */
  const FormDialog = () => {
    if (!showForm) return null;
    const update = (key: string, val: any) => setFormData((d) => ({ ...d, [key]: val }));
    const selectedKpi = kpis.find((k) => k.id === formData.primaryIndicatorId);
    return (
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingObjective ? 'Editar objetivo' : 'Nuevo objetivo'}</DialogTitle>
          </DialogHeader>
          <div className="w-full">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Información</TabsTrigger>
                <TabsTrigger value="indicators">Indicadores</TabsTrigger>
                <TabsTrigger value="owner">Responsable</TabsTrigger>
                <TabsTrigger value="details">Detalles</TabsTrigger>
              </TabsList>
            <TabsContent value="basic" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Código</Label>
                  <Input value={formData.code || ''} onChange={(e) => update('code', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Título</Label>
                  <Input value={formData.title || ''} onChange={(e) => update('title', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descripción</Label>
                  <Input value={formData.description || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.type || 'STRATEGIC'}
                    onChange={(e) => update('type', e.target.value)}
                  >
                    <option value="STRATEGIC">Estratégico</option>
                    <option value="OPERATIONAL">Operativo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Alcance</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.scope || 'QUALITY'}
                    onChange={(e) => update('scope', e.target.value)}
                  >
                    <option value="QUALITY">Calidad</option>
                    <option value="ENVIRONMENT">Medio Ambiente</option>
                    <option value="SAFETY">Seguridad</option>
                    <option value="INTEGRATED">Integrado</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Norma</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.standard || 'ISO 9001'}
                    onChange={(e) => update('standard', e.target.value)}
                  >
                    <option>ISO 9001</option>
                    <option>ISO 14001</option>
                    <option>ISO 45001</option>
                    <option>MULTIPLE</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Input type="number" value={formData.year || ''} onChange={(e) => update('year', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Inicio</Label>
                  <Input type="date" value={formData.startDate || ''} onChange={(e) => update('startDate', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fin</Label>
                  <Input type="date" value={formData.endDate || ''} onChange={(e) => update('endDate', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.status || 'PLANNED'}
                    onChange={(e) => update('status', e.target.value)}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.priority || 'MEDIUM'}
                    onChange={(e) => update('priority', e.target.value)}
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
                {policies.length > 0 && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Política SGI (principal)</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={formData.policyId || ''}
                      onChange={(e) => update('policyId', e.target.value || undefined)}
                    >
                      <option value="">— Sin política —</option>
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {policies.length > 0 && (
                  <div className="space-y-2 md:col-span-2">
                    <Label className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Políticas vinculadas (múltiples)</Label>
                    <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                      {policies.map((p) => {
                        const checked = (formData.policyIds || []).includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const cur = formData.policyIds || [];
                                update('policyIds', e.target.checked ? [...cur, p.id] : cur.filter((x) => x !== p.id));
                              }}
                            />
                            {p.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label>Meta *</Label>
                  <Input value={formData.target || ''} onChange={(e) => update('target', e.target.value)} placeholder="Descripción de la meta" />
                </div>
                <div className="space-y-2">
                  <Label>Valor meta</Label>
                  <Input type="number" value={formData.targetValue || ''} onChange={(e) => update('targetValue', Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Unidad</Label>
                  <Input value={formData.unit || ''} onChange={(e) => update('unit', e.target.value)} placeholder="Ej: %, días, unidades" />
                </div>
                <div className="space-y-2">
                  <Label>Progreso (%)</Label>
                  <Input type="number" min={0} max={100} value={formData.progress || 0} onChange={(e) => update('progress', Number(e.target.value))} />
                </div>
              </div>

              {/* Origen Estratégico */}
              <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  Origen Estratégico
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de origen</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={formData.originType || 'MANUAL'}
                      onChange={(e) => {
                        update('originType', e.target.value);
                        update('originId', '');
                        if (['FO','FA','DO','DA'].includes(e.target.value)) {
                          loadContextStrategies(e.target.value, formData.contextYear || currentYear);
                        } else { setContextStrategies([]); }
                      }}
                    >
                      {Object.entries(ORIGIN_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Año de contexto</Label>
                    <Input
                      type="number"
                      value={formData.contextYear || currentYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        update('contextYear', y);
                        if (['FO','FA','DO','DA'].includes(formData.originType || '')) {
                          loadContextStrategies(formData.originType!, y);
                        }
                      }}
                    />
                  </div>
                  {['FO','FA','DO','DA'].includes(formData.originType || '') && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Estrategia DAFO</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={formData.originId || ''}
                        onChange={(e) => update('originId', e.target.value)}
                      >
                        <option value="">— Seleccionar estrategia —</option>
                        {contextStrategies.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!['FO','FA','DO','DA'].includes(formData.originType || '') && formData.originType !== 'MANUAL' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Referencia de origen</Label>
                      <Input
                        value={formData.originId || ''}
                        onChange={(e) => update('originId', e.target.value)}
                        placeholder="Código o referencia..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="indicators" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2"><Link2 className="w-4 h-4" /> Indicador / KPI vinculado</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.primaryIndicatorId || ''}
                    onChange={(e) => update('primaryIndicatorId', e.target.value || undefined)}
                  >
                    <option value="">— Sin KPI vinculado —</option>
                    {kpis.map((k) => (
                      <option key={k.id} value={k.id}>{k.code ? `[${k.code}] ` : ''}{k.name}{k.unit ? ` (${k.unit})` : ''}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">La fuente de verdad de la medición es el indicador del módulo Indicadores.</p>
                </div>
                {selectedKpi && (
                  <div className="md:col-span-2 rounded-lg border bg-slate-50 p-3 text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div><span className="text-muted-foreground">Valor actual:</span> <b>{selectedKpi.currentValue ?? '—'}{selectedKpi.unit || ''}</b></div>
                    <div><span className="text-muted-foreground">Meta KPI:</span> <b>{selectedKpi.targetValue ?? '—'}{selectedKpi.unit || ''}</b></div>
                    <div><span className="text-muted-foreground">Sentido:</span> <b>{selectedKpi.direction === 'LOWER_BETTER' ? 'Menor es mejor' : 'Mayor es mejor'}</b></div>
                    <div><span className="text-muted-foreground">Frecuencia:</span> <b>{selectedKpi.frequency || '—'}</b></div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Línea base (valor inicial)</Label>
                  <Input type="number" value={formData.baselineValue ?? ''} onChange={(e) => update('baselineValue', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Ej: 80" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Gauge className="w-4 h-4" /> Método de cálculo del progreso</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.progressMethod || 'MANUAL'}
                    onChange={(e) => update('progressMethod', e.target.value)}
                  >
                    {Object.entries(PROGRESS_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {formData.progressMethod === 'MANUAL' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Justificación del avance (obligatoria en modo manual)</Label>
                    <Input value={formData.lastProgressNote || ''} onChange={(e) => update('lastProgressNote', e.target.value)} placeholder="Fundamento del % de avance..." />
                  </div>
                )}
                {formData.progressMethod === 'KPI' && !formData.primaryIndicatorId && (
                  <p className="md:col-span-2 text-xs text-amber-600">Seleccioná un KPI para calcular el progreso automáticamente.</p>
                )}
                {formData.progressMethod === 'ACTIONS' && (
                  <p className="md:col-span-2 text-xs text-muted-foreground">El progreso se calculará según las actividades/hitos completados del objetivo.</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="owner" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Proceso responsable</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.processId || ''}
                    onChange={(e) => update('processId', e.target.value || undefined)}
                  >
                    <option value="">— Sin proceso —</option>
                    {processes.map((p) => (
                      <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2"><Layers className="w-4 h-4" /> Procesos involucrados</Label>
                  <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                    {processes.length === 0 && <p className="text-xs text-muted-foreground">No hay procesos en el Mapa de Procesos.</p>}
                    {processes.map((p) => {
                      const checked = (formData.involvedProcessIds || []).includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const cur = formData.involvedProcessIds || [];
                              update('involvedProcessIds', e.target.checked ? [...cur, p.id] : cur.filter((x) => x !== p.id));
                            }}
                          />
                          {p.code ? `[${p.code}] ` : ''}{p.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2"><UserCog className="w-4 h-4" /> Responsable funcional (puesto/rol)</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.responsiblePositionId || ''}
                    onChange={(e) => update('responsiblePositionId', e.target.value || undefined)}
                  >
                    <option value="">— Sin responsable funcional —</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">El objetivo conserva el responsable funcional aunque el usuario asignado cambie.</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Usuario asignado</Label>
                  <EmployeeCombobox
                    value={formData.owner || ''}
                    onChange={id => update('owner', id)}
                    placeholder="Buscar responsable..."
                    allowFreeText
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Responsable alternativo</Label>
                  <EmployeeCombobox
                    value={formData.responsible || ''}
                    onChange={id => update('responsible', id)}
                    placeholder="Buscar responsable alternativo..."
                    allowFreeText
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Sede</Label>
                  <Input value={formData.sede || ''} onChange={(e) => update('sede', e.target.value)} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="details" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Notas</Label>
                  <Input value={formData.notes || ''} onChange={(e) => update('notes', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Etiquetas</Label>
                  <Input value={formData.tags || ''} onChange={(e) => update('tags', e.target.value)} placeholder="Separadas por comas" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  /* ─── Detail Drawer / Dialog ─── */
  const DetailDialog = () => {
    if (!detailObjective) return null;
    const obj = detailObjective;
    return (
      <Dialog open={!!detailObjective} onOpenChange={() => setDetailObjective(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              {obj.code} — {obj.title}
            </DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="info">Información</TabsTrigger>
              <TabsTrigger value="activities">Actividades ({obj.activities?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="indicators">Indicadores ({obj.indicators?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="history">Seguimiento ({obj.progressLogs?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="links">Vínculos</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">Estado:</span> {renderStatusBadge(obj.status)}</div>
                <div><span className="font-medium">Progreso:</span> {obj.progress}%</div>
                <div><span className="font-medium">Norma:</span> {obj.standard || '—'}</div>
                <div><span className="font-medium">Tipo:</span> {obj.type || '—'}</div>
                <div><span className="font-medium">Meta:</span> {obj.target} {obj.targetValue ? `(${obj.targetValue}${obj.unit || ''})` : ''}</div>
                <div><span className="font-medium">Año:</span> {obj.year}</div>
                <div><span className="font-medium">Inicio:</span> {obj.startDate ? new Date(obj.startDate).toLocaleDateString() : '—'}</div>
                <div><span className="font-medium">Fin:</span> {obj.endDate ? new Date(obj.endDate).toLocaleDateString() : '—'}</div>
                <div><span className="font-medium">Política:</span> {obj.policy?.name || '—'}</div>
                <div><span className="font-medium">Proceso responsable:</span> {obj.process?.name || '—'}</div>
                <div><span className="font-medium">Responsable funcional:</span> {obj.responsiblePosition?.name || '—'}</div>
                <div><span className="font-medium">Método de progreso:</span> {PROGRESS_METHOD_LABELS[obj.progressMethod || 'MANUAL']}</div>
              </div>
              {obj.involvedProcessIds && obj.involvedProcessIds.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">Procesos involucrados:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {obj.involvedProcessIds.map((pid) => {
                      const p = processes.find((x) => x.id === pid);
                      return <span key={pid} className="px-2 py-0.5 rounded bg-gray-100 text-xs">{p ? (p.code ? `[${p.code}] ${p.name}` : p.name) : pid.slice(0, 8)}</span>;
                    })}
                  </div>
                </div>
              )}
              {obj.originType && obj.originType !== 'MANUAL' && (
                <div className="border rounded-lg p-4 bg-blue-50 space-y-1">
                  <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <GitBranch className="w-4 h-4" /> Trazabilidad Estratégica
                  </h4>
                  <div className="mt-2 flex flex-col gap-0.5 text-sm text-blue-700">
                    {obj.contextYear && (
                      <><span className="text-xs text-blue-500">Contexto SGI {obj.contextYear}</span><span className="text-xs text-blue-400">↓</span></>
                    )}
                    <span className="font-medium">{ORIGIN_TYPE_LABELS[obj.originType] || obj.originType}</span>
                    {obj.originId && (
                      <><span className="text-xs text-blue-400">↓</span><span>{obj.originId}</span></>
                    )}
                    <span className="text-xs text-blue-400">↓</span>
                    <span className="font-medium">Objetivo: {obj.title}</span>
                  </div>
                </div>
              )}
              {obj._assessment?.kpi && (
                <div className="border rounded-lg p-4 bg-indigo-50 space-y-2">
                  <h4 className="text-sm font-semibold text-indigo-800 flex items-center gap-2"><Link2 className="w-4 h-4" /> Indicador / KPI vinculado</h4>
                  <p className="text-sm font-medium">{obj.primaryIndicator?.name || '—'} {obj.primaryIndicator?.code ? `(${obj.primaryIndicator.code})` : ''}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Línea base:</span> <b>{obj._assessment.kpi.baseline ?? '—'}</b></div>
                    <div><span className="text-muted-foreground">Valor actual:</span> <b>{obj._assessment.kpi.value ?? '—'}{obj._assessment.kpi.unit || ''}</b></div>
                    <div><span className="text-muted-foreground">Meta:</span> <b>{obj._assessment.kpi.target ?? '—'}{obj._assessment.kpi.unit || ''}</b></div>
                    <div><span className="text-muted-foreground">Frecuencia:</span> <b>{obj._assessment.kpi.frequency || '—'}</b></div>
                  </div>
                </div>
              )}
              {obj._assessment && (obj._assessment.riskLevel !== 'NORMAL' || obj._assessment.isDelayed) && (
                <div className={`border rounded-lg p-4 space-y-2 ${obj._assessment.isDelayed ? 'bg-orange-50 border-orange-300' : (RISK_LEVEL_CONFIG[obj._assessment.riskLevel]?.color || '')}`}>
                  <h4 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {obj._assessment.isDelayed ? 'Objetivo retrasado' : `Estado de riesgo: ${RISK_LEVEL_CONFIG[obj._assessment.riskLevel]?.label}`}</h4>
                  <p className="text-sm">{obj._assessment.reason}</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Real:</span> <b>{obj._assessment.actualProgress}%</b></div>
                    <div><span className="text-muted-foreground">Esperado:</span> <b>{obj._assessment.expectedProgress ?? '—'}%</b></div>
                    <div><span className="text-muted-foreground">Desviación:</span> <b>{obj._assessment.deviation !== null && obj._assessment.deviation !== undefined ? `${obj._assessment.deviation > 0 ? '+' : ''}${obj._assessment.deviation} pp` : '—'}</b></div>
                  </div>
                </div>
              )}
              {obj.description && (
                <div className="text-sm">
                  <span className="font-medium">Descripción:</span>
                  <p className="mt-1 text-muted-foreground">{obj.description}</p>
                </div>
              )}
              {obj.notes && (
                <div className="text-sm">
                  <span className="font-medium">Notas:</span>
                  <p className="mt-1 text-muted-foreground">{obj.notes}</p>
                </div>
              )}
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full transition-all" style={{ width: `${Math.min(obj.progress ?? 0, 100)}%` }} />
              </div>
            </TabsContent>
            <TabsContent value="activities" className="py-4">
              {(obj.activities && obj.activities.length > 0) ? (
                <div className="space-y-2">
                  {obj.activities.map((a) => (
                    <Card key={a.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{a.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.startDate && new Date(a.startDate).toLocaleDateString()} — {a.endDate && new Date(a.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline">{ACTIVITY_STATUS_LABELS[a.status] || a.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin actividades registradas</p>
              )}
            </TabsContent>
            <TabsContent value="indicators" className="py-4">
              {(obj.indicators && obj.indicators.length > 0) ? (
                <div className="space-y-2">
                  {obj.indicators.map((ind) => (
                    <Card key={ind.id}>
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{ind.indicator?.name || `Indicador ${ind.indicatorId.slice(0, 8)}`}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin indicadores vinculados</p>
              )}
            </TabsContent>
            <TabsContent value="history" className="py-4">
              {(obj.progressLogs && obj.progressLogs.length > 0) ? (
                <div className="space-y-3">
                  {obj.progressLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                        <div className="flex-1 w-px bg-gray-200" />
                      </div>
                      <div className="flex-1 border rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {log.previousProgress !== null && log.previousProgress !== undefined ? `${log.previousProgress}% → ` : ''}{log.newProgress ?? '—'}%
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{PROGRESS_SOURCE_LABELS[log.source] || log.source}</span>
                        </div>
                        {(log.previousStatus || log.newStatus) && log.previousStatus !== log.newStatus && (
                          <p className="text-xs text-muted-foreground mt-1">Estado: {STATUS_LABELS[log.previousStatus || ''] || log.previousStatus || '—'} → {STATUS_LABELS[log.newStatus || ''] || log.newStatus || '—'}</p>
                        )}
                        {log.kpiValue !== null && log.kpiValue !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">Valor KPI: {log.kpiValue}</p>
                        )}
                        {log.justification && <p className="text-xs mt-1">{log.justification}</p>}
                        {log.evidenceUrl && (
                          <a href={log.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">{log.evidenceName || 'Ver evidencia'}</a>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">{log.userName || 'Sistema'} · {new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin historial de seguimiento</p>
              )}
            </TabsContent>
            <TabsContent value="links" className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Auditorías ({obj.audits?.length ?? 0})</h4>
                  {obj.audits && obj.audits.length > 0 ? obj.audits.map((a) => (
                    <div key={a.id} className="text-xs border rounded p-2 mb-1">{a.audit?.title || a.auditId}</div>
                  )) : <p className="text-xs text-muted-foreground">Sin auditorías</p>}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">CAPA ({obj.capas?.length ?? 0})</h4>
                  {obj.capas && obj.capas.length > 0 ? obj.capas.map((c) => (
                    <div key={c.id} className="text-xs border rounded p-2 mb-1">{c.capa?.title || c.capaId}</div>
                  )) : <p className="text-xs text-muted-foreground">Sin CAPA</p>}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Riesgos ({obj.risks?.length ?? 0})</h4>
                  {obj.risks && obj.risks.length > 0 ? obj.risks.map((r) => (
                    <div key={r.id} className="text-xs border rounded p-2 mb-1">{r.risk?.description || r.riskId}</div>
                  )) : <p className="text-xs text-muted-foreground">Sin riesgos</p>}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  };

  /* ─── Main Layout ─── */
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6" />
            Objetivos SGI 360 <PageTitleHelp moduleHref="/objetivos" />
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión integral de objetivos estratégicos — ISO 9001/14001/45001 §6.2
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo objetivo
        </Button>
      </div>

      {Dashboard()}
      {FiltersPanel()}
      {TableSection()}
      {FormDialog()}
      {DetailDialog()}
    </div>
  );
}
